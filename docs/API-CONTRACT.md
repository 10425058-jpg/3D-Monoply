# 3D Monopoly — API Contract v1.1.2 (online MVP)

**Status:** Proposed normative contract for review, NOT implemented backend.
**Transport:** REST for all mutations, Socket.IO for room/match subscription and broadcasts.
**Sources:** [ONLINE-MVP-RULES.md](./ONLINE-MVP-RULES.md) defines game rules, [GAME-STATE.md](./GAME-STATE.md) shapes, [SOCKET-EVENTS.md](./SOCKET-EVENTS.md) realtime, [DATABASE-DESIGN.md](./DATABASE-DESIGN.md) persistence.

## 1. Release scope and naming

Online target is **`mini-v1`** on **`central-castle`** with **`contentVersion: "central-castle@1"`**, for 2–4 human players. `classic-v1` is reserved for a later full-rules backend. Local/AI mode is unchanged. A finite, playable online match MUST implement every square, card type, doubles, Jail, rent, insolvency, bankruptcy and winner rules from ONLINE-MVP-RULES before it can be called MVP complete.

REST base `/api/v1`; development origin `http://localhost:3000`. JSON uses camelCase, integer money within [0,2147483647], UTC ISO timestamps. Response success `{"data":{...},"meta":{}}`; failure `{"error":{"code":"...","message":"...","details":{}}}`. No bare resource responses.

## 2. Authentication and CSRF lifecycle

| Method | Path | Input | Result |
|---|---|---|---|
| POST | `/auth/register` | `{username,email,password}` | 201 `data:{user,accessToken,expiresIn:900,csrfToken}` plus refresh Set-Cookie |
| POST | `/auth/login` | `{email,password}` | 200 same fields and refresh Set-Cookie |
| POST | `/auth/refresh` | refresh cookie, header `X-CSRF-Token` | 200 `data:{accessToken,expiresIn:900,csrfToken}` and rotated refresh Set-Cookie |
| POST | `/auth/logout` | refresh cookie, header `X-CSRF-Token` | 200 `data:{success:true}`, revoke session and clear refresh cookie |
| GET | `/users/me` | Bearer access JWT | profile in `data` |
| PATCH | `/users/me` | Bearer JWT, allowlisted profile fields only | updated profile |

Login/register explicitly mint an opaque **7-day maximum rotating refresh token** and send it via `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` (Secure may be disabled on localhost HTTP). Cookie is not returned in JSON. An independent, session-bound CSRF token is returned in the login/register JSON `data.csrfToken`; keep it **in memory**, present in `X-CSRF-Token` on refresh/logout, and rotate it with refresh. Browser automatically attaches refresh cookie only with `credentials:"include"`; restrict CORS and allowed Origin, implement CSRF validation. Do not put credentials in localStorage or URLs. If browser tab reloads and loses in-memory CSRF token, bootstrap `GET /auth/csrf` with credentialed cookie and strict Origin to return `data:{csrfToken}` without granting access JWT; no other session data returned. Access JWT lives in memory and expires after 15 minutes. The backend stores only hashes/expiry/revocation lineage of refresh credentials. Deploying across different sites requires revisiting SameSite/CORS/CSRF settings explicitly.

## 3. Room browsing and membership

The creator is first room member and host. Ready-to-start requires 2–4 human members; host is implicitly ready, others must mark ready. On leaving a WAITING room, host transfers to oldest active member; close if empty. The server assigns each joining member the lowest free seatOrder (0–3); seats remain stable until that member leaves, and match turns proceed by ascending seatOrder. An empty seat can be reused by a later joiner. Tokens and colors are server-assigned from the fixed seat palette in GAME-STATE.md; selection/customization is not part of mini-v1. The room snapshot contains each member's seatOrder, token and color. A room is accessible through REST and Socket.IO only after server membership authorization. Public `GET /rooms` lists WAITING non-private rooms with safe summary only.

| Method | Path | Input | Response `data` |
|---|---|---|---|
| GET | `/rooms?limit=20&cursor=...` | Bearer token; optional pagination | `{items:[{roomId,mapId,memberCount,maxPlayers,status}],nextCursor:null|string}` |
| POST | `/rooms` | `{mapId:"central-castle",maxPlayers:4,isPrivate:boolean}` | 201 `{room:RoomState,inviteCode?:string}` |
| GET | `/rooms/:roomId` | member auth | RoomState |
| POST | `/rooms/:roomId/join` | `{inviteCode?:string}` | RoomState |
| POST | `/rooms/:roomId/leave` | `{}` | **WAITING only:** `{success:true}`; when IN_PROGRESS return 409 `ROOM_ALREADY_STARTED` (use match `actions/forfeit`); when CLOSED return 409 `ROOM_CLOSED` |
| PATCH | `/rooms/:roomId/ready` | `{isReady:boolean}` | RoomState |
| POST | `/rooms/:roomId/start` | `{rulesetId:"mini-v1",contentVersion:"central-castle@1"}` | 201 `{matchId,stateVersion,status,mapId}` |

**Room departure vs match forfeiture:** `POST /rooms/:roomId/leave` changes room membership only while `RoomState.status=WAITING`; it is rejected with `409 ROOM_ALREADY_STARTED` during an active or paused match (room status IN_PROGRESS). The player must use authenticated `POST /matches/:matchId/actions/forfeit` to withdraw from an ongoing match. After a match ends and its room is CLOSED, REST leave returns `409 ROOM_CLOSED`. Socket.IO `room:leave` is *subscription only* and never changes room membership, match ownership, connection status, or forfeit state. No disconnection automatically invokes either REST endpoint.

For a private room: generate cryptographically random high-entropy invite code (e.g. 16 random bytes base64url), return raw `inviteCode` **only once in successful create response** to host. Store only hash, never broadcast or log code. Host UI must offer Copy Code immediately; after loss, create a new code via authenticated host-only `POST /rooms/:roomId/invite/rotate` returning new `inviteCode`, invalidating prior code atomically. GET room never returns raw code; join comparison constant-time. Public listing never exposes private rooms, invite tokens, emails or passwords. Room Socket.IO subscriptions are defined in SOCKET-EVENTS.md.

## 4. Server-authoritative gameplay actions

`GET /matches/:matchId` returns authorized **public MatchState snapshot** as `{data:MatchState,meta:{}}` including committed phase, player states, `allowedActions`, `turnNumber`, `completedTurns`, `lastCardResolved`, winner and pause status. `allowedActions` is a server-derived, requestor-specific array of REST action names; it is never stored in SQL. Every `GET /matches/:matchId` and unicast `match:snapshot` must be personalized to the authenticated requester. Shared broadcasts (`match:started`, `game:resumed`) contain match IDs and/or version only, not a single unpersonalized snapshot. The server still validates every attempted action. Internal deck orders and server randomness must not be in public snapshots.

**All** match-mutating REST POST bodies have **UUID** `clientActionId`, integer `expectedStateVersion` and `contentVersion:"central-castle@1"`, plus route-specific fields. No parallel write-capable Socket.IO commands. Backend derives actor from access token; never trusts client dice, money, card outcomes, owner IDs or participant IDs.

| POST under `/matches/:matchId/actions/` | Route-specific fields | Legal use |
|---|---|---|
| `roll-dice` | none | PRE_ROLL; includes Jail attempts |
| `buy-property` | `spaceId:number` | LANDED_ACTION with affordable unowned property |
| `decline-property` | `spaceId:number` | LANDED_ACTION; remains unowned |
| `end-turn` | none | END_TURN, no pending extra roll |
| `pay-jail-bail` | none | PRE_ROLL with inJail, cash >=50 |
| `use-jail-card` | `cardId:string` | PRE_ROLL with inJail, held card |
| `forfeit` | none | active or paused match participant (not already eliminated) |
| `forfeit-player` | `targetPlayerId:string` | connected current host, PAUSED, target disconnected continuously >=120 seconds |
| `abandon` | none | connected current host, PAUSED match; terminal ABANDONED without winner |

Mini-v1 intentionally has **no enabled** auction, trade, build, sell, mortgage or debt-resolution endpoints; those require a new ruleset and versioned API change. Do not show them as usable in online mode. Server resolves Chance/Chest and all landings **within roll-dice**; no client `resolve-card` authority.

Example request: `POST /api/v1/matches/match_xyz/actions/roll-dice`:
```json
{"clientActionId":"f7399e8e-96b5-4a5a-a418-e7411a73cdd8","expectedStateVersion":17,"contentVersion":"central-castle@1"}
```
Example successful action response:
```json
{"data":{"actionId":"act_001","matchId":"match_xyz","stateVersion":18,"dice":[3,4],"playerId":"mp_001","turnPhase":"END_TURN","events":[{"type":"game:dice_rolled"},{"type":"game:player_moved"}]},"meta":{}}
```
Do not assume END_TURN for doubles/landed purchasable property; response reflects actual server result.

**Request processing order (normative):** authenticate/authorize, validate syntax, then lookup idempotency by `(matchId,clientActionId)` **before** comparing `expectedStateVersion`. Same action ID + same actor + identical canonical request hash returns **original stored response** regardless of now-stale version; reuse ID with different request/actor returns 409 `INVALID_ACTION`. For a **new** ID validate content version and expected state version, then phase/rules and mutate state atomically with `processed_actions` and events, advancing `stateVersion` exactly once. After commit broadcast (durable outbox/recovery via GET); never roll twice on retry.

## 5. Match lifecycle, host authority and reconnection

Authentication: a Socket.IO `/game` connection uses a short-lived JWT. The client refreshes via REST and reconnects with a new `auth.token`; re-subscribe to `room:join` or `match:join` and request a personalized authoritative snapshot. Refresh failure requires login and never automatically forfeits a match.

**Presence and grace.** A player is DISCONNECTED only when all their authenticated match sockets have closed. Persist `disconnectedAt`. If the current player disconnects, other participants cannot skip their turn. After 120 seconds of continuous absence, set the nonterminal match to PAUSED with its original turn state. Never automatically bankrupt a player for a Wi-Fi outage.

**Host throughout the match.** `rooms.host_user_id` is authoritative in WAITING, IN_PROGRESS and PAUSED. When the active-match host has been disconnected for at least 120 seconds, atomically elect the connected, non-bankrupt match participant with the lowest `seatOrder`; update `room_members.is_host`, increment `roomRevision` and emit `room:host_changed` and `room:updated`. If no eligible participant is online, keep the old host until an eligible person reconnects and immediately elect then. The returning previous host does not recover privilege automatically.

**Resume and overdue players.** PAUSED resumes as IN_PROGRESS automatically once every non-bankrupt player is connected, preserving phase, dice, pending purchase and turn pointer. A connected current host can instead invoke REST `POST /api/v1/matches/:matchId/actions/forfeit-player` only if target is another player continuously offline >=120 seconds. Backend rechecks absence atomically, logs `reason:HOST_FORFEIT_ABSENT`, forfeits target property/cash to Bank, recomputes turn and FINISHED/IN_PROGRESS result, and emits committed events. It rejects connected or early targets with `PLAYER_NOT_ELIGIBLE_FOR_FORFEIT`. A host may invoke `POST /api/v1/matches/:matchId/actions/abandon` while PAUSED (same idempotency/version body as all actions) to end without a winner. A player can voluntarily use `actions/forfeit` while active or paused.

**All offline timeout.** When the last eligible player disconnects, persist `allPlayersOfflineSince`; clear when any eligible person reconnects. If zero eligible players remain connected for **24 continuous hours**, a durable background job atomically transitions match to ABANDONED without a winner. Being offline for less than 24 hours is NOT immediate abandonment. On a terminal match, no resume or game action is accepted; final snapshots remain readable by authorized prior participants.

**Terminal state and parent room.** A match FINISHED on last solvent player or after 80 completed player turns according to ONLINE-MVP-RULES. When FINISHED or ABANDONED, set `turnPhase:GAME_OVER`, `currentPlayerId:null`, `rooms.status:CLOSED`, increment `roomRevision`, and broadcast terminal event and `room:updated` after the transaction. Preserve match association through the single `matches.room_id` foreign key (one match per room); `RoomState.matchId` is derived by lookup, not a duplicate DB column. No same-room rematch is allowed in mini-v1; create a new WAITING room.

**Test scenarios:** disconnected host election and return, voluntary/host forced forfeit, reconnect racing forced forfeit, paused resume, 23h59m vs 24h all-offline restart-safe timer, last survivor, turn-limit finish, read-only CLOSED room and rejected terminal commands.

## 6. Error codes and health

| HTTP status | Error code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid shape/type/integer money or board IDs |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` | Bad/expired auth |
| 403 | `FORBIDDEN`, `CSRF_INVALID` | Not member/host, origin or CSRF failed |
| 404 | `ROOM_NOT_FOUND`, `MATCH_NOT_FOUND` | Resource absent/inaccessible |
| 409 | `ROOM_FULL`, `ROOM_ALREADY_STARTED`, `ROOM_CLOSED`, `MATCH_ALREADY_TERMINAL`, `PLAYER_NOT_ELIGIBLE_FOR_FORFEIT`, `INVALID_INVITE_CODE`, `USERNAME_TAKEN`, `EMAIL_TAKEN`, `NOT_YOUR_TURN`, `INVALID_PHASE`, `INVALID_ACTION`, `INSUFFICIENT_FUNDS`, `STATE_VERSION_CONFLICT`, `CONTENT_VERSION_MISMATCH`, `MATCH_PAUSED` | Conflict |
| 429 | `RATE_LIMITED` | Rate limiting |
| 500 | `INTERNAL_ERROR` | Internal error |
| 503 | `DEPENDENCY_UNAVAILABLE` | Database unavailable |

`GET /health` is public; returns 200 `{data:{status:"ok"},meta:{}}` when service and DB reachable, **503 with standard error** `DEPENDENCY_UNAVAILABLE` when DB is down. Sensitive diagnostics stay server-side. Always rate-limit auth, invites and actions.

## 7. Contract review

All five core docs plus ONLINE-MVP-RULES.md and CONTRACT-CONSISTENCY-REVIEW.md must be reviewed together. Documentation changes alone do not establish working backend, schema migrations, tests or production readiness.

