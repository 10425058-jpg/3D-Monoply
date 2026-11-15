import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root='docs/environment-visual-polish-v2',evidence=`${root}/evidence`;
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const n=value=>value.toLocaleString('en-US',{maximumFractionDigits:1});
const mib=value=>n(value/1048576);
const measurements=[];
for(const quality of ['low','balanced','high']){
  const before=await json(`${evidence}/before/${quality}.json`),after=await json(`${evidence}/after/${quality}.json`);
  assert.equal(before.sampleMs,5000);assert.equal(after.sampleMs,5000);
  assert.deepEqual(before.scenarios.map(s=>s.cameraName),['overview','reference','wide']);
  assert.deepEqual(after.scenarios.map(s=>s.cameraName),['overview','reference','wide']);
  for(let i=0;i<before.scenarios.length;i++){
    const a=before.scenarios[i],b=after.scenarios[i];
    assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.metadata.viewport,b.metadata.viewport);
    assert.equal(a.metadata.dpr,b.metadata.dpr);assert.equal(a.metadata.renderer,b.metadata.renderer);
    measurements.push({quality,camera:b.cameraName,before:a.summary,after:b.summary,
      fpsChangePercent:(b.summary.fps/a.summary.fps-1)*100,renderer:b.metadata.renderer,
      allocationsBefore:a.metadata.allocationEstimates,allocationsAfter:b.metadata.allocationEstimates,
      loadedGlbBytesBefore:before.assetResponses.reduce((sum,asset)=>sum+asset.bytes,0),
      loadedGlbBytesAfter:after.assetResponses.reduce((sum,asset)=>sum+asset.bytes,0),
      loadedCloudBytesAfter:after.textureResponses.reduce((sum,asset)=>sum+asset.bytes,0)});
  }
}
await writeFile(`${evidence}/performance.json`,JSON.stringify(measurements,null,2)+'\n');
const beforeViews=await json(`${evidence}/before/views.json`),afterViews=await json(`${evidence}/after/views.json`);
assert.equal(afterViews.length,13);
for(const view of afterViews){
  const before=beforeViews.find(v=>v.name===view.name);assert.ok(before);
  assert.deepEqual(view.metadata.camera,before.metadata.camera);
  assert.deepEqual(view.metadata.viewport,before.metadata.viewport);assert.equal(view.metadata.dpr,before.metadata.dpr);
  assert.deepEqual(view.errors,[]);assert.ok(view.tiles.every(tile=>!tile.occludedByEnvironment));
}
const performanceRows=measurements.map(m=>`| ${m.quality} / ${m.camera} | ${n(m.before.fps)} → **${n(m.after.fps)}** | ${n(m.before.frameP50)} → ${n(m.after.frameP50)} | ${n(m.before.frameP95)} → ${n(m.after.frameP95)} | ${n(m.before.gpuP50)} → ${n(m.after.gpuP50)} | ${n(m.before.calls)} → ${n(m.after.calls)} | ${n(m.before.triangles)} → ${n(m.after.triangles)} |`).join('\n');
const memoryRows=measurements.filter(m=>m.camera==='reference').map(m=>`| ${m.quality} | ${mib(m.allocationsBefore.geometryAttributeBytes)} → ${mib(m.allocationsAfter.geometryAttributeBytes)} | ${mib(m.allocationsBefore.textureRgbaBytes)} → ${mib(m.allocationsAfter.textureRgbaBytes)} | ${mib(m.loadedGlbBytesBefore)} → ${mib(m.loadedGlbBytesAfter)} | ${n(m.loadedCloudBytesAfter/1024)} |`).join('\n');
const readyRows=['reference-balanced','reference-high','wide-balanced','wide-high'].map(name=>`| ${name} | ${n(beforeViews.find(v=>v.name===name).readyMs)} → ${n(afterViews.find(v=>v.name===name).readyMs)} |`).join('\n');
await writeFile(`${root}/PERFORMANCE.md`,`# Matched rendering measurements

Main at \`842217f\` versus V2, Chrome 157 / Three r164, AMD Radeon 610M
Direct3D11. Each build uses 1440×900 CSS pixels, DPR 0.9 Low / 1 Medium and
High, seed 10425058, reduced motion, four-second warmup and five-second
samples per camera. Camera metadata, viewport, DPR and renderer are checked
for equality. No other browser/GPU workload or Blender job ran during sampling.
Counts include the unchanged board/city and shadow pass. These are local
samples, not device-wide FPS guarantees; CPU scheduling also affects FPS.
Medium is the project's \`balanced\` preset.

| Tier / camera | FPS before → after | Frame p50 ms | Frame p95 ms | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${performanceRows}

The refined assets reduce their own triangles, while the true 2D mountain
surfaces add geometry. The cloud pass has fewer cards and no runtime mask
generation. Rendering cost remains bounded across all three presets. The
unchanged board/city still account for most draw calls.

| Tier, close view | Geometry buffers MiB before → after | Texture estimate MiB | Selected GLB download MiB | New cloud PNG KiB |
| --- | ---: | ---: | ---: | ---: |
${memoryRows}

More detailed normals, ledges and vertex shading increase GLB bytes despite
lower triangle counts. Allocation estimates count live scene buffers and
RGBA/mipmap dimensions; they are **not driver VRAM readings**. Only the chosen
asset tier and cloud PNG load.

| View | Observed navigation-to-environment-ready ms before → after |
| --- | ---: |
${readyRows}

Readiness includes actual GLB loads and the selected cloud atlas. These are
local preview timings from successive new tabs in one browser per capture
run, with cache reuse; they are not controlled cold-network benchmarks.

[Compact JSON](evidence/performance.json), [before summary](evidence/before/summary.json),
[after summary](evidence/after/summary.json). The full quality JSON files retain
per-frame CPU/GPU timings, exact camera metadata, served asset status/hash
checks, allocations, and browser error arrays.
`);
const pairs=[['Close / Medium','reference-balanced'],['Close / High, 1920×1080','reference-high'],['Wide / Medium','wide-balanced'],['Wide / High','wide-high'],['Default / Medium','overview-balanced'],['Default / High','overview-high'],['East','east'],['Reverse','reverse'],['West','west'],['Previously sparse 135°','coverage-135'],['Previously sparse 225°','coverage-225'],['Phone portrait / Low','portrait'],['Phone landscape / Medium','landscape']];
await writeFile(`${root}/SCREENSHOTS.md`,`# Matched production captures

Thirteen pairs captured and visually reviewed in real Chrome. All 40 tile rays
are clear of scenery; no fallbacks or console/page errors. Poses, viewports,
DPR, responsive offsets and seeded game match exactly between builds.
The source screenshots lack camera metadata, so the close/wide poses are
reconstructions rather than an exact historical pose match.

| View | Before | After |
| --- | --- | --- |
${pairs.map(([title,name])=>`| ${title} | ![${title} before](evidence/before/${name}.png) | ![${title} after](evidence/after/${name}.png) |`).join('\n')}

[Full capture and tile-ray metadata](evidence/after/views.json).
`);
console.log('Wrote performance and screenshot reports from the matched raw evidence.');
