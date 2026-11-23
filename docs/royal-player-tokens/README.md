# Royal fantasy player tokens

The four miniatures were modeled in Blender 5.2.3 LTS from the supplied concepts. Each comparison pairs the reference with a render made by reimporting the final master GLB. It also shows the opposite and rear angles.

| Token ID | Master GLB | Game export | Reference comparison |
| --- | --- | --- | --- |
| `racecar` | [Royal Carriage](master/RoyalCarriage.glb) · 3.91 MB · 204,840 triangles | [GLB](../../public/assets/models/player-tokens/RoyalCarriage.glb) · 848 kB · 36,192 triangles · 8 draws | [Carriage](comparisons/RoyalCarriage.jpg) |
| `cat` | [Royal Unicorn](master/RoyalUnicorn.glb) · 6.53 MB · 258,152 triangles | [GLB](../../public/assets/models/player-tokens/RoyalUnicorn.glb) · 650 kB · 27,670 triangles · 8 draws | [Unicorn](comparisons/RoyalUnicorn.jpg) |
| `yacht`, `top_hat` | [Royal Pegasus](master/RoyalPegasus.glb) · 6.96 MB · 284,592 triangles | [GLB](../../public/assets/models/player-tokens/RoyalPegasus.glb) · 794 kB · 34,038 triangles · 10 draws | [Pegasus](comparisons/RoyalPegasus.jpg) |
| `rubber_duck` | [Royal Griffin](master/RoyalGriffin.glb) · 7.03 MB · 291,792 triangles | [GLB](../../public/assets/models/player-tokens/RoyalGriffin.glb) · 826 kB · 35,524 triangles · 8 draws | [Griffin](comparisons/RoyalGriffin.jpg) |

Sizes are decimal. Draw counts cover the visible material batches before any shadow passes. The [asset inventory](asset-inventory.json) records the exact byte counts, bounds, triangles, atlas dimensions and SHA-256 hashes. The four game GLBs total 3.12 MB and 133,424 triangles.

## Visual review

- **Carriage.** The ivory cabin has four real arched openings, gathered curtains and tufted seats. Six cast petals connect each wheel rim to a sapphire hub. The reference uses deeper scroll relief and a richer blue canopy. The model uses open wheel spokes and carries the heraldic plaque through to the rear.
- **Unicorn.** The muzzle, neck, barrel and all four legs form a continuous porcelain mesh. A spiral horn, mane locks, curled tail, rolled collar and inset gems carry the silhouette. The reference has a fuller layered coiffure, a broader gold tail ribbon and more deeply modeled hoof scrolls.
- **Pegasus.** The wings have separate flight feathers and overlapping coverts on both faces. The gold bridle and chestplate distinguish it from the unicorn. Its primaries sweep farther back and the breastplate is simpler than the concept.
- **Griffin.** The eagle brow, hooked beak, staggered ruff and gilded claws sit on broad paws and folded lion haunches. Blue median feathers break up the ivory wings. The leading-edge trim is straighter and the layered ruff is more regular than in the concept.

The source textures are procedural and the models use embedded PBR materials. The supplied 2D art appears in the comparison sheets only. The assets use the repository’s license and required no external generation service.

## Game integration

Drei loads the game GLBs by URL and shares their geometries, materials and textures between token instances. The fit uses each mesh’s ground plane, height and horizontal radius. The loader places each token inside the existing animated group, with the original token available during loading or if the GLB fails to load. The game adds selective shadow casting to the main surfaces and keeps the existing ring colors.

Solo and online use the same renderer. The fourth seat displays Royal Pegasus through its existing `yacht` ID. Existing games using `top_hat` also display Pegasus. The online lobby uses the same model names for those IDs.

## Verify and regenerate

```sh
blender -b --factory-startup --python-exit-code 1 --python tools/blender/royal_tokens/generate.py -- --render front opposite rear
blender -b --factory-startup --python-exit-code 1 --python tools/blender/royal_tokens/generate.py -- --tier game --render front --size 520
python tools/blender/validate_assets.py --profile royal-token-master docs/royal-player-tokens/master/*.glb
python tools/blender/validate_assets.py --profile royal-token-game public/assets/models/player-tokens/*.glb
npm run lint
npm run build
```

The Blender script supports `--only` for selective regeneration. The `game` tier writes to the review directory for comparison before copying exports into `public/assets/models/player-tokens`. Pass the four originals to [compare.ps1](../../tools/blender/royal_tokens/compare.ps1) with `-Carriage`, `-Unicorn`, `-Pegasus` and `-Griffin` to regenerate the comparison sheets.

Run the browser check against a production preview on port 5199. Setting `ROYAL_BASELINE_URL` adds a comparison with a locally served build of the base revision.

```sh
node scripts/royal-tokens-browser.mjs
```

## Test results

- TypeScript and the Vite production build passed. The four production GLBs matched their validated source hashes.
- All eight GLBs passed binary inspection for material and texture references, indexed geometry, normals, and ground-aligned Y-up bounds.
- The existing Solo, Online, animation and menu suites passed. The original asset PR and its base revision both reported `4 !== 2` in the V6 graphics ownership-rail assertion.
- Chrome loaded all four GLBs in the default match, including Pegasus in the green fourth seat. The legacy `top_hat` fixture also showed Pegasus and verified all four actors on a property tile at 414 × 780. A real dice roll took the Griffin from GO to tile 8 and captured an airborne frame. A simulated missing Pegasus GLB left the fourth ring visible and the default match playable.

| Balanced desktop run | Median frame | 95th-percentile frame | Median draw calls | Median triangles including shadow passes |
| --- | ---: | ---: | ---: | ---: |
| Main at `5e6472b`, stock lineup | 55.0 ms | 82.0 ms | 209 | 618,993 |
| Updated stock lineup | 58.6 ms | 76.2 ms | 196 | 814,539 |
| Legacy `top_hat` fixture | 67.7 ms | 92.5 ms | 196 | 814,539 |

Chrome reported an AMD Radeon 610M through Direct3D 11. The before and after captures use the same viewport, camera and default four-seat match. Timings vary with host load. The final samples and actor bounds are in [runtime.json](browser/runtime.json).

[Before](browser/baseline-shared-corner.jpg) · [After](browser/updated-shared-corner.jpg) · [All four on GO](browser/all-four-at-go.jpg) · [Board overview](browser/desktop-board-overview.jpg) · [Small viewport](browser/small-viewport-shared-property.jpg)
