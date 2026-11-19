# Solo dice E2E timing failure

The old resilience test awaited Puppeteer's Roll click and then started polling `turnPhase`. By the time the first poll arrived on a slow renderer, the game could already be moving. A live SwiftShader reproduction recorded a trusted click, the committed `[3, 5]` roll, visible dice, all eight tile transitions, the correct top faces, and the final `LANDED_ACTION` decision. Its delayed legacy poll missed `ROLLING`. [Failed GitHub Actions run](https://github.com/10425058-jpg/3D-Monoply/actions/runs/44449813391)

## Before

The probe ran against the original V7 game in Chrome with the same SwiftShader flags as CI. It subscribed to the live Zustand store through Vite, recorded the browser input and scene transforms, then ran the old post-click polling loop. The third trial added an 850 ms delay to the Node-side read to reproduce the original failing predicate. The other two trials used the original polling cadence.

| Measurement | SwiftShader | SwiftShader, 4× CPU throttle | SwiftShader, delayed read |
| --- | ---: | ---: | ---: |
| DOM click dispatch to capture | 2.4 ms | 13.1 ms | 2.6 ms |
| Click capture to `ROLLING` commit | 0.7 ms | 3.9 ms | 0.6 ms |
| Commit to Puppeteer click completion | 413.6 ms | 67.7 ms | 629.3 ms |
| Actual time in `ROLLING` | 687.9 ms | 713.4 ms | 684.6 ms |
| First legacy sample from commit | 418.4 ms | 68.8 ms | 1491.1 ms |
| First sampled phase | `ROLLING` | `ROLLING` | `MOVING` |
| Rolling scene samples / token hops | 3 / 4 | 3 / 3 | 2 / 7 |
| Settled faces and upward alignment | 3, 5 / 1, 1 | 3, 5 / 1, 1 | 3, 5 / 1, 1 |

In the delayed trial, the click acknowledgment left about 55 ms before `MOVING`. The first poll arrived 807 ms after that transition. WebGL and the environment had reported ready, fonts were loaded, and the main thread recorded a task of up to 612 ms during the observation window. The archived CI log records the assertion and its surrounding steps. Its exact input and frame timing is unavailable.

The V7 store schedules 680 ms at 1× and 340 ms at 2×. A busy browser main thread can postpone those callbacks, as the measured phase durations show. Once the browser yields, it can commit the next phase before Puppeteer finishes the click or submits a separate sample. This behavior also explains why increasing the polling frequency after the click leaves the race in place.

The post-click phase polling predates V7. Earlier board regression checks began recording dice poses in the browser before input, and an earlier resilience change waited for a settled pose. The resilience phase assertion still depended on Node polling the live phase. That left the same race in place across those revisions.

## Fix

- `useSoloAudit.ts` exposes a turn subscription on the existing `?soloTest` loopback hook. It records phase, committed dice, active player, speed, and tile changes synchronously.
- `GraphicsAudit.tsx` exposes a frame callback on the opt-in graphics audit. It samples the actual meshes after Three.js submits the board scene. The renderer and Zustand observations stay independent.
- `board-v5-motion.mjs` installs the subscriptions and input timestamps before the real Roll click. It reads the trace after landing, verifies `ROLLING → MOVING → LANDED_ACTION` and all eight committed steps, then checks a rendered token hop and both settled dice faces. Failure output includes the click and sample timestamps, phases, mesh poses, long tasks, console errors and a screenshot. Cleanup detaches both observers and restores the fixture RNG.
- `board-v5-resilience.mjs` invokes the observer and offers a focused motion run and a quality, speed and motion matrix.

The fix is based on `391a306`, the current `main` merge of PR #65. The source diff preserves V7's gameplay timers, production rendering, board and environment, AI, economy, and Online rules.

## After

The corrected test first reads the result after the board has submitted the landing frame. All four focused runs recovered the complete phase history from that late read. Each rendered hop exceeds the original height threshold of 0.38, and both settled dice report top faces 3 and 5 with upward alignment 1.0.

| Renderer and run | Actual time in `ROLLING` | First result read from commit | Rolling frames | First rendered hop height |
| --- | ---: | ---: | ---: | ---: |
| Native WebGL | 687.7 ms | 2133.7 ms | 40 | 0.709 |
| SwiftShader 1 | 1131.2 ms | 2527.2 ms | 2 | 0.525 |
| SwiftShader 2 | 689.7 ms | 2732.9 ms | 5 | 0.749 |
| SwiftShader 3 | 817.2 ms | 2293.0 ms | 2 | 0.501 |

All 12 SwiftShader quality, speed and motion combinations passed, along with a consecutive turn in the same game. In two normal-motion profiles SwiftShader submitted only two rolling frames with near-level dice. Those cases verified rolling visibility, a rendered hop and the exact settled orientation. The other five normal-motion cases also recorded visibly tilted dice during the roll. [Recorded timelines and matrix measurements](timelines.json)

## Reproduction and verification

Run the focused check with `node scripts/board-v5-resilience.mjs --motion-only`. Add `--matrix` to cover Low, Balanced and High, both motion preferences, both speeds, and a consecutive roll in the same match. Set `CI=true` to use the workflow's SwiftShader flags. The full board regression uses `npm run test:board-browser`. On failure the trace and screenshot are written to `V5_EVIDENCE_OUT`.

| Local check | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm run test:animations` | 21 passed |
| `npm run test:solo` | 52 passed |
| Focused browser check | Native WebGL and three independent SwiftShader launches passed |
| SwiftShader browser matrix | 13 cases passed |
| `npm run test:board-browser` | Board scenarios, four repeat mounts, three WebGL context recovery checks, motion, optional font fallback, and eight rules audit scenarios passed |
