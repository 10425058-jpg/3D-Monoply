# 3D Monopoly — Cross-Document Contract Consistency Review v1.1.2

**Scope:** Exactly seven contract documents: API-CONTRACT, SOCKET-EVENTS, GAME-STATE, DATABASE-DESIGN, ONLINE-MVP-RULES, INTEGRATION-PLAN, and this review. **Documentation audit only; no actual backend implementation, Prisma migration, E2E run or build verification.**

## 1. Resolved findings (canonical definitions, not later overrides)

| Finding | Resolution | Source of truth |
|---|---|---|
| Lobby unreachable before match | Socket `room:join` / `room:snapshot`, `room:updated` and `match:started` prior to `match:join` | Socket §1–4 |
| PAUSED match deadlock / absent host | 120s grace, connected eligible host failover, overdue host-forfeit, automatic resume when all survivors connected, 24h all-offline ABANDONED | API §5, Socket §5/7, Rules §8, DB §6 |
| Room after terminal match | FINISHED/ABANDONED sets CLOSED, results read-only; next game requires new room | API §5, State §7, DB §6 |
| Full gameplay holes | Explicit simplified `mini-v1` supports all board types and **11 supported card action types**, jail, doubles, bankruptcy, GO, rent, tax and deterministic finish | Online Rules §§1–7 |
| `MatchState.allowedActions` omitted | Server computes per authenticated requesting viewer, not persisted; returned by personalized REST GET and unicast match:snapshot, never broadcast globally | State §§2/4, API §4, Socket §§3/7, Integration §2 |
| Last card resolved omitted | Public `lastCardResolved:LastCardResolved|null` with card/deck/player/effects/version/timestamp; stored `matches.last_card_resolved JSONB` | State §§2–4, DB §2, Rules §4, Socket §3 |
| Card action count | **11**, matching `src/types/game.ts` and `src/data/cardsData.ts` | Rules §4 |
| Chance nearest utility rent ambiguity | **10 × dice values of the original roll that landed on Chance**, no second roll; matches local code `state.dice[0]+state.dice[1]` | Rules §4; local `src/store/useGameStore.ts` |
| Turn counter ambiguity | turnNumber starts at 1 and counts started player turns; completedTurns starts 0 and counts completed turns; doubles do not increment | State §4, Rules §1, DB §2 |
| Seat/token/color selection | Stable lowest-free seatOrder 0..3 assigned on joining; fixed unique seat palette based on current local defaults, freeze after start | State §§2/4; API §3; DB §2 |
| Missing error codes | `PLAYER_NOT_ELIGIBLE_FOR_FORFEIT`, `ROOM_CLOSED`, `MATCH_ALREADY_TERMINAL` now in main HTTP 409 table | API §6 |
| Bankruptcy socket reason missing | Mandatory reason enum, including `HOST_FORFEIT_ABSENT`; optional `creditorPlayerId` | Socket §3 |
| Two-way room ↔ match FK ambiguity | Only **`matches.room_id UUID UNIQUE`** persisted; derive public `RoomState.matchId` by lookup. No `rooms.match_id` | DB §§2/6; State §7 |
| Abandon path inconsistent | `POST /api/v1/matches/:matchId/actions/abandon` (standard action body and idempotency) | API §§4/5 |
| Duplicated lifecycle appendices | Consolidated lifecycle and role rules into core API §5, Socket §7, State §7, DB §6, Rules §8; removed text claiming later sections supersede older text | All 7 docs |

## 2. Final small clarifications

| Finding | Resolution | References |
|---|---|---|
| Room leave after match starts | REST `POST /rooms/:roomId/leave` is WAITING-only; 409 `ROOM_ALREADY_STARTED` during a match; `actions/forfeit` is the gameplay exit; CLOSED rooms return 409 `ROOM_CLOSED`. Socket `room:leave` only unsubscribes. | API §3; Rules §8; Socket §1; Integration §2 |
| Nearest Utility Markdown | Replaced invalid nested `**` markers with one unambiguous bold expression; original turn's `DiceState.total` is used without reroll. | Rules §4 |

## 2. Previously agreed essentials also preserved

- REST for all mutations; Socket.IO subscriptions and broadcasts only. One shared `{data,meta}` success envelope; `{error:{code,message,details}}` on errors.
- JWT access in memory, rotating HttpOnly refresh cookie, CSRF and Origin validation. Private room code returned once to host; hash only in DB.
- Money is a nonnegative TypeScript/JSON integer `number`, stored PostgreSQL `INTEGER CHECK(money >= 0)`.
- `processed_actions` with unique `(match_id,client_action_id)` and replay check **before** version conflict. One stateVersion per committed mutation; events may share a version.
- Human-only mini-v1, one map `central-castle@1`, no online builds/trades/auctions or server AI.

## 3. Required executable tests (not run)

Also test WAITING `POST /rooms/:roomId/leave` success vs IN_PROGRESS/PAUSED `ROOM_ALREADY_STARTED` and CLOSED `ROOM_CLOSED`, and verify Socket.IO `room:leave` never changes membership or game status.

1. GET and unicast match snapshot differ in `allowedActions` between current player, opponent, host and terminal viewer; global events leak no viewer action list.
2. Two players draw different Chance/Chest cards; `last_card_resolved` updates exactly once per committed resolution and survives reconnect and server restart, while secret deck order never leaks.
3. Card action count 11; Chance nearest utility uses exactly the initiating turn's saved `DiceState.total`, not fresh randomness.
4. turnNumber/completedTurns remain consistent across doubles, purchase/decline, normal end turn, active bankruptcy/forfeit and 80-turn finish.
5. Server assigns seatOrder, token and color; duplicate seat prevented; vacancy is reused before start and not after.
6. All error codes, including three newly added 409 lifecycle errors, match their intended HTTP status; end points use the same `/actions/` family.
7. Room is linked to a match only through `matches.room_id`; DB unique constraint allows one match per room, snapshots project match ID.
8. Host absence, host transfer, disconnected-player forfeit, exact resume and 24h offline terminal across backend restart; closed room cannot be reopened.

**Audit honesty:** These are documentation consistency decisions and test specifications, not proof that a real backend or playable multiplayer match exists. Validate everything in code before merge/release.
