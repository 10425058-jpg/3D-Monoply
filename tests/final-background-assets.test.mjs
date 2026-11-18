import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const folder = path.join(root, 'public/assets/models/environment');
const manifestPath = path.join(folder, 'final-background-manifest.json');
const receipt = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sourceRecords = ['background-v1-manifest.json', 'sunset-manifest.json'].flatMap(file =>
  JSON.parse(readFileSync(path.join(folder, file), 'utf8')).assets);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const families = ['royal-island-left', 'royal-island-right', 'royal-island-citadel', 'sky-garden', 'sky-windmill'];

function glb(filename) {
  const bytes = readFileSync(path.join(folder, filename));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  assert.equal(bytes.readUInt32LE(24 + jsonLength), 0x004e4942);
  return { bytes, document: JSON.parse(bytes.subarray(20, 20 + jsonLength)), binary: bytes.subarray(28 + jsonLength) };
}

function values(asset, accessorIndex) {
  const accessor = asset.document.accessors[accessorIndex];
  const view = asset.document.bufferViews[accessor.bufferView];
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
  assert.ok(components && size, 'only portable scalar/vector geometry is expected');
  const read = { 5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[accessor.componentType];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride || components * size;
  const divisor = accessor.normalized ? { 5121: 255, 5123: 65535 }[accessor.componentType] : 1;
  return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: components }, (_, j) =>
    asset.binary[read](start + i * stride + j * size) / divisor));
}

const waterAnchors = document => Object.fromEntries(document.nodes
  .filter(node => /^water(?:course|fall)_/.test(node.name))
  .map(node => [node.name.replace(/\.\d+$/, ''), {
    translation: node.translation, rotation: node.rotation, scale: node.scale, extras: node.extras,
  }]));

test('final scenery release contains five complete, independently bounded LOD families', () => {
  assert.equal(receipt.assets.length, 15);
  assert.equal(new Set(receipt.assets.map(asset => asset.file)).size, 15);
  assert.deepEqual([...new Set(receipt.assets.map(asset => asset.id))].sort(), families.map(id => `${id}-final-v1`).sort());
  for (const family of families) {
    const lods = ['high', 'balanced', 'low'].map(tier => receipt.assets.find(asset => asset.id === `${family}-final-v1` && asset.tier === tier));
    assert.ok(lods.every(Boolean), `${family} has every quality`);
    assert.ok(lods[0].triangles > lods[1].triangles && lods[1].triangles > lods[2].triangles, `${family} has genuine reduced LODs`);
    for (const asset of lods) {
      const budget = family.startsWith('royal-island')
        ? { high: 55000, balanced: 38000, low: 24000 }[asset.tier]
        : { high: 18000, balanced: 15000, low: 12000 }[asset.tier];
      assert.equal(asset.triangleBudget, budget);
      assert.ok(asset.triangles > 0 && asset.triangles <= budget, asset.file);
      assert.ok(asset.bytes < 4 * 1024 * 1024, `${asset.file} remains below its download cap`);
    }
  }
});

test('all fifteen actual GLBs pass the geometry, buffer, atlas and manifest validator', () => {
  const report = JSON.parse(execFileSync(process.env.PYTHON || 'python', [
    'tools/blender/validate_assets.py', ...receipt.assets.map(asset => path.join(folder, asset.file)), '--manifest', manifestPath,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  assert.equal(report.valid, true);
  assert.equal(report.assets.length, 15);
  for (const asset of report.assets) {
    assert.ok(asset.drawPrimitives >= 9 && asset.drawPrimitives <= 10, `${asset.file} retains material batching`);
    assert.ok(asset.materials <= 10);
    assert.equal(asset.images.length, 1);
    assert.deepEqual([asset.images[0].width, asset.images[0].height], [256, 256]);
    assert.ok(asset.images[0].referencedTexelColors > 100, 'the embedded atlas contains real surface detail');
  }
});

test('source exports remain immutable and all real water-anchor transforms and metadata survive', () => {
  for (const record of receipt.assets) {
    const source = sourceRecords.find(asset => asset.file === record.sourceFile);
    assert.ok(source, `${record.sourceFile} has pre-existing provenance`);
    assert.equal(record.sourceSha256, source.sha256);
    assert.equal(digest(readFileSync(path.join(folder, record.sourceFile))), source.sha256, 'the existing export is immutable');
    const asset = glb(record.file);
    assert.equal(digest(asset.bytes), record.sha256);
    assert.equal(asset.bytes.length, record.bytes);
    assert.deepEqual(waterAnchors(asset.document), waterAnchors(glb(record.sourceFile).document), record.file);
    assert.ok(!/crown-foundation|central-city|royal-garden-dressing/.test(record.id));
    for (const buffer of asset.document.buffers) assert.equal(buffer.uri, undefined, 'no external runtime buffer dependency');
    for (const image of asset.document.images) assert.equal(image.uri, undefined, 'the atlas travels inside the GLB');
  }
});

test('actual normals, contact tints and topology survive reconstruction and portable export', () => {
  for (const record of receipt.assets) {
    const asset = glb(record.file);
    let triangles = 0;
    for (const mesh of asset.document.meshes) for (const primitive of mesh.primitives) {
      assert.deepEqual(Object.keys(primitive.attributes).filter(key => key.startsWith('TEXCOORD_')), ['TEXCOORD_0']);
      assert.ok(primitive.attributes.COLOR_0 !== undefined, 'baked grounding and foliage tints must survive');
      const normals = values(asset, primitive.attributes.NORMAL);
      assert.ok(normals.every(normal => normal.every(Number.isFinite) && Math.abs(Math.hypot(...normal) - 1) < .01), `${record.file} has usable lighting normals`);
      const colors = values(asset, primitive.attributes.COLOR_0);
      assert.ok(colors.every(color => color.every(value => value >= 0 && value <= 1)), 'contact colors stay normalized');
      const material = asset.document.materials[primitive.material];
      if (material.name === 'Sakura blossom clusters') {
        const bright = colors.filter(color => (color[0]+color[1]+color[2])/3 > .2).length;
        assert.ok(bright/colors.length > .98, `${record.file}: repeated shadow baking must not blacken shared blossom geometry`);
      }
      if (['Meadow and moss', 'Sakura blossom clusters', 'Lavender layered cliff'].includes(material.name)) {
        const range = colors.reduce((result, color) => [Math.min(result[0], color[0]), Math.max(result[1], color[0])], [1, 0]);
        assert.ok(range[1] - range[0] > .025, `${record.file}: ${material.name} retains shaded color variation`);
      }
      triangles += primitive.indices === undefined
        ? asset.document.accessors[primitive.attributes.POSITION].count / 3
        : asset.document.accessors[primitive.indices].count / 3;
    }
    assert.equal(triangles, record.triangles, 'recorded topology agrees with the actual index buffers');
  }
});

test('authoring receipt binds the exact Blender sources used to produce the final assets', () => {
  assert.equal(receipt.generator, 'tools/blender/final_background_overhaul.py');
  assert.match(receipt.license, /MIT/);
  for (const [filename, hash] of Object.entries(receipt.sourceHashes)) {
    assert.equal(digest(readFileSync(path.join(root, 'tools/blender', filename), 'utf8').replaceAll('\r\n', '\n')), hash, filename);
  }
});
