# 3D Monopoly — Socket.IO Event Contract

**Status:** v1.0.0 implementation baseline  
**Transport:** Socket.IO  
**Namespace:** `/game` (proposed)  
**Authentication:** access token supplied in Socket.IO handshake auth  
**Room channel:** `match:<matchId>`

This document defines real-time events between the React frontend and NestJS backend. REST API definitions are in [API-CONTRACT.md](./API-CONTRACT.md).

## 1. Connection

Client connects to the backend Socket.IO namespace `/game` with:

```ts
io(`${API_ORIGIN}/game`, {
  auth: { token: accessToken },
  transports: ["websocket", "polling"]
});
```

The server validates the token during connection. Never put tokens in query strings or log them.

Connection lifecycle events:

| Event | Direction | Purpose |
|---|---|---|
| `connect` | Server → Client (Socket.IO reserved) | Connected |
| `connect_error` | Server → Client (reserved) | Connection/auth failure |
| `disconnect` | Server → Client (reserved) | Disconnected |
| `server_error` | Server → Client | Application-level error |

## 2. Event envelope

Every application event should include a match identifier and state version where applicable.

```ts
interface GameEvent<TPayload> {
  eventId: string;
  matchId: string;
  stateVersion: number;
  occurredAt: string; // ISO 8601 UTC
  payload: TPayload;
}
```

Gameplay-mutating commands are sent only over REST, not Socket.IO. The following interface is retained for historical context and MUST NOT be used for gameplay mutations:

```ts
interface ClientCommand<TPayload> {
  matchId: string;
  clientActionId: string; // UUID for idempotency
  payload: TPayload;
}
```

Use server acknowledgements for command acceptance/rejection. Do not assume that emitting an event means the command succeeded.

## 3. Client → Server events (v1 locked)

| Event | Payload | Notes |
|---|---|---|
| `match:join` | `{ matchId }` | Authorized subscribe; server sends snapshot |
| `match:leave` | `{ matchId }` | Unsubscribe; not a forfeit |

**No gameplay mutations over socket.** Lobby ready uses REST `PATCH /rooms/:roomId/ready`. Roll, purchase, trade, auctions and end turn use REST action endpoints. All events named `game:roll_dice`, `game:buy_property`, `game:end_turn`, `game:action` and `player:ready` are **not accepted as Socket.IO commands** in v1.

## 4. Server → Client events

| Event | Payload | When emitted |
|---|---|---|
| `room:updated` | Room snapshot | Member joins/leaves, ready state changes, host changes |
| `match:started` | Match ID + initial snapshot | Lobby transitions into a match |
| `match:snapshot` | Full authoritative match snapshot | Join/reconnect/recovery |
| `game:dice_rolled` | Player ID, dice, total, positions | Server accepted a dice roll |
| `game:player_moved` | Player ID, from/to positions | Movement is committed |
| `game:property_purchased` | Player ID, space ID, price, balance | Property purchase succeeds |
| `game:rent_paid` | Payer, owner, space, amount, balances | Rent is charged |
| `game:turn_changed` | Current player ID, turn phase | Turn changes |
| `game:auction_updated` | Auction state | Bid/pass/auction completion |
| `game:trade_updated` | Trade proposal state | Proposal/accept/reject |
| `game:player_bankrupt` | Player ID, final placement | Bankruptcy occurs |
| `game:finished` | Winner and final standings | Match ends |
| `player:connection_changed` | Player ID, connection status | Player disconnects/reconnects |
| `server_error` | Error code/message | Command rejected or server error |

## 5. Acknowledgement format

For a client command:

Success:

```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "stateVersion": 18
  }
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_YOUR_TURN",
    "message": "It is not your turn."
  }
}
```

## 6. Example: dice roll broadcast

1. Active player sends REST `POST /api/v1/matches/:matchId/actions/roll-dice` with unique `clientActionId` and `expectedStateVersion`.
2. Server authenticates the player, checks match membership, turn, phase, and idempotency.
3. Server generates dice and applies game rules.
4. Server persists the required state/event.
5. Server broadcasts `game:dice_rolled` and any resulting movement/landed-space events to `match:<matchId>`.
6. All clients animate the same server-approved result.
7. Clients update their authoritative game view using the event payload or a fresh snapshot.

The server must never accept dice values supplied by the client.

## 7. Reconnection and state recovery

- On reconnect, client re-authenticates and emits `match:join`.
- Server verifies membership and returns `match:snapshot`.
- Snapshot includes `stateVersion`.
- Client compares versions and replaces stale online game state with the snapshot.
- If an event has a version gap, request a fresh snapshot.
- Disconnection does not automatically mean the player forfeits. Grace period and timeout behavior are **Decision needed**.

## 8. Security and reliability

- Authorize every event against the authenticated user and match membership.
- Validate payload schemas and size limits.
- Rate-limit sensitive commands such as roll, bid, and trade.
- Use idempotency keys for state-changing commands.
- Do not broadcast private data (email, token, password, hidden server state).
- Do not rely on client timestamps or client-reported money/position.
- Do not broadcast an event until the corresponding state transition is accepted by the server.

## 9. v1 protocol lock

See [API-CONTRACT.md](./API-CONTRACT.md#contract-v100--locked-implementation-decisions-2026-11-10) for precedence. `game:dice_rolled` and other server broadcasts are notifications only. Custom broadcasts MUST carry `eventId`, `matchId`, `stateVersion`, `occurredAt`, and `payload`. In the first release, reconnect grace is 120 seconds; after that the match is paused, not forfeited. Acknowledgement shape in section 5 applies to the allowed socket subscription commands only. Gameplay actions use the REST response envelope.
