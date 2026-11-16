import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root='docs/premium-environment-v4',evidence=`${root}/evidence`;
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const n=value=>value===null?'unavailable':value.toLocaleString('en-US',{maximumFractionDigits:1});
const mib=value=>n(value/1048576);
const measurements=[];
for(const quality of ['low','balanced','high']){
  const before=await json(`${evidence}/before/${quality}.json`),after=await json(`${evidence}/after/${quality}.json`);
  assert.equal(before.sampleMs,5000);assert.equal(after.sampleMs,5000);
  assert.equal(before.warmupMs,after.warmupMs);
  assert.deepEqual(before.scenarios.map(s=>s.cameraName),['overview','reference','wide']);
  assert.deepEqual(after.scenarios.map(s=>s.cameraName),['overview','reference','wide']);
  assert.deepEqual(after.errors,[]);assert.deepEqual(after.failedRequests,[]);
  for(let i=0;i<before.scenarios.length;i++){
    const a=before.scenarios[i],b=after.scenarios[i];
    assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.metadata.viewport,b.metadata.viewport);
    assert.equal(a.metadata.dpr,b.metadata.dpr);assert.equal(a.metadata.renderer,b.metadata.renderer);
    assert.ok(b.tiles.every(tile=>!tile.occludedByEnvironment));
    measurements.push({quality,camera:b.cameraName,before:a.summary,after:b.summary,
      fpsChangePercent:(b.summary.fps/a.summary.fps-1)*100,renderer:b.metadata.renderer,
      userAgent:b.metadata.userAgent,dpr:b.metadata.dpr,
      allocationsBefore:a.metadata.allocationEstimates,allocationsAfter:b.metadata.allocationEstimates,
      loadedGlbBytesBefore:before.assetResponses.reduce((sum,asset)=>sum+asset.bytes,0),
      loadedGlbBytesAfter:after.assetResponses.reduce((sum,asset)=>sum+asset.bytes,0),
      loadedCloudBytesBefore:(before.textureResponses||[]).reduce((sum,asset)=>sum+asset.bytes,0),
      loadedCloudBytesAfter:(after.textureResponses||[]).reduce((sum,asset)=>sum+asset.bytes,0)});
  }
}
await writeFile(`${evidence}/performance.json`,JSON.stringify(measurements,null,2)+'\n');
const beforeViews=await json(`${evidence}/before/views.json`),afterViews=await json(`${evidence}/after/views.json`);
assert.equal(afterViews.length,17);
for(const view of afterViews){
  const before=beforeViews.find(v=>v.name===view.name);assert.ok(before);
  assert.deepEqual(view.metadata.camera,before.metadata.camera);
  assert.deepEqual(view.metadata.viewport,before.metadata.viewport);assert.equal(view.metadata.dpr,before.metadata.dpr);
  assert.deepEqual(view.errors,[]);assert.equal(view.environment.fallbacks,0);assert.equal(view.environment.shadowCasters,0);
  if(!view.diagnosticDetail)assert.ok(view.tiles.every(tile=>!tile.occludedByEnvironment));
}
const performanceRows=measurements.map(m=>`| ${m.quality} / ${m.camera} | ${n(m.before.fps)} → **${n(m.after.fps)}** | ${n(m.before.frameP50)} → ${n(m.after.frameP50)} | ${n(m.before.frameP95)} → ${n(m.after.frameP95)} | ${n(m.before.gpuP50)} → ${n(m.after.gpuP50)} | ${n(m.before.calls)} → ${n(m.after.calls)} | ${n(m.before.triangles)} → ${n(m.after.triangles)} |`).join('\n');
const memoryRows=measurements.filter(m=>m.camera==='reference').map(m=>`| ${m.quality} | ${mib(m.allocationsBefore.geometryAttributeBytes)} → ${mib(m.allocationsAfter.geometryAttributeBytes)} | ${mib(m.allocationsBefore.textureRgbaBytes)} → ${mib(m.allocationsAfter.textureRgbaBytes)} | ${mib(m.loadedGlbBytesBefore)} → ${mib(m.loadedGlbBytesAfter)} | ${n(m.loadedCloudBytesBefore/1024)} → ${n(m.loadedCloudBytesAfter/1024)} |`).join('\n');
// This view started a fresh Chrome run for both captures. Earlier diagnostic
// recaptures changed tab/cache order, so do not compare their warm ready times.
const readyRows=['supplied-gameplay'].map(name=>`| ${name} | ${n(beforeViews.find(v=>v.name===name).readyMs)} → ${n(afterViews.find(v=>v.name===name).readyMs)} |`).join('\n');
await writeFile(`${root}/PERFORMANCE.md`,`# Matched V4 rendering measurements

Main at \`1cf0472\` versus V4, actual renderer:
\`${measurements[0].renderer}\`.
Three r164; the capture user-agent and exact renderer are retained in the
[compact JSON](evidence/performance.json). Both builds use 1440×900 CSS pixels,
DPR 0.9 Low / 1 Medium and High, seed 10425058, reduced motion, four-second
warmup and five-second samples per camera. Camera metadata, viewport, DPR and
renderer are checked for equality. Samples run without another GPU workload.
Counts include the unchanged board/city and shadow pass. These are local
samples, not FPS guarantees for other devices; CPU scheduling also affects FPS.
Medium is the project's \`balanced\` preset.

| Tier / camera | FPS before → after | Frame p50 ms | Frame p95 ms | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${performanceRows}

| Tier, close view | Geometry buffers MiB before → after | Texture estimate MiB | Selected GLB download MiB | Cloud PNG KiB |
| --- | ---: | ---: | ---: | ---: |
${memoryRows}

Allocation estimates count actual scene buffers and RGBA/mipmap dimensions;
they are **not driver VRAM readings**. Selected GLB/PNG bytes are actual HTTP
responses checked against public-artifact SHA256 hashes. Cached distant LODs
and the selected quality tier are included in the loaded-byte totals.

| View | Observed navigation-to-environment-ready ms before → after |
| --- | ---: |
${readyRows}

Readiness includes real GLB loads and the selected cloud atlas. The attached
gameplay view started a fresh Chrome run for each capture, with no previous
tab load in that browser. These are local-preview timings, not controlled
cold-network benchmarks. Other raw view timings are retained but excluded
from this table because diagnostic recaptures changed tab/cache order.

[Before summary](evidence/before/summary.json), [after summary](evidence/after/summary.json).
Full per-quality JSON files retain per-frame CPU/GPU timings, exact camera
metadata, served status/hash checks, live allocations and browser error arrays.
The separate [screenshot report](SCREENSHOTS.md) records 14 normal views and
three QA-only detail targets. Performance is measured only in normal gameplay
poses, not in the diagnostic detail views.
`);
await writeFile(`${root}/SCREENSHOTS.md`,`# Matched V4 application captures

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
${afterViews.map(view=>`| ${view.title}${view.diagnosticDetail?' (diagnostic)':''} | ![${view.name} before](evidence/before/${view.name}.png) | ![${view.name} after](evidence/after/${view.name}.png) |`).join('\n')}

[Full capture/tile metadata](evidence/after/views.json) ·
[Matched performance](PERFORMANCE.md).
`);
const assets=await json('public/assets/models/environment/v4-manifest.json');
assert.equal(assets.assets.length,12);
const original=await json('public/assets/models/environment/polish-v2-manifest.json');
const assetRows=assets.assets.map(asset=>{
  const source=original.assets.find(item=>item.file===asset.sourceFile);assert.ok(source);
  assert.equal(asset.sourceSha256,source.sha256);
  return `| ${asset.file} | ${n(source.triangles)} → ${n(asset.triangles)} | ${n(source.bytes/1024)} → ${n(asset.bytes/1024)} |`;
}).join('\n');
await writeFile(`${root}/ASSETS.md`,`# Blender V4 asset inventory

Generated by \`tools/blender/refine_environment_v4.py\` with actual Blender
\`${assets.blenderVersion}\`. Twelve variants refine four original project
families. Each receipt binds its immutable V2 source SHA256. Runtime assets
are metre-scale Y-up GLBs with the shared embedded 128² atlas, one canonical
UV set, retained water anchors, cavity colours and three-tap baked directional
contact shading. Blender/Python are offline authoring dependencies only.

| Runtime file | Source → V4 triangles | Source → V4 KiB |
| --- | ---: | ---: |
${assetRows}

The original source GLBs are preserved. Added detail is limited to existing
landmarks; no extra island placements are introduced. Cheaper original distant
LODs remain in use. The [generation receipts](../../public/assets/models/environment/v4-manifest.json)
record bounds, transforms, triangle counts, bytes, anchors and hashes.
The [actual binary validation](evidence/asset-validation.json) checks the
produced buffers, positions, indices, embedded textures and topology budgets.
These are original project MIT assets, with no paid generation provider.
`);
const appearance=await json(`${evidence}/appearance.json`);
const appearanceRows=[
  ['Mean HSV saturation','meanHsvSaturation'],['Median HSV saturation','medianHsvSaturation'],
  ['Display-RGB luminance standard deviation','luminanceStdDev'],['Pale low-saturation pixel fraction','paleLowSaturationFraction'],
  ['Green-class mean saturation','greenMeanSaturation'],['Blue-class mean saturation','blueMeanSaturation']
].map(([label,key])=>`| ${label} | ${n(appearance.before[key]*100)}% | ${n(appearance.after[key]*100)}% |`).join('\n');
await writeFile(`${root}/APPEARANCE.md`,`# Near-environment screenshot statistics

The fixed \`hero-left-detail\` crop [${appearance.rectangle.join(', ')}] was
selected after inspecting the actual baseline/checkpoint images. It contains
${appearance.description}, with small sky/background gaps between silhouettes.
Both final captures use identical camera, target,
viewport and DPR. [Exact output](evidence/appearance.json).

| Descriptive statistic | Before | After |
| --- | ---: | ---: |
${appearanceRows}

The tool reads actual screenshot PNG bytes using the existing repository
decoder. HSV values describe display-encoded colours; luminance statistics use
weighted display-RGB channels, not physical scene radiance. The pale fraction
uses luminance >0.63 and saturation <0.16. Green and blue classes use fixed hue
ranges and saturation >0.16; changes in geometry/palette affect their pixel
membership. This is a numerical description of the selected crop, not an
automatic visual-quality pass threshold or an attribution of every change to
fog alone. Actual image inspection is the visual authority.

Reproduce after reviewing the same crop:

\`\`\`sh
python tools/compare_environment_capture.py docs/premium-environment-v4/evidence/before/hero-left-detail.png docs/premium-environment-v4/evidence/after/hero-left-detail.png --rect 320 180 720 440 --description "near castle island: blue roofs, ivory walls, blossoms, grass, stone and cliff edge, excluding HUD" --output docs/premium-environment-v4/evidence/appearance.json
\`\`\`
`);
console.log('Wrote V4 performance and screenshot tables from matched application evidence.');
