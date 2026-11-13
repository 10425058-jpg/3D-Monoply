# Priority 3 — Continuous browser E2E, Node 22 and Three.js dependency consistency

## CI coverage

Every pull request targeting `main` that changes the frontend, backend, test
scripts, npm locks or the validation workflow triggers **Validate Pull Requests**.
This workflow now has two required jobs:

1. `build`: Node 22, deterministic `npm ci`, online state/security unit tests,
   existing animation/graphics regressions and production frontend build.
2. `Real Chrome / two players / PostgreSQL` (after `build`): Node 22, pinned
   Chrome, a disposable PostgreSQL 16 service, committed Prisma migrations,
   production-style Vite + NestJS build served from **one origin**, and
   `npm run test:online-browser` with **two isolated Chrome browser contexts**.

The Chrome suite exercises real login/session cookies, public and private room
flows, authoritative dice and 3D state, turn handoff, reload, reconnect/pause,
idempotent action replay, results and Solo regression. The existing script uses
`ONLINE_TEST_URL` for its website origin and `CHROME_PATH` for its browser.

Chrome on the CI runner uses software WebGL (SwiftShader); this is a rendering
test, but NOT a benchmark of a real discrete GPU or a substitute for phone QA.
Two browser contexts run against a **disposable CI database**, not production.
No credentials from the temporary sessions are published to logs or artifacts.

A failed workflow uploads `.online-test/priority3/` PNG screenshots and
sanitized `results.json`, kept for seven days. Run logs also include the
NestJS server output on failure. For successful runs, screenshots are still
available as the same short-lived artifact for review. Never commit test
screenshots containing private invite codes; the browser script masks them.

## Node.js version policy

- The repository root `.nvmrc` specifies **Node 22**.
- Frontend PR CI, Pages deployment, backend CI and Render deployment use 22.
- GitHub Pages now uses `npm ci` rather than the unpredictable `npm install`.
- Both package manifests require Node `>=22.12 <23`.
- TypeScript Node type declarations follow major version 22.
- For VS Code on Windows, install Node 22 LTS and check `node -v`,
  then run `npm ci` in the root and in `backend/`.

## Three.js and postprocessing

The project retains Three.js **0.164.1** and React Three Fiber 8. A more
recent transitive `postprocessing@6.39.6` requires Three **>=0.168**, which
is incompatible with the current scene and other pinned dependencies.

We explicitly depend on **postprocessing 6.35.6** and override all transitive
resolutions to use this version. Its declared Three peer range is
`>=0.152.0 <0.167.0`, covering Three 0.164.1 without forcing an engine
upgrade. The lockfile is regenerated and committed. Node 22 `npm ci`,
frontend build and real-browser test must pass before merging.

Do not remove the pin or upgrade Three without checking the entire dependency
graph, graphics tests, and the real Chrome suite.

## Production validation still required

The browser CI test uses **local HTTP** and **temporary PostgreSQL** while
serving React/NestJS from the same origin. It verifies the deployment shape,
not live Render HTTPS, DNS, SSL certificates, database recovery, real latency,
production WebSocket proxies, performance with dozens of players or mobile
Safari.

Before publicly announcing multiplayer:
1. Verify Render has been provisioned explicitly and its real URL is healthy.
2. Confirm PostgreSQL backups/restore via Render's dashboard and a restore drill.
3. Open the **actual Render HTTPS URL** in two separate browser profiles, create
   two test accounts and run the public/private room and full-game checklist
   in `docs/ONLINE-DEPLOYMENT.md`.
4. Inspect cookies (`Secure; HttpOnly; SameSite=Lax`), CORS, and WebSocket
   connections via the browser Network panel on the real domain.
5. Test page reload, client disconnect/reconnect, phone landscape, and a
   production server restart using an isolated test match.
6. Do not mistake GitHub Pages frontend deployment for hosting multiplayer.

Actual internet deployment requires your Render account, billing authorization,
and a running managed PostgreSQL database. No external production server is
created by this pull request.
