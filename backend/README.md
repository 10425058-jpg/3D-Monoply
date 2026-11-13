# 3D Monopoly — Backend

NestJS + TypeScript server for online multiplayer (`mini-v1` rules on `central-castle@1`),
with PostgreSQL through Prisma and Socket.IO for live notifications.

It implements the contracts in `docs/` (v1.1.2): `API-CONTRACT.md`, `SOCKET-EVENTS.md`,
`GAME-STATE.md`, `DATABASE-DESIGN.md` and `ONLINE-MVP-RULES.md`.

## Status — read this first

| Part | State |
|---|---|
| Rules engine (`src/game/`) | **Tested.** 57 automated tests pass, including 500 random full games. |
| Server layer (auth, rooms, matches, sockets, database) | **CI-verified.** NestJS starts against an isolated PostgreSQL instance, the REST smoke test passes, and HTTP/Socket.IO integration tests exercise auth, room and match flows. |
| Database migration | **Committed and CI-verified.** Apply the versioned migration with `npx prisma migrate deploy`. |

Nothing here has been played end to end in two browsers. Do that before telling anyone online mode works
(`docs/INTEGRATION-PLAN.md` §3).

**New here? Read [`GUIDE.md`](./GUIDE.md) first.** It walks through setup, running, testing and debugging step by step.

## Continuous integration

Every pull request targeting `main` that changes `backend/**` or the backend CI
workflow runs a single GitHub Actions check: **Backend CI / Backend / PostgreSQL / Socket.IO**.
The same workflow runs after backend changes are pushed to `main`, and it can be
run manually using **Actions → Backend CI → Run workflow**.

The check uses Node.js 22, `npm ci` with the committed `backend/package-lock.json`,
an isolated PostgreSQL 16 service, Prisma schema/drift/integrity checks, all 57
rules engine tests, NestJS type-check/build, REST smoke tests, and HTTP/Socket.IO
integration tests. The old separate step-1/2/3 verification workflows were removed
to avoid duplicated work. Database and JWT settings in CI are **test-only**.

When updating backend dependencies, run `npm install` inside `backend/` and
commit both `package.json` and `package-lock.json`. CI uses `npm ci` and
fails if they are out of sync.

## Requirements

- **Node.js 20.6 or newer** (`node -v`)
- **Docker Desktop** for the local PostgreSQL database (or your own PostgreSQL 16)

## Setup (first time)

Run everything inside the `backend/` folder.

```bash
cd backend

# 1. Install packages (also generates the Prisma client)
npm install

# 2. Create your local settings
cp .env.example .env          # Windows PowerShell: copy .env.example .env
#    Open .env and replace JWT_ACCESS_SECRET with a long random string.

# 3. Start PostgreSQL
npm run db:up

# 4. Apply the committed migrations (creates all tables and CHECK constraints)
npx prisma migrate deploy

# Migration status (optional)
npx prisma migrate status

# 6. Check the code
npm test                      # rules engine tests
npm run lint                  # type-check everything

# 7. Start the server (restarts when you save a file)
npm run start:dev
```

Then open <http://localhost:3000/api/v1/health>. You should see `{"data":{"status":"ok"},"meta":{}}`.
A `503` with `DEPENDENCY_UNAVAILABLE` means the server runs but cannot reach PostgreSQL.

The initial migration includes all six gameplay CHECK constraints. For future schema changes, add corresponding SQL constraints to a versioned migration. `npm run db:constraints` remains available for maintenance but is not required after the initial deployment.

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run the server in watch mode |
| `npm run build` / `npm run start:prod` | Build to `dist/` and run the build |
| `npm test` | Rules engine unit tests |
| `npm run test:integration` | Integration tests against a running backend and **disposable** PostgreSQL database (auth, room/match, Socket.IO and reconnect) |
| `npm run lint` | Type-check without building |
| `npm run smoke` | Plays the start of a real match against the running server (REST only) |
| `npm run db:up` / `npm run db:down` | Start / stop the local PostgreSQL container |
| `npm run db:migrate` | Create and apply a new development migration after editing `schema.prisma` |
| `npx prisma migrate deploy` | Apply committed migrations in deployment environments |
| `npm run db:constraints` | Apply `prisma/sql/constraints.sql` |
| `npm run prisma:studio` | Browse the database in your browser |

## Resume Match and session maintenance (priority 2)

- `GET /api/v1/matches/active` requires an access JWT and returns up to 20
  latest `IN_PROGRESS` or `PAUSED` matches **belonging to that user only**.
  The result includes match ID, room ID, map, turn, status, and timestamps,
  but never players' secret decks or other users' private snapshots.
- The online Lobby's **Continue playing** section uses this endpoint. Clicking
  Resume opens the existing server-authoritative match using its ID; the
  existing recovery flow subscribes to `/game` and fetches a personalized snapshot.
- `SessionCleanupService` runs on startup and once per hour; each sweep
  removes at most 1,000 already-expired sessions or sessions revoked over
  seven days earlier. Recent revoked sessions and valid active sessions remain.
  SQL indexes on expiration and revocation were added in a committed migration.
  This service assumes the existing single-instance backend deployment.
- Browser logout now clears in-memory credentials immediately, even if
  revocation fails due to network loss. A **non-secret localStorage marker**
  blocks cookie-based session restoration until the remote logout is retried
  successfully. When back online, it retries CSRF bootstrap and server logout.
  Do not clear local storage to bypass the pending marker: the old refresh
  cookie may still be valid on the server.
- This pending-marker protection requires persistent browser storage. When
  the browser denies storage access, an offline logout cannot guarantee
  sign-out will survive a full reload before server revocation. For public
  launch, confirm storage is available in your supported browser matrix.

## Integration tests

Step 3 adds `test/integration.test.mjs`; Step 4 consolidates all backend checks into
`.github/workflows/backend-ci.yml`. This workflow creates a **temporary**
PostgreSQL 16 database, applies committed migrations, builds/starts NestJS, and runs
`npm run test:integration` with `DISCONNECT_GRACE_SECONDS=2` to exercise pause,
reconnect and host failover quickly.

For a local integration run, start a **dedicated test PostgreSQL database** and the
backend server (with `DISCONNECT_GRACE_SECONDS=2`) first, then execute
`npm run test:integration` in a separate terminal. The tests register users,
create rooms/matches, and persist actions; **never use your production database**.
The server must allow `http://localhost:5173` as a CORS origin.

This suite checks real HTTP/Socket.IO/database behavior but does **not** simulate a
full 80-turn game, restart the server in mid-match, or test token expiry after 15 minutes.

## Environment variables

See `.env.example`. **Never commit `.env`.**

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 3000) |
| `CORS_ORIGIN` | Frontend URL(s) allowed to call the API and sockets, comma-separated |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Signs the 15-minute access tokens (32+ characters) |
| `COOKIE_SECURE` | `true` on HTTPS, `false` on `http://localhost` |
| `DISCONNECT_GRACE_SECONDS` | Optional. Lower it to test pause/resume quickly (default 120) |

## Folder structure

```text
backend/
  prisma/
    schema.prisma           # all tables (docs/DATABASE-DESIGN.md)
    sql/constraints.sql     # CHECK constraints
  src/
    main.ts, app.module.ts  # startup, /api/v1 prefix, CORS
    config.ts, env.ts       # settings from .env
    common/                 # error format, { data, meta } wrapper, rate limit, validators
    prisma/                 # database connection
    health/                 # GET /health
    auth/                   # register, login, refresh, logout, csrf, access-token guard
    users/                  # GET / PATCH /users/me
    rooms/                  # lobby: list, create, join, leave, ready, invite, start
    game/
      content/              # board + cards, generated from the frontend's src/data
      rules/                # the rules engine — pure TypeScript, no database or network
    matches/
      matches.service.ts    # snapshot + actions (idempotency, versions, one transaction)
      lifecycle.service.ts  # presence, pause/resume, host failover, 24-hour abandon
      match-store.ts        # load/save a match, public snapshot
    realtime/               # Socket.IO "/game" namespace (subscriptions only)
  test/engine.test.ts       # rules tests
```

## REST API (`/api/v1`)

Success: `{ "data": ..., "meta": {} }`. Error: `{ "error": { "code", "message", "details" } }`.
Protected routes need `Authorization: Bearer <accessToken>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | public |
| POST | `/auth/register`, `/auth/login` | return `user, accessToken, expiresIn, csrfToken`; set the refresh cookie |
| POST | `/auth/refresh`, `/auth/logout` | refresh cookie + `X-CSRF-Token` header |
| GET | `/auth/csrf` | new CSRF token after a page reload |
| GET, PATCH | `/users/me` | profile |
| GET | `/rooms?limit=&cursor=` | public waiting rooms |
| POST | `/rooms` | create; private rooms return `inviteCode` once |
| GET | `/rooms/:roomId` | members only |
| POST | `/rooms/:roomId/join`, `/leave`, `/start`, `/invite/rotate` | |
| PATCH | `/rooms/:roomId/ready` | |
| GET | `/matches/:matchId` | the caller's personal snapshot |
| POST | `/matches/:matchId/actions/:action` | `roll-dice`, `buy-property`, `decline-property`, `end-turn`, `pay-jail-bail`, `use-jail-card`, `forfeit`, `forfeit-player`, `abandon` |

Every action body carries `clientActionId` (UUID), `expectedStateVersion` and
`contentVersion: "central-castle@1"`. Sending the same request twice returns the first response
and changes nothing.

## Socket.IO (`/game` namespace)

Connect with `io("http://localhost:3000/game", { auth: { token: accessToken } })`.
Client events: `room:join`, `room:leave`, `match:join`, `match:leave`. Nothing else.
All game changes go through REST; the socket only notifies.

## How an action is processed

1. Check the access token and that the caller is a player in the match.
2. Lock the match row, so actions on one match run one at a time.
3. Look up `clientActionId`. An exact retry gets the stored response.
4. Check `contentVersion`, then `expectedStateVersion`.
5. Run the rules engine (`src/game/rules/engine.ts`).
6. Save the new state, the processed action and the events in one transaction.
7. After the commit, broadcast the events over Socket.IO.

## Where this differs from the docs

Raise these with the team and update the docs or the code:

1. **Extra event `game:money_changed`** `{playerId, amount, balance, reason}` for GO salary, tax, bail,
   purchases and card payments. The docs list no event for these, so clients could not animate them.
   `game:player_moved` also carries `passedGo`.
2. **No partial unique indexes.** "One active membership per room and user" and "one member per seat"
   are enforced in code while the room row is locked, not by a database index. Prisma cannot declare
   partial indexes.
3. **`POST /rooms/:roomId/leave` during a match is rejected** (`ROOM_ALREADY_STARTED`). Players use
   `forfeit`. The docs do not say what should happen.
4. **New matches start with every player `DISCONNECTED`.** Each player has the normal grace period to
   send `match:join`. Otherwise a player who never opens the game would count as connected forever.
5. **`match:leave` counts as that socket going offline** for the disconnect rules.
6. **Pause and resume each add 1 to `stateVersion`.** A connection change alone does not.
7. **`room:host_changed` is also sent on the match channel**, so players who left the lobby channel see it.
8. **`game:rent_paid` is not sent when the payer goes bankrupt**; `game:player_bankrupt` is sent instead.
9. **`stateVersion` starts at 0** for a new match.
10. **The deck is stored as a draw pile**: `ordered_card_ids[0]` is the next card, a drawn card goes
    straight to the bottom, `draw_cursor` counts draws, and `returned_card_ids` stays empty.

## Known limits

- **One server process only.** The socket registry and the rate limiter are in memory.
- **Events are broadcast straight after the commit.** There is no outbox, so a crash between the two
  loses the broadcast; clients recover with `GET /matches/:matchId`.
- **No tests for the server layer yet.** `docs/INTEGRATION-PLAN.md` §5 lists the ones required.
