# Manual camera motion and frame pacing

The baseline is `d0ebe845f66cf7deaf7acf73eb0da195e4337a59` (`main`). The opening view uses the existing viewport fit. The overhead button remains an explicit view change. A drag or wheel input takes over from that transition and keeps its current angle and pivot.

OrbitControls still interprets mouse, wheel, and touch gestures with the existing limits and sensitivities. Its input camera accumulates the requested pose. The scene camera consumes that pose once per frame, with exponential damping of yaw, pitch, and distance. Yaw stays continuous across the spherical seam, and the camera quaternion comes from the resulting pose and pivot. Reduced motion presents the requested pose on the next frame. The controller reads player state only when an explicit player view is requested.

Pointer picking processes the latest hover sample once per animation frame and preserves immediate button and touch selection. The board uses the shared hover state for its tile and label transforms. Cloud banks keep their instance buffers until the transparent draw order changes. Renderer settings, assets, shaders, styles, and game rules are identical across the two builds.

## Measurement method

The benchmark replays 100 orbit positions and then 14 wheel steps against each production preview. A native pointer-down starts the orbit. Timed DOM events deliver identical coordinates and wheel deltas on both builds, and separate native input probes measure time from the browser event timestamp to the first render submission with a changed camera pose. The measured latency ends at WebGL submission. Headless frame intervals estimate missed 60 Hz slots by rounding each interval to the nearest slot and counting the excess beyond one.

The normal timing run disables the audit's WebGL timer. The baseline Direct3D pilot with the timer enabled spent about 2.78 seconds in `getParameter`, which includes waiting for the driver. GPU-query diagnostics run independently of the frame-pacing samples. [Direct3D CPU pilot](evidence/pilot-d3d11.cpuprofile) · [WebGL timer extension specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)

## Frame pacing results

Three pairs used fresh headless Chrome 158 contexts on Windows, an AMD Ryzen 9 8945HX and Radeon 610M, and ANGLE OpenGL 4.5. Both production builds used the Balanced preset at 1440 × 900 and DPR 1. Each context replayed the two workloads once to warm shaders and picking. The pairs alternated build order. Entries are medians of the three per-run measurements, with the baseline on the left. [Raw frame timings and input probes](evidence/comparison-balanced.json)

| Workload | FPS | Frame p50 ms | Frame p95 ms | Frame p99 ms | Estimated missed 60 Hz slots |
|---|---:|---:|---:|---:|---:|
| Orbit | 4.07 → 3.46 | 273.4 → 328.8 | 596.1 → 469.5 | 654.5 → 478.9 | 105 → 118 |
| Zoom | 3.85 → 5.81 | 304.4 → 162.6 | 444.2 → 301.5 | 459.8 → 306.1 | 83 → 57 |

| Workload | Input p50 ms | Input p95 ms | CPU render p50 ms | CPU render p95 ms | DOM dispatch p95 ms | Long tasks | Long-task total ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orbit | 409.9 → 257.2 | 587.1 → 473.2 | 3.7 → 3.6 | 5.19 → 4.78 | 0.61 → 0.31 | 1 → 1 | 82 → 264 |
| Zoom | 609.5 → 689.6 | 991.8 → 797.5 | 3.9 → 4.0 | 5.83 → 4.70 | 0.60 → 0.70 | 1 → 1 | 264 → 191 |

Each workload yielded 4–8 frame intervals per run. The large frame gaps make the p95 and p99 sensitive to individual frames. The results show mixed pacing and input latency on this device. The local runs fell short of 60 FPS. All native input probes reached a changed pose in the requested direction.

### GPU and driver diagnostics

In a separate query-enabled pair, GPU median time was 201.4 → 172.9 ms at the matched fixed pose, 207.7 → 276.7 ms during orbit, and 150.5 → 216.9 ms during zoom. CPU render medians for the moving views were 2.9–3.8 ms. The GPU timings and the CPU traces, which spent 2.14 and 1.64 seconds in `getParameter` respectively, point to GPU throughput and driver waits in these samples. The cloud-layer toggles produced inconsistent medians, so individual shader costs remain unresolved. [GPU query samples and layer probes](evidence/comparison-balanced-gpu.json) · [Baseline CPU profile](evidence/before-balanced-gpu.cpuprofile) · [Candidate CPU profile](evidence/after-balanced-gpu.cpuprofile)

## Visual preservation

Chrome captured the same poses with the same game state, animation clock, seed, drawing buffer, and render preset. Five WebGL pairs were pixel-identical. One pixel in the High orbit pair differed by one channel level. In the 1,296,000-pixel full-page images, 286–356 pixels differed per pair. Most differences were along the Roll button border with identical computed styling. A second Balanced capture reproduced all six PNGs byte for byte on the opposite build, including the border variation. All three production CSS chunks matched byte for byte. [Pixel counts, hashes, and capture conditions](evidence/visual-comparison.json)

| View | Balanced | High |
|---|---|---|
| Overview | [Before](evidence/balanced-overview-before.png) · [After](evidence/balanced-overview-after.png) | [Before](evidence/high-overview-before.png) · [After](evidence/high-overview-after.png) |
| Orbit | [Before](evidence/balanced-orbit-before.png) · [After](evidence/balanced-orbit-after.png) | [Before](evidence/high-orbit-before.png) · [After](evidence/high-orbit-after.png) |
| Zoom and Settings | [Before](evidence/balanced-zoom-settings-before.png) · [After](evidence/balanced-zoom-settings-after.png) | [Before](evidence/high-zoom-settings-before.png) · [After](evidence/high-zoom-settings-after.png) |

## Verification

- TypeScript and the Vite production build passed on Windows with Node 24.21.0.
- Simulated 30, 60, 120, and 240 Hz produced matching orbit and zoom curves at equal elapsed-time checkpoints. The camera tests also covered the yaw seam, limits, monotonic zoom, reduced motion, and interrupting an explicit view change.
- Chrome passed desktop tile picking, drag, wheel zoom, camera retention through dice and token movement, resize, hidden-tab suspension, and the overhead button. The mobile viewport passed touch drag, pinch, and reduced motion.
- The full frontend suite passed 233 of 234 tests. The existing ownership-rail test expects two rails and receives four on `main`. Its assertion and layout implementation are identical in both builds.

## Reproduce

Serve a production build of the baseline on `127.0.0.1:4270` and the candidate on `127.0.0.1:4271`. `CHROME_PATH` overrides the Chrome executable. `MOTION_ANGLE`, `MOTION_ROUNDS`, `MOTION_QUALITY`, and `MOTION_OUTPUT` select the backend, repeat count, preset, and output location.

```sh
npm run build
node --import tsx --test tests/camera-motion.test.ts
node scripts/camera-motion-benchmark.mjs
node scripts/camera-motion-visual.mjs
node scripts/camera-motion-browser.mjs
```

`--profile` records the DevTools CPU profile. `--gpu` records elapsed-time queries and fixed-pose scene layer probes. The refresh-rate tests drive the production camera step at 30, 60, 120, and 240 Hz.
