# Backend guide — where it goes, how to run it, how to debug it

Written for someone who has not run a backend before. Follow it top to bottom the first time.

## 1. What this is

The game today runs entirely in the browser: `src/store/useGameStore.ts` rolls the dice and
moves the money, so everyone has to sit at one computer. The backend is a separate program
that does those jobs on a server, so players on different computers see the same game and
nobody can cheat by editing their own browser.

| Part | State |
|---|---|
| Game rules (`src/game/`) | Tested: 57 automated tests pass, including 500 random full games. |
| Server (login, rooms, matches, sockets, database) | Written and reviewed, but **never run**. Expect a few errors the first time. Section 6 says how to deal with them. |
| Frontend connection | **Not built.** The frontend does not talk to the backend yet. See section 8. |

## 2. Where it goes

The `backend` folder sits at the top of the repo, next to `src` and `docs`. Nothing inside
`src/` changes.

```text
3D-Monoply-main/
├── backend/        <- this folder (new)
├── docs/
├── public/
├── src/            <- the frontend, unchanged
├── index.html
└── package.json    <- the FRONTEND's package.json, not the backend's
```

The frontend and backend are two separate programs with two separate `package.json` files.
Commands for the backend are always run **inside `backend/`**.

## 3. Install these once

| Tool | Why | Check it works |
|---|---|---|
| Node.js 20.6 or newer (nodejs.org, "LTS") | Runs the server | `node -v` |
| Docker Desktop (docker.com) | Runs the PostgreSQL database | `docker -v`, and the Docker app must be open |

On Windows, Docker Desktop asks to install WSL 2 the first time. Say yes and restart.

## 4. First run

Open a terminal in the repo folder. In VS Code: Terminal > New Terminal.

```bash
cd backend
npm install
```

Takes a minute or two. It should end with a line like `added 400 packages`. Warnings are fine;
lines starting with `npm ERR!` are not.

```bash
cp .env.example .env
```

On Windows PowerShell use `copy .env.example .env`. This creates your private settings file.
Open `.env`, find `JWT_ACCESS_SECRET`, and replace the value with a long random string. This
prints one you can paste:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Start the database (Docker Desktop must be running):

```bash
npm run db:up
```

Create the tables. This also creates a `prisma/migrations/` folder. Commit that folder.

```bash
npx prisma migrate dev --name init
npm run db:constraints
```

Check the code, then start the server:

```bash
npm test
npm run lint
npm run start:dev
```

- `npm test` should end with `pass 57` and `fail 0`.
- `npm run lint` should print nothing. Anything it prints is an error to fix (section 6).
- `npm run start:dev` should end with `API: http://localhost:3000/api/v1`. Leave it running.

Open <http://localhost:3000/api/v1/health> in a browser. You should see:

```json
{"data":{"status":"ok"},"meta":{}}
```

## 5. Check that it really works

With the server still running, open a **second** terminal:

```bash
cd backend
npm run smoke
```

This plays the start of a real match: it registers two test users, creates a room, joins,
starts a match and takes 12 turns' worth of actions. Each step prints a tick. If it ends with
`All smoke checks passed`, login, rooms, the database and the game rules all work together.
If a step fails, it prints which request failed and the server's error code.

To look inside the database: `npm run prisma:studio` opens a page showing every table.

What the smoke test does not cover: live socket updates, pause/resume when someone
disconnects, and refresh tokens. Those need the frontend, or two browsers.

### Every day after the first

```bash
cd backend
npm run db:up
npm run start:dev
```

Stop the server with Ctrl+C. Stop the database with `npm run db:down`.

## 6. Debugging

**Where errors show up**

| Place | What you see there |
|---|---|
| The terminal running `npm run start:dev` | Startup failures and crashes, with a file name and line number |
| `npm run lint` | Type errors, as `src/some/file.ts(12,5): error TS....` (file, line, column) |
| The browser's Network tab (F12) | What a request sent and the `{ "error": { "code", "message" } }` it got back |
| `npm run smoke` | The first request that fails |

Read the **first** error, not the last. Later ones are usually caused by the first.

**Common problems**

| You see | Cause | Fix |
|---|---|---|
| `JWT_ACCESS_SECRET is missing or too short` | No `.env`, or the placeholder is still in it | Do the `.env` step in section 4 |
| Health page shows `DEPENDENCY_UNAVAILABLE`, or `Can't reach database server` (P1001) | Database is not running | Open Docker Desktop, then `npm run db:up`. `docker ps` should list `monopoly-postgres` |
| `The table public.users does not exist` (P2021) | Tables were never created | `npx prisma migrate dev --name init` |
| `port is already allocated` on 5432 | Another PostgreSQL is already using that port | In `docker-compose.yml` change `"5432:5432"` to `"5433:5432"`, and in `.env` change `5432` to `5433` |
| `EADDRINUSE ... 3000` | Something else uses port 3000, or the server is already running in another terminal | Close the other one, or set `PORT=3001` in `.env` |
| `@prisma/client did not initialize yet` | The database client was not generated | `npx prisma generate` |
| `Nest can't resolve dependencies of ...` | A wiring mistake in a `*.module.ts` file | The message names the class and the module. Send it to whoever maintains the backend |
| Browser console: `blocked by CORS policy` | The frontend's address is not allowed | `CORS_ORIGIN` in `.env` must match the frontend address exactly, e.g. `http://localhost:5173`. Restart the server |
| `401 UNAUTHORIZED` | No access token, or it expired (they last 15 minutes) | Call `POST /auth/refresh`, then retry |
| `403 CSRF_INVALID` | `refresh` or `logout` without the `X-CSRF-Token` header, or from a wrong address | Send the `csrfToken` from login in that header |
| `409 STATE_VERSION_CONFLICT` | The game moved on since you last fetched it | `GET /matches/:matchId`, then retry with the new `stateVersion` |
| `409 CONTENT_VERSION_MISMATCH` | Wrong `contentVersion` in the request | Send `"central-castle@1"` |
| `429 RATE_LIMITED` | Too many requests in a minute | Wait. The response says how many seconds |
| `Lifecycle sweep failed` every 5 seconds | Database is down, or tables are missing | Fix the database; the messages stop |

**If a rule of the game is wrong** (wrong rent, wrong card effect), the bug is in
`src/game/rules/engine.ts`. Add a test to `test/engine.test.ts` that shows the wrong
behaviour, fix the engine, and run `npm test`. No database or server is needed for this.

**To start over with an empty database:** `npx prisma migrate reset`, then `npm run db:constraints`.

## 7. Which file does what

| If the problem is with... | Look in |
|---|---|
| Register, login, tokens, cookies | `src/auth/` |
| Creating, joining, leaving, starting rooms | `src/rooms/rooms.service.ts` |
| Dice, movement, rent, cards, jail, bankruptcy, winning | `src/game/rules/engine.ts` |
| Board prices and card texts | `src/game/content/` (generated from the frontend's `src/data/`) |
| "Version conflict", repeated requests, saving a move | `src/matches/matches.service.ts` |
| What a player is allowed to see | `projectMatchState` in `src/matches/match-store.ts` |
| Disconnects, pausing, host changes, abandoned matches | `src/matches/lifecycle.service.ts` |
| Live updates over sockets | `src/realtime/game.gateway.ts` |
| Database tables | `prisma/schema.prisma` |
| The shape of every error | `src/common/errors.ts`, `src/common/http-exception.filter.ts` |

If `src/data/boardData.ts` or `src/data/cardsData.ts` change in the frontend, the backend's
copy in `src/game/content/` must be regenerated and `CONTENT_VERSION` raised, or the two
sides will disagree about prices.

## 8. Connecting the frontend (not done yet)

The frontend has no code that talks to a server. This is stage 6 of `docs/INTEGRATION-PLAN.md`.
The existing local game stays as it is; online mode is added beside it.

**Where the new code goes**

```text
src/
├── online/                 <- new folder
│   ├── api.ts              <- fetch wrapper for /api/v1, keeps the access token in memory
│   ├── socket.ts           <- Socket.IO connection to /game
│   └── useOnlineStore.ts   <- online game state (same idea as store/useGameStore.ts)
├── components/ui/          <- new screens: Login, Lobby, Room
└── App.tsx                 <- choose "Play locally" or "Play online"
```

**What it needs**

- In the repo root (not `backend/`): `npm install socket.io-client`
- A root `.env` file containing `VITE_API_URL=http://localhost:3000`
- Two terminals while developing: `npm run start:dev` in `backend/`, and `npm run dev` in the root

**What the frontend does, in order**

1. `POST /auth/register` or `/auth/login`. Keep `accessToken` and `csrfToken` in memory, never
   in `localStorage`. Auth requests need `credentials: 'include'` so the browser stores the
   refresh cookie.
2. `GET /rooms`, `POST /rooms`, `POST /rooms/:roomId/join`, `PATCH /rooms/:roomId/ready`.
3. Open the socket: `io(VITE_API_URL + '/game', { auth: { token: accessToken } })`, then emit
   `room:join` to get lobby updates.
4. The host calls `POST /rooms/:roomId/start`. Everyone receives `match:started`.
5. Emit `match:join`. The server replies with `match:snapshot`, the whole game as this player sees it.
6. Show buttons only for what is in `allowedActions`. A click sends
   `POST /matches/:matchId/actions/roll-dice` (and so on) with a new `clientActionId`, the
   current `stateVersion`, and `contentVersion`.
7. Update the screen from the socket events (`game:dice_rolled`, `game:player_moved`, ...).
   If an event's `sequence` skips a number, fetch `GET /matches/:matchId` again.

The frontend never rolls dice or changes money in online mode. It only asks, then shows what
the server says happened.

The exact request and event shapes are in `docs/API-CONTRACT.md`, `docs/SOCKET-EVENTS.md` and
`docs/GAME-STATE.md`.

## 9. Putting it on GitHub

Do not upload `node_modules/`, `dist/` or `.env`. The `.gitignore` in this folder already
excludes them. `.env` holds your secret and must never be committed.

**In the browser**

1. On the repo page, click the branch button (`main`), type `backend-setup`, and choose
   **Create branch**.
2. **Add file > Upload files**. Drag the whole `backend` folder in, so the files land under
   `backend/`. Check that `.gitignore` and `.env.example` are included (they are hidden files:
   Cmd+Shift+. shows them on Mac; View > Hidden items on Windows).
3. Commit to the `backend-setup` branch.
4. Click **Compare & pull request**, set the base to `main`, and choose **Create draft pull request**.

**With Git**

```bash
git checkout -b backend-setup
git add backend
git commit -m "Add backend (NestJS, Prisma, rules engine)"
git push -u origin backend-setup
```

Then open the pull request on GitHub.

## 10. Before marking the pull request ready

- [ ] `npm install` finishes without `npm ERR!`
- [ ] `npm test` shows `pass 57`, `fail 0`
- [ ] `npm run lint` prints nothing
- [ ] `prisma/migrations/` exists and is committed
- [ ] The health page shows `"status":"ok"`
- [ ] `npm run smoke` ends with `All smoke checks passed`
- [ ] The team has decided on the items under "Where this differs from the docs" in `README.md`
