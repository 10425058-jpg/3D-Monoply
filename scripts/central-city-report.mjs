import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root='docs/premium-central-city',evidence=`${root}/evidence`;
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const n=value=>value===null?'unavailable':value.toLocaleString('en-US',{maximumFractionDigits:1});
const mib=value=>n(value/1048576);
const measurements=[];
for(const quality of ['low','balanced','high']){
  const before=await json(`${evidence}/before/${quality}.json`),after=await json(`${evidence}/after/${quality}.json`);
  assert.equal(before.sampleMs,5000);assert.equal(after.sampleMs,5000);assert.equal(before.warmupMs,after.warmupMs);
  assert.deepEqual(before.scenarios.map(s=>s.cameraName),['overview','reference','wide']);
  assert.deepEqual(after.scenarios.map(s=>s.cameraName),['overview','reference','wide']);
  assert.ok(after.centralCity);assert.deepEqual(after.errors,[]);assert.deepEqual(after.failedRequests,[]);
  for(let i=0;i<before.scenarios.length;i++){
    const a=before.scenarios[i],b=after.scenarios[i];
    assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.metadata.viewport,b.metadata.viewport);
    assert.equal(a.metadata.dpr,b.metadata.dpr);assert.equal(a.metadata.renderer,b.metadata.renderer);
    assert.ok(b.tiles.every(tile=>!tile.occludedByEnvironment));
    if(b.cameraName==='overview')assert.ok(b.tiles.every(tile=>!tile.occludedByCity&&tile.pickableTileId===tile.id));
    measurements.push({quality,camera:b.cameraName,before:a.summary,after:b.summary,
      fpsChangePercent:(b.summary.fps/a.summary.fps-1)*100,renderer:b.metadata.renderer,
      userAgent:b.metadata.userAgent,dpr:b.metadata.dpr,
      allocationsBefore:a.metadata.allocationEstimates,allocationsAfter:b.metadata.allocationEstimates,
      loadedGlbBytesBefore:before.assetResponses.reduce((sum,a)=>sum+a.bytes,0),
      loadedGlbBytesAfter:after.assetResponses.reduce((sum,a)=>sum+a.bytes,0),
      cityGlbBytes:after.assetResponses.filter(a=>a.url.includes('/central-city/')).reduce((sum,a)=>sum+a.bytes,0),
      loadedCloudBytesBefore:before.textureResponses.reduce((sum,a)=>sum+a.bytes,0),
      loadedCloudBytesAfter:after.textureResponses.reduce((sum,a)=>sum+a.bytes,0)});
  }
}
await writeFile(`${evidence}/performance.json`,JSON.stringify(measurements,null,2)+'\n');
const rows=measurements.map(m=>`| ${m.quality} / ${m.camera} | ${n(m.before.fps)} → **${n(m.after.fps)}** | ${n(m.before.frameP50)} → ${n(m.after.frameP50)} | ${n(m.before.frameP95)} → ${n(m.after.frameP95)} | ${n(m.before.gpuP50)} → ${n(m.after.gpuP50)} | ${n(m.before.calls)} → ${n(m.after.calls)} | ${n(m.before.triangles)} → ${n(m.after.triangles)} |`).join('\n');
const memory=measurements.filter(m=>m.camera==='reference').map(m=>`| ${m.quality} | ${mib(m.allocationsBefore.geometryAttributeBytes)} → ${mib(m.allocationsAfter.geometryAttributeBytes)} | ${mib(m.allocationsBefore.textureRgbaBytes)} → ${mib(m.allocationsAfter.textureRgbaBytes)} | ${mib(m.loadedGlbBytesBefore)} → ${mib(m.loadedGlbBytesAfter)} | ${mib(m.cityGlbBytes)} |`).join('\n');
await writeFile(`${root}/PERFORMANCE.md`,`# Central city rendering measurements

Unchanged main at \`88a5bd6\` versus the central-city candidate. The renderer is
\`${measurements[0].renderer}\`.
The exact browser user-agent, renderer, allocation estimates and metrics are in
[the comparison JSON](evidence/performance.json).

Both builds use 1440×900 CSS pixels, seed 10425058, the same camera matrices and
responsive offsets, DPR 0.9 Low / 1 Medium and High, four-second warmup and
five-second samples. Medium is the project's \`balanced\` preset. Chrome runs
sequentially without another browser/GPU job, Blender job or build. The media
preference is reduced motion in both builds. The old central city ignores that
preference for some decorative animations; the new fountain and flags honor it.
This is a controlled rendering comparison, not a device-independent FPS promise.

| Tier / camera | FPS before → after | Frame p50 ms | Frame p95 ms | GPU p50 ms | Draw calls | Triangles drawn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

Counts include the entire scene and its existing shadow pass. Material batching,
fewer central shadow casters and removal of the old city's many local lights
reduce submission cost. The surrounding world, global light rig, tone mapping
and property ring are unchanged. The new district adds zero real-time lights;
warm windows use emission and ten lamps share an instanced halo draw.

| Tier, reference camera | Geometry buffers MiB before → after | Texture estimate MiB | Total selected GLB download MiB | New city GLB MiB |
| --- | ---: | ---: | ---: | ---: |
${memory}

Allocation estimates inspect actual scene buffers and texture/mipmap dimensions;
they are not driver VRAM readings. GLB bytes are observed HTTP response bodies,
checked against exported public-file SHA256 hashes. The table includes the
unchanged selected surrounding assets. The city is a new download; the old city
was constructed in JavaScript and remains bundled as the loading/error fallback.
All five visual unlock groups are included in one selected city GLB. Higher
levels do not trigger additional downloads. No decoder or new dependency is added.
These samples do not measure cold-network latency or sustained thermal behavior.

[Raw before summary](evidence/before/summary.json) ·
[Raw after summary](evidence/after/summary.json).
Per-tier JSON retains per-frame timing, source/served hashes and error arrays.
`);

const beforeViews=await json(`${evidence}/before/views.json`),afterViews=await json(`${evidence}/after/views.json`);
assert.equal(beforeViews.length,12);assert.equal(afterViews.length,12);
for(const view of afterViews){
  const old=beforeViews.find(v=>v.name===view.name);assert.ok(old);
  assert.deepEqual(view.metadata.camera,old.metadata.camera);assert.deepEqual(view.metadata.viewport,old.metadata.viewport);
  assert.equal(view.metadata.dpr,old.metadata.dpr);assert.deepEqual(view.errors,[]);
  assert.ok(view.city);assert.equal(view.environment.fallbacks,0);assert.equal(view.environment.shadowCasters,0);
}
const coverage=afterViews.filter(v=>!v.detail).map(v=>{
  const old=beforeViews.find(b=>b.name===v.name),clear=x=>x.tiles.filter(t=>!t.occludedByCity).length;
  return `| ${v.name} | ${clear(old)} | ${clear(v)} |`;
}).join('\n');
await writeFile(`${root}/SCREENSHOTS.md`,`# Central city browser captures

Twelve paired captures from the actual production application. Before is the
unchanged main \`88a5bd6\` tree; after is the central-city candidate. Camera pose,
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
${afterViews.map(v=>`| ${v.name}${v.detail?' (detail)':''} | ![${v.name} before](evidence/before/${v.name}.png) | ![${v.name} after](evidence/after/${v.name}.png) |`).join('\n')}

| Wider capture | City-clear tile centers before /40 | After /40 |
| --- | ---: | ---: |
${coverage}

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
`);

const assets=await json('public/assets/models/central-city/manifest.json'),validation=await json(`${evidence}/asset-validation.json`);
assert.equal(validation.valid,true);assert.equal(assets.assets.length,3);
for(const [file,hash] of Object.entries(assets.sourceHashes)){
  const source=(await readFile(`tools/blender/${file}`,'utf8')).replaceAll('\r\n','\n');
  assert.equal(createHash('sha256').update(source).digest('hex'),hash);
}
const assetRows=assets.assets.map(a=>{
  const inspected=validation.assets.find(v=>v.file===a.file);assert.equal(inspected.sha256,a.sha256);
  return `| ${a.tier} | ${a.file} | ${n(a.levelTriangles['1'])} | ${n(a.triangles)} / ${n(a.triangleBudget)} | ${n(a.bytes/1024)} | ${inspected.drawPrimitives} |`;
}).join('\n');
await writeFile(`${root}/ASSETS.md`,`# Original Blender central district

\`tools/blender/generate_central_city.py\` was executed with installed Blender
**${assets.blenderVersion}**. It reuses the project's architectural construction
modules for original center geometry, without importing or regenerating any
outside-world GLB. Shared module source hashes are retained in
[the manifest](../../public/assets/models/central-city/manifest.json).
Source hashes normalize UTF-8 line endings to LF for Windows/Linux checkouts;
GLB hashes always cover the exact binary bytes.
The script, modules and generated geometry are original repository MIT assets.
No paid provider, downloaded mesh or reference-image plane is used.

| Tier | GLB | Base-level triangles | All five groups / budget | KiB | Material primitives, all groups |
| --- | --- | ---: | ---: | ---: | ---: |
${assetRows}

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
explicit 38k/68k/100k triangle budgets. The \`central-city\` validator profile is
restricted to this family; existing outer-world budgets remain unchanged.
This is the repository's validator, not a claim that Khronos conformance or
the unavailable optional \`game-dev\` CLI ran. Chrome also imported and rendered
every tier with served-file hash checks.

Blender and Python are offline authoring tools only. The deployed application
loads the checked-in GLBs through Drei/Three.js and requires neither tool.
`);
console.log('Wrote central-city performance, paired screenshots and verified asset inventory.');
