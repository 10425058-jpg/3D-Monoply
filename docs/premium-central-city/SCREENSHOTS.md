# Central city browser captures

Twelve paired captures from the actual production application. Before is the
unchanged main `88a5bd6` tree; after is the central-city candidate. Camera pose,
target, viewport, DPR and responsive offset match, with seed 10425058 and reduced
motion. The property ring, HUD and outside world are preserved in both builds.

The four close detail targets are diagnostic QA poses, not new game camera
presets. They inspect architecture and landscaping while parts of the board
leave the frame. All twelve captures have no console/page errors or outside
asset fallbacks. The default desktop/phone captures check all 40 physically
clear and pickable tile centers. Wider interaction coverage is recorded in
[the gameplay regression](evidence/regression/results.json).

| View | Before | After |
| --- | --- | --- |
| overview-medium | ![overview-medium before](evidence/before/overview-medium.png) | ![overview-medium after](evidence/after/overview-medium.png) |
| overview-high | ![overview-high before](evidence/before/overview-high.png) | ![overview-high after](evidence/after/overview-high.png) |
| front | ![front before](evidence/before/front.png) | ![front after](evidence/after/front.png) |
| rear | ![rear before](evidence/before/rear.png) | ![rear after](evidence/after/rear.png) |
| castle-front (detail) | ![castle-front before](evidence/before/castle-front.png) | ![castle-front after](evidence/after/castle-front.png) |
| castle-rear (detail) | ![castle-rear before](evidence/before/castle-rear.png) | ![castle-rear after](evidence/after/castle-rear.png) |
| fountain-plaza (detail) | ![fountain-plaza before](evidence/before/fountain-plaza.png) | ![fountain-plaza after](evidence/after/fountain-plaza.png) |
| garden-buildings (detail) | ![garden-buildings before](evidence/before/garden-buildings.png) | ![garden-buildings after](evidence/after/garden-buildings.png) |
| east | ![east before](evidence/before/east.png) | ![east after](evidence/after/east.png) |
| top | ![top before](evidence/before/top.png) | ![top after](evidence/after/top.png) |
| portrait-low | ![portrait-low before](evidence/before/portrait-low.png) | ![portrait-low after](evidence/after/portrait-low.png) |
| landscape-medium | ![landscape-medium before](evidence/before/landscape-medium.png) | ![landscape-medium after](evidence/after/landscape-medium.png) |

| Wider capture | City-clear tile centers before /40 | After /40 |
| --- | ---: | ---: |
| overview-medium | 40 | 40 |
| overview-high | 40 | 40 |
| front | 33 | 35 |
| rear | 34 | 35 |
| east | 34 | 33 |
| top | 40 | 40 |
| portrait-low | 40 | 40 |
| landscape-medium | 40 | 40 |

The unchanged default overview, top and phone views expose all forty centers.
Lower front/rear/east diagnostic poses allow the central architecture to cover
some opposite tiles in both builds, with different silhouettes. Those views
are for inspecting the model from multiple sides and do not claim full-ring
visibility. Decoration remains noninteractive; production camera behavior and
property inspection controls are preserved.

The manual review includes the front entrance, rear gallery and balcony, all
three open fountain bowls, paths, mansard café, other houses and flowering trees.
The rear is modeled and lit as a complete façade. Closeups also disclose the
bounded stylized foliage and paving detail; these are not concept-art renders.
[Full capture metadata](evidence/after/views.json) · [Performance](PERFORMANCE.md).
