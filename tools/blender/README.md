# Procedural fantasy environment

The shipped GLBs are already generated and validated. Running the game does not require Blender. Continue from these files; regenerate only an asset you intend to change.

The master continuation preserves the completed landscape/prop exports and updates only the two royal island composites. The left five-spire gatehouse and right three-tower palace now have different gables, silhouettes and an open loggia. See [the current report](../../docs/fantasy-master/README.md) for same-camera evidence, final triangle inventory and continuation limits. Use `--only royal-island-left,royal-island-right` to reproduce that export without rebuilding completed props.

## Generate or update

From the repository root, with Blender on PATH:

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_environment.py -- --milestone final
```

Tested with Blender **5.2.3 LTS**. On Windows, invoke the installed executable with PowerShell's `&` operator. Paths in the scripts resolve relative to their source, independent of the current working directory. No add-on, paid provider, network access or external texture file is required. `--python-exit-code 1` makes a failed generation fail the command.

Update only the airship, preserving all completed island and prop exports:

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_environment.py -- --milestone final --only fantasy-airship --tiers high,balanced,low
```

Update one island LOD:

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_environment.py -- --milestone final --only royal-island-left --tiers balanced
```

Options: `--seed` (default `10425058`), `--out-dir`, `--tiers high,balanced,low,distant`, `--only` comma-separated asset IDs, and `--milestone foundation|architecture|nature|final`. `--only` merges new receipts into the existing manifest and touches only selected GLBs. Without it, the chosen milestone is regenerated. `foundation` writes its own manifest and island checkpoint; later milestones do not rebuild that checkpoint. Geometry, palette and layout are deterministic for the seed, Blender version and invocation. Export node names/hashes may differ when the generation order or Blender exporter changes; validate the new receipt rather than assuming byte identity across versions.

`architecture` exports the two kingdoms without nature; `nature` and `final` export the complete islands plus reusable props. Milestone A/B/C browser evidence is retained under `docs/phase2-world/evidence`.

## Authoring conventions

- Blender uses Z-up, metres, front -Y, meadow/architecture ground at Z=0. The official glTF exporter converts once to Y-up and front +Z. Do not rotate the runtime asset another 90 degrees.
- Exported mesh root origin `[0,0,0]`, applied transforms, no cameras, lights or animation clips. Each composite is joined and split into material primitives by glTF. Runtime uses one instanced draw per material, with raycasting and real-time shadows disabled for background models.
- `waterfall_origin_left/right` and `waterfall_end_left/right` are exported empties with effect metadata. Runtime reads these anchors directly. They face outward from the gameplay board. Numeric suffixes from Blender are tolerated.
- `core.py` supplies shared PBR materials, a real embedded 128² surface atlas, UV projection, bevelled boxes, shaped lathes, curved polygon tubes and actual open arch surrounds. Set image colour space **before** writing generated pixels: Blender 5.2 otherwise reallocates them. Vertex tint defaults white on untinted geometry.
- Generator modules return objects and have no import-time reset/export. Islands have flat irregular plateaus and fractured tapered cliffs. Architecture, tree, house, bridge, lantern and airship modules can be reused separately. `export_assets.py` evaluates authoring modifiers, batches materials and writes hashes/bounds/count receipts.
- Main high/balanced/low tiers reduce architectural sides, windows, house detail, foliage lobes and tree counts. The far LOD further decimates low geometry by 50%. Hard budgets and actual inventory are in [assets.md](../../docs/phase2-world/assets.md).

## Validate and reproduce browser evidence

```sh
python tools/blender/validate_assets.py --manifest public/assets/models/environment/manifest.json --output docs/phase2-world/evidence/asset-validation.json
npm run test:environment-assets
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

In another terminal:

```sh
node scripts/phase2-audit.mjs after
node scripts/environment-regression.mjs
node scripts/phase2-report.mjs
```

The browser scripts use installed Chrome and `puppeteer-core`, already in the project. Override `CHROME_PATH` and `AUDIT_URL` as needed. `AUDIT_QUALITIES=balanced` and `AUDIT_SAMPLE_MS=1500` select a short checkpoint; final measurements use all tiers and 5000 ms. Do not run Blender renders or another browser performance workload during measurement. Do not overwrite `evidence/before` with the candidate: that baseline belongs to main at `b0681d5`.

The stdlib validator checks actual binary positions/indices, bounds, transforms, material/triangle/file budgets, embedded image dimensions/CRC/decoded pixel colours and the texels reached by exported UVs. Mutation tests exercise malformed files, bad indices/bounds, external texture links and valid-but-black PNGs. It is a project-specific inspection, not a claim that the Khronos conformance validator or a missing game-dev CLI ran.

All authored geometry and the generated atlas are original project assets under the repository MIT license. User references guided the art direction; no reference image or third-party mesh is embedded.

## Supporting archipelago

`generate_archipelago.py` creates the original celestial observatory, ivy-covered
sanctuary ruins and millstream hamlet. It uses the same construction API, embedded
atlas and official Blender GLB exporter. It writes only nine `sky-*.glb` LODs and
`archipelago-manifest.json`; existing royal island exports remain intact.

```sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_archipelago.py
python tools/blender/validate_assets.py --manifest public/assets/models/environment/archipelago-manifest.json
```

Blender 5.2.3 LTS produced the checked-in bytes. All three models have high,
balanced and low topology, applied Y-up runtime transforms, a ground origin,
UVs, correct normals and one embedded 128px atlas. Each is below 8,000 triangles
and 650,000 bytes; balanced/low are below 4,000 triangles. Millstream route and
waterfall empties attach the browser animation to the actual exported cliff.
The ten destinations reuse three material-batched model draws, rather than
cloning an independent scene for each island. See the [new report](../../docs/premium-fantasy-world/README.md)
for the actual inventory, placement safety, screenshots and measurements.
