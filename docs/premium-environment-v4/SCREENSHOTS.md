# Matched V4 application captures

Seventeen before/after pairs, rendered in the actual gameplay application with
the same camera pose/target, viewport, DPR, responsive offset and seeded game.
Fourteen normal gameplay views retain all 40 scenery-clear tile rays. Three
QA-only detail targets inspect the existing island architecture and waterfall
geometry; those views intentionally look away from the board and do not claim
board framing/picking coverage. No new production camera preset is introduced.
All captures require zero asset fallbacks, zero scenery shadow casters and no
console/page errors. Capture completion alone does not establish visual quality;
the images must also be inspected. The source reference lacks camera metadata,
so close/wide poses reconstruct its direction rather than claim pixel identity.

| View | Before | After |
| --- | --- | --- |
| Attached current gameplay framing / High | ![supplied-gameplay before](evidence/before/supplied-gameplay.png) | ![supplied-gameplay after](evidence/after/supplied-gameplay.png) |
| Supplied gameplay angle / Medium | ![reference-balanced before](evidence/before/reference-balanced.png) | ![reference-balanced after](evidence/after/reference-balanced.png) |
| Supplied gameplay angle / High | ![reference-high before](evidence/before/reference-high.png) | ![reference-high after](evidence/after/reference-high.png) |
| Whole world / Medium | ![wide-balanced before](evidence/before/wide-balanced.png) | ![wide-balanced after](evidence/after/wide-balanced.png) |
| Whole world / High | ![wide-high before](evidence/before/wide-high.png) | ![wide-high after](evidence/after/wide-high.png) |
| Default overview / Medium | ![overview-balanced before](evidence/before/overview-balanced.png) | ![overview-balanced after](evidence/after/overview-balanced.png) |
| Default overview / High | ![overview-high before](evidence/before/overview-high.png) | ![overview-high after](evidence/after/overview-high.png) |
| East orbit | ![east before](evidence/before/east.png) | ![east after](evidence/after/east.png) |
| Reverse orbit | ![reverse before](evidence/before/reverse.png) | ![reverse after](evidence/after/reverse.png) |
| West orbit | ![west before](evidence/before/west.png) | ![west after](evidence/after/west.png) |
| 135° steep orbit | ![coverage-135 before](evidence/before/coverage-135.png) | ![coverage-135 after](evidence/after/coverage-135.png) |
| 225° steep orbit | ![coverage-225 before](evidence/before/coverage-225.png) | ![coverage-225 after](evidence/after/coverage-225.png) |
| Phone portrait / Low | ![portrait before](evidence/before/portrait.png) | ![portrait after](evidence/after/portrait.png) |
| Phone landscape / Medium | ![landscape before](evidence/before/landscape.png) | ![landscape after](evidence/after/landscape.png) |
| Castle island, terrain and vegetation / High (diagnostic) | ![hero-left-detail before](evidence/before/hero-left-detail.png) | ![hero-left-detail after](evidence/after/hero-left-detail.png) |
| Palace materials and gardens / High (diagnostic) | ![hero-right-detail before](evidence/before/hero-right-detail.png) | ![hero-right-detail after](evidence/after/hero-right-detail.png) |
| Waterfall sheets, cliff source and mist / High (diagnostic) | ![waterfall-detail before](evidence/before/waterfall-detail.png) | ![waterfall-detail after](evidence/after/waterfall-detail.png) |

[Full capture/tile metadata](evidence/after/views.json) ·
[Matched performance](PERFORMANCE.md).
