# V10 lossless performance

The comparison starts from `main` at `98685215059bc0afbff8bbb06adf6806e6b1266f`. Both sides are production builds of the same game, including the current token geometry, V9 dialogs, and complete environment.

## Rendering changes

- The key directional light reuses its PCF shadow map while the light and its visible casters are unchanged. Casters request updates when they move, mount, unmount, or upload changed instance transforms. The light checks its own transform after Three updates world matrices. The map also refreshes after context restoration.
- Environment GLB and sakura batches reuse their existing culling bounds and instance order. They skip the visibility calculation when the camera and batch transform are unchanged and reuse the list of visible instances on motion. Fixed local matrices avoid recomposition on these batches and Arcade lots.
- Each Classic house or hotel submits its two matching windows as one instanced draw. Each pair uses the original geometry, offsets, and material. All houses share their window resources, as do all hotels. Both dice share pip geometry. The planar construction rings render in one pass with the original two-sided material.
- Landmark and island subscriptions follow the player fields their visuals use. Token appearance is separated from property and hover updates, and token placement reuses its seat offsets. The canvas pauses when the page is hidden and retains its animation clock for the next visible frame. Visible ambient effects continue running between turns.

## Measurement

The harness uses the existing `graphicsAudit` renderer instrumentation and the loopback `soloTest` fixtures. It runs one foreground canvas at a time in a fresh Chrome context, alternating which build runs first. The viewport is 1440 × 900 at DPR 1. Normal motion is enabled. It measures separate windows for an idle board, pointer orbit and zoom, three settings dialog cycles, a committed dice roll, the ensuing token hop, a property upgrade, 22 developed Arcade lots, and a Classic stress fixture with 32 houses and three hotels. Draw calls and submitted triangles include the shadow pass when it runs.

The renderer was Chrome's ANGLE D3D11 backend on an AMD Radeon 610M, with an AMD Ryzen 9 8945HX and about 15.3 GiB RAM. The audit received GPU elapsed-time queries from WebGL. CPU timings cover `WebGLRenderer.render`. Frame intervals include time outside that call. Long tasks come from the browser's Performance Observer. Shader counters measure compile and link submissions and synchronous link-status calls. Heap metrics are browser measurements, and texture and geometry bytes are estimates from scene resources.

[Balanced measurements](evidence/benchmark-balanced.json) · [High measurements](evidence/benchmark-high.json)

### Balanced results

Each cell gives the median result across three runs before and three after. FPS is calculated from mean frame intervals within each run. CPU and GPU columns show median milliseconds per frame.

| Scenario | FPS | Frame p50 ms | Frame p95 ms | CPU ms | GPU ms | Draw calls | Submitted triangles |
|---|---:|---:|---:|---:|---:|---:|---:|
| Idle | 61.7 → 68.5 | 14.8 → 14.3 | 23.9 → 17.2 | 1.9 → 1.7 | 13.23 → 12.80 | 278 → 260 | 1,076,942 → 966,946 |
| Orbit and zoom | 56.1 → 55.9 | 16.8 → 17.4 | 24.5 → 21.4 | 1.9 → 1.8 | 14.66 → 15.08 | 261 → 243 | 995,111 → 878,425 |
| Dice | 54.6 → 56.6 | 17.9 → 17.1 | 23.3 → 21.6 | 2.3 → 2.2 | 14.96 → 14.60 | 288 → 288 | 1,093,918 → 1,093,918 |
| Token movement | 60.4 → 65.5 | 16.7 → 15.7 | 21.7 → 20.3 | 1.9 → 2.3 | 14.48 → 14.42 | 289 → 289 | 1,093,942 → 1,093,942 |
| Construction | 54.9 → 61.1 | 16.4 → 15.2 | 28.4 → 27.6 | 2.4 → 2.0 | 14.41 → 14.41 | 308 → 287 | 1,099,058 → 981,160 |
| Settings dialog | 48.1 → 51.6 | 18.7 → 18.8 | 25.5 → 22.9 | 2.3 → 2.3 | 15.41 → 15.42 | 297 → 279 | 1,171,309 → 1,061,313 |
| Late Arcade | 54.0 → 51.3 | 17.9 → 18.6 | 23.7 → 26.5 | 1.9 → 1.7 | 15.37 → 15.61 | 297 → 279 | 1,171,309 → 1,061,313 |
| Late Classic | 56.1 → 57.9 | 17.4 → 17.1 | 22.0 → 19.0 | 3.9 → 2.9 | 14.69 → 14.70 | 553 → 432 | 1,024,846 → 935,762 |

Late Arcade saved 18 draw calls and recorded a higher p95. Orbit p95 fell by 3.1 ms and its median interval rose by 0.6 ms. Construction triggered two long tasks per run, with their median combined duration falling from 170 ms to 145 ms. The Classic stress fixture reported 496 → 427 live renderer geometries.

### High results

| Scenario | FPS | Frame p50 ms | Frame p95 ms | CPU ms | GPU ms | Draw calls | Submitted triangles |
|---|---:|---:|---:|---:|---:|---:|---:|
| Idle | 49.0 → 55.5 | 19.6 → 17.8 | 23.0 → 21.0 | 2.5 → 2.0 | 18.20 → 16.07 | 293 → 273 | 1,421,096 → 1,212,448 |
| Orbit and zoom | 43.2 → 48.3 | 22.0 → 20.5 | 29.1 → 25.0 | 2.3 → 1.8 | 19.59 → 18.23 | 270 → 248 | 1,354,603 → 1,137,401 |
| Dice | 43.4 → 44.1 | 22.9 → 22.6 | 31.7 → 27.3 | 3.7 → 2.9 | 19.88 → 19.35 | 303 → 303 | 1,438,072 → 1,438,072 |
| Token movement | 48.2 → 46.9 | 21.1 → 22.2 | 26.4 → 25.9 | 2.8 → 2.4 | 18.78 → 19.64 | 304 → 304 | 1,438,096 → 1,438,096 |
| Construction | 44.7 → 47.3 | 21.9 → 20.5 | 43.2 → 42.3 | 3.0 → 2.2 | 19.83 → 18.96 | 322 → 325 | 1,428,340 → 1,443,856 |
| Settings dialog | 40.0 → 43.7 | 24.6 → 22.2 | 27.9 → 28.1 | 2.5 → 2.6 | 21.04 → 18.54 | 318 → 292 | 1,577,266 → 1,306,815 |
| Late Arcade | 42.3 → 44.1 | 23.0 → 21.2 | 29.5 → 33.7 | 3.1 → 2.0 | 20.77 → 18.76 | 318 → 292 | 1,577,266 → 1,306,815 |
| Late Classic | 43.9 → 47.3 | 22.1 → 20.4 | 27.4 → 25.6 | 4.6 → 3.4 | 19.23 → 18.01 | 568 → 445 | 1,369,000 → 1,181,264 |

Late Arcade still had a higher p95 at High. Dice and token frames often needed fresh shadows. The timing of those updates also affects the construction draw-count samples. Long-task totals during High construction were 167 → 221 ms. End-of-run JS heap medians were 42.9 → 29.9 MiB at Balanced and 31.8 → 45.3 MiB at High. These are live readings from the benchmark, without forced collection, and vary with garbage collection timing.

## Visual comparison

Each pair captures the 3D canvas at the same viewport, DPR, camera pose, seed, game phase, and animation time. The recorded cases include an active roll, a token in motion, and a house still under construction. The PNG comparison counts pixels by their largest RGB channel difference.

All 18 pairs were pixel-identical. The capture waited for the actual four-glyph construction cash label to be rendered on both builds before advancing the clock. The candidate submitted zero shadow passes in the stationary and camera-only probes. Dice, movement, landmarks, and High construction still refreshed the map. The hidden-tab probe recorded zero canvas clears and confirmed that rendering resumed on visibility change. All three production CSS chunks matched the baseline byte for byte.

| Scene | Balanced | High |
|---|---|---|
| Full board and four player islands | [Before](evidence/captures/balanced/before/01-overview.png) · [After](evidence/captures/balanced/after/01-overview.png) | [Before](evidence/captures/high/before/01-overview.png) · [After](evidence/captures/high/after/01-overview.png) |
| Castle and town buildings | [Before](evidence/captures/balanced/before/02-castle.png) · [After](evidence/captures/balanced/after/02-castle.png) | [Before](evidence/captures/high/before/02-castle.png) · [After](evidence/captures/high/after/02-castle.png) |
| Four player tokens on GO | [Before](evidence/captures/balanced/before/03-tokens-on-go.png) · [After](evidence/captures/balanced/after/03-tokens-on-go.png) | [Before](evidence/captures/high/before/03-tokens-on-go.png) · [After](evidence/captures/high/after/03-tokens-on-go.png) |
| Floating islands and waterfalls | [Before](evidence/captures/balanced/before/04-floating-islands-waterfalls.png) · [After](evidence/captures/balanced/after/04-floating-islands-waterfalls.png) | [Before](evidence/captures/high/before/04-floating-islands-waterfalls.png) · [After](evidence/captures/high/after/04-floating-islands-waterfalls.png) |
| Dice rolling | [Before](evidence/captures/balanced/before/05-dice-rolling.png) · [After](evidence/captures/balanced/after/05-dice-rolling.png) | [Before](evidence/captures/high/before/05-dice-rolling.png) · [After](evidence/captures/high/after/05-dice-rolling.png) |
| Token movement | [Before](evidence/captures/balanced/before/06-token-moving.png) · [After](evidence/captures/balanced/after/06-token-moving.png) | [Before](evidence/captures/high/before/06-token-moving.png) · [After](evidence/captures/high/after/06-token-moving.png) |
| Property construction | [Before](evidence/captures/balanced/before/07-property-construction.png) · [After](evidence/captures/balanced/after/07-property-construction.png) | [Before](evidence/captures/high/before/07-property-construction.png) · [After](evidence/captures/high/after/07-property-construction.png) |
| Late Arcade board | [Before](evidence/captures/balanced/before/08-late-game.png) · [After](evidence/captures/balanced/after/08-late-game.png) | [Before](evidence/captures/high/before/08-late-game.png) · [After](evidence/captures/high/after/08-late-game.png) |
| Classic houses and hotels | [Before](evidence/captures/balanced/before/09-classic-houses-hotels.png) · [After](evidence/captures/balanced/after/09-classic-houses-hotels.png) | [Before](evidence/captures/high/before/09-classic-houses-hotels.png) · [After](evidence/captures/high/after/09-classic-houses-hotels.png) |

[Balanced camera, timestamps, pixels and render passes](evidence/captures/balanced/conditions.json) · [High camera, timestamps, pixels and render passes](evidence/captures/high/conditions.json)

## Verification

| Check | Result |
|---|---|
| `npm run lint` and `npm run build` | Passed with TypeScript and Vite 5.4.21 on Windows and Node 24.21.0. |
| Full frontend unit suite | 223 of 224 passed. The ownership-rail assertion expects two rails and receives four. The identical test fails on the archived `main` source. |
| Backend build and unit tests | Passed. All 59 backend tests passed. |
| `test:board-browser` | All three constituent scripts passed. The main suite covered 18 Solo scenarios and 22 dice observations. Four Solo mounts reported matching scene allocations and renderer counts of 231 geometries and 35 textures. Context-loss recovery passed at all three presets. |
| `test:arcade-browser` and `test:arcade-graphics-browser` | Passed the evolving properties, payment and card scenarios, four-sided model gallery at three presets, and blocked hotel GLB fallback. |
| `royal-tokens-browser.mjs` and `royal-ui-browser.mjs` | Passed token sizes and motion, and 37 dialog checks across six viewport sizes. The dialog script uses a Vite development server for its test fixtures. |
| `test:menu-browser` | Passed production startup, route, and canvas checks at four viewport sizes. |
| `test:online-browser` | All 10 scenarios passed against local NestJS, Socket.IO, and PostgreSQL, including sign-in, private rooms, authoritative rolls, reload, reconnect, and match results. The test server used the CI disconnect grace. |
| `test:arcade-online-browser` | Passed two- and four-player event, rent, card, and reconnect checks. Three returns from Home to the same Online match reported 253 geometries and 36 textures each. [Raw result](evidence/arcade-online.json) |
| `test:rules-online-browser` | Passed restored card instructions, live purchase, action replay, and quiet reload. |
| `test:environment-browser` | The legacy Low environment triangle-budget assertion failed on both production builds. The V10 captures and context-recovery suite cover the current environment. |

A separate six-return test used the same Online match on each production build and waited for old canvas disposal before remounting. Both builds reported 249 geometries and 36 textures at every sample. Post-GC heap grew by 5.11 MiB on `main` and 5.14 MiB on V10. The source of that baseline growth is unresolved. [Matched remount measurements](evidence/online-remounts.json)

## Experiments and limits

The first profile was GPU-bound. In the Balanced pilot, median idle GPU work was 17.5 ms, compared with 1.8 ms spent inside the renderer on the CPU. The original shadow pass also submitted geometry on frames where every caster held its pose. An early version discovered changed casters by scanning the scene each frame. Matched Balanced runs showed that this approach raised idle and orbit frame times, so the final cache uses updates from the casters themselves.

The live depth pass still runs on frames with moving casters. For the existing PCF filter, separating static and dynamic depth work would require combining their depths before filtering. A second independently filtered shadow map would change how shadows overlap.

The idle shader warm-up trial raised first-roll program linking and median frame time. The final build recorded 84 → 82 program links over the full Balanced run and 87 → 85 at High. First-roll links rose from two to five at Balanced and from one to two at High. First-use shader and main-thread costs remain.

An unfiltered Meshopt round trip reproduced every byte of the sampled geometry buffers for the central district, lite sakura, balanced left island, griffin, and hotel. The samples compressed by 28–53% before transport compression. The main castle GLB was 3,524,608 bytes, with 628,541 bytes after gzip. Meshopt brought the tested castle geometry buffers from 3,436,708 to 1,782,411 bytes before transport compression. The round trip used the installed codec and left the source assets intact. Shipping compressed assets calls for a separate transfer and decode benchmark under realistic network conditions.

Lower DPR, smaller shadow maps, simpler meshes, and fewer effects would each change the rendered output. Those quality trade-offs are outside this lossless comparison.

## Reproduce

Build `9868521` and this branch in separate worktrees and run their Vite previews on ports `4270` and `4271`, respectively. Run the scripts from the candidate worktree. Set `CHROME_PATH` if Chrome is installed elsewhere, `V10_ROUNDS` to repeat the benchmark, and `V10_QUALITY=high` for the High preset. The scripts accept `V10_BASELINE_URL`, `V10_CANDIDATE_URL`, and `V10_OUTPUT` overrides.

```sh
npm run lint
npm run build
node scripts/v10-performance.mjs
node scripts/v10-captures.mjs
```
