# 3D Monopoly — Frontend / Backend Integration Plan v1.0.0

**Status:** Implementation plan for team review; not a claim of completed implementation.
**Normative references:** [REST API](./API-CONTRACT.md), [Socket Events](./SOCKET-EVENTS.md), [Game State](./GAME-STATE.md), [Database](./DATABASE-DESIGN.md)

## 1. Repository and branches

The repo root stays a functioning React 18 / TypeScript / Vite / Three.js app. Backend lives in `backend/` (NestJS + TypeScript + Prisma + PostgreSQL); do **not** move the frontend into a new directory. Existing local/AI gameplay remains independent of network mode.

Work from reviewed feature branches. Backend foundation is confined to `backend/`, except agreed shared tooling. Avoid unrelated changes to root package, CI, tsconfig or lockfile. Do not commit `.env`, DB credentials, JWT secrets or refresh tokens; document placeholders in `backend/.env.example`.

## 2. Cross-team locked v1 decisions

| Concern | Contract |
|---|---|
| Launch online game | 2–4 humans, one map `central-castle`, ruleset `classic-v1`, content version `central-castle@1` |
| Transport | REST-only mutations; Socket.IO-only notifications/subscriptions/presence |
| API result | `{data,meta}` success; `{error:{code,message,details}}` failure |
| Money | TypeScript `number` safe integer within 32-bit signed range; PostgreSQL `INTEGER`; no `BIGINT` for game money |
| Persistence | `matches` persists doubles, dice, optional auction/trade/debt and pause; `match_players` persists disconnect data; `processed_actions` persists UUID idempotency |
| Client commands | UUID `clientActionId`, `expectedStateVersion`, `contentVersion` in every mutation |
| Auth | 15-min JWT bearer access token kept in memory; rotating 7-day HttpOnly refresh cookie; CSRF and origin safeguards |
| Reconnect | 120-second grace, full snapshot on join, match PAUSED on expiry; no automatic forfeits |
| Lobby | 2–4 players; host implicitly ready; on host exit waiting room oldest active player becomes host |
| Deferred | Online auctions/trades/build/mortgage/jail/cards/debt/bankruptcy, server AI, daily rewards/leaderboards |

## 3. 21-day rollout and responsibilities

| Priority | Backend | Frontend | Shared acceptance test |
|---|---|---|---|
| P0 | App scaffold, health, DB/migrations | Preserve current local mode | Frontend builds; backend starts |
| P0 | Auth/session and CSRF | Typed API client, login | Register/login/refresh/logout |
| P0 | Lobby create/join/ready/start | Lobby components | 2 browser accounts start |
| P0 | Match snapshot, roll, buy/decline, rent, end turn | Online store adapter, state/animation separation | Server dice, no client authority |
| P0 | Socket broadcasts, presence and grace pause | Subscribe, dedup, recover snapshot | 2 browser tabs + reconnect |
| P1 | Complete specific classic rules | UI for additional actions | Only when exact rules and payloads tested |
| P2 | Progression, maps, cosmetics | Visual polish | Later release |

If the core P0 multiplayer path cannot be completed by the deadline, deliver a strong local/AI game instead of presenting partially implemented backend features as working.

## 4. Integration boundary

Frontend service modules (when implementation begins): `src/services/apiClient.ts`, `authService.ts`, `roomService.ts`, `matchService.ts`, `src/socket/socketClient.ts`, `src/types/api.ts` (or a shared contract package once it exists). Existing `src/store/useGameStore.ts` remains local game authority. In online mode use a separate adapter/store driven by server `MatchState`; camera/modal/animation state stays client-local. Avoid local AI timers and local dice randomization changing online authority.

Run frontend: `npm install && npm run dev`. Run backend once scaffolded: `cd backend && npm install && npm run start:dev`. Configure dev CORS credentials/origins appropriately and database URL through backend environment.

## 5. Required team tests and PR gate

1. Five documentation files agree on one transport, endpoint family, error envelope and money type.
2. All backend schema migrations include `matches.doubles_count`, `dice_state`, `auction_state`, `pending_trade_state`, `pending_debt_state`, `paused_at`, `pause_reason`, `match_players.connection_status`, `disconnected_at`, and `processed_actions` uniqueness.
3. Duplicate same `clientActionId` with same request does not roll/buy twice; changed request with same ID is 409; stale distinct action is 409.
4. Money overflow and non-integer input rejected; DB round-trip equals JSON `number` integer.
5. Frontend never emits gameplay mutation over Socket.IO and never trusts its own dice/balance as canonical.
6. Two independent browser sessions see identical versioned match state; reconnect obtains complete snapshot; 120-second disconnect results in PAUSED state and no auto-forfeit.
7. Access/refresh token and CSRF lifecycle validated. Unauthorized room/match access refused.
8. Local/AI game, build, rendering and existing frontend tests still pass.

**Definition of done:** PR is code-reviewed; schema, request/response, unit/integration/e2e tests pass for its specific feature; deployment instructions are reproducible. Docs being approved is not equivalent to backend being implemented.
