# 3D Monopoly — Game State Contract v1.0.0

**Status:** Canonical public online schema proposal; not an implemented shared package
**REST:** [API-CONTRACT.md](./API-CONTRACT.md) | **Persistence:** [DATABASE-DESIGN.md](./DATABASE-DESIGN.md)

## 1. Type guarantees

Use JSON `number` / TypeScript `number` **only for integers**. **Money must be an integer within PostgreSQL INTEGER range [-2147483648,2147483647]**; runtime validation must check `Number.isSafeInteger` and bounds. PostgreSQL `INTEGER` is the canonical money storage type. No `BIGINT` for money, coins, experience or action version in the v1 MVP (schema and TypeScript types must agree). IDs: opaque string for user/room/match/match player; number (integer 0–39) for board `spaceId`. Time: UTC ISO 8601 string.

Game truth lives on server; UI state such as camera, quality, hover, selection, modal, animation and local sound settings stays in frontend. Local Zustand types may be mapped to online types via adapter; do not replace local/AI logic.

## 2. Canonical types

```ts
type Id = string;
type Money = number; // integer, PostgreSQL INTEGER range; runtime-validated
type RoomStatus = "WAITING" | "IN_PROGRESS" | "CLOSED";
type MatchStatus = "IN_PROGRESS" | "PAUSED" | "FINISHED" | "ABANDONED";
type TurnPhase =
  | "PRE_ROLL" | "ROLLING" | "MOVING" | "LANDED_ACTION"
  | "CARD_DRAWN" | "DEBT_RESOLUTION" | "END_TURN" | "GAME_OVER";
type PlayerConnectionStatus = "CONNECTED" | "DISCONNECTED";

interface PlayerState {
  playerId: Id;
  userId: Id; // required for v1 human-only online matches
  username: string;
  avatarUrl: string | null;
  token: string; // game piece/skin identifier, never an auth token
  color: string;
  position: number; // board space 0..39
  money: Money;
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  seatOrder: number;
  connectionStatus: PlayerConnectionStatus;
  disconnectedAt: string | null;
}
interface PropertyState {
  spaceId: number;
  ownerPlayerId: Id | null;
  houses: number;
  isMortgaged: boolean;
}
interface DiceState {
  values: [number, number];
  total: number;
  rolledByPlayerId: Id;
}
interface AuctionState {
  auctionId: Id;
  spaceId: number;
  currentBid: Money;
  highestBidderPlayerId: Id | null;
  activePlayerIds: Id[];
  status: "OPEN" | "CLOSED";
}
interface TradeState {
  tradeId: Id;
  fromPlayerId: Id;
  toPlayerId: Id;
  offerCash: Money;
  requestCash: Money;
  offerPropertyIds: number[];
  requestPropertyIds: number[];
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
}
interface PendingDebtState {
  debtorPlayerId: Id;
  creditorPlayerId: Id | null; // null = bank
  amount: Money;
  reason: string;
}
interface MatchState {
  matchId: Id;
  roomId: Id;
  status: MatchStatus;
  mapId: "central-castle";
  rulesetId: "classic-v1";
  contentVersion: "central-castle@1";
  players: PlayerState[];
  properties: PropertyState[];
  currentPlayerId: Id;
  turnNumber: number;
  turnPhase: TurnPhase;
  dice: DiceState | null;
  doublesCount: number;
  auction: AuctionState | null;
  pendingTrade: TradeState | null;
  pendingDebt: PendingDebtState | null;
  winnerPlayerId: Id | null;
  stateVersion: number;
  pausedAt: string | null;
  pauseReason: string | null;
  startedAt: string;
  updatedAt: string;
}
interface RoomMember {
  userId: Id;
  username: string;
  avatarUrl: string | null;
  isReady: boolean;
  isHost: boolean;
}
interface RoomState {
  roomId: Id;
  status: RoomStatus;
  hostUserId: Id;
  mapId: "central-castle";
  maxPlayers: number; // 2..4
  isPrivate: boolean;
  members: RoomMember[];
  matchId: Id | null;
}
```

## 3. Matching persistence locations

| GameState field | PostgreSQL location | Why |
|---|---|---|
| money, position, jail, bankrupt, seat order | `match_players` | player truth |
| connectionStatus, disconnectedAt | `match_players.connection_status`, `disconnected_at` | reconnect after restart |
| mapId, rulesetId, contentVersion, phase, dice, doublesCount, winner, turn, pause | `matches` | match truth |
| ownership, houses, mortgage | `property_ownerships` | property truth |
| auction, pendingTrade, pendingDebt | `matches.auction_state`, `pending_trade_state`, `pending_debt_state` JSONB | optional transient phase state, nullable; rule validation required |
| action request IDs / original responses | `processed_actions` | idempotency after retries/restarts |
| all committed events / sequence | `game_events` | ordered audit / replay metadata |

Persist snapshot-affecting transient fields **transactionally** before broadcasting. Storing JSONB does not mean a deferred gameplay feature is launch-ready.

## 4. Existing frontend model mapping

| Local store | Online contract |
|---|---|
| numeric `Player.id` | opaque `playerId` and `userId` |
| `Player.name` | `username` |
| `PropertyState.ownerId` | `ownerPlayerId` |
| `currentPlayerIndex` | `currentPlayerId` |
| local dice/randomness | server `DiceState` |
| auction/trade/debt local objects | canonical server state above once supported |

Content: server owns `central-castle@1` and numeric space IDs 0..39. Frontend may render its art/map variations but cannot change authoritative prices, rules or rewards.

## 5. Versioning and invariants

Each **accepted state-changing command increments `stateVersion` exactly once**, not once per event. Multiple events may share version and carry unique event IDs/ordered `game_events.sequence`. Every client mutation requires UUID `clientActionId`, `expectedStateVersion` and `contentVersion`; identical retries return the original result, different payload with same ID is rejected. Only active player may take turn actions; server computes dice, money transfers and rents, validates budgets, ownership and phase, and commits atomically. On reconnect/missed event clients fetch snapshot; 120 seconds after disconnect match becomes PAUSED, not auto-forfeited.

## 6. Launch constraints

Online release uses 2–4 humans; server AI, progression, advanced auctions/trades, builds, jail/card/debt/bankruptcy are deferred pending separately defined rule and payload tests. The schema contains nullable states to support those features later without inventing already working implementations.
