# Matched rendering measurements

Main at `842217f` versus V2, Chrome 157 / Three r164, AMD Radeon 610M
Direct3D11. Each build uses 1440×900 CSS pixels, DPR 0.9 Low / 1 Medium and
High, seed 10425058, reduced motion, four-second warmup and five-second
samples per camera. Camera metadata, viewport, DPR and renderer are checked
for equality. No other browser/GPU workload or Blender job ran during sampling.
Counts include the unchanged board/city and shadow pass. These are local
samples, not device-wide FPS guarantees; CPU scheduling also affects FPS.
Medium is the project's `balanced` preset.

| Tier / camera | FPS before → after | Frame p50 ms | Frame p95 ms | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low / overview | 71.4 → **89.9** | 13.8 → 10.7 | 17.9 → 13.7 | 11.4 → 10.4 | 1,832 → 1,827 | 207,153 → 212,639 |
| low / reference | 73.1 → **95.2** | 13.6 → 10.2 | 16 → 12.5 | 10.4 → 9.4 | 1,861 → 1,860 | 232,075 → 233,513 |
| low / wide | 71.7 → **93.8** | 14 → 10.4 | 15.9 → 12.6 | 8.8 → 6.3 | 1,866 → 1,867 | 240,289 → 241,731 |
| balanced / overview | 46.1 → **50.5** | 20.9 → 19.7 | 29.2 → 24.9 | 19.4 → 18.7 | 2,761 → 2,752 | 335,476 → 312,111 |
| balanced / reference | 50.1 → **54.5** | 19.7 → 17.9 | 22.8 → 21.7 | 18.1 → 16.8 | 2,789 → 2,789 | 376,338 → 388,026 |
| balanced / wide | 51.9 → **56.7** | 19.1 → 17 | 21.7 → 21.4 | 17.6 → 14.7 | 2,794 → 2,794 | 389,718 → 401,406 |
| high / overview | 42 → **45.2** | 22.9 → 22.1 | 33.1 → 23.9 | 21.7 → 20.9 | 2,761 → 2,757 | 422,406 → 459,575 |
| high / reference | 46.2 → **49.7** | 21.4 → 19.9 | 25 → 22.2 | 20 → 18.8 | 2,799 → 2,799 | 481,247 → 510,326 |
| high / wide | 42.3 → **52.5** | 23.1 → 18.4 | 28.9 → 24.1 | 20.8 → 16.5 | 2,794 → 2,794 | 495,644 → 524,723 |

The refined assets reduce their own triangles, while the true 2D mountain
surfaces add geometry. The cloud pass has fewer cards and no runtime mask
generation. Rendering cost remains bounded across all three presets. The
unchanged board/city still account for most draw calls.

| Tier, close view | Geometry buffers MiB before → after | Texture estimate MiB | Selected GLB download MiB | New cloud PNG KiB |
| --- | ---: | ---: | ---: | ---: |
| low | 9.3 → 9.7 | 1.7 → 1.9 | 4.8 → 5.3 | 57.1 |
| balanced | 13.5 → 13.6 | 3.5 → 4.2 | 7.8 → 8.5 | 141.9 |
| high | 19 → 18.9 | 6.9 → 8.1 | 11.8 → 13 | 256.4 |

More detailed normals, ledges and vertex shading increase GLB bytes despite
lower triangle counts. Allocation estimates count live scene buffers and
RGBA/mipmap dimensions; they are **not driver VRAM readings**. Only the chosen
asset tier and cloud PNG load.

| View | Observed navigation-to-environment-ready ms before → after |
| --- | ---: |
| reference-balanced | 3,711 → 3,866 |
| reference-high | 987 → 895 |
| wide-balanced | 819 → 789 |
| wide-high | 880 → 823 |

Readiness includes actual GLB loads and the selected cloud atlas. These are
local preview timings from successive new tabs in one browser per capture
run, with cache reuse; they are not controlled cold-network benchmarks.

[Compact JSON](evidence/performance.json), [before summary](evidence/before/summary.json),
[after summary](evidence/after/summary.json). The full quality JSON files retain
per-frame CPU/GPU timings, exact camera metadata, served asset status/hash
checks, allocations, and browser error arrays.
