# Background polish performance and review status

Status: draft for review. Production build and all 47 Node tests pass. Actual GLB byte/manifest inspection passes for all 22 assets. The saved final camera audit passes asset response/hash, console/network, camera equality and environment tile-occlusion checks across all three qualities. Final gameplay/motion and WebGL context-recovery browser checks have not yet been run for this candidate.

The captured workload uses Chrome on Radeon 610M, 1440×900, seeded game state, reduced motion, four-second warmup and five-second samples. Low keeps its existing reduced render DPR. The representative lower camera is `[4.5,27,40]` toward `[0,.7,0]`; overview uses the unchanged production preset.

| Quality / camera | Before FPS | After FPS | Change | GPU p50 ms before / after |
| --- | ---: | ---: | ---: | ---: |
| Low / overview | 71.97 | 69.47 | -3.5% | 13.11 / 13.68 |
| Low / reference | 77.72 | 63.06 | -18.9% | 11.78 / 13.12 |
| Balanced / overview | 34.52 | 29.36 | -15.0% | 26.68 / 31.24 |
| Balanced / reference | 40.42 | 32.75 | -19.0% | 22.39 / 27.83 |
| High / overview | 26.26 | 29.42 | +12.0% | 34.55 / 31.59 |
| High / reference | 32.53 | 30.19 | -7.2% | 28.04 / 30.64 |

These measurements do **not** establish the no-significant-regression acceptance criterion. Balanced quality and the low reference view need investigation and a controlled repeat before readiness for merge. Earlier checkpoints varied substantially on the same machine; composition-b measured balanced overview/reference at 39.32/41.85 FPS, but that is not the final candidate and must not replace its less favorable numbers.

Overview draw calls remain 1761 low and 2699 balanced; high changes 2709 to 2699 due to culling. Reference calls increase 1766 to 1776 low and remain 2704 balanced / 2714 high. More visible scenery increases reference triangles from 153286 to 159653 low, 246242 to 250622 balanced and 280612 to 286061 high.

Static sky detail bakes once into an RGBA8 render target: 512×256 low (0.5 MiB), 1024×512 balanced/high (2 MiB), without depth, stencil or mips. Subsequent frames sample it in the existing sky pass. Mountain and cloud geometry each remain one draw; no new real-time shadow maps or volumetric passes are added.

Raw measurements and matched screenshots are in `evidence/before` and `evidence/after`. Earlier iteration captures and cost-isolation results are retained under `composition-a` and `composition-b`. The static property strip in composition-b was pixel-identical to the baseline; whole-city pixel identity is not expected because existing castle/fountain animations use elapsed time.

Before marking ready: review the final visuals, investigate/repeat the adverse performance samples, run the gameplay/motion regression and execute `scripts/atmosphere-context.mjs` against the production preview.
