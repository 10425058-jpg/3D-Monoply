import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, 'public/assets/textures/environment');
const manifest = JSON.parse(readFileSync(path.join(directory, 'cloud-volume-v3-manifest.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('all three actual v3 atlases have full connected bodies, soft clean edges and square unstretched cells', () => {
  const report = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['tools/blender/validate_clouds_v3.py'],
    { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
  assert.equal(report.valid, true);
  assert.equal(report.assets.length, 3);
  for (const asset of report.assets) {
    assert.equal(asset.variants.length, 8);
    assert.ok(asset.bytes < 600000);
    for (const variant of asset.variants) {
      assert.ok(variant.bodyAspect > 1.05 && variant.bodyAspect < 2.4);
      assert.equal(variant.gutterAlphaMax, 0);
      assert.deepEqual(variant.cardCrop, [.05, .12, .95, .88]);
      assert.equal(variant.cropOutsideAlphaMax, 0);
      assert.equal(variant.cropBoundaryAlphaMax, 0);
      assert.ok(variant.connectedBodyFraction > .98);
    }
  }
});

test('v3 cloud authoring provenance binds the actual generator/dependency and original-project rights', () => {
  assert.equal(manifest.generator, 'tools/blender/bake_clouds_v3.py');
  assert.match(manifest.method, /3D cumulus density/);
  assert.match(manifest.license, /MIT/);
  assert.equal(manifest.variants, 8);
  for (const [filename, sha256] of Object.entries(manifest.sourceHashes)) {
    assert.equal(digest(readFileSync(path.join(root, 'tools/blender', filename), 'utf8').replaceAll('\r\n', '\n')), sha256);
  }
  for (const receipt of manifest.assets) {
    const bytes = readFileSync(path.join(directory, receipt.file));
    assert.equal(digest(bytes), receipt.sha256);
    assert.equal(bytes.length, receipt.bytes);
    assert.equal(receipt.columns, 4);
    assert.equal(receipt.rows, 2);
  }
});

test('the completed V2 atlases remain byte-identical to their original project receipt', () => {
  const original = JSON.parse(readFileSync(path.join(directory, 'cloud-volume-v2-manifest.json'), 'utf8'));
  for (const receipt of original.assets) {
    assert.equal(digest(readFileSync(path.join(directory, receipt.file))), receipt.sha256);
  }
});
