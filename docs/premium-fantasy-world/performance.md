# Rendering measurements

Baseline: main at `712693a`. Candidate: this branch's built production assets. Measurements use the same Chrome/GPU, seed, CSS viewport (1440×900), quality DPR and camera pose. Two 5-second windows per version/quality/camera are pooled, with A/B and B/A order retained. Models and shader warmup finish before sampling. No simultaneous audit or render workload was launched by this task during the comparison.

Renderer: ANGLE (AMD, AMD Radeon(TM) 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11). Local Node: v24.21.0; Blender: 5.2.3 LTS. Repository CI continues to use Node 22. These are local measurements, with normal OS/GPU variance; they do not certify universal 60 FPS or physical mobile performance.

| Quality / camera | Mean ms before → after | Change | FPS before → after | P95 ms before → after | GPU P50 ms before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| low / overview | 13.64 → 16.10 | 18.06% | 73.32 → 62.10 | 17.40 → 25.00 | 12.76 → 14.20 |
| low / reference | 12.78 → 13.73 | 7.42% | 78.26 → 72.85 | 17.10 → 17.70 | 11.59 → 12.73 |
| balanced / overview | 25.05 → 25.43 | 1.49% | 39.92 → 39.33 | 31.20 → 29.10 | 23.15 → 23.84 |
| balanced / reference | 23.69 → 23.63 | -0.29% | 42.21 → 42.33 | 34.10 → 30.60 | 21.23 → 21.52 |
| high / overview | 28.11 → 29.13 | 3.64% | 35.58 → 34.33 | 36.00 → 39.60 | 26.04 → 26.45 |
| high / reference | 26.36 → 26.74 | 1.46% | 37.94 → 37.39 | 34.30 → 29.80 | 24.24 → 24.89 |

| Quality / camera | Calls before → after | Triangles before → after | Geometry allocations before → after | Texture allocations before → after |
| --- | ---: | ---: | ---: | ---: |
| low / overview | 1761 → 1790 | 150343 → 179655 | 1761 → 1790 | 5 → 8 |
| low / reference | 1777 → 1808 | 158261 → 187603 | 1777 → 1808 | 7 → 10 |
| balanced / overview | 2699 → 2729 | 249164 → 281142 | 1773 → 1803 | 7 → 10 |
| balanced / reference | 2705 → 2738 | 251026 → 283060 | 1779 → 1812 | 8 → 11 |
| high / overview | 2699 → 2729 | 279528 → 325596 | 1773 → 1803 | 7 → 10 |
| high / reference | 2715 → 2748 | 287963 → 334087 | 1789 → 1822 | 9 → 12 |

The whole scene includes the unchanged board/city/shadow passes; these are not environment-only costs. The low island/water/airship subsystem contains 61,903 triangles, below its 65k subsystem cap, with zero shadow casters. Three new GLBs produce 27 material batches, shared across ten placements. Water is a few ribbon/mist draws; no extra lights, shadow maps, render loops or postprocessing are added.

GPU drivers do not expose actual VRAM usage through this WebGL API. Before/after geometry and texture allocation counts are reported above. Candidate CPU attribute sizes and estimated RGBA/mip allocations are in [performance.json](evidence/performance.json); they exclude driver overhead and are not VRAM measurements. Four scene mount/unmount cycles keep those counts and estimates identical, with one GLB request per URL across all cycles.

Total JavaScript grows by 5,839 bytes (1,981 gzip bytes). The nine new shipped LODs total 2,470,356 bytes; each quality fetches only three of them. Existing menu CSS/image and gameplay rules remain untouched. Local page-to-environment-ready times range from 686 to 3923 ms. These include compilation/cache effects and are observations, not controlled network-speed claims; per-resource durations are retained.

| New Blender model | Tier | Triangles | Bytes |
| --- | --- | ---: | ---: |
| sky-observatory | high | 3808 | 250788 |
| sky-observatory | balanced | 3314 | 225548 |
| sky-observatory | low | 2954 | 204336 |
| sky-ruins | high | 2660 | 210420 |
| sky-ruins | balanced | 2290 | 181520 |
| sky-ruins | low | 2090 | 165584 |
| sky-hamlet | high | 7600 | 597116 |
| sky-hamlet | balanced | 3932 | 325488 |
| sky-hamlet | low | 3732 | 309556 |

[All controlled windows](evidence/controlled/summary.json) · [Raw frames and metadata](evidence/controlled/runs.json) · [Initial pre-edit baseline](evidence/before/summary.json) · [Early art checkpoint](evidence/checkpoint/balanced.json) · [Binary/texture validation of all 31 models](evidence/asset-validation.json). Earlier measurements are retained; faster individual windows are not treated as demonstrated speedups.

The slowest individual comparison was low/overview, repeat 0: 29.74% higher mean frame time (74.40 → 57.34 FPS). It remains in the pooled result and raw records. The 20% target applies to the engineering comparison; it is not a promise that every short window or device meets it. Sky, cloud and ridge geometry are included in whole-scene measurements, outside the island subsystem cap.

[First candidate measurements before the final composition](evidence/checkpoint/initial-after/summary.json) are retained separately from the final controlled comparison.
