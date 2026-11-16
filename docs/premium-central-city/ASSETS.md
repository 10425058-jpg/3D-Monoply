# Original Blender central district

`tools/blender/generate_central_city.py` was executed with installed Blender
**5.2.3 LTS**. It reuses the project's architectural construction
modules for original center geometry, without importing or regenerating any
outside-world GLB. Shared module source hashes are retained in
[the manifest](../../public/assets/models/central-city/manifest.json).
Source hashes normalize UTF-8 line endings to LF for Windows/Linux checkouts;
GLB hashes always cover the exact binary bytes.
The script, modules and generated geometry are original repository MIT assets.
No paid provider, downloaded mesh or reference-image plane is used.

| Tier | GLB | Base-level triangles | All five groups / budget | KiB | Material primitives, all groups |
| --- | --- | ---: | ---: | ---: | ---: |
| high | central-royal-district.glb | 82,766 | 94,194 / 100,000 | 6,703.4 | 32 |
| balanced | central-royal-district-balanced.glb | 61,214 | 67,170 / 68,000 | 4,697.2 | 32 |
| low | central-royal-district-low.glb | 30,402 | 33,494 / 38,000 | 2,327.5 | 30 |

All tiers use 15 shared PBR materials and one embedded original 256² atlas
(0.25 MiB RGBA, about 0.33 MiB with mipmaps), one canonical UV set, normals and
baked vertex contact shading. Gold has metal response; stone, slate, wood,
foliage and paving retain distinct roughness. Directional contact shading is
baked against the existing sun direction. The district stays at its authored
world orientation, with the existing real shadow map used selectively.

The complete geometry bounds are X/Z ±7.65m and Y −0.37…9.655m: inside the
original 15.3m lawn, below the 10.8m authoring ceiling and the unchanged camera's
11m castle fit bound. The official
glTF exporter converts Blender Z-up/front −Y to metre-scale Y-up/front +Z once.
The browser applies exported transforms directly, without another 90° rotation.

The level-one mesh contains the keep, decorated portal, windowed rear gallery,
four houses, stone plaza, fountain structure, gardens, eight cherry trees,
six pines, blue cupola pavilion, ten lamps, four benches and flowering arch.
Level two adds rear watchtowers, three adds front terrace turrets, four adds
front/rear clocks and five adds a fountain crown. Geometry and flags unlock
from the existing maximum player landmark level; no gameplay state is changed.
One selected GLB contains all groups. Nine flag, ten lamp and one fountain
anchors attach the four runtime effect draws to the actual architecture.

Lower tiers reduce roof/tower sections, branch/canopy topology, small blossom
sprays and paving segments. Entire districts are joined by unlock group and
material, avoiding hundreds of React object draws. Fountain surfaces and curved
jets share one geometry, flags and lamp halos are instanced, and spray uses
28/52/80 points. No fluid simulation, refraction pass or point light is added.

The [binary inspection](evidence/asset-validation.json) checks actual buffers,
indices, bounds, normals, UVs, decoded PNG texels, embedded images, hashes and
explicit 38k/68k/100k triangle budgets. The `central-city` validator profile is
restricted to this family; existing outer-world budgets remain unchanged.
This is the repository's validator, not a claim that Khronos conformance or
the unavailable optional `game-dev` CLI ran. Chrome also imported and rendered
every tier with served-file hash checks.

Blender and Python are offline authoring tools only. The deployed application
loads the checked-in GLBs through Drei/Three.js and requires neither tool.
