import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root='docs/sunset-kingdom',evidence=`${root}/evidence`;
const json=async filename=>JSON.parse(await readFile(filename,'utf8'));
const n=value=>value.toLocaleString('en-US',{maximumFractionDigits:1});
const measurements=[];
for(const quality of ['low','balanced','high']) {
  const before=await json(`${evidence}/before/${quality}.json`),after=await json(`${evidence}/after/${quality}.json`);
  assert.equal(before.sampleMs,5000);assert.equal(after.sampleMs,5000);
  for(let i=0;i<before.scenarios.length;i++) {
    const a=before.scenarios[i],b=after.scenarios[i];
    assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.metadata.viewport,b.metadata.viewport);assert.equal(a.metadata.dpr,b.metadata.dpr);
    assert.equal(a.metadata.renderer,b.metadata.renderer);
    measurements.push({quality,camera:b.cameraName,before:a.summary,after:b.summary,
      fpsChangePercent:(b.summary.fps/a.summary.fps-1)*100,
      allocationsBefore:a.metadata.allocationEstimates,allocationsAfter:b.metadata.allocationEstimates,
      renderer:b.metadata.renderer,
      loadedGlbBytesBefore:before.assetResponses.reduce((sum,asset)=>sum+asset.bytes,0),
      loadedGlbBytesAfter:after.assetResponses.reduce((sum,asset)=>sum+asset.bytes,0)});
  }
}
await writeFile(`${evidence}/performance.json`,JSON.stringify(measurements,null,2));
const manifest=await json('public/assets/models/environment/sunset-manifest.json');
const ids=[...new Set(manifest.assets.map(asset=>asset.id))];
const perfRows=measurements.map(m=>`| ${m.quality} / ${m.camera} | ${n(m.before.fps)} → **${n(m.after.fps)}** | ${n(m.before.gpuP50)} → ${n(m.after.gpuP50)} | ${n(m.before.calls)} → ${n(m.after.calls)} | ${n(m.before.triangles)} → ${n(m.after.triangles)} |`).join('\n');
const memoryRows=measurements.filter(m=>m.camera==='reference').map(m=>{
  const a=m.allocationsBefore,b=m.allocationsAfter,mb=bytes=>n(bytes/1048576);
  return `| ${m.quality} | ${mb(a.geometryAttributeBytes)} → ${mb(b.geometryAttributeBytes)} | ${mb(a.textureRgbaBytes)} → ${mb(b.textureRgbaBytes)} | ${mb(m.loadedGlbBytesBefore)} → ${mb(m.loadedGlbBytesAfter)} |`;
}).join('\n');
const assets=ids.map(id=>`| ${id} | ${['high','balanced','low'].map(tier=>n(manifest.assets.find(a=>a.id===id&&a.tier===tier).triangles)).join(' | ')} |`).join('\n');
const report=`# Sunset floating kingdom

This pass recreates the newly supplied fantasy concept as interactive scenery
around the existing Monopoly board. It starts from current main at \`0fb8a2f\`.
The reference is art direction only: no reference pixels are used in gameplay.

The surrounding world gains a tall eight-spire citadel, an actual open sky
bridge and lookout crag, a windmill hamlet, flowering marble belvederes, royal
garden dressing, and a fractured island foundation with blue crown banners and
trailing ivy beneath the unchanged board chassis. Ten new destinations join
the existing castles and supporting islands around the full camera orbit.

The waterfalls are convex, widening 3D curtains with flowing filaments, source
foam and dissipating mist. Their rivers and curtains share a draw; spray shares
another. The sunset has three wrapping cloud shelves, higher cumulus, four
procedurally shaded billboard variants, a warm solar disc, and four mountain
ranges with finer ridges and lit flanks. The royal blue airship drifts above the
skyline. Motion respects the live reduced-motion preference and tab visibility.

## Matched production captures

The poses, FOV, responsive offsets, DPR, seeded game and viewport match exactly.

| Before | After |
| --- | --- |
| ![Concept angle before](evidence/before/reference-desktop.png) | ![Concept angle after](evidence/after/reference-desktop.png) |
| ![Default before](evidence/before/balanced-overview.png) | ![Default after](evidence/after/balanced-overview.png) |
| ![Zoomed out before](evidence/before/wide.png) | ![Zoomed out after](evidence/after/wide.png) |
| ![Alternate orbit before](evidence/before/orbit.png) | ![Alternate orbit after](evidence/after/orbit.png) |
| ![Reverse before](evidence/before/reverse.png) | ![Reverse after](evidence/after/reverse.png) |
| ![Phone before](evidence/before/portrait.png) | ![Phone after](evidence/after/portrait.png) |
| ![Landscape before](evidence/before/landscape.png) | ![Landscape after](evidence/after/landscape.png) |

The board, central city/castle, HUD, camera controls, presets, gameplay state,
rules, backend and multiplayer code retain their source. The new foundation
sits below the chassis; scenery never intercepts gameplay input or casts board
shadows. Actual exported bounds and browser rays validate tile clearance.

## Blender source and asset inventory

Installed **Blender 5.2.3 LTS** executed
[generate_sunset_kingdom.py](../../tools/blender/generate_sunset_kingdom.py), using
\`bpy\` and the existing original construction modules. Five assets have three
topology tiers, applied metre-scale Y-up exports, a real
embedded 128×128 atlas, vertex cavity shading and named effect anchors.
Existing GLBs remain byte-for-byte unchanged. All new geometry is original
under the repository MIT license. No paid provider was used. The optional
game-dev CLI is absent; the repository validator inspected the actual bytes.

| Asset | High triangles | Balanced triangles | Low triangles |
| --- | ---: | ---: | ---: |
${assets}

[Export hashes, bounds and anchors](../../public/assets/models/environment/sunset-manifest.json) ·
[Binary geometry/texture validation](evidence/asset-validation.json) ·
[Reproduction commands](../../tools/blender/README.md).

Only the selected quality tier is loaded. Background GLBs use a compact
illustrated shader with one sun, sky fill, a small metallic highlight and the
baked cavity colours. The board retains its existing PBR lighting. Model
families share material-batched instancing, with per-placement sphere/frustum
culling. All environment geometry is shadow-free. The cloud volume atlas is
baked once on the CPU; the main sky bakes once on the GPU and on context
restoration. No fullscreen bloom, volume raymarch or fluid simulation is added.
Instance buffers and generated textures are released on scene departure.

## Measured rendering cost

Real Chrome 157 / Three r164 on **AMD Radeon 610M, Direct3D11**. Both builds use
1440×900, DPR 0.9 on low and 1 on balanced/high, seed 10425058, reduced motion,
4-second warmup and 5-second samples per camera. Measurements ran without a
second GPU workload. These are local-browser measurements, not device-wide FPS
guarantees. Counts include the original board, its shadow pass and city.

| Tier / camera | FPS before → after | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: |
${perfRows}

The richer geometry increases download and allocation cost. The simpler
background shader reduces GPU time enough to improve measured FPS in every
case. The original board still accounts for most of the roughly 2,750 draws.

| Tier, lower view | Geometry buffer MiB before → after | Texture allocation estimate MiB | Selected GLB download MiB |
| --- | ---: | ---: | ---: |
${memoryRows}

Allocation estimates use actual scene buffers and RGBA image dimensions; they
are not driver VRAM readings. [Compact comparison](evidence/performance.json)
and full raw samples under [before](evidence/before/summary.json) and
[after](evidence/after/summary.json) retain the camera, GPU timings, file hashes,
sample counts and material/geometry inventories. Art checkpoint captures are
excluded from the commit.

## Verification

- Production TypeScript/Vite build; local Node 24.21.0 with the existing host
  Rollup WASM shim. CI continues to use the repository's Node 22 configuration.
- 45 presentation, camera, layout, menu boundary and cloud-pixel checks; 16
  online state/lifecycle checks; 10 actual asset and malformed-asset tests.
- Seven matched multi-angle/responsive views, all 40 tile rays clear, same
  cameras and DPR, no asset fallbacks, zero environment shadow casters and no
  browser rendering errors: [view evidence](evidence/after/views.json).
- Real mouse/touch selection of all 40 spaces across four viewport sizes;
  top view, presets, reset, orbit, zoom, dice [1,2], movement to Baltic Avenue,
  purchase for $60 and end turn: [interaction results](evidence/regression/results.json).
- Water/cloud/airship motion, live reduced motion, hidden-tab freeze and no
  diagnostic globals in ordinary play: [motion results](evidence/regression/environment-motion.json).
- Four mount/unmount cycles preserve live allocations and one download per
  cached GLB; an aborted optional asset preserves board selection:
  [resilience](evidence/regression/resilience.json).
- Context loss/restoration at all quality tiers and byte-identical restored
  sky pixels: [context checks](evidence/regression/context-restore.json).

## Limits

The concept has painterly detail and dense flower coverage that this browser
scene approximates with bounded geometry. Clouds use shaded cards plus a
procedural sky bake; architecture uses baked cavity shading and inexpensive
runtime lighting. This is a stylized reconstruction, not an identical render
of the concept. The existing central castle and board illumination remain as
requested. Local Docker was unavailable, so the full PostgreSQL/two-player
browser suite runs in the pull request's existing CI workflow; the local online
state tests passed.

## Reproduce

\`\`\`sh
blender --background --factory-startup --python-exit-code 1 --python tools/blender/generate_sunset_kingdom.py
npm run test:environment-assets
npm run build
# Serve unchanged main on 4181 and the candidate on 4182.
node scripts/sunset-kingdom-review.mjs before
node scripts/sunset-kingdom-review.mjs after
# Set AUDIT_URL and AUDIT_EVIDENCE_ROOT=docs/sunset-kingdom/evidence as appropriate.
node scripts/atmosphere-audit.mjs before
node scripts/atmosphere-audit.mjs after
node scripts/sunset-kingdom-report.mjs
\`\`\`
`;
await writeFile(`${root}/README.md`,report);
console.log('Wrote the sunset kingdom report from matched raw measurements.');
