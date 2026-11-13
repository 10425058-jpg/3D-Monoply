# Step 6 — Launch real multiplayer on Render (opt-in)

## Current status

The repository now contains a **deployment configuration**, not a live deployment.
The current GitHub Pages workflow still publishes the **static-only** React build.
GitHub Pages cannot run the NestJS backend, PostgreSQL, or Socket.IO server.

This step introduces a second hosting target: a **single Render HTTPS web
service** serves both the React build and NestJS/Socket.IO, backed by a **separate
managed PostgreSQL 16 database**. Players must use that full-stack Render URL
(or a verified custom domain) for online multiplayer.

Nothing is provisioned until you connect your Render account and explicitly sync
the Blueprint. The Blueprint selects paid plans; review Render's current pricing
**before approving the sync**. It has `autoDeployTrigger: off` to avoid deploying
every subsequent push without review. Do not configure multiple web instances:
this backend's presence registry is in process memory.

## Why one origin?

The frontend defaults to `/api/v1` and Socket.IO namespace `/game` with
transport path `/socket.io`. When Nest serves the Vite files too, all three use
the **same HTTPS site**.

The existing refresh cookie is `HttpOnly; SameSite=Lax` and is restricted to
`/api/v1/auth`; production also requires `Secure`. This works naturally
with same-site requests and avoids assuming cross-site cookies will work between
`github.io` and an unrelated API hostname.

Render supplies `RENDER_EXTERNAL_URL` at runtime. The backend trusts this exact
origin for CORS, Socket.IO, and refresh/logout CSRF origin validation.
To use a custom domain, add its exact HTTPS origin to `CORS_ORIGIN` in the
Render Dashboard (comma-separated if several are needed). Set HTTPS on every
public hostname. Never use `*` with credentialed CORS.

## Before deploying

1. Review/merge the deployment PR into `main`; confirm GitHub Actions is green.
2. Open [Render Dashboard](https://dashboard.render.com/) and connect the
   GitHub repository `10425058-jpg/3D-Monoply`.
3. Choose **New → Blueprint**, select this repository and its `render.yaml`.
4. Review the planned **Starter web service** and **PostgreSQL 16** instance
   with compute plan `0.1c-256mb` and **15 GB disk** in **Singapore**.
   These are PAID resources, billed separately for compute and database storage.
   **Do not proceed unless you have reviewed current prices in your dashboard,
   workspace tier, storage/compute charges and billing limits.**
5. Approve the Blueprint sync. Render generates `JWT_ACCESS_SECRET` and wires
   the PostgreSQL private connection string automatically; do not paste or
   commit either secret. Verify generated `JWT_ACCESS_SECRET` is nonempty.
6. After creation, open the `miniature-city-online` service on Render and
   **manually deploy** `main` (auto-deploy is intentionally off). Render builds
   frontend and backend; its paid pre-deploy command runs
   `npx prisma migrate deploy` before starting the server.
7. Wait for the health check to pass. Render will show the actual
   `https://...onrender.com` URL; use **that actual URL**, not a guessed one.

To deploy a later change, open Render and manually deploy a reviewed commit.
Review each Prisma migration first; do not casually roll back applied schemas.

## Render Blueprint details

- `render.yaml`: Node 22, Singapore, one web instance, PostgreSQL 16.
- Build: frontend `npm ci --include=dev && npm run build`, then backend
  `npm ci --include=dev && npm run build`.
- Pre-deploy: `cd backend && npx prisma migrate deploy` (requires paid web plan).
- Start: `cd backend && npm run start:prod`.
- Nest binds to `0.0.0.0:${PORT}` and can serve `../dist` when
  `SERVE_FRONTEND=true`; all other environments retain the original behavior.
- Render sets `RENDER_EXTERNAL_URL`, which is added as a trusted origin.
- Render connects to PostgreSQL using the **internal** database URL, and
  external database IP access is disabled in `render.yaml`.
- `COOKIE_SECURE=true`, `NODE_ENV=production`, and a randomly generated JWT
  signing secret are set by the Blueprint.

## Database backups: required before accepting real users

Render's paid PostgreSQL instances offer continuous Point-in-Time Recovery (PITR).
Current recovery windows depend on the **workspace tier**, not the database
compute size: **3 days for Hobby, 7 days for Pro+**. The Free database instance
does not provide PITR. The recovery operation creates a **new, separately billed
database instance** rather than rolling back the existing database in place.

Before inviting real players, open the PostgreSQL **Recovery** tab on Render,
confirm PITR is enabled, and verify the recovery-window dates. Create an
**on-demand logical backup** when available and store it safely outside the
application/database. Do a restore drill in an isolated instance before launch;
confirm that migrations and expected tables are present and that the original
DB remains unchanged. A backup that has never been restored is not fully tested.

The Blueprint cannot prove backups are active or usable: that requires an actual
provisioned database and a real restore test in your Render account. Never store
backup exports or DB credentials in the public Git repository. For ongoing
operation, schedule periodic logical exports to external storage if you require
retention beyond the short PITR window. Monitor storage utilization; the
`diskSizeGB: 15` allocation is not unlimited and cannot be reduced in place.

References:
- https://render.com/docs/postgresql-backups
- https://render.com/docs/blueprint-spec
- https://render.com/docs/compute-plans

## Proxy security and per-player rate limits

The Render Blueprint sets `TRUST_PROXY_HOPS=1`. Express trusts only the
nearest reverse-proxy hop for `req.ip` (never `trust proxy=true`).
This is needed for accurate per-client throttling when Render terminates TLS.
Do **not** configure this on a server exposed directly to arbitrary clients,
or change the hop count without verifying the infrastructure. Local development
uses `TRUST_PROXY_HOPS=0` by default. The CI suite tests spoofed
`X-Forwarded-For` prefixes and verifies that separate client IPs receive
independent rate limits.

Run the dedicated GitHub Actions security check before deployment. It inspects
**production** npm dependencies separately from dev/test dependencies. Audit
results describe potential exposures; a clean audit is not a security guarantee.

## Acceptance test after Render deployment

Use **two browsers or independent profiles**, not two tabs sharing one user:

1. Open the actual Render service URL. The Main Menu and 3D scene load.
2. Visit `https://YOUR-RENDER-HOST/api/v1/health`. It should return a
   `200` with the standard `{"data":{"status":"ok"},"meta":{}}` envelope.
3. Register Alice and Bob from two separate browser contexts.
4. Alice creates a **private** two-player room and copies its code and room ID.
5. Bob joins using that invitation. Alice/Bob both see the Waiting Room.
6. Bob selects Ready; Alice starts the match.
7. Roll and complete at least one server-authoritative turn. Compare
   3D dice, positions, property ownership, cash, and next-turn state.
8. Reload Bob's browser during the match. Check that cookie/CSRF restoration
   succeeds and the **same** match is restored.
9. Disconnect Bob and reconnect; verify pause/resume behavior (production
   grace is 120 seconds; allow for the expected delay).
10. Open the browser Network tab: `/api/v1` calls and `/socket.io` requests
    should target the **same hostname** as the frontend, and the refresh
    cookie should be `Secure; HttpOnly; SameSite=Lax`.

Do not claim public multiplayer is verified until these steps pass.

## Existing GitHub Pages URL

The existing GitHub Pages deployment continues to work for Solo. Its static
`github.io` origin **does not** proxy to Render automatically and will not
work for Play Online in this setup. Share the **Render full-stack URL** for
online play instead. Pointing the old GitHub Pages frontend at Render as a
different-site backend would require additional authentication and CSRF design
work and is intentionally not implemented here.

If you use a custom domain later, point it at the Render web service and
configure the exact domain in Render + `CORS_ORIGIN`. Verify TLS and session
restoration under that domain before announcing it.

## Security and production limits

- The server stores passwords as hashes, but do not use a test password for
  administrator accounts or publish database credentials.
- Keep one server instance; Socket.IO match presence/rate limits are currently
  process-local and do **not** use a Redis adapter/shared state.
- A restart drops active WebSocket connections; clients reauthenticate and
  recover state from PostgreSQL. Test this behavior manually before launch.
- Production monitoring, observability, backups, abuse controls and real-user
  load tests are not implemented by the hosting Blueprint alone.
- Do not assume phone Safari or long-duration sessions have been validated.
- Only the `mini-v1` ruleset is available online, not all Solo mechanics.

## Verification supplied by this PR

`.github/workflows/deploy-readiness.yml` checks the Render-style build in
GitHub Actions, applies migrations to **disposable** PostgreSQL, starts
Nest serving Vite assets, checks health, origin validation and secure-cookie
behavior, and reruns the backend Socket.IO integration tests. This validates
deployment **readiness**, not public network reachability or actual Render
service provisioning.
