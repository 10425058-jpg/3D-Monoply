# Miniature City online frontend

The application opens at a main menu. Play Solo mounts the existing game, including its AI, local rules, meta progression, graphics options and effects. Play Online opens authentication, a public lobby, public/private waiting rooms, and a server-authoritative match in the existing React Three Fiber scene. Online uses **mini-v1**, a finite 2–4 human player variant; auctions, trades, mortgages and buildings remain Solo features.

## Run locally

Use Node 20.6+ and PostgreSQL 16. Install dependencies in both directories:

```sh
npm ci
cd backend
npm ci
cp .env.example .env
```

Set `DATABASE_URL` to your development database and `JWT_ACCESS_SECRET` to a newly generated secret of at least 32 characters. Never commit `.env`. The backend example describes every setting. For Docker development, change the placeholder database password, then run:

```sh
docker compose up -d
npx prisma migrate deploy
npm run start:dev
```

In another terminal at the repository root:

```sh
npm run dev -- --host localhost
```

The default URLs are `http://localhost:5173` and `http://localhost:3000`. Vite proxies `/api` and `/socket.io` to NestJS. Add the **exact browser origin** to backend `CORS_ORIGIN`, including the port if Vite chooses another port. Use `localhost` consistently; mixing `127.0.0.1` and `localhost` changes cookie behavior. `COOKIE_SECURE=false` is for local HTTP only.

The frontend `.env.example` documents optional `VITE_API_BASE_URL` and `VITE_SOCKET_URL`. Defaults are same-origin `/api/v1` and namespace `/game`. Socket.IO uses its default **transport path `/socket.io`**; `/game` is a namespace, not the transport path. Changing Vite variables requires restarting Vite or rebuilding.

## Architecture and authority

- `src/Application.tsx` selects the menu, Solo or online screens using hash routes, compatible with the existing relative GitHub Pages base. Room/match UUIDs in the hash allow reload recovery. Credentials and invites never enter URLs.
- `src/online/apiClient.ts` parses actual `{data,meta}` envelopes, masks internal errors, uses cookie credentials and `cache: no-store`, and retries an authorized 401 at most once. It binds browser fetch correctly and bounds requests at 20 seconds.
- `sessionManager.ts` keeps JWT/CSRF/user state in memory. Restore bootstraps CSRF, rotates the HttpOnly cookie, and reads `/users/me`. Refresh is single-flight; Web Locks serialize cookie operations across same-origin tabs. Every rotation bootstraps CSRF again inside the lock because another tab may have rotated it. BroadcastChannel sends a logout signal containing no credentials. A failed refresh clears authentication without touching Solo. Successful refresh updates identity and reconnects sockets with the new JWT.
- `onlineController.ts` owns a screen's subscription, REST reconciliation and action mutex. New actions get a UUID and current version. An uncertain network/5xx result blocks further actions and offers an explicit retry using the **original complete request**, including UUID and expected version. A version conflict reads a snapshot and does not resubmit a new action. No optimistic dice, money, purchases or movements are committed locally.
- `socketClient.ts` subscribes after connection with acknowledgement handling and retry after a lost acknowledgement. It listens to all implemented room/game/presence events, including the backend's additional `game:money_changed`. JWT changes replace the old connection and listeners. Reconnect and foregrounding fetch personalized snapshots; an eight-second visible-tab REST poll covers missed notifications or lost broadcasts. Presence can change without advancing `stateVersion` and must still be fetched.
- `eventTracker.ts` bounds event-ID deduplication, detects sequence gaps and ignores older sequenced notifications. Several events may share one version. No broadcast is copied into another viewer's `allowedActions`.
- `gamePresentationAdapter.ts` maps UUID player identity to immutable server-assigned seats through an explicit map. Ownership uses that map, never array position. The separate scene store exposes presentation controls only, with no Solo game commands. Its cancellable animation queue displays committed dice first, then tile hops, and reconciles to the server result. Jail/card relocations reconcile directly. Reduced motion skips transition animation.
- `presentation/SceneStore.tsx` injects the data source into the existing scene, board, tokens, dice, camera, diagnostics and effects. The default is the existing Solo store. The online provider uses its own store and never calls Solo rules. The existing geometry, assets, lights, camera presets, instance batching, quality limits and effects are retained. Memoizing the scene prevents unrelated HUD/activity updates from rerendering the world.

Navigation also exercises environment teardown. `instanceResources.ts` releases instance-owned buffers through Three's prototype method because R3F masks the instance's `dispose` with `dispose={null}` to protect cached GLBs. Cached geometry/atlases remain reusable; a regression test verifies that separation.

Leaving a waiting room uses REST and changes membership. Unsubscribing or leaving the match screen does not forfeit. The explicit Forfeit action requires confirmation. Pause, host failover, eligible absent-player forfeiture, abandonment and terminal authority remain on the backend. A closed room has no rematch; return to the lobby to create another.

Private invite codes live only in memory. Create and rotate responses show them to the host. Reloading loses the original code; the host can replace it. Copy Invite includes both full room ID and code. Public lists never contain private rooms.

## Focused backend recovery fix

The original `game:finished` event contained standings, but `GET /matches/:id` omitted persisted ranks. A client that missed the event or reloaded could recover the winner but could not recover authoritative rankings. `projectMatchState` now returns an additive `standings` array, empty before FINISHED and on abandonment. Terminal ranks come from `match_players.final_rank`; money and net worth use persisted state and the server's existing calculation. No request contracts, rules or schema changed. The integration test verifies equal standings for both viewers after finish and snapshot recovery.

## Test commands

```sh
# Frontend: security, retries, mapping, event ordering and socket lifecycle
npm run test:online
node --test tests/animations.test.mjs tests/graphics.test.mjs tests/environment-assets.test.mjs
npm run build

# Backend
cd backend
npm test
npm run lint
npm run build
# Requires a running backend against a DISPOSABLE database
npm run test:integration
```

`npm run test:online-browser` drives the real UI through isolated Chrome contexts. It registers disposable users, creates rooms and persists game actions. Point it only at an application backed by a **disposable database**. It expects Chrome at the same path as the existing graphics audits; override `CHROME_PATH` on other systems. `ONLINE_TEST_URL` defaults to `http://localhost:5174`; set it to your Vite origin and allow that origin in NestJS. Use backend `DISCONNECT_GRACE_SECONDS=2` for this test. Evidence goes to ignored `.online-test/` (override with `ONLINE_TEST_OUT`). The script never writes credentials, cookies or invite codes to evidence files.

The script covers auth/logout/reload, public room live ready/start, authoritative dice and 3D reconciliation, action replay, reload, actual socket loss/pause/resume, terminal results after refresh, private invite rotation/rejection, and Solo roll/property/AI regression. It captures desktop and mobile views. No API responses or gameplay state are mocked in this suite. Pure unit tests use test doubles for failure paths.

See `ONLINE-VERIFICATION.md` for executed results and limits; commands in this document are instructions, not assertions that deployment has been verified.

## Production hosting

The checked-in `.github/workflows/deploy.yml` publishes only the static Vite bundle to GitHub Pages. The repository contains **no configured production API origin**. GitHub Pages does not run NestJS or PostgreSQL. This PR does not deploy or provision either service.

Prefer one HTTPS origin serving the built frontend and reverse-proxying `/api/v1` and `/socket.io` to NestJS. Keep `base: './'` for relative assets. For example, at a reverse proxy:

```nginx
location /api/v1/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Origin $http_origin;
}
location /socket.io/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 75s;
}
```

Host PostgreSQL separately with backups and private connectivity. Run the committed Prisma migrations before starting NestJS. Set `COOKIE_SECURE=true` and exact HTTPS frontend origins in `CORS_ORIGIN`. Preserve Origin and CSRF headers; do not wildcard credentialed CORS. Keep Socket.IO on the **same single backend process**: this backend's socket registry and rate limiter are process-local and currently have no shared adapter or durable outbox.

The existing refresh cookie is HttpOnly, **SameSite=Lax**, scoped to `/api/v1/auth`. A GitHub Pages frontend and an unrelated API hostname are cross-site: login may return a short-lived JWT, but cross-site fetch cannot reliably restore/refresh this Lax cookie. Do not claim persistent authentication in that topology. HTTPS frontend/API subdomains under the same registrable domain can be same-site, but still require precise CORS and browser verification. No cross-site production cookie change or production authentication verification is included here. Local same-origin proxy cookie/CSRF recovery is exercised by the browser suite.

When the API is absent or unavailable, the UI reports **Online Service Unavailable**. Solo remains accessible without authentication. The frontend does not replace an unavailable service with simulated rooms or local multiplayer.
