# 3D Monopoly — API Contract

**Status:** Implementation baseline approved by project owner (team review via PR)  
**Version:** 1.0.0  
**Target backend:** NestJS + TypeScript  
**Transport:** REST over HTTP for request/response operations; Socket.IO for live match events  
**Database:** PostgreSQL via Prisma

> This document is the shared agreement between Frontend and Backend. It describes the proposed interface; it is not an implementation. Items marked **Decision needed** must be agreed by the team before implementation.

## 1. Project context and integration principles

The current repository is a React + TypeScript + Vite + Three.js application. The current game state is managed in `src/store/useGameStore.ts` with Zustand. It includes local players (including AI), properties, current player index, turn phase, dice, cards, auctions, trades, debt resolution, and meta progression.

The current game is primarily client-side/local. The online backend described here is a new capability. Do not assume the current Zustand store is already connected to a server.

Principles:

1. The server is authoritative for online match state, dice results, turns, money, ownership, rent, auctions, trades, bankruptcy, and winner.
2. The client may animate and render a server-approved result, but must not decide authoritative game outcomes.
3. Keep rendering/UI state (camera mode, hovered/selected board space, graphics quality, modal visibility, animation progress) on the client.
4. Keep board definitions and card definitions as versioned game content. Agree whether these are initially bundled in the backend or shared as versioned data.
5. Use stable string IDs for users, rooms, matches, and online players. Existing local numeric player indexes are not suitable as persistent identity.
6. Never send database credentials, password hashes, JWT secrets, or server-only values to the browser.

## 2. Base URL, versioning, and common conventions

Development base URL: `http://localhost:3000/api/v1`  
Production base URL: provided by deployment configuration.

All JSON responses use UTF-8. Dates use ISO 8601 UTC strings. Money is an integer in the game's currency unit (no floating point).

### Authentication

Protected REST requests use:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The server derives the authenticated user from the token. Do not trust a client-supplied `userId` or `playerId` as proof of identity.

### Standard success shape

All successful responses MUST use the following envelope (no bare resources):

```json
{
  "data": {},
  "meta": {}
}
```

### Standard error shape

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "The requested room does not exist.",
    "details": {}
  }
}
```

Common HTTP status codes:

| Status | Meaning |
|---|---|
| 400 | Invalid request / validation error |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but not allowed |
| 404 | Resource not found |
| 409 | State conflict (wrong turn, room full, already started) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

Error codes should be stable machine-readable strings. Frontend should use the code for behavior and the message for display.

## 3. Authentication and user endpoints

### 3.1 Register

`POST /auth/register` — Public

Request:

```json
{
  "username": "PlayerOne",
  "email": "player@example.com",
  "password": "a-strong-password"
}
```

Response (201):

```json
{
  "data": {
    "user": {
      "id": "usr_123",
      "username": "PlayerOne",
      "email": "player@example.com",
      "avatarUrl": null,
      "createdAt": "2026-11-09T10:00:00.000Z"
    },
    "accessToken": "<token>",
    "expiresIn": 3600
  }
}
```

Validation: username and email format; password policy; reject duplicate email/username. Never return password hash.

### 3.2 Login

`POST /auth/login` — Public

Request:

```json
{
  "email": "player@example.com",
  "password": "a-strong-password"
}
```

Response (200): same shape as register.

Errors: `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `VALIDATION_ERROR`.

### 3.3 Logout

`POST /auth/logout` — Authenticated

Response (200): `{ "data": { "success": true } }`.

Implementation note: if access tokens are stateless, logout behavior and refresh-token revocation must be explicitly designed. Locked: rotating refresh token in an HttpOnly cookie and short-lived JWT access token; see section "Contract v1.0.0 — locked implementation decisions".

### 3.4 Current profile

`GET /users/me` — Authenticated

Response:

```json
{
  "data": {
    "id": "usr_123",
    "username": "PlayerOne",
    "email": "player@example.com",
    "avatarUrl": null,
    "level": 1,
    "experience": 0,
    "coins": 0,
    "createdAt": "2026-11-09T10:00:00.000Z"
  }
}
```

### 3.5 Update profile

`PATCH /users/me` — Authenticated

Request (all fields optional):

```json
{
  "username": "NewName",
  "avatarUrl": "https://cdn.example.com/avatar.png"
}
```

Only allowlisted profile fields can be updated. Coins, level, wins, and other rewards cannot be set directly by the client.

## 4. Room endpoints

A room is a lobby before a match. A match is the actual game session. The room may retain a reference to its match after starting.

### 4.1 Create room

`POST /rooms` — Authenticated

Request:

```json
{
  "mapId": "central-castle",
  "maxPlayers": 4,
  "isPrivate": false
}
```

Response (201):

```json
{
  "data": {
    "id": "room_abc123",
    "status": "WAITING",
    "mapId": "central-castle",
    "maxPlayers": 4,
    "isPrivate": false,
    "hostUserId": "usr_123",
    "players": [],
    "createdAt": "2026-11-09T10:00:00.000Z"
  }
}
```

Rules: creator becomes host and room member; maxPlayers must be within the agreed range (proposed 2–4); mapId must be supported.

### 4.2 Get room

`GET /rooms/:roomId` — Authenticated room member (or public-room policy)

Returns room details, members, ready states, and match ID if started.

### 4.3 Join room

`POST /rooms/:roomId/join` — Authenticated

Request:

```json
{
  "inviteCode": "optional-for-private-room"
}
```

Response: updated room resource.

Errors: `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_ALREADY_STARTED`, `INVALID_INVITE_CODE`, `ALREADY_IN_ROOM`.

### 4.4 Leave room

`POST /rooms/:roomId/leave` — Authenticated

Response: `{ "data": { "success": true } }`.

Locked: transfer host to longest-present active member in a waiting room, or close when room becomes empty.

### 4.5 Ready state

`PATCH /rooms/:roomId/ready` — Authenticated

Request:

```json
{ "isReady": true }
```

Response: updated room state.

### 4.6 Start match

`POST /rooms/:roomId/start` — Authenticated host only

Request:

```json
{ "rulesetId": "classic-v1" }
```

Response (201):

```json
{
  "data": {
    "matchId": "match_xyz789",
    "status": "IN_PROGRESS",
    "mapId": "central-castle",
    "currentTurnPlayerId": "mp_001",
    "stateVersion": 1
  }
}
```

The server validates minimum player count and ready states before starting.

## 5. Match and gameplay endpoints

REST endpoints are suitable for commands that need a clear response. Socket.IO broadcasts the resulting state/events to all players. The server must validate every command against the current match state.

### 5.1 Get match snapshot

`GET /matches/:matchId` — Authenticated match member

Returns the current authoritative snapshot. Used when joining/reconnecting or recovering after missed events.

### 5.2 Roll dice

`POST /matches/:matchId/actions/roll-dice` — Authenticated match member

Request:

```json
{ "clientActionId": "uuid-generated-by-client" }
```

The client does not send dice values or desired movement. Server verifies current turn and phase, generates dice securely, applies game rules, and returns the result.

Response:

```json
{
  "data": {
    "actionId": "act_001",
    "dice": [3, 4],
    "total": 7,
    "playerId": "mp_001",
    "fromPosition": 5,
    "toPosition": 12,
    "turnPhase": "LANDED_ACTION",
    "stateVersion": 18
  }
}
```

### 5.3 Buy property

`POST /matches/:matchId/actions/buy-property`

Request:

```json
{
  "spaceId": 12,
  "clientActionId": "uuid-generated-by-client"
}
```

Server checks that it is the player's turn, the player is on that space, the property is purchasable and unowned, and the player has enough money. Price comes from server-side board rules, not the client.

### 5.4 Decline property / auction

`POST /matches/:matchId/actions/decline-property`  
`POST /matches/:matchId/actions/auction`

Auction actions:

- `POST /matches/:matchId/actions/auction/bid` — request includes integer `amount` and `clientActionId`.
- `POST /matches/:matchId/actions/auction/pass`.

Server controls bid order, minimum increments, available funds, and auction completion.

### 5.5 Build / sell / mortgage

`POST /matches/:matchId/actions/build` — `{ "spaceId": 12, "clientActionId": "..." }`  
`POST /matches/:matchId/actions/sell-house` — same shape  
`POST /matches/:matchId/actions/mortgage` — same shape

Server validates ownership, even building rules, house/hotel limits, mortgage state, and money.

### 5.6 Trade

`POST /matches/:matchId/actions/trades`

Request:

```json
{
  "toPlayerId": "mp_002",
  "offerCash": 100,
  "requestCash": 50,
  "offerPropertyIds": [3],
  "requestPropertyIds": [8],
  "clientActionId": "uuid-generated-by-client"
}
```

Locked: create trade proposal, then recipient accepts or rejects. Acceptance is atomic.

### 5.7 Debt, jail, cards, and turn

Proposed command endpoints:

- `POST /matches/:matchId/actions/settle-debt`
- `POST /matches/:matchId/actions/declare-bankruptcy`
- `POST /matches/:matchId/actions/pay-jail-bail`
- `POST /matches/:matchId/actions/use-jail-card`
- `POST /matches/:matchId/actions/resolve-card`
- `POST /matches/:matchId/actions/end-turn`

The exact command payloads depend on the final ruleset. Server owns all calculations and phase transitions.

### 5.8 Common action response

Successful actions should return the authoritative result and current state version. A compact action response may be returned over HTTP while the complete update is broadcast over Socket.IO.

All state-changing commands should support an idempotency key such as `clientActionId` so a retry does not apply the same purchase, payment, or roll twice.

## 6. Match state and identifiers

- `userId`: persistent account ID.
- `playerId`: player seat/participant ID within one match.
- `roomId`: lobby ID.
- `matchId`: game session ID.
- `spaceId`: stable integer from the board definition (the current frontend uses board-space IDs).
- `stateVersion`: monotonically increasing integer per match; helps clients ignore stale/out-of-order updates.

Do not treat the current local `Player.id` numeric index as a global user ID.

## 7. Frontend integration responsibilities

Frontend should:

1. Keep camera, selection, hover, modal, sound, graphics quality, and animation state locally.
2. Use API responses and Socket.IO snapshots/events to update online gameplay state.
3. Show loading, success, and error states for commands.
4. Never optimistically award money, assign property ownership, or choose dice results as final truth.
5. Re-fetch `GET /matches/:matchId` when state versions indicate a gap or after reconnect.
6. Keep the existing local/AI mode working while online mode is developed separately.

Suggested frontend modules (add when integration begins):

```text
src/
  services/
    apiClient.ts
    authService.ts
    roomService.ts
    matchService.ts
  socket/
    socketClient.ts
  types/
    api.ts
```

## 8. Decisions resolved for implementation

The project-owner-approved decisions and MVP scope are locked in **Contract v1.0.0 — locked implementation decisions** below. Any changes require a reviewed contract PR. Unimplemented features are not implicitly supported.

## 9. Scope recommendation

Implement in increments:

1. Backend foundation + health check + Prisma connection.
2. Authentication + user profile.
3. Room lifecycle and lobby.
4. Match snapshot + server-authoritative core turn/dice/property actions.
5. Socket.IO synchronization and reconnect.
6. Remaining rules (auction, trades, debt, jail, cards, bankruptcy).
7. Meta progression and leaderboard.

Do not attempt to migrate every existing local feature into multiplayer in the first backend pull request.

---

## Contract v1.0.0 — locked implementation decisions (2026-11-10)

**Status: Project-owner implementation baseline.** This section resolves the former `Decision needed` items for the 21-day delivery. If older draft examples below differ, **this section takes precedence**. Changing a contract field, command, event, or policy requires a reviewed docs PR and version bump. Documentation approval does **not** mean backend code is implemented.

| Area | Locked decision |
|---|---|
| Backend | NestJS + TypeScript, PostgreSQL + Prisma. Frontend stays in repository root; backend starts in `backend/`. |
| Transport | **REST is the sole path for mutating gameplay commands.** Socket.IO is used for lobby/match broadcasts, presence and snapshot recovery only. Do not implement `game:roll_dice`, `game:buy_property`, `game:end_turn` or generic `game:action` as write-capable socket handlers. |
| REST response | All successful resources/actions use `{ "data": ..., "meta": {} }`; all errors use `{ "error": { "code": "...", "message": "...", "details": {} } }`. No bare-resource responses. |
| API paths | Base `/api/v1`; the resource is `/matches/:matchId` (not `/games/:id`). Use the explicitly listed action endpoints in API-CONTRACT.md. |
| Identity | Authenticated JWT Bearer access token (15-minute lifetime); rotating refresh token via Secure, HttpOnly, SameSite=Lax cookie (7-day maximum), with backend-stored hashed refresh-token identifiers and revocation on logout. Cookie CSRF protection is required for refresh/logout operations. Local development may relax Secure only over HTTP localhost. Never store tokens in localStorage or URL parameters. |
| Auth endpoints | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /users/me`. Refresh response returns `data.accessToken` and `data.expiresIn`; cookie is set/rotated via Set-Cookie. Login/register set refresh cookie and return access token. |
| Lobby | 2–4 human players; host is creator; when host leaves a waiting room, transfer host to the longest-present active member, otherwise close room. Room start requires all members ready except host (host is implicitly ready). |
| First map/rules | `mapId=central-castle`, `rulesetId=classic-v1`, board space IDs 0–39 and integer game currency. This is a compatibility contract, not a claim that existing custom rules already match classic Monopoly. Backend must define/test exact card lists, building, jail and auction rules before enabling those features online. |
| Content ownership | Backend owns one versioned board/ruleset dataset `central-castle@1`. Frontend renders the same board IDs and sends its declared content version; backend rejects unsupported versions with `CONTENT_VERSION_MISMATCH`. No client-supplied prices or card outcomes. A shared package can follow later; no duplicate independent rule definitions. |
| IDs | User, room, match and match-player IDs are opaque strings; `spaceId` is integer. Server resolves user identity from auth, never from user-supplied IDs. |
| State | Server owns money, ownership, turn, dice, cards, debt and outcome; client owns camera/UI/animation. Every accepted state-changing command increments `stateVersion` and has idempotent `clientActionId` UUID. |
| Trade | Proposal → recipient accepts/rejects; acceptance is an atomic server transaction with renewed validity checks. Do not implement single-step unconfirmed trades. |
| AI | No server-controlled AI seats in first online release. Existing local vs AI mode is preserved. |
| Reconnect | A disconnected player remains in match for 120 seconds. Rejoin via authorized `match:join` triggers full `match:snapshot`; version gaps require snapshot. After grace expires, mark player absent and pause the match pending explicit room policy; do **not** auto-forfeit or silently transfer ownership in v1. |
| Meta progression | Daily rewards, wheel, stickers, missions, leaderboards and cosmetics are **out of scope** for the 21-day online MVP. The existing local implementation remains untouched. |
| Online MVP slice | Auth, room create/join/ready/start, match snapshot, roll-dice, buy/decline property, rent resolution, end-turn, authoritative broadcasts and reconnect. Auctions, trades, building, mortgage, advanced jail/cards/debt/bankruptcy and full classic-rules parity remain specified but must not be advertised as implemented until tested end-to-end. |
| Error and consistency | `VALIDATION_ERROR`=400, `UNAUTHORIZED`=401, `FORBIDDEN`=403, `ROOM_NOT_FOUND`/`MATCH_NOT_FOUND`=404, `NOT_YOUR_TURN`/`INVALID_PHASE`/`ROOM_FULL`/`CONTENT_VERSION_MISMATCH`/`STATE_VERSION_CONFLICT`=409, `RATE_LIMITED`=429. Client retries safe reads and idempotent writes with same `clientActionId`. |

**Command delivery:** the client sends `clientActionId` and `expectedStateVersion` in the JSON body of every gameplay mutation (plus action-specific fields); the backend authenticates, authorizes, validates, transactionally commits, returns `{data:{...,stateVersion},meta:{}}` and then broadcasts the resulting event(s). A replay of the same action ID returns the original outcome without applying it again. On state conflict, client fetches `GET /matches/:matchId` and re-renders. Server never accepts dice values, money totals, or ownership changes from a client.

**Socket ordering:** every custom server event uses `{eventId,matchId,stateVersion,occurredAt,payload}`. Socket emits are **notifications, not commands**. The only allowed client socket messages are `match:join`, `match:leave` and connection/presence operations; ready state changes use REST `PATCH /rooms/:roomId/ready`. Match snapshots are authoritative; clients deduplicate `eventId`, reject stale versions, and recover gaps by REST GET.

**Compatibility rules:** legacy draft examples without `expectedStateVersion` or `meta` illustrate gameplay but must be updated by implementers to follow this locked baseline. Never break local/AI mode when integrating online services.

