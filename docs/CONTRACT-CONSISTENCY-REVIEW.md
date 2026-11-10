# Frontend–Backend Contract Review and Acceptance Matrix — v1.1.0

**Scope:** Seven documentation files in the `docs/` integration bundle (API-CONTRACT, SOCKET-EVENTS, GAME-STATE, DATABASE-DESIGN, INTEGRATION-PLAN, ONLINE-MVP-RULES and this review). **Docs checked; real backend and migrations NOT tested.**

## 1. Findings resolved in the contract

| Reported gap | Normative resolution | Cross-check |
|---|---|---|
| Lobby events unreachable before match exists | Socket `room:join` / `room:leave` and `room:snapshot` on `room:<roomId>`, independent of match; room:updated and match:started broadcast to waiting subscribers | API §3, Socket §1–4, Integration §3 |
| PAUSED cannot resume | At 120s disconnected match enters PAUSED; when all solvent players reconnect server resumes atomically and broadcasts game:resumed. Host can abandon paused match if they cannot reconnect | API §5, Socket §5, State §1, DB §3 |
| Unimplemented core Monopoly spaces/rules | New explicit **mini-v1** finite online ruleset covers all board types, all 10 supported card actions, doubles, GO, jail, bankrupt, rent, terminal result. No pretending to offer full classic-v1 | ONLINE-MVP-RULES §§1–7, API §§1/4 |
| Private room code cannot be shared | Cryptographically strong invite code returned once in private room create response, host-only rotate; stored hashed, never listed/broadcast | API §3, DB §2 |
| Refresh token never issued | Login/register issue Set-Cookie refresh token and data.csrfToken; refresh/logout use cookie and CSRF header; csrf bootstrap after reload | API §2, DB §2, Integration §2 |
| Missing errors / health | Explicit INVALID_INVITE_CODE, USERNAME_TAKEN, EMAIL_TAKEN, CSRF_INVALID, DEPENDENCY_UNAVAILABLE and 503 health | API §6, Integration §5 |
| Retry order conflicts | Authenticate/validate, lookup processed_actions **first**, replay original response, then check expected version for new IDs | API §4, DB §3, State §4 |
| currentPlayerId nullability | Nullable in state and DB; required non-null when IN_PROGRESS/PAUSED; null in FINISHED/ABANDONED | State §1–2, DB §2 |
| Negative money | `INTEGER NOT NULL CHECK(money >= 0)` and atomic bankruptcy transfers | Rules §6, State §1, DB §1–3 |
| Socket token expires mid-game | Client refreshes access token using HttpOnly cookie+CSRF, reconnects socket with new JWT, re-subscribes and snapshots | API §5, Socket §5 |
| Can't browse public rooms | `GET /api/v1/rooms` paginated, public waiting rooms only | API §3 |
| Doc count wrong | Seven files consistently enumerated in this review and Integration Plan | Integration introduction |

## 2. Additional risks and safeguards

- Mini-v1 is explicitly **not** classic Monopoly: no auctions, trades, builds/mortgages, manual debt resolution. These actions are hidden/disabled in online mode, not silently no-ops.
- Every completed player turn increments `completedTurns`; after 80 turns compare net worth, cash, owned deeds then seat order to choose winner. One solvent player wins instantly.
- Server deck state survives restart; held Jail cards are removed from draw pile. Preview responses never reveal future deck order.
- Server reserves access to rule code; client renders results but cannot choose dice, cards or price.
- Return original action response on identical UUID retry, even with now-stale expectedVersion. Unique DB constraint prevents concurrent duplicate actions.
- Current local game uses its own rules and IDs; adapter must not break local/AI gameplay.

## 3. Verification ledger

| Check | Documentation | Runtime |
|---|---|---|
| Consistent transport, room lifecycle, match lifecycle and event names | Specified | **Not run** |
| Money type, non-negative check, idempotency, deck storage | Specified | **Not run** |
| Auth login refresh cookie/CSRF and socket expiry recovery | Specified | **Not run** |
| Every board type and every card action resolves | Specified | **Not run** |
| Paused game resumes or can be explicitly abandoned | Specified | **Not run** |
| Full two-browser end-to-end match | Required | **Not run** |
| Existing frontend build and local/AI regression | Required | **Not run** |

No claim of zero bugs or of a complete backend is made by a docs-only PR. If schemas/semantics change, update all seven docs and automated contract tests together.
