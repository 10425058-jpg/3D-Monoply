# 3D Monopoly — Frontend / Backend Integration Plan v1.1.2

**Status:** Implementation proposal for review, not proof of running backend.
**Reference bundle (7 docs):** [API Contract](./API-CONTRACT.md), [Socket Events](./SOCKET-EVENTS.md), [Game State](./GAME-STATE.md), [Database Design](./DATABASE-DESIGN.md), [Online Rules](./ONLINE-MVP-RULES.md), this plan, and [Contract Review](./CONTRACT-CONSISTENCY-REVIEW.md).

## 1. Scope and ownership

Keep the current React/TypeScript/Vite/React Three Fiber frontend in repo root, preserving local/AI gameplay. Proposed NestJS + Prisma + PostgreSQL backend lives under `backend/`. Online mode is a separate server-state adapter with the deliberately simplified `mini-v1` ruleset on `central-castle@1`; do not claim this equals classic Monopoly. Only 2–4 humans, one match per room, no rematch in a CLOSED room. Advanced auction, trade, mortgage, building and manual debt mechanics are deferred from the online mode.

## 2. Authoritative decisions to implement together

| Concern | Single contract |
|---|---|
| Commands | REST `/api/v1` only for mutations; Socket.IO `/game` for authorized room/match subscriptions and committed notifications |
| Auth | 15-minute bearer JWT in memory; rotating <=7-day HttpOnly refresh cookie, CSRF token and Origin protection; reconnect Socket with refreshed JWT |
| Economy | TypeScript/JSON integer `number`, 0..2147483647; PostgreSQL `INTEGER CHECK(money >= 0)`; immediate bankruptcy on unaffordable obligations in mini-v1 |
| Match request | UUID `clientActionId`, `expectedStateVersion` and `contentVersion`; replay check **before** stale-version comparison |
| Snapshot | `MatchState.allowedActions` is **computed per authenticated viewer**; no storage, no global broadcast of another player's available actions |
| Card history | `MatchState.lastCardResolved` (nullable) persisted as `matches.last_card_resolved JSONB`, visible to reconnecting authorized players; future deck remains private |
| Chance Utility | 10× **the original two dice already rolled that turn** to land on Chance, not another roll; align with existing frontend `src/store/useGameStore.ts` |
| Turn counters | `turnNumber` starts 1 (started turn index), `completedTurns` starts 0 and increments at final completion/active bankruptcy; doubles extra rolls are the same turn |
| Seats and skins | Assign lowest free seatOrder 0–3 on room join; fixed server token/color pair per seat; freeze on match start, traverse ascending seatOrder |
| Lobby/room | Server emits room updates before match exists; `match:started` broadcasts ID/version only, then clients subscribe to get personalized snapshot |
| Presence | 120-second grace, host failover, eligible host-only overdue forfeit, resume when survivors connected, 24h all-offline auto-abandon |
| Terminal | Match FINISHED/ABANDONED closes room; results retained; no same-room rematch |
| Match ↔ room | Sole stored FK `matches.room_id UNIQUE`; `RoomState.matchId` is derived. **No `rooms.match_id` database column.** |
| Errors / API paths | Error codes from API-CONTRACT §6 (includes 3 lifecycle codes); `abandon` is `POST /matches/:matchId/actions/abandon` |

## 3. Delivery slices and acceptance criteria

| Priority | Backend | Frontend / contract test |
|---|---|---|
| P0 | NestJS app, health and Prisma migrations | Frontend build remains working; 503 when DB unavailable |
| P0 | Session/cookie/CSRF and auth endpoints | Register/login, refresh, logout, 15-min access expiry and socket reconnect |
| P0 | Room browse/create/join/ready/start and server seat allocation | 2 players see lobby change before match; stable token/color, unique seats |
| P0 | Authoritative MatchState with derived per-viewer allowedActions and card history | Two different viewers see their own action lists; no deck leak |
| P0 | Full `mini-v1` rules engine | All 40 spaces, 11 card action types, GO, Jail, doubles, rent, tax, insolvency and 80-turn finish |
| P0 | Versioned REST commands and durable processed_actions | Exactly once roll/buy under retries, including same-action replay with outdated version |
| P0 | Socket match state, host failover, pause/resume/abandon | Disconnected host recovery, explicit overdue forfeit, restart-safe 24h auto-abandon |
| P0 | Finish and terminal room close | match result persisted; RoomState derives matchId; closed rooms reject joining/ready/start |
| Later | Advanced classic rules and multiple maps | Separate ruleset/content version and migrations |

If the online P0 slice cannot pass a two-client end-to-end match within the remaining deadline, prioritize a stable, honestly labeled local/AI release rather than shipping incomplete multiplayer.

## 4. Development and verification

Root frontend: `npm install && npm run dev`. Proposed backend after creation: `cd backend && npm install && npm run start:dev`. Use dedicated branches/PRs, document backend env config and database migrations, never commit real secrets. An online adapter must not overwrite `src/store/useGameStore.ts` local/AI behavior.

Before release, execute—not merely describe—tests for: auth/CSRF rotation; two-room clients and room-start; seat assignment/reuse; personalized `allowedActions`; null/persisted last card; original dice reuse for Chance utility; turn counter boundaries; all 11 card actions; bankruptcy reason in socket payload; idempotency races; host reconnect/forfeit; all-offline 24-hour deadline after DB restart; `matches.room_id UNIQUE` and derived room matchId; POST `/actions/abandon`; terminal room closure; root build and local AI regression. All test failures block claims of a completed backend.

**Definition of done:** Feature-specific schema validation, Prisma migrations, executable tests, security review and reproducible setup pass. A docs-only PR does not establish runtime correctness.
