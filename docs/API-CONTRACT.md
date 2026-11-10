# 3D Monopoly — REST API Contract v1.0.0

**Status:** Team review / implementation specification (not a claim of implemented backend)
**Backend:** NestJS + TypeScript | **Database:** PostgreSQL + Prisma
**Transport:** REST commands; Socket.IO notifications (see [SOCKET-EVENTS.md](./SOCKET-EVENTS.md))
**Version:** 1.0.0 | **Date:** 2026-11-10

## 1. Single source of truth and launch scope

This file is normative for REST endpoints, errors and authentication. [GAME-STATE.md](./GAME-STATE.md) defines public game types and rules; [SOCKET-EVENTS.md](./SOCKET-EVENTS.md) defines subscriptions and events; [DATABASE-DESIGN.md](./DATABASE-DESIGN.md) defines durable storage; [INTEGRATION-PLAN.md](./INTEGRATION-PLAN.md) sets implementation milestones. No "Decision needed" alternatives are active in v1.

**21-day online MVP:** authenticated 2–4 human players; one map `central-castle`; ruleset `classic-v1`; content version `central-castle@1`; lobby, start, snapshot, roll, buy/decline property, rent, end turn, event synchronization and reconnect. This does not claim full classic rules or multiplayer are currently implemented. **Deferred online:** auctions, trades, buildings, mortgage, jail/cards/debt/bankruptcy, server AI and meta progression until rule-complete and tested. Existing local/AI frontend must remain functional.

**Authority:** Backend chooses dice, validates actions, calculates prices/rent, manages ownership, money, turns, versioning and outcome; client is presentation only (camera, hover, modals, VFX, animation, settings). Board content is backend-owned and versioned. Board IDs are integers 0–39. Match/player/user/room IDs are opaque strings.

## 2. Common HTTP conventions

Base URL: `http://localhost:3000/api/v1` in development. Production URL via environment configuration. JSON `camelCase`; timestamps ISO 8601 UTC; money non-negative or debt-specific **safe integers** represented as JSON numbers and TypeScript `number`, bounded by **-2,147,483,648 to 2,147,483,647** to match PostgreSQL `INTEGER`. Validate `Number.isSafeInteger` and the database range on every relevant operation; never serialize JS `bigint` to JSON money.

All successful responses use `{ "data": <value>, "meta": {} }` (meta may include requestId). Error responses use `{ "error": { "code": "VALIDATION_ERROR", "message": "Readable explanation", "details": {} } }`. Never return bare resources. Action responses return the committed `stateVersion` and action result; client can obtain full authoritative snapshot via GET.

HTTP status and stable codes:
| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` |
| 404 | `ROOM_NOT_FOUND`, `MATCH_NOT_FOUND` |
| 409 | `ROOM_FULL`, `ROOM_ALREADY_STARTED`, `NOT_YOUR_TURN`, `INVALID_PHASE`, `STATE_VERSION_CONFLICT`, `CONTENT_VERSION_MISMATCH`, `INSUFFICIENT_FUNDS`, `INVALID_ACTION` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

## 3. Authentication

- `POST /auth/register`: `{username,email,password}` → 201 `{data:{user,accessToken,expiresIn:900},meta:{}}`.
- `POST /auth/login`: `{email,password}` → 200 same envelope; reject invalid credentials with 401.
- `POST /auth/refresh`: refresh cookie + CSRF token → 200 `{data:{accessToken,expiresIn:900},meta:{}}`; rotates refresh cookie.
- `POST /auth/logout`: refresh cookie + CSRF token → 200 `{data:{success:true},meta:{}}`; revoke refresh session.
- `GET /users/me`: bearer-authenticated profile, with `data:{id,username,email,avatarUrl,createdAt}`.
- `PATCH /users/me`: bearer-authenticated `{username?,avatarUrl?}`; only allowlisted fields, never balance/level/rewards supplied by client.

Protected REST endpoints require `Authorization: Bearer <accessToken>`. JWT access token lifetime 15 minutes, kept **in memory** on frontend. Rotating opaque refresh token (maximum 7 days) is only in a `Secure; HttpOnly; SameSite=Lax` cookie; localhost HTTP dev may omit Secure. Backend stores a **hash** of refresh credentials with revocation/expiry. Refresh/logout require CSRF defense (validated `X-CSRF-Token`, tied to session and delivered via a non-HttpOnly CSRF cookie or a safe bootstrap flow), strict allowed Origin and CORS; cross-site deployment needs separately reviewed cookie/CSRF settings. Do not use localStorage or query strings for credentials. Socket.IO `/game` receives access token in handshake `auth.token`.

## 4. Rooms / lobby

Room has `roomId`, `status` (`WAITING|IN_PROGRESS|CLOSED`), `hostUserId`, `mapId`, `maxPlayers`, `members` and `matchId`. Creator is a member and host. 2–4 **human** players; host implicitly ready; others must be ready. On host leaving a waiting room, longest-present active member becomes host; empty room closes.

| Method | Endpoint | Request | Success |
|---|---|---|---|
| POST | `/rooms` | `{mapId:"central-castle",maxPlayers:4,isPrivate:false}` | 201 room in `data` |
| GET | `/rooms/:roomId` | — | room in `data` |
| POST | `/rooms/:roomId/join` | `{inviteCode?}` | updated room |
| POST | `/rooms/:roomId/leave` | `{}` | `{success:true}` |
| PATCH | `/rooms/:roomId/ready` | `{isReady:boolean}` | updated room |
| POST | `/rooms/:roomId/start` | `{rulesetId:"classic-v1",contentVersion:"central-castle@1"}` | 201 `{matchId,stateVersion,status,mapId}` |

Only host starts, after minimum players and readiness checks. Server checks membership and private invite code (do not trust `userId` in request body).

## 5. Match reads and action requests

`GET /matches/:matchId`: authorized member receives `{data: MatchState, meta:{}}` per [GAME-STATE.md](./GAME-STATE.md), including `stateVersion`, `contentVersion`, durable transient states (auction/debt if enabled), connection state and phase.

**Every match mutation** is an authenticated REST POST and includes **`clientActionId` (UUID string)**, **`expectedStateVersion` (integer)** and **`contentVersion:"central-castle@1"`**. Payload includes only listed action-specific fields. Backend validates authorization, membership, action against phase and version; server computes effects; commits state, game events and idempotency record in one atomic transaction; returns original response for exact duplicate `clientActionId` without applying again. If the same action ID is reused with a different request payload, return `409 INVALID_ACTION`; avoid duplicate writes even across retries, crashes and multiple backend instances. Stale new actions get `409 STATE_VERSION_CONFLICT`, and client refreshes GET snapshot. Backend may broadcast events after commit; delivery must be recoverable by snapshot/outbox.

| POST action route under `/matches/:matchId/actions/` | Additional request fields | Rollout |
|---|---|---|
| `roll-dice` | none | MVP |
| `buy-property` | `spaceId:number` | MVP |
| `decline-property` | `spaceId:number` | MVP; no auction until auction rules enabled |
| `end-turn` | none | MVP |
| `auction/bid` | `amount:number` | Deferred |
| `auction/pass` | none | Deferred |
| `build`, `sell-house`, `mortgage` | `spaceId:number` | Deferred |
| `trades` | `toPlayerId,offerCash,requestCash,offerPropertyIds,requestPropertyIds` | Deferred: creates pending proposal |
| `trades/:tradeId/accept`, `trades/:tradeId/reject` | none | Deferred: atomic accepted trade |
| `settle-debt`, `declare-bankruptcy` | rule-specific documented schema required before enabling | Deferred |
| `pay-jail-bail`, `use-jail-card`, `resolve-card` | rule-specific documented schema required before enabling | Deferred |

**Example roll request** `POST /api/v1/matches/match_xyz/actions/roll-dice`:

```json
{"clientActionId":"f7399e8e-96b5-4a5a-a418-e7411a73cdd8","expectedStateVersion":17,"contentVersion":"central-castle@1"}
```

**Response** `200`:
```json
{"data":{"actionId":"act_001","matchId":"match_xyz","playerId":"mp_001","dice":[3,4],"total":7,"fromPosition":5,"toPosition":12,"turnPhase":"LANDED_ACTION","stateVersion":18},"meta":{}}
```

The frontend must **not** send dice values or claimed money, player position, prices or resulting ownership. On repeated action ID, server returns the same response without a second roll. No Socket.IO gameplay command may mutate server state.

## 6. Snapshot and synchronization rules

- First connect/reconnect: authorize socket `match:join`; server emits full `match:snapshot`. Also support REST `GET /matches/:matchId` to recover after gaps.
- Each accepted gameplay command advances `stateVersion` exactly once; a command may yield **multiple events with the same version**. Events have unique `eventId`, are deduplicated, and do not independently increment state versions.
- Disconnect grace period **120 seconds**. After expiry, match becomes paused with persisted pause reason; no automatic forfeit. Unpause policy must be explicitly implemented/tested before enabling automatic resumption.
- Only one map `central-castle`, one ruleset `classic-v1` for MVP. Server validates content version and returns 409 `CONTENT_VERSION_MISMATCH` for incompatible clients.

## 7. Change management

Any API change needs a reviewed PR and semver update; frontend and backend use shared contract tests (or validated schemas) and keep old local AI behavior isolated from online services. Do not interpret this contract as evidence of completed implementation.
