# 3D Monopoly — Socket.IO Event Contract v1.0.0

**Status:** Implementation specification (not implemented by documentation alone)
**Transport:** Socket.IO namespace `/game` | room `match:<matchId>`
**Authoritative REST contract:** [API-CONTRACT.md](./API-CONTRACT.md)

## 1. Hard boundary: REST mutations, Socket notifications

Only REST endpoints change the match (dice, property, end turn, trade, auction, ready-state). **No** write-capable `game:roll_dice`, `game:buy_property`, `game:end_turn`, `game:action` or `player:ready` Socket.IO commands exist in v1. Historical examples proposing those commands are retired. Socket.IO is used to subscribe, receive broadcasts, observe connection status and obtain a snapshot after reconnection. Do not expose parallel REST and Socket command paths.

The client connects to `/game` with an access token via `auth: { token: accessToken }`, not a URL query or cookie-only auth. The server validates identity, membership and room authorization. Socket.IO reserved events: `connect`, `connect_error`, `disconnect`.

## 2. Event envelope and event ordering

All custom **match** notifications use:
```ts
interface MatchEvent<TPayload> {
  eventId: string;       // unique for deduplication
  matchId: string;       // opaque string
  stateVersion: number;  // committed match version
  occurredAt: string;    // UTC ISO 8601
  payload: TPayload;
}
```

One accepted REST command increases the version **once**; many events can share that version and have distinct event IDs. Event order within one command is determined by server-side `sequence` in durable `game_events`. Clients must deduplicate event IDs, reject older versions, and fetch `GET /api/v1/matches/:matchId` if a version gap appears. The snapshot is authoritative. Do not mutate server state in event listeners.

## 3. Allowed client-to-server events

| Event | Payload | Acknowledgement |
|---|---|---|
| `match:join` | `{matchId:string}` | `{ok:true,data:{subscribed:true}}`, then snapshot |
| `match:leave` | `{matchId:string}` | `{ok:true,data:{subscribed:false}}` |

On rejection: `{ok:false,error:{code,message,details:{}}}`. Lobby ready and lobby start requests are REST actions; `room:updated` is a server broadcast only. Match state-changing commands use REST with `clientActionId`, `expectedStateVersion`, `contentVersion`.

## 4. Server-to-client notifications

| Event | Payload | Trigger |
|---|---|---|
| `room:updated` | room snapshot | REST room changes |
| `match:started` | `{matchId,snapshot}` | successful REST room start |
| `match:snapshot` | complete authoritative MatchState | authorized join/recovery |
| `game:dice_rolled` | `{playerId,dice:[number,number],total,fromPosition,toPosition}` | successful REST roll |
| `game:player_moved` | `{playerId,fromPosition,toPosition}` | committed movement |
| `game:property_purchased` | `{playerId,spaceId,price,balance}` | purchase |
| `game:rent_paid` | `{payerPlayerId,ownerPlayerId,spaceId,amount}` | rent |
| `game:turn_changed` | `{currentPlayerId,turnPhase}` | turn changes |
| `game:auction_updated` | auction state | deferred |
| `game:trade_updated` | trade proposal state | deferred |
| `game:player_bankrupt` | player ID and placement | deferred |
| `game:finished` | winner and placements | end condition |
| `player:connection_changed` | `{playerId,connectionStatus,disconnectedAt}` | presence changes |
| `game:paused` | `{reason,pausedAt}` | grace timeout |
| `server_error` | `{code,message,details}` | recoverable protocol error |

Match-specific notifications use the standard `MatchEvent` envelope; `room:updated` and `server_error` are room/protocol messages and may use their explicitly documented payloads. No raw JWT, passwords or invite secrets in broadcasts.

## 5. Canonical roll sequence

1. Client sends **REST** `POST /api/v1/matches/:matchId/actions/roll-dice` with UUID `clientActionId`, integer `expectedStateVersion`, `contentVersion`.
2. Backend authenticates, authorizes turn/phase, deduplicates action ID, validates expected state version, generates dice and commits the state, idempotency record and `game_events` in a DB transaction.
3. Backend responds with `{data:{...,stateVersion},meta:{}}`. Broadcast `game:dice_rolled` and `game:player_moved` after commit (recovery via snapshots); clients animate the approved result.
4. If REST response is lost, resend **the same** `clientActionId` and identical payload; backend returns prior response, never rolls again.

## 6. Reconnect and safety

Disconnect does not forfeit a player. Authorized `match:join` after reconnection emits snapshot including stateVersion. Grace period is 120 seconds; after expiry match pauses, not forfeits. Persist enough data to enforce grace across backend restarts. Broadcast may be missed; GET snapshot reconciles. Rate-limit joins, enforce membership, validate payload size and avoid logging credentials. Local/AI mode must not rely on network events.
