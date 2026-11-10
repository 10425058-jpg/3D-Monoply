# Frontend–Backend Contract Consistency Review — 2026-11-10

**Scope:** Documentation review of API-CONTRACT.md, SOCKET-EVENTS.md, GAME-STATE.md, DATABASE-DESIGN.md, INTEGRATION-PLAN.md on this PR branch. This is a **documentation-level check only**; no NestJS service, Prisma migration or running multiplayer app was verified.

## 1. Resolved cross-document contradictions

| Topic | Canonical resolution | Sources |
|---|---|---|
| Monetary representation | TypeScript `number` (integer within signed 32-bit range) ↔ PostgreSQL `INTEGER`; no `BIGINT` money fields | GAME-STATE §1–2; DATABASE-DESIGN §1–2; API-CONTRACT §2 |
| Missing match-state persistence | `matches.dice_state`, `doubles_count`, `auction_state`, `pending_trade_state`, `pending_debt_state`, `paused_at`, `pause_reason`; player connection state and timestamp in `match_players` | GAME-STATE §3; DATABASE-DESIGN §2–3 |
| Duplicate action processing | Required `processed_actions` with unique `(match_id,client_action_id)`, original-response replay and request-hash check; same transaction as gameplay writes | DATABASE-DESIGN §2–3; API-CONTRACT §5 |
| Ambiguous socket commands | REST exclusively changes gameplay or ready state. Socket.IO only subscribes, broadcasts and supplies snapshots | API-CONTRACT §5–6; SOCKET-EVENTS §1–5 |
| API result shape | `{data,meta}` success; `{error:{code,message,details}}` error | API-CONTRACT §2; INTEGRATION-PLAN §2 |
| Command versioning | Every action body: UUID `clientActionId`, integer `expectedStateVersion`, content version; one increment per committed mutation, possibly multiple events per same version | API-CONTRACT §5; GAME-STATE §5; SOCKET-EVENTS §2 |
| IDs and board data | Opaque online IDs, numeric board `spaceId` 0..39, server-owned `central-castle@1`; `classic-v1` target ruleset | API-CONTRACT §1; GAME-STATE §1–2; DATABASE-DESIGN §2 |
| Reconnect | 120-second disconnect grace → `PAUSED` state and full snapshot resynchronization; no automatic forfeits | API-CONTRACT §6; SOCKET-EVENTS §6; GAME-STATE §5; DATABASE-DESIGN §2–3 |
| Auth | 15-minute access JWT in memory; hashed/rotating 7-day refresh sessions in HttpOnly cookie; CSRF protection; no tokens in URL | API-CONTRACT §3; DATABASE-DESIGN §2; INTEGRATION-PLAN §2 |

## 2. Implementation-level checks still required

Documentation convergence is **not** a substitute for real code integration tests. Before any backend merge, developers must verify:

- Prisma schema exactly matches described columns, constraints, types and nullability, including `processed_actions` idempotency and connection timestamp persistence.
- TypeScript runtime validators (e.g., Zod) reject fractional/out-of-range monetary amounts and invalid board IDs.
- Backend action processing is transactional and race-safe for concurrent retries of identical and conflicting `clientActionId` values.
- Lost REST response + retry produces one action and the same result; version conflict and content-version mismatch use correct 409 error.
- Event outbox/reconnect snapshot restores match state after websocket missed event and backend restart.
- One or more events from one command do **not** increment stateVersion independently.
- CSRF/origin checks and refresh cookie behavior match actual frontend/backend deployment origins.
- `classic-v1` rules, card lists, rent/jail/auction behavior and advanced action payloads are separately specified/tested **before** enabling those deferred modes.
- Root frontend local/AI game, build and tests still work after adding online adapters.

## 3. Non-goals and known limitations

- This PR changes **documentation only**; it does not implement backend endpoints or frontend integrations.
- Online advanced gameplay (auction, trade, build, mortgage, jail, cards, debt, bankruptcy), AI seats and meta progression remain **deferred** under the 21-day online MVP.
- Comprehensive type-level automated contract tests and full backend integration cannot be asserted until the code exists.
- Database SQL blocks are schema illustrations; backend developers must create/review Prisma migrations and foreign-key ordering.

**Review rule:** If a new PR changes an endpoint, enum, money type, event, or persistence column, update all dependent docs and tests in that same PR.
