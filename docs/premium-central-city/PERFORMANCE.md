# Central city rendering measurements

Unchanged main at `88a5bd6` versus the central-city candidate. The renderer is
`ANGLE (AMD, AMD Radeon(TM) 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
The exact browser user-agent, renderer, allocation estimates and metrics are in
[the comparison JSON](evidence/performance.json).

Both builds use 1440×900 CSS pixels, seed 10425058, the same camera matrices and
responsive offsets, DPR 0.9 Low / 1 Medium and High, four-second warmup and
five-second samples. Medium is the project's `balanced` preset. Chrome runs
sequentially without another browser/GPU job, Blender job or build. The media
preference is reduced motion in both builds. The old central city ignores that
preference for some decorative animations; the new fountain and flags honor it.
This is a controlled rendering comparison, not a device-independent FPS promise.

| Tier / camera | FPS before → after | Frame p50 ms | Frame p95 ms | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low / overview | 75.6 → **164.6** | 12.8 → 6.1 | 18.2 → 6.2 | 11.4 → 4.4 | 1,831 → 452 | 215,897 → 150,965 |
| low / reference | 79.9 → **164.8** | 12.3 → 6.1 | 14.4 → 6.2 | 10.5 → 4.8 | 1,863 → 484 | 236,769 → 171,837 |
| low / wide | 76 → **160.9** | 12.6 → 6.1 | 15.9 → 7.7 | 8.4 → 5.2 | 1,869 → 490 | 244,991 → 180,059 |
| balanced / overview | 45.9 → **99** | 21.3 → 9.4 | 28.4 → 14.8 | 20.1 → 8.3 | 2,752 → 590 | 314,423 → 267,770 |
| balanced / reference | 49.5 → **98.3** | 19.7 → 9.8 | 24.2 → 12.2 | 18.3 → 8.6 | 2,789 → 627 | 392,394 → 345,741 |
| balanced / wide | 53.2 → **136.6** | 18.3 → 7 | 22 → 9.4 | 16.5 → 5.9 | 2,794 → 632 | 405,774 → 359,121 |
| high / overview | 36.3 → **73.2** | 24.9 → 13.6 | 40 → 15.1 | 23.4 → 12.2 | 2,757 → 595 | 464,839 → 447,158 |
| high / reference | 42.2 → **70.5** | 22.6 → 14.1 | 36.1 → 16.2 | 21.2 → 12.8 | 2,799 → 637 | 515,590 → 497,909 |
| high / wide | 46.2 → **84.6** | 21.1 → 11.4 | 26.3 → 16.3 | 19.2 → 10.1 | 2,794 → 632 | 529,987 → 512,306 |

Counts include the entire scene and its existing shadow pass. Material batching,
fewer central shadow casters and removal of the old city's many local lights
reduce submission cost. The surrounding world, global light rig, tone mapping
and property ring are unchanged. The new district adds zero real-time lights;
warm windows use emission and ten lamps share an instanced halo draw.

| Tier, reference camera | Geometry buffers MiB before → after | Texture estimate MiB | Total selected GLB download MiB | New city GLB MiB |
| --- | ---: | ---: | ---: | ---: |
| low | 9.5 → 8.6 | 1.9 → 2.3 | 5.1 → 7.4 | 2.3 |
| balanced | 13.3 → 14.7 | 4.2 → 4.5 | 8.2 → 12.8 | 4.6 |
| high | 18.3 → 21.7 | 8.1 → 8.4 | 12.4 → 18.9 | 6.5 |

Allocation estimates inspect actual scene buffers and texture/mipmap dimensions;
they are not driver VRAM readings. GLB bytes are observed HTTP response bodies,
checked against exported public-file SHA256 hashes. The table includes the
unchanged selected surrounding assets. The city is a new download; the old city
was constructed in JavaScript and remains bundled as the loading/error fallback.
All five visual unlock groups are included in one selected city GLB. Higher
levels do not trigger additional downloads. No decoder or new dependency is added.
These samples do not measure cold-network latency or sustained thermal behavior.

[Raw before summary](evidence/before/summary.json) ·
[Raw after summary](evidence/after/summary.json).
Per-tier JSON retains per-frame timing, source/served hashes and error arrays.
