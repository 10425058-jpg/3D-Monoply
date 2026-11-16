# Premium central castle and miniature city

This change starts from main at `88a5bd6`, after the completed V4 surrounding
world upgrade. It replaces the existing decorative center with an original
Blender-authored royal district. The outer property ring, floating islands,
sky, camera implementation, HUD, gameplay and backend sources are preserved.

The original center used many independently rendered primitives, repeated
houses and rounded tree clusters. Its rear castle elevation was sparse, its
fountain and paths had little architectural detail, and its numerous draws,
shadow casters and local lights dominated submission cost. The new center
reuses the repository's offline architectural construction modules and retains
the existing city as its loading/error fallback.

The castle has shaped royal-blue slate roofs, ivory and gold mouldings,
recessed arched glazing, a decorated triple portal, stone stairs with a red
runner, heraldry, flags and terrace balustrades. The rear has a gabled gallery,
three tall windows, an attic lancet and a supported balcony. The upper keep
and side elevations also have glazing. This is complete 3D geometry viewed
from multiple sides, rather than a front-only image or façade.

Four miniature houses surround a circular paved plaza. A burgundy mansard café,
blue gabled shopfronts, awnings, chimneys, balconies and side/rear windows give
them distinct forms within the same material palette. Stone paths connect
the stairs, plaza and front flowering arch. Eight cherry trees carry small
five-petal mesh sprays; six pines, flowerbeds, shrubs and rocks frame the paths.
Ten lamps, four benches, railings and a blue cupola pavilion complete the garden.
The fountain has three actual open bowls, turquoise water surfaces, curved
jets and restrained spray.

## Integration and preservation

`CenterCity3D.tsx` loads only the selected Low, Medium or High GLB through Drei.
Geometry and the embedded atlas stay in the loader cache; mounted material
clones are owned and disposed locally. Static meshes are batched by material
and unlock group. Only stone, ivory, slate, wood and gold batches cast shadows.
The existing sun, shadow map, exposure and color pipeline are unchanged. Baked
contact shading, roughness, emission and small instanced lamp halos provide
local depth and warmth without adding real-time lights.

`RoyalCityEffects.tsx` contributes four draws: water/curved jets, spray points,
instanced flags and instanced lamp halos. Water and flags use simple GLSL with
live reduced-motion and hidden-tab guards. The effects dispose owned geometry
and instance buffers while preserving cached model resources. Decorative
objects have no gameplay raycasts or click handlers.

The existing maximum player `landmarkLevel` still controls five visual stages:
base district, rear towers, front turrets, clocks and crown. No game-state
writes or rule changes are introduced. Previewing levels is available only
through the opt-in `?graphicsAudit` diagnostic hook. Ordinary gameplay has no
audit globals. The scene change outside the city consists of passing its
existing quality preset to the city component; no camera or board parameters
change. The diagnostic ray audit checks actual mesh geometry even though
decorative runtime raycasting is disabled.

`CenterCityLegacy.tsx` is an exact copy of the prior center. It remains visible
while the selected GLB loads and if that request fails. Both the fallback and
all five new levels preserve the forty playable tile centers. The complete
asset footprint remains within the original 15.3m central lawn.

## Evidence and validation

- [Twelve paired browser views](SCREENSHOTS.md), including castle front/rear,
  plaza, houses, vegetation, alternate angles and phone sizes.
- [Original Blender assets, topology, materials and provenance](ASSETS.md).
- [Nine matched performance samples](PERFORMANCE.md), including FPS, frame/GPU
  time, draws, triangles, allocation estimates and the new download cost.
- [City browser regression](evidence/regression/central-city.json): all five
  visual levels at all three tiers, unchanged game snapshots, forty clear
  tiles, reduced motion, hidden tabs, four mount cycles, cached loading,
  asset failure fallback, subdirectory loading and audit isolation.
- [Context recovery](evidence/regression/context-balanced.json): all three
  tiers restore with zero mean pixel difference in the inspected city crop.
- [Pointer/touch and Solo gameplay](evidence/regression/results.json): all
  forty spaces at four viewports, camera controls, dice [1,2], movement to
  Baltic Avenue, purchase and end turn.

The production TypeScript/Vite build and **78 local tests** passed: 62
presentation, camera, menu, environment and actual asset checks, plus 16
online state/lifecycle checks. This Windows host uses Node 24.21.0 with its
existing local Rollup WASM shim; CI uses the project's configured Node 22.
The PR's existing CI workflow also runs real two-player Chrome gameplay
against isolated PostgreSQL. Its outcome is recorded on the PR checks.

Installed **Blender 5.2.3 LTS** actually ran `bpy` and the official GLB exporter.
The optional `game-dev` CLI is unavailable on this host. The repository binary
validator, source/hash receipts, actual Chrome imports and browser rendering
were used instead. No paid generation service was invoked. No source concept
image, downloaded mesh, new package or runtime Blender dependency is included.

## Limits

This is a bounded stylized interpretation of the reference. Trees retain
clustered silhouettes with small mesh blossoms, and paving uses geometry plus
a shared 256² material atlas. Contact shading is static. Fountain motion is a
shader effect, rather than fluid simulation, and warm glazing/halos do not
illuminate nearby objects with local lights. The legacy city remains an
expensive fallback if the asset cannot load.

The selected GLB adds 2.3/4.6/6.5 MiB on Low/Medium/High, while the fallback
code remains bundled. Medium/High live geometry allocation estimates increase
despite fewer draws. On the measured AMD Radeon 610M, overview FPS changes
75.6→164.6, 45.9→99.0 and 36.3→73.2 respectively. These short local samples
are not low-end-device or cold-network guarantees. Mobile landscape retains
the existing large HUD and small board framing. Browser views sample camera
angles; they do not prove every continuous orbit position.

## Reproduce

The generated GLBs are checked in. Do not regenerate them to run the game.
Blender is needed only for an intentional authoring change:

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_central_city.py
python tools/blender/validate_assets.py public/assets/models/central-city/central-royal-district.glb public/assets/models/central-city/central-royal-district-balanced.glb public/assets/models/central-city/central-royal-district-low.glb --profile central-city --manifest public/assets/models/central-city/manifest.json
node --test tests/central-city.test.mjs
npm run build
```

Keep the saved `before` evidence from the main `88a5bd6` tree. It was captured
from an isolated production build, equivalent to the completed V4 commit tree.
Never replace it with candidate screenshots. Serve that baseline on 4189,
the candidate on 4190 and the same candidate under `/3D-Monoply/` on 4191.
The last two preview commands are:

```sh
npm run preview -- --host 127.0.0.1 --port 4190 --strictPort
npm run preview -- --host 127.0.0.1 --port 4191 --strictPort --base /3D-Monoply/
node scripts/central-city-review.mjs after
node scripts/central-city-audit.mjs after
node scripts/central-city-regression.mjs
```

For the existing gameplay browser check, set `AUDIT_URL=http://127.0.0.1:4190`
and `GRAPHICS_REGRESSION_OUT=docs/premium-central-city/evidence/regression`,
then run `node scripts/graphics-regression.mjs`. Finally regenerate the tables
with `node scripts/central-city-report.mjs`. Keep performance samples separate
from builds, Blender jobs and other browser workloads. Browser scripts use
installed Chrome, overridable through `CHROME_PATH`.
