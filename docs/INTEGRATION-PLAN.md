# 3D Monopoly — Frontend / Backend Integration Plan

## 1. Repository ownership

The current root application is the Frontend (React + TypeScript + Vite). Keep it working as-is.

Proposed repository layout:

```text
3D-Monoply/
  src/                  # existing Frontend
  public/               # existing static assets
  backend/              # new NestJS application
  docs/
    API-CONTRACT.md
    SOCKET-EVENTS.md
    GAME-STATE.md
    DATABASE-DESIGN.md
    INTEGRATION-PLAN.md
```

Do not move the current root frontend into a new `frontend/` folder as part of the first Backend PR. That would create unnecessary churn and risk breaking existing scripts/deployment.

## 2. Branch workflow

- Frontend work: feature branches from the agreed base branch.
- Backend foundation: `feature/backend-foundation`.
- Contract/docs: `docs/api-contract-and-architecture`.
- Never commit directly to `main`.
- Keep Backend changes inside `backend/` initially, except for explicitly agreed root-level documentation or shared tooling.
- Coordinate changes to root `package.json`, lockfiles, TypeScript config, and CI workflows.

## 3. Local development (proposed)

Frontend (repository root):

```bash
npm install
npm run dev
```

Backend (after it is created):

```bash
cd backend
npm install
npm run start:dev
```

Database should run locally or through an agreed development service. Backend must document the exact PostgreSQL setup, environment variables, Prisma generation, and migration commands in `backend/README.md`.

Do not commit real `.env` files or production secrets. Commit `.env.example` with placeholder values only.

## 4. Integration sequence

1. Review and approve the API Contract, Socket Events, Game State, and Database Design docs.
2. Backend foundation PR: NestJS app, health check, environment config, Prisma/PostgreSQL connection.
3. Auth and profile endpoints.
4. Room/lobby endpoints and room events.
5. Match snapshot endpoint and server-authoritative core game actions.
6. Frontend creates API client and online-mode service layer.
7. Connect Socket.IO, render authoritative events, and add reconnect/snapshot recovery.
8. Test two or more browser sessions against the same match.
9. Add remaining rules and progression features incrementally.

## 5. Frontend integration boundary

The current `src/store/useGameStore.ts` contains local gameplay logic and local AI behavior. Do not replace it wholesale during backend foundation.

Recommended approach:

- Preserve current local mode.
- Add an explicit online mode / online store adapter when the backend match APIs are ready.
- Keep UI and 3D scene components consuming a stable view model where possible.
- Keep presentation-only state local.
- In online mode, apply server snapshots/events to the online game state.
- Do not let local AI timers or local random dice logic control an online match.

Suggested future frontend additions:

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

## 6. Definition of done for first Backend PR

- NestJS starts locally.
- Health endpoint responds successfully.
- PostgreSQL connection is documented and verifiable.
- Prisma schema and migration workflow are documented.
- `.env.example` contains placeholders only.
- Backend has its own package.json.
- Existing root Frontend build remains unaffected.
- No Frontend files are modified without agreement.
- Setup steps are documented and tested by another teammate.

## 7. Team decisions to record

Before implementation, agree on:
- API response format and error codes.
- Authentication token/refresh strategy.
- Initial map ID and board data versioning.
- Supported player count and host-leave behavior.
- Exact first-release Monopoly rules.
- Whether AI can join online rooms.
- Disconnect/reconnect grace period.
- Scope of trades, auctions, cards, jail, debt, and custom railroad events.
- First-release progression features.
