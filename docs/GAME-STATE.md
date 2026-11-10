# 3D Monopoly — Online Game State v1.1.2

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
  token: "rubber_duck"|"cat"|"racecar"|"yacht"; // seat-assigned game piece, NOT JWT
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
type ActionName = "roll-dice" | "buy-property" | "decline-property" | "end-turn" |
  "pay-jail-bail" | "use-jail-card" | "forfeit" | "forfeit-player" | "abandon";
interface LastCardResolved {
  cardId: string; deck: "chance" | "chest"; playerId: Id;
  effects: Array<{type:string; amount?:number; targetSpaceId?:number}>;
  stateVersion: number; resolvedAt: string; // UTC
}
interface MatchState {
  matchId:Id; roomId:Id;
  status:MatchStatus;
  mapId:"central-castle"; rulesetId:RulesetId; contentVersion:ContentVersion;
  players:PlayerState[]; properties:PropertyState[];
  currentPlayerId:Id|null;
  turnNumber:number; // 1-based started player-turn index
  completedTurns:number; // 0-based count of fully concluded player turns
  turnPhase:TurnPhase; dice:DiceState|null; doublesCount:number;
  pendingExtraRoll:boolean;
  pendingPurchaseSpaceId:number|null;
  lastCardResolved:LastCardResolved|null;
  allowedActions:ActionName[]; // computed for authenticated viewer, not stored or broadcast
  winnerPlayerId:Id|null;
  finishReason:"LAST_PLAYER"|"TURN_LIMIT"|null;
  stateVersion:number; pausedAt:string|null; pauseReason:string|null;
  allPlayersOfflineSince:string|null;
  startedAt:string; updatedAt:string;
}
interface RoomMember {
  userId:Id; username:string; avatarUrl:string|null;
  seatOrder:number; token:"rubber_duck"|"cat"|"racecar"|"yacht"; color:string;
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
| status, mapId, rulesetId, contentVersion, turn, completedTurns, dice, doublesCount, pendingExtraRoll, pendingPurchaseSpaceId, lastCardResolved, winner, pause and finish | `matches` |
| property owners and houses/mortgages (fixed values in mini-v1) | `property_ownerships` |
| secret card decks, shuffled draw order, cursor and returned cards | `match_decks` |
| `clientActionId` and original result | `processed_actions` |
| sequenced event logs | `game_events` |
| public roomRevision, membership, seatOrder, token/color and host | `rooms`, `room_members` |
| `allowedActions` (per-viewer projection) | **Not persisted**; server derives from authenticated viewer, `MatchState`, permissions and rules |

## 4. Viewer-specific actions, turn counters, seat and card rules

- `allowedActions` is derived for **each authenticated viewer** using the viewer's match player ID and the current phase, bankruptcy, jail status, pending purchase, host authority and pause eligibility. It is an array of REST action names (route suffixes such as `roll-dice`), not an authorization token: backend validates the action again. A non-current player may only have `forfeit` (and, if eligible connected host while PAUSED, `forfeit-player`/`abandon`). A terminal match returns `[]`. Do **not** persist it, return it in shared Socket broadcasts, or copy another viewer's list. Each `GET /matches/:matchId` and unicast `match:snapshot` is individually projected. Shared `match:started` and `game:resumed` notifications carry identifiers/version rather than a globally shared view.
- `lastCardResolved` is **null** until the first Chance or Chest card resolves. On each draw, server records the revealed card ID, deck, affected player, publicly visible effects, UTC resolution time and the committed stateVersion, atomically with deck/economy changes in `matches.last_card_resolved JSONB`. It is safe in the public match snapshot; never disclose the remaining shuffled deck order.
- `turnNumber` starts at **1** on the first player's `PRE_ROLL`; it counts the number of **started player turns**. `completedTurns` starts at **0** and increments once on each conclusively ended player turn (successful `end-turn`, active player bankruptcy or forfeit), never on doubles extra rolls or passive opponent forfeits. When the next player's turn actually begins, increment `turnNumber`. At terminal state it remains the number of the final started turn; no artificial next turn is created. For an active nonterminal turn, `turnNumber = completedTurns + 1`. A PAUSED match preserves both counters.
- Room join assigns the **lowest free seatOrder 0–3**, and a predefined unique token/color pair: seat 0 = `rubber_duck/#f59e0b`, seat 1 = `cat/#ec4899`, seat 2 = `racecar/#3b82f6`, seat 3 = `yacht/#10b981`. These match the current local game's default token identifiers. The room's member retains their seat unless they leave before start; released seats may be filled before start. After start, the order is frozen (no replacements), and turns traverse non-bankrupt match players by ascending seatOrder. No selectable token/color UI or client-provided cosmetic values in mini-v1. The host gets the first seat in a newly created room.

## 5. Version, event and action rules

Each successful state-changing REST action increments `stateVersion` exactly once; multiple game events may share that version but must have distinct `eventId` and ordered `sequence`. Room changes increment `roomRevision`, separate from match version. All mutating match calls carry UUID `clientActionId`, `expectedStateVersion` and `contentVersion`. Deduplicate existing action ID and return original response **before** checking expected version for a new action. New stale or incompatible commands fail with 409; refresh GET snapshot. Never send future deck order or secret invite codes in state.

## 6. Relationship to current local frontend

The existing Zustand `src/store/useGameStore.ts` uses numeric player IDs, client-side dice, local AI, full rules/extra UI phases and meta-progression. **Do not change those types to online schema in place.** Build an online adapter with server string IDs, authoritative snapshots and a separate UI presentation state; keep local mode working. Online `mini-v1` is intentionally different from local rules, so the UI must label the ruleset clearly.

## 7. Match and host lifecycle invariants

`RoomState.hostUserId` is authoritative while WAITING, IN_PROGRESS or PAUSED. After host absence >=120 seconds during a match, transfer to connected solvent participant with smallest seatOrder, including after a reconnect when there was no eligible candidate. Former host does not reclaim automatically. All remaining eligible players reconnecting resumes the original PAUSED turn, or connected host may forfeit an overdue absent opponent. `allPlayersOfflineSince` starts on last eligible player disconnection and clears on reconnection; 24 continuous hours all-offline causes ABANDONED. Terminal MatchState uses `currentPlayerId:null`, `turnPhase:"GAME_OVER"`, `allowedActions:[]` and parent `RoomState.status:"CLOSED"`. `RoomState.matchId` is a **derived value from unique `matches.room_id`**, not a stored `rooms.match_id`. Terminal room is read-only; no same-room rematch. `game:player_bankrupt` includes a mandatory reason and optional creditor.
