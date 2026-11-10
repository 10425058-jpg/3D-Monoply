# 3D Monopoly — Frontend / Backend Integration Plan v1.1.0

**Status:** Proposed implementation plan, not proof of running backend.
**Normative docs:** [API-CONTRACT.md](./API-CONTRACT.md), [SOCKET-EVENTS.md](./SOCKET-EVENTS.md), [GAME-STATE.md](./GAME-STATE.md), [DATABASE-DESIGN.md](./DATABASE-DESIGN.md), [ONLINE-MVP-RULES.md](./ONLINE-MVP-RULES.md). [CONTRACT-CONSISTENCY-REVIEW.md](./CONTRACT-CONSISTENCY-REVIEW.md) tracks validations. **Six documents are reviewed together** (five contracts/plans + review; the new online rules document means **seven** documents in total).

## 1. Scope and repo boundaries

Keep current React/TypeScript/Vite/R3F frontend in root, keep its local/AI game functional, add NestJS + Prisma + PostgreSQL in `backend/`. No wholesale Zustand refactor; online mode is a separate server-state adapter. Use online ruleset **mini-v1** on `central-castle@1`, **not classic-v1**. Local game may retain richer rules; UI must identify mode. Preserve player visual polish and deliver stable game rules before optional animations.

## 2. Team-agreed API choices

- REST `/api/v1` is the **only** gameplay/lobby mutation transport. Socket.IO is for `room:join/leave` and `match:join/leave` subscriptions, event broadcasts and snapshots.
- Money: JSON/TS safe integer `number` within [0,2147483647], DB `INTEGER CHECK(money >= 0)`; immediate bankruptcy on unaffordable obligations.
- JWT access: 15 minutes, in memory. Login/register set 7-day max rotating HttpOnly refresh cookie plus return an in-memory CSRF token; credentialed refresh rotates both; `GET /auth/csrf` bootstrap after page reload. Socket reconnect uses freshly refreshed JWT and re-subscribes.
- Private rooms return raw code once on creation and allow host rotation, DB stores only hash. Authenticated GET /rooms browses public waiting rooms.
- 120-second disconnect grace, PAUSED on timeout, resume when all remaining solvent players reconnect; otherwise authorized host can abandon. No timeout auto-bankruptcy/forfeit.
- All actions: UUID clientActionId, expectedStateVersion, contentVersion. Idempotency lookup **before** state-version check; transaction writes state/action result/events.
- Match turn rules: full mini-v1 coverage for Chance/Chest, Jail, GO, doubles, rent, taxes, bankruptcy, and deterministic terminal condition at last solvent player or 80 completed turns. No exposed auctions, trades, builds, mortgages or manual debt actions in this simplified online ruleset.
- Ended/abandoned match has null currentPlayerId; active/paused match has non-null currentPlayerId; secrets such as deck order never in snapshots.

## 3. Build and deliver in vertical slices

| Priority | Backend | Frontend | Acceptance criteria |
|---|---|---|---|
| P0 | NestJS health, DB, Prisma migrations | Preserve root build and local mode | GET /health: 200 with DB, 503 on DB outage |
| P0 | Register/login/refresh/CSRF/logout | Typed auth client | Login sets cookie + csrf; 15-minute expiry renewal |
| P0 | Room CRUD, private codes, public browsing, Socket room channel | Lobby list / ready / host / copy code | 2 users see ready changes before match exists |
| P0 | Match snapshot and rules engine for mini-v1 | Online state adapter | All 40 spaces and every card action covered |
| P0 | Actions, durable idempotency, version conflicts, deck state | Roll/buy/decline/end/jail/forfeit controls | Duplicate roll never executes twice |
| P0 | Socket match channel, presence, pause/resume/abandon | Animate committed events and recover snapshots | Drop/reconnect including mid-game token expiry |
| P0 | Finish and bankruptcy | Game-over UI | Last solvent or 80 turns finishes deterministically |
| P1 | Lobby search filters, advanced telemetry | Additional polish | Optional if time remains |
| Later | Full classic-v1 features | Classic UI options | Separate contract and tests |

Do not claim online multiplayer works until the complete P0 slice passes two-account browser E2E. If resources cannot support core game rule coverage inside 21 days, ship an honest polished local/AI game instead of an incomplete multiplayer mode.

## 4. Development invariants

- Each REST command must have executable schema validation; backend decides all economy, randomness and board/card effects; errors use one JSON envelope and stable code.
- Both REST room state and Socket room broadcasts are authorized: users waiting in lobby join `room:<roomId>` before any match exists.
- Auth middleware must protect endpoints and sockets; refresh uses cookie + CSRF + origin, and socket JWT refresh/reconnect with snapshots.
- Match cards and dice require durable state; no client-provided dice or future deck order. UI must disable unsupported `mini-v1` actions.
- Money, IDs, phase, nullable fields, roomRevision and stateVersion must correspond to DB columns.
- Always use short feature branches and PR review; do not modify root frontend unnecessarily for backend scaffolding.

## 5. Implementation and verification workflow

Run root frontend `npm install && npm run dev`; backend once created `cd backend && npm install && npm run start:dev`. Do not commit real .env. Include backend .env.example, DB setup/migration instructions, test scripts, and deployment cookie/cors origin notes.

Mandatory test groups:
1. Auth registration/login sets refresh+CSRF, refresh rotates, logout revokes; reloaded client bootstraps CSRF; expired socket reconnects with new JWT.
2. Public room discovery and private code creation, join, invalid code, rotate and revoked code. Room subscribers see joins/ready/host/start before match ID exists.
3. Match actions: same clientActionId replay first even if old expected version, different-body reused ID rejected, stale new ID rejected, concurrency prevents duplicate rolls.
4. Gameplay: all 40 squares and all card action types; doubles 1–3, Jail 1–3, GO forward/backwards, rent, tax, insufficient funds, creditor/bank bankruptcy, extra-roll phase, finite 80-turn winner.
5. Presence: grace 120 seconds, transition PAUSED, all reconnect resumes exact turn/phase, hosted abandon when otherwise stuck; no automatic forfeit on Wi-Fi drop.
6. End-state: winner persisted, currentPlayerId null and no more actions; absent players and special end condition tested; frontend online UI matches disabled actions.
7. Database checks: nonnegative INTEGER balances, deck cursor and held cards, current player FK/circular creation, idempotency table, ordered events, restart recovery.
8. Verify current local game and frontend build still pass.

**Definition of done:** These are tests that must be implemented and run by the development team; documentation updates alone cannot certify a working application.
