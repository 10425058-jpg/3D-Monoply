# 3D Monopoly — Online Game State v1.1.0

**Status:** Proposed canonical online types; not a checked-in shared TS implementation.
**Rules:** [ONLINE-MVP-RULES.md](./ONLINE-MVP-RULES.md) | **REST:** [API-CONTRACT.md](./API-CONTRACT.md) | **DB:** [DATABASE-DESIGN.md](./DATABASE-DESIGN.md)

## 1. Primitive and state invariants

IDs for user, room, match, player are opaque strings; `spaceId` numeric integer 0..39. All money is **nonnegative** integer TypeScript `number` with PostgreSQL `INTEGER` bounds [0,2147483647], not BigInt. Match states are `IN_PROGRESS`, `PAUSED`, `FINISHED`, `ABANDONED`. Turn phase is a committed decision (`PRE_ROLL`, `LANDED_ACTION`, `END_TURN`, `GAME_OVER`); animation phases `ROLLING`, `MOVING`, `CARD_DRAWN` are client-only for **mini-v1**. A PAUSED match retains the same turn phase, dice and current player; FINISHED and ABANDONED have `currentPlayerId:null`.

## 2. Types

```ts
type Id = string;
type Money = number; // runtime must validate Number.isSafeInteger && 0<=money<=2147483647
type RoomStatus = "WAITING" | "IN_PROGRESS" | "CLOSED";
type MatchStatus = "IN_PROGRESS" | "PAUSED" | "FINISHED" | "ABANDONED";
type TurnPhase = "PRE_ROLL" | "LANDED_ACTION" | "END_TURN" | "GAME_OVER";
type ConnectionStatus = "CONNECTED" | "DISCONNECTED";
type RulesetId = "mini-v1";
type ContentVersion = "central-castle@1";
interface PlayerState {
  playerId: Id; userId: Id; username: string; avatarUrl: string|null;
  token: string; // game piece identifier, NOT JWT
  color: string; seatOrder: number; position: number; money: Money;
  inJail: boolean; jailTurns: number; heldJailCardIds: string[];
  isBankrupt: boolean; connectionStatus: ConnectionStatus;
  disconnectedAt: string|null;
}
interface PropertyState {
  spaceId:number; ownerPlayerId:Id|null;
  houses:number; // zero in mini-v1
  isMortgaged:boolean; // false in mini-v1
}
interface DiceState { values:[number,number]; total:number; rolledByPlayerId:Id; }
interface MatchState {
  matchId:Id; roomId:Id;
  status:MatchStatus;
  mapId:"central-castle"; rulesetId:RulesetId; contentVersion:ContentVersion;
  players:PlayerState[]; properties:PropertyState[];
  currentPlayerId:Id|null; turnNumber:number; completedTurns:number;
  turnPhase:TurnPhase; dice:DiceState|null; doublesCount:number;
  pendingExtraRoll:boolean;
  pendingPurchaseSpaceId:number|null;
  winnerPlayerId:Id|null;
  finishReason:"LAST_PLAYER"|"TURN_LIMIT"|null;
  stateVersion:number; pausedAt:string|null; pauseReason:string|null;
  allPlayersOfflineSince:string|null;
  startedAt:string; updatedAt:string;
}
interface RoomMember {
  userId:Id; username:string; avatarUrl:string|null;
  isReady:boolean; isHost:boolean;
}
interface RoomState {
  roomId:Id; roomRevision:number; status:RoomStatus;
  hostUserId:Id; mapId:"central-castle";
  maxPlayers:number; isPrivate:boolean; members:RoomMember[];
  matchId:Id|null;
}
```

The server also persists **secret** deck order/cursor, card draw/return state and dice RNG results; these must **not** be included in public MatchState. Revealed card effects and held jail cards are public. For mini-v1 there are no auction/trade/debt pending objects; fields from older future-classic proposals are **not** part of this versioned mini-v1 state. If more mechanics are added, introduce explicit versioned state and persistence together.

## 3. Mapping to durable storage

| Public state | Storage |
|---|---|
| money, position, Jail, heldJailCardIds, bankruptcy, connections, disconnectedAt | `match_players` |
| status, mapId, rulesetId, contentVersion, turn, completedTurns, dice, doublesCount, pendingExtraRoll, pendingPurchaseSpaceId, winner, pause and finish | `matches` |
| property owners and houses/mortgages (fixed values in mini-v1) | `property_ownerships` |
| secret card decks, shuffled draw order, cursor and returned cards | `match_decks` |
| `clientActionId` and original result | `processed_actions` |
| sequenced event logs | `game_events` |
| public roomRevision, membership and host | `rooms`, `room_members` |

## 4. Version, event and action rules

Each successful state-changing REST action increments `stateVersion` exactly once; multiple game events may share that version but must have distinct `eventId` and ordered `sequence`. Room changes increment `roomRevision`, separate from match version. All mutating match calls carry UUID `clientActionId`, `expectedStateVersion` and `contentVersion`. Deduplicate existing action ID and return original response **before** checking expected version for a new action. New stale or incompatible commands fail with 409; refresh GET snapshot. Never send future deck order or secret invite codes in state.

## 5. Relationship to current local frontend

The existing Zustand `src/store/useGameStore.ts` uses numeric player IDs, client-side dice, local AI, full rules/extra UI phases and meta-progression. **Do not change those types to online schema in place.** Build an online adapter with server string IDs, authoritative snapshots and a separate UI presentation state; keep local mode working. Online `mini-v1` is intentionally different from local rules, so the UI must label the ruleset clearly.

## 6. Host and terminal lifecycle invariants (v1.1.1)

- `RoomState.hostUserId` remains authoritative during WAITING, IN_PROGRESS and PAUSED, not only during lobby. Host failover for an absent active-match host occurs after 120 seconds, to the **connected non-bankrupt participant with lowest seatOrder**; `isHost` mirrors this in RoomMember state. Former host never auto-regains authority.
- `MatchState` adds **`allPlayersOfflineSince: string | null`** (ISO UTC). This is set when the last non-bankrupt human disconnects, cleared on any eligible reconnection, and persists for the 24-hour no-eligible-player automatic ABANDONED safety deadline.
- A PAUSED match may resume when every remaining eligible player has reconnected **or** when a connected host forfeits overdue disconnected participants until all remaining players are connected. If only one remains, FINISHED takes precedence over resuming.
- A terminal MatchState has `currentPlayerId:null`, `turnPhase:"GAME_OVER"` and its parent RoomState has `status:"CLOSED"`. Terminal rooms retain `matchId` and final host/history but cannot be reused for rematches. Only a new room starts WAITING. If all eligible players are offline, no automatic abandonment occurs before 24 continuous hours.
- `game:player_bankrupt` may include reason `HOST_FORFEIT_ABSENT`; `stateVersion` advances for the committed forfeit, and `roomRevision` advances for host transfer/closure.
