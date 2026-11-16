# Premium fantasy environment V4

This pass starts from main at `1cf0472`, which merged the previous environment
polish. The existing castles, villages, gardens, ruins, mills, bridges,
waterfalls, clouds, mountains and airship are the foundation. The target is
stronger art direction and material depth rather than a larger island count.
The concept guides the blue/ivory architecture, rich greens, pink blossoms,
turquoise water and golden sunset. Gameplay continues to render real 3D assets.

The final branch also incorporates main's subsequent avatar-only fix at
`44056d5` (PR #54). The matched environment captures and timings retain their
original `1cf0472` baseline and equivalent HUD conditions. The V4 diff itself
does not modify the avatar CSS or other UI/gameplay files.

## Original weaknesses and audit

The previous world had soft silhouettes and broad camera coverage, but pale
clouds and shallow lighting weakened colour separation. Near grass and stone
lost contrast while distance treatments were not sufficiently distinct.
Waterfall curtains remained too uniformly translucent. Existing architecture
and foliage needed visible detail and more controlled surface response.

The renderer already uses ACES filmic tone mapping at exposure 1 and sRGB
output. The board owns the real directional shadow pass. The environment uses
a shared illustrated shader, the embedded original material atlas, baked
vertex cavity shading, a GPU sky bake, an offline cloud-density atlas, and
instanced GLBs with frustum culling. The correct scope is those environment
systems, not a global exposure or board-lighting rewrite.

The ordinary scene fog is not the direct source of haze on the custom GLB
shader: that shader applies its own aerial colour blend. The washout therefore
needs correction in its near/middle/far blend, fill light and reflectance
palette, as well as the lower cloud sea. No evidence identified a texture
colour-space failure, and the existing output/texture colour pipeline is kept.

## Atmosphere, lighting and materials

The environment shader no longer imposes a constant haze floor on nearby
landmarks. Distance softening starts at 88m and smoothly develops toward 250m,
with the existing responsive camera pullback compensated so a short-screen
overview does not flatten all scenery. Distant islands keep cool atmospheric
depth. The background sky and cloud sea use deeper lavender/cool-blue shadows,
restrained peach-gold sunlight and less pale coverage rather than an opaque
white veil.

Cool fill is reduced relative to the warm directional key. Grass, cliffs,
evergreens, slate and blossoms have a consistent material-class reflectance
palette rather than a global saturation filter. Broad grass breakup and stone
strata are low-frequency, while roughness controls highlights. Blue roofs gain
restrained specular response; blossoms retain soft edge lighting; windows and
lantern materials retain selective warmth. Board lights, exposure and the
existing real shadow map are unchanged.

## Existing asset refinement

Blender's `bpy` workflow imports the V2 hero castle island, palace island,
citadel and foundation rather than reconstructing the world. The refinement
changes blossom component shape/colour, erodes existing terrain edges, adds
small arched rear glazing, stone surrounds, a supported balcony, door hinges
and coursing, then bakes directional contact shading. Three sun-visibility
taps align with the existing runtime light, grounding buildings and trees
without another browser shadow pass. New details share the original project
atlas. Re-imported/new meshes normalize to one UV set so no unused UV layers
inflate every exported vertex. High/Medium/Low retain the same identities.

[Actual exported topology, bytes and provenance](ASSETS.md) includes the
12 refined variants and source hashes. Runtime quality selects only the
chosen tier; original distant LODs remain cheaper silhouettes. No Blender or
Python installation is required to play the deployed game.

Installed **Blender 5.2.3 LTS** actually executed the `bpy` generator. The
optional `game-dev` CLI is absent on this host (`Get-Command` discovery);
the repository's actual binary validator and Chrome import/render checks
were used. No paid provider was invoked. All authored refinements remain
original project assets under the repository MIT license.

## Water, clouds and mountains

The existing waterfall anchors drive convex, scalloped sheets with varying
width, gentle lateral drift and surface motion. Turquoise/cyan tonal layers,
computed surface normals, a cheap view-dependent rim, broken whitewater and
source foam replace uniformly translucent strips. Source spray and base mist
remain restrained. Each of the 15 waterfall groups still uses two draws and
the existing shared shader program; no browser fluid simulation is introduced.

Clouds reuse the eight original offline density masks and one sorted instanced
pass. Density contrast, cool interiors, warm sun-facing tint and lower nearby
bank opacity preserve softer forms without restoring the white wash. Card
counts stay 24/32/40. The mountain system retains 30 distinct heightfields and
one draw: warped ridge coordinates, erosion, varied saddles, blue-lavender
colour layers and directional vertex shading improve profiles without adding
geometry. All generated/mounted resources retain disposal and motion guards.

## Implementation and evidence

The final changes, asset provenance and verification results are documented
alongside the actual runtime implementation. The following reports are built
from matching captures and raw telemetry, not separately generated artwork:

- [Seventeen matched application views](SCREENSHOTS.md): attached gameplay framing, reference direction,
  wide/default Medium and High, alternate orientations, phone views, existing
  castle/palace materials and near-waterfall diagnostics.
- [Measured performance and loading cost](PERFORMANCE.md): nine matched
  quality/camera samples, p50/p95, GPU time, draws, triangles, allocation
  estimates and actual served asset bytes.
- [Descriptive near-island colour and contrast](APPEARANCE.md): the fixed
  inspected crop, actual PNG statistics and their interpretation limits.
- [Before evidence](evidence/before/summary.json) and
  [after evidence](evidence/after/summary.json).

In the inspected 720×440 near-island crop, mean HSV saturation changes from
32.2% to 45.2%, display-RGB luminance standard deviation from 18.5% to 21.4%,
and the pale low-saturation fraction from 26.7% to 14.2%. These describe the
actual rendered colour/contrast change, including small background gaps
between the model silhouettes. They are not a universal art-quality
score or proof that every pixel change comes from atmospheric correction;
geometry and palette also change which pixels belong to a surface class.

## Regression evidence

The production TypeScript/Vite build and **75 local tests** passed: 46
presentation/camera/layout/menu/atmosphere checks, 16 online state/lifecycle
checks and 13 actual asset/PNG/malformed-file checks. This host uses Node
24.21.0 with the existing local Rollup WASM shim; CI uses the project's Node
22 configuration. Browser checks use the same production application.
These evidence files record what ran and their actual assertions:

- [Gameplay pointer/touch and camera controls](evidence/regression/results.json):
  40 spaces across desktop/tablet/phone sizes, presets/top/reset/orbit/zoom,
  authoritative dice [1,2], Baltic Avenue movement, purchase and end turn.
- [Motion behavior](evidence/regression/environment-motion.json): water/cloud/
  airship animation, live reduced motion, hidden tabs and ordinary-play audit
  isolation.
- [Resilience](evidence/regression/resilience.json): repeated scene mounts,
  live allocation stability, cached downloads, missing optional assets and
  subdirectory deployment loading.
- [WebGL recovery](evidence/regression/context-restore.json): context loss and
  restoration for all three tiers, with restored sky-pixel comparison.

The implementation does not alter backend systems. The PR's existing workflow
also exercises two real Chrome players against isolated PostgreSQL.

Every one of the 17 paired captures has an empty console/page error array,
zero scenery fallbacks and zero scenery shadow casters. All 14 normal views
have 40 scenery-clear tile rays. The three closeups intentionally inspect
scenery with a diagnostic target and do not claim board-framing coverage.

## Preservation and limitations

The Monopoly board, central city/castle, property data, HUD, controls, menu,
dice, movement, AI, trading, auctions, authentication, multiplayer, backend and
navigation stay outside this visual pass. Scenery remains noninteractive and
does not join the board's real-time shadow pass. Diagnostic detail cameras are
QA-only poses, not new gameplay camera controls.

The concept has painterly fine detail that bounded browser geometry and
baked shading approximate. Cloud cards remain view-facing soft impostors,
not a runtime volumetric simulation. Water is a stylized shader, not a fluid
simulation. The existing responsive 844×390 landscape HUD occupies much of
the viewport and leaves a small board; that UI/camera behavior is preserved.
Screenshot statistics describe selected pixels and cannot automatically prove
art quality. Coverage evidence samples normal views rather than every possible
continuous camera position.

Directional contact shading is baked in asset-local coordinates and rotates
with each placed island, while the runtime sun remains fixed in world space.
It is a restrained static grounding approximation rather than physically exact
world-space self-shadowing at every rotated copy. Runtime scenery adds no
shadow casters. The inspected internal board/city crop is visually preserved
but not byte-identical; [its descriptive pixel comparison](evidence/board-preservation.json)
records the actual difference without an arbitrary pass/fail threshold.

## Reproduce

Serve a production build of unchanged main `1cf0472` on port 4186 and the
candidate on 4187. Keep saved baseline evidence; never overwrite it with the
candidate build. The browser scripts use installed Chrome, overridable through
`CHROME_PATH`.

```sh
node scripts/premium-v4-review.mjs before
node scripts/premium-v4-review.mjs after
# AUDIT_URL=http://127.0.0.1:4187
# AUDIT_EVIDENCE_ROOT=docs/premium-environment-v4/evidence
# AUDIT_CAMERAS=overview,reference,wide
node scripts/atmosphere-audit.mjs after
node scripts/premium-v4-regression.mjs
node scripts/premium-v4-report.mjs
```

Run matched frame measurements without other browser/GPU work, Blender jobs,
builds or performance tests. `REVIEW_VIEWS` selects a comma-separated art
checkpoint subset; full final captures include all seventeen views.

The regression wrapper runs the four existing Chrome checks sequentially
against port 4187 and the same production build served under `/3D-Monoply/`
on port 4188. Start that additional prefix preview before running it. Keep
browser regressions separate from frame-timing samples.
