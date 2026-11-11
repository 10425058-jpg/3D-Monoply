# Measured performance

Production builds, Chrome 156, Windows, AMD Radeon 610M through ANGLE/D3D11. Seed 10425058; 1440 × 900 CSS pixels; device scale 1; 4-second warmup and 5-second sample per camera/tier; reduced motion enabled. Low retains its existing 0.9 maximum render DPR. Exact camera matrices, viewport and DPR equality are asserted by the audit.

Before: main at b0681d5. After: milestone D. Values are whole rendered frames including the existing board, shadow and effect passes. GPU time uses EXT_disjoint_timer_query_webgl2; CPU submission time and individual frame samples are in the raw JSON. Texture counts are renderer allocations, not bytes.

| Quality / camera | FPS before → after | Draw calls | Triangles | GPU p50 ms | Frame p95 ms | Texture allocations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low / overview | 66.6 → 72.5 | 1756 → 1761 | 143,610 → 151,954 | 14.3 → 13.2 | 16.8 → 15.5 | 2 → 4 |
| low / three-quarter | 59.0 → 61.5 | 1767 → 1766 | 144,838 → 153,286 | 15.8 → 15.7 | 21.1 → 17.6 | 2 → 5 |
| balanced / overview | 38.9 → 40.7 | 2682 → 2699 | 213,202 → 244,382 | 23.9 → 23.3 | 30.3 → 27.5 | 3 → 6 |
| balanced / three-quarter | 36.2 → 35.8 | 2693 → 2704 | 214,430 → 246,242 | 26.3 → 26.4 | 31.5 → 32.4 | 3 → 7 |
| high / overview | 34.7 → 38.3 | 2682 → 2709 | 222,070 → 277,872 | 26.6 → 24.8 | 34.5 → 28.9 | 3 → 7 |
| high / three-quarter | 32.6 → 33.2 | 2693 → 2714 | 223,298 → 280,612 | 29.1 → 28.9 | 35.1 → 33.6 | 3 → 8 |

The added scene detail increases triangle counts. Overview draw calls increase by 5 / 17 / 27 in low / balanced / high; material batching and shadow-free background meshes keep this bounded. The three-quarter balanced sample changes by about -1%, within ordinary run variance; other FPS samples improve. This single-machine result does not establish a universal speedup or a 60 FPS guarantee. Balanced/high still fall short of 60 FPS on this integrated GPU. Broader device testing remains necessary.

The audit verifies real GLB response hashes against the shipped bytes and rejects console errors, failed requests and tile occlusion. Cache is disabled for asset verification; download time is outside the warmed render sample. No real-time AO, shadow, bloom or fluid-simulation passes were added.
