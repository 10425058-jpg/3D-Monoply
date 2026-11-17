import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const folder = path.join(root, 'public/assets/models/environment');
const manifestPath = path.join(folder, 'background-v1-manifest.json');
const receipt = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sourceReceipt = JSON.parse(readFileSync(path.join(folder, 'v4-manifest.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const glbDocument = filename => {
  const bytes = readFileSync(path.join(folder, filename));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
};
const waterAnchors = document => Object.fromEntries(document.nodes.filter(node => /^water(?:course|fall)_/.test(node.name)).map(node => [
  node.name.replace(/\.\d+$/, ''), { position: node.translation, extras: node.extras },
]));

test('background V1 has only the requested three surrounding island families and three bounded LODs', () => {
  assert.equal(receipt.assets.length, 9);
  assert.equal(new Set(receipt.assets.map(asset => asset.file)).size, 9);
  for (const id of ['royal-island-left', 'royal-island-right', 'royal-island-citadel']) {
    const assets = ['high', 'balanced', 'low'].map(tier => receipt.assets.find(asset => asset.id === `${id}-background-v1` && asset.tier === tier));
    assert.ok(assets.every(Boolean));
    assert.ok(assets[0].triangles > assets[1].triangles && assets[1].triangles > assets[2].triangles);
    for (const asset of assets) {
      assert.ok(asset.triangles <= { high: 40000, balanced: 25000, low: 16000 }[asset.tier]);
      assert.ok(asset.bytes < 3 * 1024 * 1024);
      assert.ok(asset.sculptedCanopyLobes >= 20, 'the authored crown forms receive a real geometry pass');
    }
  }
  assert.ok(receipt.assets.every(asset => !/crown-foundation|central-city/.test(asset.file)));
});

test('actual background bytes pass the existing unmodified project geometry/material/atlas policy', () => {
  const report = JSON.parse(execFileSync(process.env.PYTHON || 'python', [
    'tools/blender/validate_assets.py', ...receipt.assets.map(asset => path.join(folder, asset.file)), '--manifest', manifestPath,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  assert.equal(report.valid, true);
  assert.equal(report.assets.length, 9);
  for (const asset of report.assets) {
    assert.equal(asset.drawPrimitives, 10);
    assert.equal(asset.materials, 10);
    assert.equal(asset.images.length, 1);
    assert.deepEqual([asset.images[0].width, asset.images[0].height], [128, 128]);
    assert.ok(asset.images[0].referencedTexelColors > 100);
  }
});

test('new GLBs retain original V4 source bytes, camera-safe bounds, canonical UVs and all actual water anchor transforms', () => {
  for (const asset of receipt.assets) {
    const original = sourceReceipt.assets.find(source => source.file === asset.sourceFile);
    assert.ok(original);
    assert.equal(asset.sourceSha256, original.sha256);
    assert.equal(digest(readFileSync(path.join(folder, asset.sourceFile))), original.sha256, 'the completed V4 source is immutable');
    assert.equal(digest(readFileSync(path.join(folder, asset.file))), asset.sha256);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(asset.bounds.min[axis] >= original.bounds.min[axis] - 0.001, `${asset.file} min bounds`);
      assert.ok(asset.bounds.max[axis] <= original.bounds.max[axis] + 0.001, `${asset.file} max bounds`);
    }
    const originalDocument = glbDocument(asset.sourceFile), document = glbDocument(asset.file);
    assert.deepEqual(waterAnchors(document), waterAnchors(originalDocument), 'effect anchor position, width and semantic metadata remain exact');
    for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
      assert.deepEqual(Object.keys(primitive.attributes).filter(key => key.startsWith('TEXCOORD_')), ['TEXCOORD_0']);
      assert.ok(primitive.attributes.COLOR_0 !== undefined, 'baked cavity and foliage tints survive the export');
    }
  }
});

test('background authoring provenance identifies the exact portable generator and helper sources', () => {
  assert.equal(receipt.generator, 'tools/blender/upgrade_background_v1.py');
  assert.match(receipt.license, /MIT/);
  for (const [filename, hash] of Object.entries(receipt.sourceHashes)) {
    assert.equal(digest(readFileSync(path.join(root, 'tools/blender', filename), 'utf8').replaceAll('\r\n', '\n')), hash, filename);
  }
});
