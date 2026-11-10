# 3D Monopoly — Socket.IO Contract v1.1.2

**Status:** Proposed normative specification. Mutations occur **only via REST**, not Socket.IO. See [API-CONTRACT.md](./API-CONTRACT.md), [GAME-STATE.md](./GAME-STATE.md), [ONLINE-MVP-RULES.md](./ONLINE-MVP-RULES.md).

## 1. Connection, rooms and authorization

Connect to Socket.IO namespace `/game` with `auth:{token:accessToken}`, not query-string credentials. Each room and match is independently authorized on **every join**. A user may be subscribed to `room:<roomId>` in the lobby **before a match exists**. A match subscription uses `match:<matchId>` after it starts.

| Client → server event | Payload | Ack and effect |
|---|---|---|
| `room:join` | `{roomId:string}` | `{ok:true,data:{subscribed:true}}`; authorized user joins `room:<roomId>`, receives `room:snapshot` |
| `room:leave` | `{roomId:string}` | `{ok:true,data:{subscribed:false}}`; unsubscribe from Socket.IO notifications only, **never changes REST room membership or forfeits a match**, including during IN_PROGRESS/PAUSED |
| `match:join` | `{matchId:string}` | authorized match participant joins `match:<matchId>` and receives `match:snapshot` |
| `match:leave` | `{matchId:string}` | unsubscribe only, does not forfeit |

Invalid payload/auth/membership ack: `{ok:false,error:{code,message,details:{}}}`. Socket.IO `connect`, `disconnect`, `connect_error` are reserved. **Never** implement `game:roll_dice`, `game:end_turn`, `game:buy_property`, generic `game:action` or `player:ready` as gameplay-changing socket handlers. Lobby ready uses `PATCH /api/v1/rooms/:roomId/ready`.

## 2. Event envelopes and clients

```ts
type EventEnvelope<T> = {
  eventId: string;     // stable unique id
  occurredAt: string;  // UTC ISO
  payload: T;
  roomId?: string;     // required for room:* messages
  matchId?: string;    // required for match:* / game:* messages
  stateVersion?: number; // required for match/game snapshots and updates
  sequence?: number;     // per-match ordered game_event sequence when emitted
}
```

For lobby messages `roomId` is required and `roomRevision` is included inside the room payload; client replaces old lobby snapshots with newer revision. For match messages `matchId` and `stateVersion` are required, with `sequence` for sequenced committed gameplay events. A REST command increments stateVersion **once**, but may emit **several** events at the same version, ordered by sequence; client deduplicates eventId, checks sequence gaps and fetches a fresh REST snapshot if uncertain. A snapshot is authoritative; do not treat movement animation frames as committed state.

## 3. Server → client events

| Name | Payload / purpose |
|---|---|
| `room:snapshot` | authorized room's full RoomState; initial lobby subscribe |
| `room:updated` | updated RoomState after REST join/leave/ready/host change and terminal closure |
| `room:host_changed` | `{roomId,previousHostUserId,newHostUserId,roomRevision}` on room host failover |
| `match:started` | `{matchId,stateVersion}` delivered to subscribed lobby users; then subscribe match channel for a private viewer-specific snapshot |
| `match:snapshot` | **unicast** authenticated viewer-specific MatchState on join/recovery, including that viewer's `allowedActions`, excluding private future deck order |
| `game:dice_rolled` | `{playerId,dice,total,fromPosition,toPosition}` |
| `game:player_moved` | `{playerId,fromPosition,toPosition}` |
| `game:property_purchased` | `{playerId,spaceId,price,balance}` |
| `game:rent_paid` | `{payerPlayerId,ownerPlayerId,spaceId,amount}` |
| `game:card_resolved` | `{playerId,cardId,deck,effects,resolvedAt}` (only revealed card, matches persisted `lastCardResolved`; no future deck order) |
| `game:jail_changed` | `{playerId,inJail,jailTurns}` |
| `game:player_bankrupt` | `{playerId,creditorPlayerId:null|string,reason:"INSOLVENT_TO_BANK"|"INSOLVENT_TO_PLAYER"|"VOLUNTARY_FORFEIT"|"HOST_FORFEIT_ABSENT"}`; reason required |
| `game:turn_changed` | `{currentPlayerId,turnPhase}` |
| `game:paused` | `{pausedAt,reason}` |
| `game:resumed` | `{matchId,stateVersion}` broadcast; each client fetches personalized snapshot |
| `game:finished` | `{winnerPlayerId,finishReason,standings}` |
| `game:abandoned` | `{reason}` |
| `player:connection_changed` | `{playerId,connectionStatus,disconnectedAt}` |
| `server_error` | `{code,message,details}` (protocol-level; not action success) |

Only broadcast committed backend-approved results; include event envelope. A match may generate several events on one dice action including GO salary, card effect, rent or bankruptcy. All game mutations and explicit room ready/start occur via REST; the socket merely notifies subscribers.

## 4. Full lobby-to-game example

1. User logs in (receives access JWT, refresh cookie and csrf token). User creates or joins room with REST.
2. User sends `room:join {roomId}`; server authorizes membership then emits `room:snapshot`.
3. Another player joins/gets ready via REST → all subscribed players receive `room:updated`.
4. Host uses REST `POST /rooms/:roomId/start`. Room subscribers receive `match:started {matchId,stateVersion}` **even if they have no match subscription yet**; then subscribe to get the individually authorized MatchState.
5. Each player emits `match:join {matchId}`; server returns match snapshot. Player rolls by REST; receives action response; server broadcasts sequenced events; clients animate and reconcile state.

## 5. Refresh, disconnection, resume

Access JWT expires in 15 minutes. Before/after expiry, client refreshes with HTTP-only refresh cookie and CSRF header (see API-CONTRACT), then **reconnects** Socket.IO with the new JWT, re-subscribes to authorized room/match and obtains snapshots. On 401/refresh failure, require login, not automatic match forfeit. Do not rely on an old socket handshake token beyond expiry; server may disconnect expired sockets and must validate on join.

Track each player's last active authenticated socket connection across tabs; only mark DISCONNECTED after all their match sockets are gone. 120-second grace starts on disconnect. Active player disconnect blocks their turn; after grace server marks PAUSED and broadcasts `game:paused`. When **all remaining solvent players** rejoin, server atomically restores IN_PROGRESS and broadcasts `game:resumed` with match ID/version; each participant fetches an authorized personalized snapshot. If not all reconnect, the connected current host may explicitly forfeit overdue disconnected participants or abandon via REST; host failover and 24-hour all-offline auto-abandon are defined in §7. Never automatically bankrupt disconnected player. Reconnect snapshots, not event retransmission, are the recovery source.

## 6. Security

Authorize room/match events and channel membership, validate payload size, rate-limit joins, never log tokens or invite codes, never broadcast private deck order, account email or hashed credentials. Socket notifications don't confer action authority. The client must not send dice or money updates.

## 7. Host failover, terminal room and viewer-safe snapshots

During IN_PROGRESS/PAUSED when the room host stays offline for >=120 seconds, the server transfers host authority to the connected, solvent participant with lowest seatOrder. It atomically increments roomRevision and sends `room:host_changed {roomId,previousHostUserId,newHostUserId,roomRevision}` and `room:updated` to authenticated lobby subscribers. The returning former host does not reclaim the role.

A connected current host may invoke **REST** `POST /matches/:matchId/actions/forfeit-player` while PAUSED against a continuously disconnected other player beyond 120 seconds; the resulting `game:player_bankrupt` event includes the **mandatory** `reason:"HOST_FORFEIT_ABSENT"`. When all surviving players are connected, a game may resume, otherwise remain paused; the 24-hour all-offline deadline may auto-abandon. `game:finished` or `game:abandoned` closes its room and triggers `room:updated` with `status:CLOSED`; there is no same-room rematch.

**Viewer privacy:** `allowedActions` depends on authenticated viewer and must **never** be sent inside a global `game:resumed` or `match:started` broadcast. Use `match:snapshot` unicast on authorized subscription and authenticated `GET /matches/:matchId` for a per-viewer projection. `room:snapshot` and `room:updated` have a common room view with server-assigned member seatOrder, token and color.

**Event/DB correspondence:** after revealing a card, backend persists `matches.last_card_resolved` and emits the same public effect in `game:card_resolved`; a reconnect snapshot exposes the last card but never the private future deck.
