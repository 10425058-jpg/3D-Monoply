# Controlled rendering comparison

Starting commit: 2c3b62d. Candidate: master continuation on graphics/fantasy-atmosphere-polish. Windows/Chrome/Radeon 610M, 1440x900, seeded game state, reduced motion. Each page warms for 5 seconds; each camera samples 5 seconds. One browser and one open game page at a time. First order A/B, second order B/A; both are retained. The default overview and lower reference camera metadata, viewport and DPR are asserted identical. Low retains the existing 0.9 render DPR. Download time is excluded; every served GLB is verified by hash against its own baseline/candidate source files.

The before build is an archived copy inside the feature worktree. Reproduce with prepare-environment-baseline.py, build/serve that directory on 4176 and candidate on 4175, then kingdom-comparison.mjs with COMPARISON_LABEL=controlled-release. No other worktree is switched or modified. [Raw samples](evidence/controlled-release/runs.json) retain camera, renderer and texture metadata; [summary](evidence/controlled-release/summary.json) retains both orders.

FPS cells show the mean of two windows and their observed range. GPU columns show the two p50 results. These short windows do not establish a device-wide guarantee.

| Tier / view | Before FPS mean (range) | After FPS mean (range) | Mean change | GPU p50 ms before / after |
| --- | ---: | ---: | ---: | ---: |
| low / overview | 44.8 (36.4-53.3) | 49.9 (35.2-64.7) | 11.3% | 15.6-23.4 / 14.6-23.6 |
| low / reference | 47.6 (38.8-56.4) | 49.2 (38.9-59.6) | 3.4% | 14.2-22.7 / 13.2-21.2 |
| balanced / overview | 21.3 (21.0-21.7) | 22.2 (21.5-22.8) | 3.9% | 39.3-40.9 / 38.4-40.0 |
| balanced / reference | 25.0 (21.7-28.3) | 23.4 (23.4-23.5) | -6.3% | 28.2-39.0 / 37.0-37.4 |
| high / overview | 25.5 (20.0-31.0) | 19.9 (19.3-20.5) | -21.9% | 29.3-41.3 / 41.1-42.2 |
| high / reference | 21.2 (21.1-21.4) | 20.6 (20.6-20.7) | -2.9% | 40.5-40.6 / 40.6-41.6 |

The high-overview short comparison had a -21.9% mean change, so a separate sustained check used 10-second warmup and 20-second samples, again A/B then B/A with no concurrent audit workload. Before: 24.6 FPS (21.1-28.2); after: 27.6 FPS (24.8-30.3). GPU p50 ranges were 30.8-39.6 / 30.1-33.1 ms. The short adverse mean did not repeat, but this variability also prevents a reliable speedup claim. Both [long-window samples](evidence/high-sustained/runs.json) and the adverse short windows remain available.

This integrated-GPU session shows substantial variability between windows, including adverse samples. Earlier measurements remain under controlled, controlled-final and controlled-display. They are not silently replaced by the latest results. Do not interpret positive means as a universal speedup or promise 60 FPS on a student laptop. Stable frame-rate acceptance on representative student hardware remains a follow-up; these measurements alone cannot certify it. The existing board/city is already a substantial workload, and its rendering settings and geometry are preserved.

| Tier / view | Calls before / after | Triangles before / after | Texture allocations before / after |
| --- | ---: | ---: | ---: |
| low / overview | 1761 / 1761 | 151,779 / 150,343 | 5 / 5 |
| low / reference | 1776 / 1777 | 159,653 / 158,261 | 7 / 7 |
| balanced / overview | 2699 / 2699 | 248,762 / 249,164 | 7 / 7 |
| balanced / reference | 2704 / 2705 | 250,622 / 251,026 | 8 / 8 |
| high / overview | 2699 / 2699 | 276,998 / 279,528 | 7 / 7 |
| high / reference | 2714 / 2715 | 286,061 / 287,963 | 9 / 9 |

The sky sphere reads one texture. Cloud shading, static halo, ACES and sRGB conversion run once at bake time. Maps are 512x256 low (0.5 MiB), 1024x512 balanced (2 MiB), 1536x768 high (4.5 MiB), RGBA8 without depth/stencil/mips. A small analytic solar patch resolves the disc at screen resolution: one additional visible draw and two triangles, before gameplay geometry, with no new texture or light. Context restoration rebakes the map. Dynamic exposure/time-of-day would require rebaking it.

Mountain rows are 3/5/7 in low/balanced/high, with 80/160/224 angular segments, batched in one draw. Main GLB materials remain batched and cast zero new real-time shadows. The scene adds no new library, volume march or post-processing pass. Texture allocation counts include shared runtime resources; they are not a measurement of total GPU/driver memory.

## Actual island inventory

| GLB | Triangles / cap | MiB | Material primitives |
| --- | ---: | ---: | ---: |
| royal-island-left-balanced.glb | 24,028 / 25,000 | 1.59 | 10 |
| royal-island-left-distant.glb | 6,584 / 8,000 | 0.54 | 10 |
| royal-island-left-low.glb | 13,168 / 16,000 | 0.89 | 10 |
| royal-island-left.glb | 38,080 / 40,000 | 2.44 | 10 |
| royal-island-right-balanced.glb | 20,731 / 25,000 | 1.39 | 10 |
| royal-island-right-distant.glb | 5,693 / 8,000 | 0.48 | 10 |
| royal-island-right-low.glb | 11,387 / 16,000 | 0.79 | 10 |
| royal-island-right.glb | 31,387 / 40,000 | 2.02 | 10 |

All 22 shipped GLBs pass project-specific binary/manifest inspection. Each kingdom embeds one 128x128 atlas (approximately 85.3 KiB RGBA plus mips), shared by its ten materials. Foundation and standalone props remain byte-identical to the starting commit. This does not claim Khronos conformance-tool execution.
