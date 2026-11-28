# Manual camera motion and frame pacing

The baseline is `d0ebe845f66cf7deaf7acf73eb0da195e4337a59` (`main`). The opening view uses the existing viewport fit. The overhead button remains an explicit view change. A drag or wheel input takes over from that transition and keeps its current angle and pivot.

OrbitControls still interprets mouse, wheel, and touch gestures with the existing limits and sensitivities. Its input camera accumulates the requested pose. The scene camera consumes that pose once per frame, with exponential damping of yaw, pitch, and distance. Yaw stays continuous across the spherical seam, and the camera quaternion comes from the resulting pose and pivot. Reduced motion presents the requested pose on the next frame. The controller reads player state only when an explicit player view is requested.

Pointer picking processes the latest hover sample once per animation frame and preserves immediate button and touch selection. The board uses the shared hover state for its tile and label transforms. Cloud banks keep their instance buffers until the transparent draw order changes. Renderer settings, assets, shaders, styles, and game rules are identical across the two builds.

## Measurement method

The benchmark replays 100 orbit positions and then 14 wheel steps against each production preview. A native pointer-down starts the orbit. Timed DOM events deliver identical coordinates and wheel deltas on both builds, and separate native input probes measure time from the browser event timestamp to the first render submission with a changed camera pose. The measured latency ends at WebGL submission. Headless frame intervals estimate missed 60 Hz slots by rounding each interval to the nearest slot and counting the excess beyond one.

The normal timing run disables the audit's WebGL timer. The baseline Direct3D pilot with the timer enabled spent about 2.78 seconds in `getParameter`, which includes waiting for the driver. GPU-query diagnostics run independently of the frame-pacing samples. [Direct3D CPU pilot](evidence/pilot-d3d11.cpuprofile) · [WebGL timer extension specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)

## Visual preservation

Chrome captured the same poses with the same game state, animation clock, seed, drawing buffer, and render preset. Five WebGL pairs were pixel-identical. One pixel in the High orbit pair differed by one channel level. In the 1,296,000-pixel full-page images, 286–356 pixels differed per pair. Most differences were along the Roll button border with identical computed styling. Same-build repeats also recorded edge-level raster differences. All three production CSS chunks matched byte for byte. [Pixel counts, hashes, and capture conditions](evidence/visual-comparison.json)

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
