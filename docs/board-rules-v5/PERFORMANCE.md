# V5 measured performance

Baseline: saved production build of main **0ba0a2f**. Candidate: `feature/board-rules-gamefeel-v5`. The original central-city and environment
GLB/cloud-atlas response hashes match between builds. No assets were regenerated.

Renderer: **ANGLE (AMD, AMD Radeon(TM) 610M (0x0000164E) Direct3D11 vs_5_0 ps_5_0, D3D11)**, Chrome 157 / Three.js 164, 1440×900 CSS pixels.
Low renders at DPR 0.9; balanced/high at DPR 1. Each paired case asserts the
same camera, viewport, drawing buffer, renderer, browser and DPR. Reduced motion
freezes world animation; the real city and environment finish loading before a
4-second warmup. Each of nine views uses a **20-second** measurement window,
with more than 30 observed frames. Baseline and candidate run sequentially, with
no other test/build/browser workload started during measurement.

The first 5-second baseline attempt failed the minimum-frame gate. It is not
used here; both final sides use the longer equal window. The cause of that slow
attempt was not established. These are one machine's observations, not a
cross-device performance guarantee or cold-network benchmark.

**FPS attribution is inconclusive on this host.** Timing changed sharply near
the end of the baseline sweep and remained slow in the candidate. A subsequent
unchanged-main control measured 17.9 FPS versus
68.6 FPS earlier at the same low/overview view; its GPU query median changed
from 4.03 ms to 47.04 ms. The immediately
following V5 control measured 16.5 FPS and
46.37 ms. Both used the same 20-second workload
and renderer; no second automated browser was observed. The underlying machine
condition was not established. These controls demonstrate timing instability,
not a measured V5 FPS improvement. All sweep data is retained below without
discarding slow cases. Draw-call/geometry reductions are repeatable across views.

| Low/overview control | Main | V5 |
| --- | ---: | ---: |
| FPS | 17.9 | 16.5 |
| Frame p95 ms | 94.2 | 92.1 |
| GPU query median ms | 47.04 | 46.37 |
| Draw calls | 452 | 281 |
| Geometries | 479 | 308 |

Control receipts: [main](evidence/control/before/low.json),
[V5](evidence/control/after/low.json).

## Frame timings

Values are **before → after**. Times are milliseconds. CPU is the sum of wrapped
render calls; GPU is the existing audit's latest completed render-pass query,
not a complete GPU frame profile. FPS uses observed animation-frame intervals.

| Quality / view | FPS | Frame p50 | Frame p95 | Render CPU p50 | GPU query p50 | Frames before / after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low / overview | 68.6 → 15.3 | 14.6 → 53.3 | 14.7 → 101.0 | 2.6 → 2.8 | 4.03 → 51.14 | 1371 / 306 |
| low / reference | 66.2 → 15.0 | 14.6 → 53.5 | 14.8 → 103.3 | 3.1 → 2.9 | 4.93 → 51.09 | 1322 / 300 |
| low / wide | 120.9 → 19.9 | 6.1 → 49.6 | 25.7 → 78.7 | 2.7 → 2.9 | 5.28 → 46.35 | 2418 / 397 |
| balanced / overview | 85.6 → 8.2 | 10.4 → 113.9 | 14.7 → 167.8 | 4.0 → 3.8 | 8.67 → 102.89 | 1713 / 162 |
| balanced / reference | 98.3 → 6.6 | 9.5 → 148.0 | 13.3 → 201.2 | 4.2 → 4.4 | 8.46 → 144.17 | 1966 / 131 |
| balanced / wide | 129.4 → 8.9 | 6.7 → 104.0 | 14.6 → 149.5 | 3.9 → 4.7 | 5.69 → 95.62 | 2588 / 177 |
| high / overview | 68.3 → 28.9 | 14.6 → 14.1 | 14.8 → 144.0 | 3.6 → 2.1 | 11.13 → 11.75 | 1365 / 576 |
| high / reference | 64.6 → 6.7 | 14.5 → 149.3 | 24.0 → 207.8 | 5.0 → 3.1 | 11.54 → 142.29 | 1291 / 134 |
| high / wide | 15.0 → 7.2 | 14.1 → 139.4 | 204.6 → 163.2 | 5.4 → 3.6 | 9.22 → 137.43 | 301 / 143 |

## Live rendering and allocation estimates

Calls/triangles are renderer medians. Geometry and texture counts are live
Three.js allocations, including lazy resources. Bytes deduplicate scene
attributes and material maps, including the audit's 4/3 mipmap estimate where
enabled; they exclude driver overhead, framebuffer targets and indirect shader
textures. They are **not measured VRAM**.

| Quality / view | Draw calls | Triangles | Geometries | Textures | Geometry + instances MiB | Material RGBA + mips MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low / overview | 452 → 281 | 150965 → 147749 | 479 → 308 | 16 → 16 | 8.60 → 8.45 | 2.27 → 7.60 |
| low / reference | 484 → 313 | 171837 → 168621 | 489 → 318 | 17 → 17 | 8.60 → 8.45 | 2.27 → 7.60 |
| low / wide | 490 → 319 | 180059 → 176843 | 491 → 320 | 17 → 17 | 8.60 → 8.45 | 2.27 → 7.60 |
| balanced / overview | 590 → 371 | 267770 → 263042 | 474 → 303 | 17 → 17 | 14.70 → 14.55 | 4.52 → 9.85 |
| balanced / reference | 627 → 408 | 345741 → 341013 | 489 → 318 | 18 → 18 | 14.70 → 14.55 | 4.52 → 9.85 |
| balanced / wide | 632 → 413 | 359121 → 354393 | 491 → 320 | 18 → 18 | 14.70 → 14.55 | 4.52 → 9.85 |
| high / overview | 595 → 376 | 447158 → 442430 | 489 → 318 | 18 → 18 | 21.68 → 21.54 | 8.43 → 13.77 |
| high / reference | 637 → 418 | 497909 → 493181 | 499 → 328 | 19 → 19 | 21.68 → 21.54 | 8.43 → 13.77 |
| high / wide | 632 → 413 | 512306 → 507578 | 501 → 330 | 19 → 19 | 21.68 → 21.54 | 8.43 → 13.77 |

The board replaces per-tile text/icons with at most six instanced batches and
one immutable 1024² RGBA atlas: 4 MiB base, about 5.33 MiB including mipmaps.
Ownership/selection updates reuse it. No render target, postprocessing pass or
new animation particle pool was added. The fixed atlas trades some texture
memory for fewer draw calls and geometry allocations. Resources are explicitly
disposed on unmount; shared instance buffers use the existing release helper.

[Four equal-workload mount receipts](evidence/regression/results.json) show
stable counts/estimated bytes. This compares identical roll/reset workloads,
not a played scene with an untouched scene. [Context-loss checks](evidence/regression/resilience.json)
restore the board at all three tiers with zero changed pixels in the frozen
650×565 board crop. Optional 3D money-label font failure preserves the scene,
committed balances and HUD transaction receipt.

Raw timings: [before](evidence/before/summary.json), [after](evidence/after/summary.json).
Per-tier JSON files retain all samples, metadata, errors and served asset hashes.
Reproduce with `AUDIT_SAMPLE_MS=20000 AUDIT_CAMERAS=overview,reference,wide
AUDIT_WAIT_CITY=1 AUDIT_EVIDENCE_ROOT=docs/board-rules-v5/evidence
AUDIT_URL=<matching preview URL> node scripts/atmosphere-audit.mjs before|after`.
Then run `node scripts/board-v5-report.mjs`.
