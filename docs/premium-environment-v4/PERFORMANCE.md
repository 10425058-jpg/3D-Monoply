# Matched V4 rendering measurements

Main at `1cf0472` versus V4, actual renderer:
`ANGLE (AMD, AMD Radeon(TM) 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
Three r164; the capture user-agent and exact renderer are retained in the
[compact JSON](evidence/performance.json). Both builds use 1440×900 CSS pixels,
DPR 0.9 Low / 1 Medium and High, seed 10425058, reduced motion, four-second
warmup and five-second samples per camera. Camera metadata, viewport, DPR and
renderer are checked for equality. Samples run without another GPU workload.
Counts include the unchanged board/city and shadow pass. These are local
samples, not FPS guarantees for other devices; CPU scheduling also affects FPS.
Medium is the project's `balanced` preset.

| Tier / camera | FPS before → after | Frame p50 ms | Frame p95 ms | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low / overview | 82.8 → **77.9** | 11.4 → 12.3 | 17.7 → 17 | 10.7 → 11 | 1,827 → 1,831 | 212,639 → 215,897 |
| low / reference | 91.4 → **94.1** | 10.2 → 10.3 | 14.1 → 13.4 | 9.6 → 9.6 | 1,860 → 1,863 | 233,513 → 236,769 |
| low / wide | 96 → **102.1** | 9.8 → 9.5 | 13.1 → 11.6 | 6.3 → 6.1 | 1,867 → 1,869 | 241,731 → 244,991 |
| balanced / overview | 44.6 → **50.7** | 22 → 19.7 | 26.9 → 21.6 | 20.7 → 18.7 | 2,752 → 2,752 | 312,111 → 314,423 |
| balanced / reference | 47.8 → **47.8** | 20.2 → 19.9 | 25.8 → 31.2 | 18.9 → 18.2 | 2,789 → 2,789 | 388,026 → 392,394 |
| balanced / wide | 47.9 → **54.1** | 20 → 17.9 | 27 → 22.5 | 17.7 → 16.6 | 2,794 → 2,794 | 401,406 → 405,774 |
| high / overview | 41.1 → **45.6** | 23.5 → 21.4 | 32 → 25.6 | 22.4 → 20.6 | 2,757 → 2,757 | 459,575 → 464,839 |
| high / reference | 43.8 → **44.7** | 22.7 → 21.2 | 28.3 → 31.5 | 21.1 → 20.7 | 2,799 → 2,799 | 510,326 → 515,590 |
| high / wide | 43.8 → **45.6** | 22.8 → 21.2 | 28.1 → 29 | 20.3 → 19.2 | 2,794 → 2,794 | 524,723 → 529,987 |

| Tier, close view | Geometry buffers MiB before → after | Texture estimate MiB | Selected GLB download MiB | Cloud PNG KiB |
| --- | ---: | ---: | ---: | ---: |
| low | 9.7 → 9.5 | 1.9 → 1.9 | 5.3 → 5.1 | 57.1 → 57.1 |
| balanced | 13.6 → 13.3 | 4.2 → 4.2 | 8.5 → 8.2 | 141.9 → 141.9 |
| high | 18.9 → 18.3 | 8.1 → 8.1 | 13 → 12.4 | 256.4 → 256.4 |

Allocation estimates count actual scene buffers and RGBA/mipmap dimensions;
they are **not driver VRAM readings**. Selected GLB/PNG bytes are actual HTTP
responses checked against public-artifact SHA256 hashes. Cached distant LODs
and the selected quality tier are included in the loaded-byte totals.

| View | Observed navigation-to-environment-ready ms before → after |
| --- | ---: |
| supplied-gameplay | 4,188 → 4,124 |

Readiness includes real GLB loads and the selected cloud atlas. The attached
gameplay view started a fresh Chrome run for each capture, with no previous
tab load in that browser. These are local-preview timings, not controlled
cold-network benchmarks. Other raw view timings are retained but excluded
from this table because diagnostic recaptures changed tab/cache order.

[Before summary](evidence/before/summary.json), [after summary](evidence/after/summary.json).
Full per-quality JSON files retain per-frame CPU/GPU timings, exact camera
metadata, served status/hash checks, live allocations and browser error arrays.
The separate [screenshot report](SCREENSHOTS.md) records 14 normal views and
three QA-only detail targets. Performance is measured only in normal gameplay
poses, not in the diagnostic detail views.
