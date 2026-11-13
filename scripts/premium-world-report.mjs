import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root='docs/premium-fantasy-world',evidence=`${root}/evidence`;
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const records=await json(`${evidence}/controlled/runs.json`);
assert.equal(records.length,24,'two run orders, three qualities, two cameras, both versions');
assert.equal(new Set(records.map(record=>record.metadata.renderer)).size,1,'same renderer across both versions and run orders');
const average=values=>values.reduce((a,b)=>a+b,0)/values.length;
const percentile=(values,p)=>values.filter(value=>value!==null).sort((a,b)=>a-b)[Math.floor(values.filter(value=>value!==null).length*p)]??null;
const rows=[];
for(const quality of ['low','balanced','high']) for(const camera of ['overview','reference']) {
  const summarize=side=>{
    const runs=records.filter(record=>record.quality===quality&&record.camera===camera&&record.side===side);
    assert.equal(runs.length,2);
    const frames=runs.flatMap(run=>run.samples),frameMeanMs=average(frames.map(frame=>frame.frameMs));
    const p=(key,amount=.5)=>percentile(frames.map(frame=>frame[key]),amount);
    return {fps:1000/frameMeanMs,frameMeanMs,frameP50:p('frameMs'),frameP95:p('frameMs',.95),
      renderCpuP50:p('renderCpuMs'),gpuP50:p('gpuMs'),calls:p('calls'),triangles:p('triangles'),
      geometries:p('geometries'),textures:p('textures'),frames:frames.length,
      allocationEstimates:runs[0].metadata.allocationEstimates??null};
  };
  const before=summarize('before'),after=summarize('after');
  rows.push({quality,camera,before,after,frameTimeChangePercent:(after.frameMeanMs/before.frameMeanMs-1)*100});
}
const bundle=async directory=>{
  const files=(await readdir(`${directory}/assets`)).filter(file=>file.endsWith('.js'));
  const sizes=await Promise.all(files.map(async file=>{const bytes=await readFile(`${directory}/assets/${file}`);return {file,bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
  return {totalBytes:sizes.reduce((sum,file)=>sum+file.bytes,0),totalGzipBytes:sizes.reduce((sum,file)=>sum+file.gzipBytes,0),files:sizes};
};
const beforeBundle=await bundle('.online-test/premium-world-baseline'),afterBundle=await bundle('dist');
const manifest=await json('public/assets/models/environment/archipelago-manifest.json');
const assets=await json(`${evidence}/asset-validation.json`);
assert.ok(assets.valid);
const views=await json(`${evidence}/after/views.json`);
const online=await json(`${evidence}/online-final/results.json`);
let softwareOnline=null;
try { softwareOnline=await json(`${evidence}/online-software/results.json`); }
catch(error) { if(error.code!=='ENOENT')throw error; }
if(softwareOnline) {
  assert.equal(softwareOnline.results.length,10);
  assert.ok(softwareOnline.results.every(result=>result.passed));
  assert.deepEqual(softwareOnline.browserErrors,[]);
}
const graphics=await json(`${evidence}/regression/results.json`);
const motion=await json(`${evidence}/regression/environment-motion.json`);
const context=await json(`${evidence}/regression/context-restore.json`);
const resilience=await json(`${evidence}/regression/resilience.json`);
const junit=await readFile(`${evidence}/unit-tests.xml`,'utf8');
assert.match(junit,/<!-- pass 68 -->/);assert.match(junit,/<!-- fail 0 -->/);
assert.equal(online.results.length,10);assert.ok(online.results.every(result=>result.passed));
assert.deepEqual(online.browserErrors,[]);
assert.deepEqual(graphics.errors,[]);assert.equal(graphics.results.length,5);
assert.ok(graphics.results.slice(0,4).every(result=>result.picking.count===40&&result.unoccludedByEnvironment));
assert.equal(graphics.results[4].endTurn,true);
const graphicsPassed=true;
for(const check of [motion,context,resilience]) assert.equal(check.passed,true);
const individualWindows=records.filter(record=>record.side==='after').map(after=>{
  const before=records.find(record=>record.side==='before'&&record.repeat===after.repeat&&record.quality===after.quality&&record.camera===after.camera);
  return {repeat:after.repeat,quality:after.quality,camera:after.camera,beforeFps:before.fps,afterFps:after.fps,
    frameTimeChangePercent:(after.frameMeanMs/before.frameMeanMs-1)*100};
});
const performance={baselineCommit:'712693a47b7664469deb519ee5f89bddd04a2fc2',
  methodology:'24 sequential five-second samples, A/B then B/A, five-second warmup, 1440x900, seeded Solo, reduced motion, matched camera and DPR. No simultaneous audit workload.',
  renderer:records[0].metadata.renderer,userAgent:records[0].metadata.userAgent,
  rows,individualWindows,bundle:{before:beforeBundle,after:afterBundle,addedBytes:afterBundle.totalBytes-beforeBundle.totalBytes,addedGzipBytes:afterBundle.totalGzipBytes-beforeBundle.totalGzipBytes},
  newAssetBytes:manifest.assets.reduce((sum,asset)=>sum+asset.bytes,0),
  loading:views.map(view=>({name:view.name,readyMs:view.readyMs,assetDurations:view.assets})),
};
await writeFile(`${evidence}/performance.json`,JSON.stringify(performance,null,2));
const n=value=>value===null?'unavailable':Number(value).toFixed(2);
let md=`# Rendering measurements\n\nBaseline: main at \`712693a\`. Candidate: this branch's built production assets. Measurements use the same Chrome/GPU, seed, CSS viewport (1440×900), quality DPR and camera pose. Two 5-second windows per version/quality/camera are pooled, with A/B and B/A order retained. Models and shader warmup finish before sampling. No other browser/render workload runs during this comparison.\n\nRenderer: ${performance.renderer}. Local Node: ${process.version}; Blender: ${manifest.blenderVersion}. Repository CI continues to use Node 22. These are local measurements, with normal OS/GPU variance; they do not certify universal 60 FPS or physical mobile performance.\n\n| Quality / camera | Mean ms before → after | Change | FPS before → after | P95 ms before → after | GPU P50 ms before → after |\n| --- | ---: | ---: | ---: | ---: | ---: |\n`;
for(const row of rows) md+=`| ${row.quality} / ${row.camera} | ${n(row.before.frameMeanMs)} → ${n(row.after.frameMeanMs)} | ${n(row.frameTimeChangePercent)}% | ${n(row.before.fps)} → ${n(row.after.fps)} | ${n(row.before.frameP95)} → ${n(row.after.frameP95)} | ${n(row.before.gpuP50)} → ${n(row.after.gpuP50)} |\n`;
md+='\n| Quality / camera | Calls before → after | Triangles before → after | Geometry allocations before → after | Texture allocations before → after |\n| --- | ---: | ---: | ---: | ---: |\n';
for(const row of rows) md+=`| ${row.quality} / ${row.camera} | ${row.before.calls} → ${row.after.calls} | ${row.before.triangles} → ${row.after.triangles} | ${row.before.geometries} → ${row.after.geometries} | ${row.before.textures} → ${row.after.textures} |\n`;
md+=`\nThe whole scene includes the unchanged board/city/shadow passes; these are not environment-only costs. The low environment contains ${motion.lowEnvironmentTriangles.toLocaleString('en-US')} triangles, below its 65k scene cap, with zero shadow casters. Three new GLBs produce 27 material batches, shared across ten placements. Water is a few ribbon/mist draws; no extra lights, shadow maps, render loops or postprocessing are added.\n\nGPU drivers do not expose actual VRAM usage through this WebGL API. Before/after geometry and texture allocation counts are reported above. Candidate CPU attribute sizes and estimated RGBA/mip allocations are in [performance.json](evidence/performance.json); they exclude driver overhead and are not VRAM measurements. Four scene mount/unmount cycles keep those counts and estimates identical, with one GLB request per URL across all cycles.\n\nTotal JavaScript grows by ${performance.bundle.addedBytes.toLocaleString('en-US')} bytes (${performance.bundle.addedGzipBytes.toLocaleString('en-US')} gzip bytes). The nine new shipped LODs total ${performance.newAssetBytes.toLocaleString('en-US')} bytes; each quality fetches only three of them. Existing menu CSS/image and gameplay rules remain untouched. Local page-to-environment-ready times range from ${Math.min(...views.map(view=>view.readyMs))} to ${Math.max(...views.map(view=>view.readyMs))} ms. These include compilation/cache effects and are observations, not controlled network-speed claims; per-resource durations are retained.\n\n| New Blender model | Tier | Triangles | Bytes |\n| --- | --- | ---: | ---: |\n`;
for(const asset of manifest.assets)md+=`| ${asset.id} | ${asset.tier} | ${asset.triangles} | ${asset.bytes} |\n`;
md+='\n[All controlled windows](evidence/controlled/summary.json) · [Raw frames and metadata](evidence/controlled/runs.json) · [Initial pre-edit baseline](evidence/before/summary.json) · [Early art checkpoint](evidence/checkpoint/balanced.json) · [Binary/texture validation of all 31 models](evidence/asset-validation.json). Earlier measurements are retained; faster individual windows are not treated as demonstrated speedups.\n';
md=md.replace('No other browser/render workload runs during this comparison.','No simultaneous audit or render workload was launched by this task during the comparison.')
  .replace('The low environment contains','The low island/water/airship subsystem contains').replace('65k scene cap','65k subsystem cap');
const worstWindow=individualWindows.reduce((worst,window)=>window.frameTimeChangePercent>worst.frameTimeChangePercent?window:worst);
md+=`\nThe slowest individual comparison was ${worstWindow.quality}/${worstWindow.camera}, repeat ${worstWindow.repeat}: ${n(worstWindow.frameTimeChangePercent)}% higher mean frame time (${n(worstWindow.beforeFps)} → ${n(worstWindow.afterFps)} FPS). It remains in the pooled result and raw records. The 20% target applies to the engineering comparison; it is not a promise that every short window or device meets it. Sky, cloud and ridge geometry are included in whole-scene measurements, outside the island subsystem cap.\n`;
md+='\n[First candidate measurements before the final composition](evidence/checkpoint/initial-after/summary.json) are retained separately from the final controlled comparison.\n';
await writeFile(`${root}/performance.md`,md);
const verification={passed:true,baselineCommit:performance.baselineCommit,node:process.version,blender:manifest.blenderVersion,
  frontendBuild:{passed:true,javascript:afterBundle.files},unitTests:{passed:68,failed:0,artifact:'unit-tests.xml'},
  realTwoPlayerBrowser:{passed:online.results.length,failed:online.browserErrors.length,artifact:'online-final/results.json'},
  softwareWebGlRetest:softwareOnline?{passed:10,failed:0,artifact:'online-software/results.json',launch:'CI=true, ANGLE SwiftShader'}:null,
  actualGlbInspection:{passed:assets.valid,models:assets.assets.length},cameraViews:views.length,
  graphics:graphicsPassed,motion:motion.passed,contextRecovery:context.passed,mountAndDownloadResilience:resilience.passed,
  nestedProductionPrefix:!!resilience.productionPrefix,worstControlledMeanFrameChangePercent:Math.max(...rows.map(row=>row.frameTimeChangePercent)),
  limitations:['844x390 retains the existing HUD and small fitted board; fog visibility is corrected, layout is unchanged.',
    'One intermediate reused-database browser run timed out in lobby join before mounting 3D; the final fresh-database run passes all 10 scenarios. Root cause was not established.',
    'game-dev CLI unavailable; installed Blender and repository validator were used directly.',
    'Local Node 24 verification is separate from required Node 22 GitHub CI. No representative-device or live-deployment certification.']};
await writeFile(`${evidence}/verification.json`,JSON.stringify(verification,null,2));
console.log(JSON.stringify({rows:rows.map(({quality,camera,frameTimeChangePercent})=>({quality,camera,frameTimeChangePercent})),bundleAddedBytes:performance.bundle.addedBytes,bundleAddedGzipBytes:performance.bundle.addedGzipBytes,verified:verification.passed}));
