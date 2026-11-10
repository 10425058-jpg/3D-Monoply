# 3D Monopoly — API Contract v1.1.0 (online MVP)

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

The creator is first room member and host. Ready-to-start requires 2–4 human members; host is implicitly ready, others must mark ready. On leaving a WAITING room, host transfers to oldest active member; close if empty. A room is accessible through REST and Socket.IO only after server membership authorization. Public `GET /rooms` lists WAITING non-private rooms with safe summary only.

| Method | Path | Input | Response `data` |
|---|---|---|---|
| GET | `/rooms?limit=20&cursor=...` | Bearer token; optional pagination | `{items:[{roomId,mapId,memberCount,maxPlayers,status}],nextCursor:null|string}` |
| POST | `/rooms` | `{mapId:"central-castle",maxPlayers:4,isPrivate:boolean}` | 201 `{room:RoomState,inviteCode?:string}` |
| GET | `/rooms/:roomId` | member auth | RoomState |
| POST | `/rooms/:roomId/join` | `{inviteCode?:string}` | RoomState |
| POST | `/rooms/:roomId/leave` | `{}` | `{success:true}` |
| PATCH | `/rooms/:roomId/ready` | `{isReady:boolean}` | RoomState |
| POST | `/rooms/:roomId/start` | `{rulesetId:"mini-v1",contentVersion:"central-castle@1"}` | 201 `{matchId,stateVersion,status,mapId}` |

For a private room: generate cryptographically random high-entropy invite code (e.g. 16 random bytes base64url), return raw `inviteCode` **only once in successful create response** to host. Store only hash, never broadcast or log code. Host UI must offer Copy Code immediately; after loss, create a new code via authenticated host-only `POST /rooms/:roomId/invite/rotate` returning new `inviteCode`, invalidating prior code atomically. GET room never returns raw code; join comparison constant-time. Public listing never exposes private rooms, invite tokens, emails or passwords. Room Socket.IO subscriptions are defined in SOCKET-EVENTS.md.

## 4. Server-authoritative gameplay actions

`GET /matches/:matchId` returns authorized **public MatchState snapshot** as `{data:MatchState,meta:{}}` including committed phase, player states, allowed actions, turn count, winner and pause status. Internal deck orders and server randomness must not be in public snapshots.

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

## 5. Pause / reconnect / match ending

Clients authenticate socket `/game` using short-lived access token. On expiry, client obtains a new access token using protected refresh route and **reconnects** socket with new `auth.token`; rejoin `room:join` (if in lobby) or `match:join`; server reauthorizes and emits snapshot. On 401, do not loop forever; return user to login without forfeiting match.

On player disconnect, persist the last-socket disconnection time and apply the 120-second grace, pause, host failover, player-forfeit, and 24-hour terminal safety rules in §8. Do not auto-forfeit solely due to disconnection.

Game ends `FINISHED` when one solvent player remains or after 80 **completed player turns** with deterministic net-worth tie-break in ONLINE-MVP-RULES.md. `GAME_OVER` phase; winner persisted; emit `game:finished`. `currentPlayerId` remains non-null in IN_PROGRESS/PAUSED; becomes null when FINISHED/ABANDONED.

## 6. Error codes and health

| HTTP status | Error code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid shape/type/integer money or board IDs |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` | Bad/expired auth |
| 403 | `FORBIDDEN`, `CSRF_INVALID` | Not member/host, origin or CSRF failed |
| 404 | `ROOM_NOT_FOUND`, `MATCH_NOT_FOUND` | Resource absent/inaccessible |
| 409 | `ROOM_FULL`, `ROOM_ALREADY_STARTED`, `INVALID_INVITE_CODE`, `USERNAME_TAKEN`, `EMAIL_TAKEN`, `NOT_YOUR_TURN`, `INVALID_PHASE`, `INVALID_ACTION`, `INSUFFICIENT_FUNDS`, `STATE_VERSION_CONFLICT`, `CONTENT_VERSION_MISMATCH`, `MATCH_PAUSED` | Conflict |
| 429 | `RATE_LIMITED` | Rate limiting |
| 500 | `INTERNAL_ERROR` | Internal error |
| 503 | `DEPENDENCY_UNAVAILABLE` | Database unavailable |

`GET /health` is public; returns 200 `{data:{status:"ok"},meta:{}}` when service and DB reachable, **503 with standard error** `DEPENDENCY_UNAVAILABLE` when DB is down. Sensitive diagnostics stay server-side. Always rate-limit auth, invites and actions.

## 7. Contract review

All five core docs plus ONLINE-MVP-RULES.md and CONTRACT-CONSISTENCY-REVIEW.md must be reviewed together. Documentation changes alone do not establish working backend, schema migrations, tests or production readiness.

## 8. Match host failover, absence and room lifecycle (v1.1.1 clarification)

This section is normative and **replaces the earlier host-only abandon / all-reconnect-only deadlock wording in §5**. The room's `hostUserId` is the authority for **both waiting and active/paused matches**, not just waiting rooms; the backend must enforce it on every privileged action.

- **120-second disconnect grace:** identify a participant as disconnected only when all authenticated match sockets are gone, persist `disconnectedAt`. After grace expiry mark the match `PAUSED` (unless already terminal). Do not automatically forfeit for connectivity loss.
- **Host failover:** if the current host is disconnected **beyond 120 seconds** while the room is IN_PROGRESS, atomically transfer `rooms.host_user_id` and `room_members.is_host` to the *connected, non-bankrupt participant with lowest `seatOrder`*. Increment `roomRevision`, emit `room:updated` and `room:host_changed`. If nobody eligible is connected, retain the former host until an eligible player reconnects, then elect immediately. The former host never automatically reclaims host privileges.
- **Resume:** while PAUSED, when all remaining non-bankrupt participants are CONNECTED, resume IN_PROGRESS and emit `game:resumed`. Alternatively a connected elected host may eliminate overdue disconnected participants using the explicit command below; after each elimination, recompute winner, remaining required connections and whether to resume. Preserve the correct turn pointer, phase, pending purchase and doubles state, unless the removed participant was current player; then advance to next eligible seat and initialize their PRE_ROLL turn.
- **Host remove overdue absent player:** `POST /matches/:matchId/actions/forfeit-player` body = `{clientActionId,expectedStateVersion,contentVersion,targetPlayerId}`. Allowed **only in PAUSED**, authenticated current connected host, after target has been continuously disconnected for **at least 120 seconds**, and target has not reconnected. Mark target bankrupt/forfeited to Bank, release their properties, and log actor/target; emit `game:player_bankrupt` with reason `HOST_FORFEIT_ABSENT` and related turn/winner events. This is irreversible and must be confirmed by the UI. Reject own target, connected players, or early requests with 409 `PLAYER_NOT_ELIGIBLE_FOR_FORFEIT`. Apply normal idempotency. A player's voluntary `forfeit` remains allowed in IN_PROGRESS or PAUSED.
- **Abandon:** `POST /matches/:matchId/abandon` with `{clientActionId,expectedStateVersion,contentVersion}` is a **host-only** action during PAUSED; host must be authenticated and currently connected. It closes the match as ABANDONED with no winner. An inactive former host has no special privilege after failover.
- **24-hour terminal safety:** if **zero non-bankrupt players are connected continuously for 24 hours**, automatically transition nonterminal match to ABANDONED, with `finishReason:null`, `winnerPlayerId:null` and `currentPlayerId:null`. Persist `allPlayersOfflineSince` on the match for restart-safe scheduling, clear it whenever an eligible participant reconnects. Timer starts from the instant the last eligible player disconnects, not from match creation or the first disconnect. This is the **only** automatic abandonment rule; no immediate abandonment as soon as everyone goes offline.
- **After FINISHED or ABANDONED:** atomically set the associated `rooms.status=CLOSED`, preserve `rooms.match_id` and final host/room history for read-only results, increment roomRevision and emit `room:updated`, plus `game:finished` or `game:abandoned`. A CLOSED room cannot be joined, readied or restarted. **No rematch in same room in mini-v1**; players create a new room. A new lobby starts as WAITING with its own host and no prior member ready state.
- Ensure the server treats these host and match transitions as versioned, atomic operations (match stateVersion for authoritative match changes; roomRevision for host/room changes). Subscribe/refresh authorization must check latest room host membership.

**New error codes:** 409 `PLAYER_NOT_ELIGIBLE_FOR_FORFEIT`, 409 `ROOM_CLOSED`, 409 `MATCH_ALREADY_TERMINAL`. A reconnect after automatic abandonment may view the final snapshot but cannot resume the match.

**Test vectors:** missing host, host away >120s, two connected players choosing the lowest-seat host, former host reconnects (no privilege reclaim), host forfeits overdue current player, host cannot forfeit connected/early absence, all players disconnected for 23h59m vs 24h, restart-safe deadline, finish closes room, abandon closes room, closed room cannot rematch.
