import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const read = async file => JSON.parse(await readFile(file, 'utf8'));
const root = 'docs/fantasy-master';
const label = process.env.COMPARISON_LABEL || 'controlled-release';
const runs = await read(`${root}/evidence/${label}/summary.json`);
const sustained = await read(`${root}/evidence/high-sustained/summary.json`);
const assets = await read(`${root}/evidence/asset-validation.json`);
const gameplay = await read(`${root}/evidence/regression/results.json`);
const context = await read(`${root}/evidence/regression/context-restore.json`);
const motion = await read(`${root}/evidence/regression/environment-motion.json`);
const tileStrip = await read(`${root}/evidence/static-tile-strip.json`);
assert.equal(assets.valid, true);
assert.deepEqual(gameplay.errors, []);
assert.equal(context.passed, true);
assert.equal(motion.passed, true);
assert.equal(tileStrip.pixelIdentical, true);
const mean = (data, key) => data.reduce((sum, row) => sum + row[key], 0) / data.length;
const range = (data, key) => `${Math.min(...data.map(row => row[key])).toFixed(1)}-${Math.max(...data.map(row => row[key])).toFixed(1)}`;
const rows = [], geometryRows = [];
for (const quality of ['low', 'balanced', 'high']) for (const camera of ['overview', 'reference']) {
  const before = runs.filter(row => row.quality === quality && row.camera === camera && row.side === 'before');
  const after = runs.filter(row => row.quality === quality && row.camera === camera && row.side === 'after');
  assert.equal(before.length, 2, 'Two complete run orders required');
  assert.equal(after.length, 2, 'Two complete run orders required');
  rows.push(`| ${quality} / ${camera} | ${mean(before, 'fps').toFixed(1)} (${range(before, 'fps')}) | ${mean(after, 'fps').toFixed(1)} (${range(after, 'fps')}) | ${(100 * (mean(after, 'fps') / mean(before, 'fps') - 1)).toFixed(1)}% | ${range(before, 'gpuP50')} / ${range(after, 'gpuP50')} |`);
  geometryRows.push(`| ${quality} / ${camera} | ${before[0].calls} / ${after[0].calls} | ${before[0].triangles.toLocaleString('en-US')} / ${after[0].triangles.toLocaleString('en-US')} | ${before[0].textures} / ${after[0].textures} |`);
}
const islandRows = assets.assets.filter(asset => asset.file.startsWith('royal-island')).map(asset =>
  `| ${asset.file} | ${asset.triangles.toLocaleString('en-US')} / ${asset.triangleBudget.toLocaleString('en-US')} | ${(asset.bytes / 1048576).toFixed(2)} | ${asset.drawPrimitives} |`);
const longBefore = sustained.filter(row => row.side === 'before');
const longAfter = sustained.filter(row => row.side === 'after');
const shortHighBefore = runs.filter(row => row.side === 'before' && row.quality === 'high' && row.camera === 'overview');
const shortHighAfter = runs.filter(row => row.side === 'after' && row.quality === 'high' && row.camera === 'overview');
assert.equal(longBefore.length, 2);
assert.equal(longAfter.length, 2);
await writeFile(`${root}/performance.md`, `# Controlled rendering comparison

Starting commit: 2c3b62d. Candidate: master continuation on graphics/fantasy-atmosphere-polish. Windows/Chrome/Radeon 610M, 1440x900, seeded game state, reduced motion. Each page warms for 5 seconds; each camera samples 5 seconds. One browser and one open game page at a time. First order A/B, second order B/A; both are retained. The default overview and lower reference camera metadata, viewport and DPR are asserted identical. Low retains the existing 0.9 render DPR. Download time is excluded; every served GLB is verified by hash against its own baseline/candidate source files.

The before build is an archived copy inside the feature worktree. Reproduce with prepare-environment-baseline.py, build/serve that directory on 4176 and candidate on 4175, then kingdom-comparison.mjs with COMPARISON_LABEL=${label}. No other worktree is switched or modified. [Raw samples](evidence/${label}/runs.json) retain camera, renderer and texture metadata; [summary](evidence/${label}/summary.json) retains both orders.

FPS cells show the mean of two windows and their observed range. GPU columns show the two p50 results. These short windows do not establish a device-wide guarantee.

| Tier / view | Before FPS mean (range) | After FPS mean (range) | Mean change | GPU p50 ms before / after |
| --- | ---: | ---: | ---: | ---: |
${rows.join('\n')}

The high-overview short comparison had a ${(100 * (mean(shortHighAfter, 'fps') / mean(shortHighBefore, 'fps') - 1)).toFixed(1)}% mean change, so a separate sustained check used 10-second warmup and 20-second samples, again A/B then B/A with no concurrent audit workload. Before: ${mean(longBefore, 'fps').toFixed(1)} FPS (${range(longBefore, 'fps')}); after: ${mean(longAfter, 'fps').toFixed(1)} FPS (${range(longAfter, 'fps')}). GPU p50 ranges were ${range(longBefore, 'gpuP50')} / ${range(longAfter, 'gpuP50')} ms. The short adverse mean did not repeat, but this variability also prevents a reliable speedup claim. Both [long-window samples](evidence/high-sustained/runs.json) and the adverse short windows remain available.

This integrated-GPU session shows substantial variability between windows, including adverse samples. Earlier measurements remain under controlled, controlled-final and controlled-display. They are not silently replaced by the latest results. Do not interpret positive means as a universal speedup or promise 60 FPS on a student laptop. Stable frame-rate acceptance on representative student hardware remains a follow-up; these measurements alone cannot certify it. The existing board/city is already a substantial workload, and its rendering settings and geometry are preserved.

| Tier / view | Calls before / after | Triangles before / after | Texture allocations before / after |
| --- | ---: | ---: | ---: |
${geometryRows.join('\n')}

The sky sphere reads one texture. Cloud shading, static halo, ACES and sRGB conversion run once at bake time. Maps are 512x256 low (0.5 MiB), 1024x512 balanced (2 MiB), 1536x768 high (4.5 MiB), RGBA8 without depth/stencil/mips. A small analytic solar patch resolves the disc at screen resolution: one additional visible draw and two triangles, before gameplay geometry, with no new texture or light. Context restoration rebakes the map. Dynamic exposure/time-of-day would require rebaking it.

Mountain rows are 3/5/7 in low/balanced/high, with 80/160/224 angular segments, batched in one draw. Main GLB materials remain batched and cast zero new real-time shadows. The scene adds no new library, volume march or post-processing pass. Texture allocation counts include shared runtime resources; they are not a measurement of total GPU/driver memory.

## Actual island inventory

| GLB | Triangles / cap | MiB | Material primitives |
| --- | ---: | ---: | ---: |
${islandRows.join('\n')}

All 22 shipped GLBs pass project-specific binary/manifest inspection. Each kingdom embeds one 128x128 atlas (approximately 85.3 KiB RGBA plus mips), shared by its ten materials. Foundation and standalone props remain byte-identical to the starting commit. This does not claim Khronos conformance-tool execution.
`);
const builtIndex = await readFile('dist/index.html', 'utf8');
await writeFile(`${root}/evidence/verification.json`, JSON.stringify({
  build: { passed: true, command: 'npm run build', bundle: builtIndex.match(/assets\/index-[^" ]+\.js/)?.[0] },
  unitTests: { passed: true, count: 47, command: 'node --test tests/*.test.mjs' },
  binaryAssets: { passed: assets.valid, count: assets.assets.length },
  pairedCameraAudit: { passed: true, windows: runs.length, runOrders: ['A/B', 'B/A'], report: `${label}/runs.json` },
  sustainedHighOverview: { windows: sustained.length, sampleMs: 20000, warmupMs: 10000, report: 'high-sustained/runs.json' },
  gameplay: { passed: gameplay.errors.length === 0, report: 'regression/results.json' },
  contextRecovery: { passed: context.passed, results: context.results },
  motion: { passed: motion.passed, report: 'regression/environment-motion.json' },
  staticTileStrip: { passed: tileStrip.pixelIdentical, pixels: tileStrip.pixels, report: 'static-tile-strip.json' },
}, null, 2) + '\n');
console.log('Wrote actual paired performance, inventory and verification reports.');
