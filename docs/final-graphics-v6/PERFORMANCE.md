# V6 measured performance

Windows / Chrome on ANGLE (AMD, AMD Radeon(TM) 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11). Three r164; v24.21.0. Production builds, 1440 × 900, DPR 1, fixed seed 10425058, reduced motion, identical opening fixture and camera. Other QA browsers were closed for the final sequential A/B runs. Each tier has a five-second idle sample and a real [1,2] rent turn after identical transaction shader warmup. Raw frame distributions, GPU query samples, CPU render timings, heap and resource metadata are retained in the measurements files. These are short local measurements, not a device-wide FPS guarantee.

## Real gameplay

| Tier | Mean FPS before → after | Frame P95 ms | Draw calls (all passes) | Triangles | Geometries | Textures |
|---|---:|---:|---:|---:|---:|---:|
| low | 164.7 → 159.2 | 6.3 → 7.4 | 285 → 178 | 156101 → 156125 | 308 → 200 | 17 → 17 |
| balanced | 94.3 → 82.2 | 14.1 → 18.6 | 374 → 203 | 279748 → 279772 | 303 → 195 | 18 → 18 |
| high | 64.7 → 69.7 | 26.2 → 18.6 | 379 → 208 | 459136 → 459160 | 318 → 210 | 19 → 19 |

## Idle

| Tier | Mean FPS before → after | Draw calls | Frame P95 ms |
|---|---:|---:|---:|
| low | 164.7 → 163.7 | 273 → 165 | 6.3 → 6.3 |
| balanced | 100.6 → 101.0 | 358 → 186 | 12.6 → 14.3 |
| high | 76.5 → 72.3 | 363 → 191 | 16.6 → 17.7 |

## Allocations and loading

| Tier | Geometry attributes MiB | Texture RGBA estimate MiB | JS heap MiB after workload | Ready ms |
|---|---:|---:|---:|---:|
| low | 8.4 → 8.0 | 7.6 → 7.6 | 37.7 → 24.8 | 4149 → 4563 |
| balanced | 14.5 → 14.1 | 9.8 → 9.8 | 25.4 → 18.9 | 4062 → 4671 |
| high | 21.5 → 21.1 | 13.8 → 13.8 | 23.5 → 30.4 | 1414 → 1430 |

Texture figures are estimates from actual image dimensions and mipmaps, not driver VRAM. Heap/ready time vary with collection, shader compilation and OS scheduling; they are recorded rather than treated as proof of improvement. There is no new image/GLB asset. All JS/CSS bundles total 1872392 → 1879173 bytes (527423 → 529698 gzip). The existing large lazy Three.js gameplay chunk remains.

The deterministic optimization is 114 existing ornaments batched into seven draws, including four shadow batches instead of 68 separate shadow casters. Owner rails add one instanced draw when deeds are owned. Each label and badge still shares the same immutable 1024² atlas. Four identical roll/reset/unmount cycles kept the exact same resource counts and allocation estimates; see [regression results](evidence/regression/results.json).

[Before raw measurements](evidence/before/measurements.json) · [After raw measurements](evidence/after/measurements.json)

## Repeated Balanced check

The initial single Balanced gameplay sample showed a larger FPS drop despite fewer calls and lower render CPU time. A bounded follow-up counterbalanced three alternating baseline/candidate pairs in one Chrome process, with only one loaded game page, five seconds idle and a fixed three-second rent turn each.

| Metric | Baseline median (range) | Candidate median (range) |
|---|---:|---:|
| fps | 91.7 (84.6–101.2) | 89.9 (86.5–98.0) |
| frameP95 | 16.8 (12.8–18.1) | 16.7 (16.2–18.1) |
| gpuP50 | 8.1 (8.0–9.6) | 8.2 (8.0–9.3) |
| renderCpuP50 | 2.5 (2.4–3.6) | 1.5 (1.5–2.1) |
| calls | 370.0 (370.0–370.0) | 199.0 (199.0–199.0) |
| geometries | 301.0 (301.0–301.0) | 193.0 (193.0–193.0) |
| textures | 18.0 (18.0–18.0) | 18.0 (18.0–18.0) |

Median gameplay FPS changed by -1.9%, with overlapping ranges; GPU median changed by 0.5%. The initial larger drop did not repeat. Render CPU time fell 40.0% and calls fell 46.2%. The supported conclusion is reduced submission/allocation cost with comparable measured gameplay throughput; no general FPS improvement is claimed. The extra 24 rendered triangles are the two ownership rails on the purchased deed.

[All six raw runs and conditions](evidence/performance-check/results.json) · [reproduction script](../../scripts/final-v6-performance-check.mjs)
