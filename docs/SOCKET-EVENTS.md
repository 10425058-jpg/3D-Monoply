# 3D Monopoly — Socket.IO Contract v1.1.0

**Status:** Proposed normative specification. Mutations occur **only via REST**, not Socket.IO. See [API-CONTRACT.md](./API-CONTRACT.md), [GAME-STATE.md](./GAME-STATE.md), [ONLINE-MVP-RULES.md](./ONLINE-MVP-RULES.md).

## 1. Connection, rooms and authorization

Connect to Socket.IO namespace `/game` with `auth:{token:accessToken}`, not query-string credentials. Each room and match is independently authorized on **every join**. A user may be subscribed to `room:<roomId>` in the lobby **before a match exists**. A match subscription uses `match:<matchId>` after it starts.

| Client → server event | Payload | Ack and effect |
|---|---|---|
| `room:join` | `{roomId:string}` | `{ok:true,data:{subscribed:true}}`; authorized user joins `room:<roomId>`, receives `room:snapshot` |
| `room:leave` | `{roomId:string}` | `{ok:true,data:{subscribed:false}}`; unsubscribe only; **does not leave the lobby** |
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
| `match:started` | `{matchId,snapshot:MatchState}` delivered to subscribed lobby users; then subscribe match channel |
| `match:snapshot` | full authorized MatchState on match join/recovery, without private deck order |
| `game:dice_rolled` | `{playerId,dice,total,fromPosition,toPosition}` |
| `game:player_moved` | `{playerId,fromPosition,toPosition}` |
| `game:property_purchased` | `{playerId,spaceId,price,balance}` |
| `game:rent_paid` | `{payerPlayerId,ownerPlayerId,spaceId,amount}` |
| `game:card_resolved` | `{playerId,cardId,deck,effects}` (only revealed card; no future deck order) |
| `game:jail_changed` | `{playerId,inJail,jailTurns}` |
| `game:player_bankrupt` | `{playerId,creditorPlayerId:null|string}` |
| `game:turn_changed` | `{currentPlayerId,turnPhase}` |
| `game:paused` | `{pausedAt,reason}` |
| `game:resumed` | `{snapshot:MatchState}` |
| `game:finished` | `{winnerPlayerId,finishReason,standings}` |
| `game:abandoned` | `{reason}` |
| `player:connection_changed` | `{playerId,connectionStatus,disconnectedAt}` |
| `server_error` | `{code,message,details}` (protocol-level; not action success) |

Only broadcast committed backend-approved results; include event envelope. A match may generate several events on one dice action including GO salary, card effect, rent or bankruptcy. All game mutations and explicit room ready/start occur via REST; the socket merely notifies subscribers.

## 4. Full lobby-to-game example

1. User logs in (receives access JWT, refresh cookie and csrf token). User creates or joins room with REST.
2. User sends `room:join {roomId}`; server authorizes membership then emits `room:snapshot`.
3. Another player joins/gets ready via REST → all subscribed players receive `room:updated`.
4. Host uses REST `POST /rooms/:roomId/start`. Room subscribers receive `match:started {matchId,snapshot}` **even if they have no match subscription yet**.
5. Each player emits `match:join {matchId}`; server returns match snapshot. Player rolls by REST; receives action response; server broadcasts sequenced events; clients animate and reconcile state.

## 5. Refresh, disconnection, resume

Access JWT expires in 15 minutes. Before/after expiry, client refreshes with HTTP-only refresh cookie and CSRF header (see API-CONTRACT), then **reconnects** Socket.IO with the new JWT, re-subscribes to authorized room/match and obtains snapshots. On 401/refresh failure, require login, not automatic match forfeit. Do not rely on an old socket handshake token beyond expiry; server may disconnect expired sockets and must validate on join.

Track each player's last active authenticated socket connection across tabs; only mark DISCONNECTED after all their match sockets are gone. 120-second grace starts on disconnect. Active player disconnect blocks their turn; after grace server marks PAUSED and broadcasts `game:paused`. When **all remaining solvent players** rejoin, server atomically restores IN_PROGRESS and broadcasts `game:resumed` with snapshot. If not all reconnect, the connected current host may explicitly forfeit overdue disconnected participants or abandon via REST; host failover and 24-hour all-offline auto-abandon are defined in §7. Never automatically bankrupt disconnected player. Reconnect snapshots, not event retransmission, are the recovery source.

## 6. Security

Authorize room/match events and channel membership, validate payload size, rate-limit joins, never log tokens or invite codes, never broadcast private deck order, account email or hashed credentials. Socket notifications don't confer action authority. The client must not send dice or money updates.

## 7. Host failover and room closure notifications (v1.1.1)

This section supersedes the earlier shorthand "host may abandon if not all reconnect" wherever that could imply an absent host can act. In an IN_PROGRESS/PAUSED room whose host is absent for more than 120 seconds, backend reassigns host to the **connected, non-bankrupt lowest-seat participant**, atomically updating room state. Existing host role persists if no connected eligible player remains until reconnect triggers election. Server broadcasts `room:host_changed` payload `{roomId,previousHostUserId,newHostUserId,roomRevision}` and `room:updated` to authenticated `room:<roomId>` subscribers. Client updates host controls from the new authoritative RoomState.

While PAUSED, host may use **REST** `POST /matches/:matchId/actions/forfeit-player` to eliminate a participant continuously disconnected for >=120 seconds; it is not a socket command. Backend broadcasts `game:player_bankrupt` with reason `HOST_FORFEIT_ABSENT`, and either `game:resumed` if remaining participants are connected, or `game:finished` if one remains. Regular player `forfeit` and host REST `/matches/:matchId/abandon` retain their own authorization.

If nobody eligible is connected continuously for 24h, backend emits `game:abandoned` upon automatic abandonment; there may be no active subscribers, so GET snapshot is the recovery path. `game:finished` and `game:abandoned` result in server `room:updated` with `status:CLOSED`. The room is read-only thereafter; there is no `room:rematch` event in mini-v1. All events use existing envelopes and match/room version rules.
