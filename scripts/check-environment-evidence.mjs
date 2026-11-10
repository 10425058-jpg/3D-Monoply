import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../docs/environment-composition/evidence/', import.meta.url);
const before = JSON.parse(await readFile(new URL('before/capture.json', root), 'utf8'));
const after = JSON.parse(await readFile(new URL('after/capture.json', root), 'utf8'));
assert.deepEqual(after.camera, before.camera);
assert.deepEqual(after.metadata.viewport, before.metadata.viewport);
assert.equal(after.metadata.dpr, before.metadata.dpr);
assert.deepEqual(after.tiles, before.tiles, 'the board projection and all tile picks must remain identical');
assert.deepEqual(after.errors, []);
assert.ok(after.summary.calls <= before.summary.calls);
assert.ok(after.summary.triangles <= before.summary.triangles);
assert.equal(after.summary.textures, before.summary.textures);
const hashes = {};
for (const name of ['before/overview.png', 'before/three-quarter.png', 'before/without-kingdom-valley.png',
  'before/without-kingdom-cloud-layers.png', 'after/overview.png', 'after/three-quarter.png']) {
  hashes[name] = createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
}
await writeFile(new URL('sha256.json', root), JSON.stringify(hashes, null, 2));
console.log('Matched camera, viewport, DPR, all forty tile projections/picks and rendering budgets verified.');
