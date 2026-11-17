import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

// Report only observed, paired production measurements. Never estimate FPS
// from geometry counts or accept a camera/renderer mismatch as a comparison.
const root='docs/board-rules-v5',evidence=`${root}/evidence`;
const json=async p=>JSON.parse(await readFile(`${evidence}/${p}`,'utf8'));
const fixed=(v,d=1)=>v===null?'unavailable':v.toFixed(d);
const mib=v=>fixed(v/1048576,2);
const performance=[],resources=[];
let renderer;
for(const quality of ['low','balanced','high']){
  const before=await json(`before/${quality}.json`),after=await json(`after/${quality}.json`);
  assert.equal(before.sampleMs,20000);assert.equal(after.sampleMs,before.sampleMs);
  for(const data of [before,after]){
    assert.deepEqual(data.errors,[]);assert.deepEqual(data.failedRequests,[]);
    assert.equal(data.scenarios.length,3);
  }
  const assetHashes=data=>[...data.assetResponses,...data.textureResponses].map(a=>[new URL(a.url).pathname,a.sha256]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(assetHashes(before),assetHashes(after),'preserved served GLBs and cloud atlases');
  before.scenarios.forEach((b,i)=>{
    const a=after.scenarios[i];assert.equal(a.cameraName,b.cameraName);assert.deepEqual(a.camera,b.camera);
    for(const key of ['renderer','userAgent','viewport','drawingBuffer','dpr','three'])assert.deepEqual(a.metadata[key],b.metadata[key],key);
    renderer??=b.metadata.renderer;assert.equal(b.metadata.renderer,renderer);
    assert.ok(a.samples.length>30&&b.samples.length>30);
    performance.push(`| ${quality} / ${a.cameraName} | ${fixed(b.summary.fps)} → ${fixed(a.summary.fps)} | ${fixed(b.summary.frameP50)} → ${fixed(a.summary.frameP50)} | ${fixed(b.summary.frameP95)} → ${fixed(a.summary.frameP95)} | ${fixed(b.summary.renderCpuP50)} → ${fixed(a.summary.renderCpuP50)} | ${fixed(b.summary.gpuP50,2)} → ${fixed(a.summary.gpuP50,2)} | ${b.samples.length} / ${a.samples.length} |`);
    const bm=b.metadata.allocationEstimates,am=a.metadata.allocationEstimates;
    resources.push(`| ${quality} / ${a.cameraName} | ${b.summary.calls} → ${a.summary.calls} | ${b.summary.triangles} → ${a.summary.triangles} | ${b.summary.geometries} → ${a.summary.geometries} | ${b.summary.textures} → ${a.summary.textures} | ${mib(bm.geometryAttributeBytes+bm.instanceAttributeBytes)} → ${mib(am.geometryAttributeBytes+am.instanceAttributeBytes)} | ${mib(bm.textureRgbaBytes)} → ${mib(am.textureRgbaBytes)} |`);
  });
}
const controlBefore=(await json('control/before/low.json')).scenarios[0];
const controlAfter=(await json('control/after/low.json')).scenarios[0];
for(const key of ['renderer','userAgent','viewport','drawingBuffer','dpr','camera'])assert.deepEqual(controlBefore.metadata[key],controlAfter.metadata[key]);
assert.ok(controlBefore.samples.length>30&&controlAfter.samples.length>30);
await writeFile(`${root}/PERFORMANCE.md`,`# V5 measured performance

Baseline: saved production build of main **0ba0a2f**. Candidate: \
\`feature/board-rules-gamefeel-v5\`. The original central-city and environment
GLB/cloud-atlas response hashes match between builds. No assets were regenerated.

Renderer: **${renderer}**, Chrome 157 / Three.js 164, 1440×900 CSS pixels.
Low renders at DPR 0.9; balanced/high at DPR 1. Each paired case asserts the
same camera, viewport, drawing buffer, renderer, browser and DPR. Reduced motion
freezes world animation; the real city and environment finish loading before a
4-second warmup. Each of nine views uses a **20-second** measurement window,
with more than 30 observed frames. Baseline and candidate run sequentially, with
no other test/build/browser workload started during measurement.

The first 5-second baseline attempt failed the minimum-frame gate. It is not
used here; both final sides use the longer equal window. The cause of that slow
attempt was not established. These are one machine's observations, not a
cross-device performance guarantee or cold-network benchmark.

**FPS attribution is inconclusive on this host.** Timing changed sharply near
the end of the baseline sweep and remained slow in the candidate. A subsequent
unchanged-main control measured ${fixed(controlBefore.summary.fps)} FPS versus
68.6 FPS earlier at the same low/overview view; its GPU query median changed
from 4.03 ms to ${fixed(controlBefore.summary.gpuP50,2)} ms. The immediately
following V5 control measured ${fixed(controlAfter.summary.fps)} FPS and
${fixed(controlAfter.summary.gpuP50,2)} ms. Both used the same 20-second workload
and renderer; no second automated browser was observed. The underlying machine
condition was not established. These controls demonstrate timing instability,
not a measured V5 FPS improvement. All sweep data is retained below without
discarding slow cases. Draw-call/geometry reductions are repeatable across views.

| Low/overview control | Main | V5 |
| --- | ---: | ---: |
| FPS | ${fixed(controlBefore.summary.fps)} | ${fixed(controlAfter.summary.fps)} |
| Frame p95 ms | ${fixed(controlBefore.summary.frameP95)} | ${fixed(controlAfter.summary.frameP95)} |
| GPU query median ms | ${fixed(controlBefore.summary.gpuP50,2)} | ${fixed(controlAfter.summary.gpuP50,2)} |
| Draw calls | ${controlBefore.summary.calls} | ${controlAfter.summary.calls} |
| Geometries | ${controlBefore.summary.geometries} | ${controlAfter.summary.geometries} |

Control receipts: [main](evidence/control/before/low.json),
[V5](evidence/control/after/low.json).

## Frame timings

Values are **before → after**. Times are milliseconds. CPU is the sum of wrapped
render calls; GPU is the existing audit's latest completed render-pass query,
not a complete GPU frame profile. FPS uses observed animation-frame intervals.

| Quality / view | FPS | Frame p50 | Frame p95 | Render CPU p50 | GPU query p50 | Frames before / after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${performance.join('\n')}

## Live rendering and allocation estimates

Calls/triangles are renderer medians. Geometry and texture counts are live
Three.js allocations, including lazy resources. Bytes deduplicate scene
attributes and material maps, including the audit's 4/3 mipmap estimate where
enabled; they exclude driver overhead, framebuffer targets and indirect shader
textures. They are **not measured VRAM**.

| Quality / view | Draw calls | Triangles | Geometries | Textures | Geometry + instances MiB | Material RGBA + mips MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${resources.join('\n')}

The board replaces per-tile text/icons with at most six instanced batches and
one immutable 1024² RGBA atlas: 4 MiB base, about 5.33 MiB including mipmaps.
Ownership/selection updates reuse it. No render target, postprocessing pass or
new animation particle pool was added. The fixed atlas trades some texture
memory for fewer draw calls and geometry allocations. Resources are explicitly
disposed on unmount; shared instance buffers use the existing release helper.

[Four equal-workload mount receipts](evidence/regression/results.json) show
stable counts/estimated bytes. This compares identical roll/reset workloads,
not a played scene with an untouched scene. [Context-loss checks](evidence/regression/resilience.json)
restore the board at all three tiers with zero changed pixels in the frozen
650×565 board crop. Optional 3D money-label font failure preserves the scene,
committed balances and HUD transaction receipt.

Raw timings: [before](evidence/before/summary.json), [after](evidence/after/summary.json).
Per-tier JSON files retain all samples, metadata, errors and served asset hashes.
Reproduce with \`AUDIT_SAMPLE_MS=20000 AUDIT_CAMERAS=overview,reference,wide
AUDIT_WAIT_CITY=1 AUDIT_EVIDENCE_ROOT=docs/board-rules-v5/evidence
AUDIT_URL=<matching preview URL> node scripts/atmosphere-audit.mjs before|after\`.
Then run \`node scripts/board-v5-report.mjs\`.
`);

const before=await json('before/views.json'),after=await json('after/views.json');
assert.equal(before.length,7);assert.equal(after.length,7);
const pairs=after.map((a,i)=>{
  const b=before[i];assert.equal(a.name,b.name);assert.equal(a.quality,b.quality);
  for(const key of ['camera','viewport','drawingBuffer','dpr','renderer'])assert.deepEqual(a.metadata[key],b.metadata[key]);
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
  return `| ${a.name} / ${a.quality} | [Before](evidence/before/${a.name}.png) | [After](evidence/after/${a.name}.png) |`;
});
const regression=await json('regression/results.json'),resilience=await json('regression/resilience.json');
assert.equal(regression.passed,true);assert.equal(resilience.passed,true);
await writeFile(`${root}/SCREENSHOTS.md`,`# V5 visual and gameplay evidence

Seven matched pairs use saved main **0ba0a2f** and the final V5 build. The script
asserts matching camera, viewport, DPR, drawing buffer and quality. Final north
and east labels retain the correct word order when read at their board rotation.
Overview, top and phone also verify all 40 tile rays, with no city/environment
occlusion. The four close label views intentionally crop the board; they are
diagnostic poses, not new user camera presets. The existing overview composition
and full-name property card remain useful on a small screen, where tiny on-board
text cannot be expected to read at desktop size.

| View / quality | Baseline | V5 |
| --- | --- | --- |
${pairs.join('\n')}

## Confirmed live actions

Deterministic fixtures establish the scenario, then real buttons/rolls execute
the store actions. Diagnostics observe the rendered world quaternion of each
die, actual token positions, buildings and instanced state markers. All six
faces were checked on both dice. Fixture APIs require a loopback hostname and
explicit \`?soloTest\`; ordinary gameplay exposes neither audit global.

${regression.scenarios.map(s=>`- [${s.name}](evidence/regression/${s.name}.png)`).join('\n')}
- [Normal token hop and dice motion](evidence/regression/normal-motion-dice.png)
- [Blocked optional font, live HUD receipt](evidence/regression/optional-font-fallback.png)

Receipts: [18 scenarios, restart and four scene mounts](evidence/regression/results.json),
[normal motion/context restoration/font fault](evidence/regression/resilience.json),
[all 40 mouse/touch spaces and camera interactions](evidence/interaction/results.json).
Run \`npm run test:board-browser\` against a production preview; use
\`V5_TEST_URL\` and \`V5_EVIDENCE_OUT\` to select its origin/output.
The paired script is \`node scripts/board-v5-review.mjs before|after\` with
baseline preview at 4192 and candidate at 4193. Never capture candidate output
as \`before\`.
`);
console.log('Wrote V5 performance and screenshot reports from matching observed receipts.');
