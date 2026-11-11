import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const models = path.join(root, 'public/assets/models/environment');
const validator = path.join(root, 'tools/blender/validate_assets.py');
const python = process.env.PYTHON || 'python';
const temporary = mkdtempSync(path.join(tmpdir(), 'monopoly-glb-validation-'));
const temporaryFiles = [];
after(() => {
  for (const filename of temporaryFiles) unlinkSync(filename);
  rmdirSync(temporary);
});

const run = (...args) => JSON.parse(execFileSync(python, [validator, ...args], { cwd: root, encoding: 'utf8' }));
const foundation = path.join(models, 'foundation-island.glb');
function fixture(change) {
  const original = readFileSync(foundation);
  const jsonLength = original.readUInt32LE(12);
  const document = JSON.parse(original.subarray(20, 20 + jsonLength));
  let binary = Buffer.from(original.subarray(28 + jsonLength));
  binary = change(document, binary) || binary;
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const paddedBinary = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + paddedBinary.length, 8);
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4E4F534A, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBinary.length); binHeader.writeUInt32LE(0x004E4942, 4);
  const filename = path.join(temporary, `fixture-${temporaryFiles.length}.glb`);
  writeFileSync(filename, Buffer.concat([header, paddedJson, binHeader, paddedBinary]));
  temporaryFiles.push(filename);
  return filename;
}
function rejected(filename, reason) {
  const result = spawnSync(python, [validator, filename], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, false);
  assert.match(report.failures[0].error, reason);
}
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

test('actual exported GLBs have valid buffers, geometry, textured PBR, applied origins and bounded cost', () => {
  const artifacts = readdirSync(models).filter(name => name.endsWith('.glb'));
  assert.ok(artifacts.length > 0, 'real generated GLB files must exist');
  const result = run(...artifacts.map(name => path.join(models, name)));
  assert.equal(result.valid, true);
  for (const asset of result.assets) {
    assert.ok(asset.triangles > 0 && asset.triangles <= asset.triangleBudget);
    assert.ok(asset.images.length > 0, `${asset.file} must contain its real texture atlas`);
    assert.ok(asset.images.every(image => image.referencedTexelColors > 3), `${asset.file} exported atlas must reach used UVs`);
    assert.match(asset.sha256, /^[a-f\d]{64}$/);
  }
});

test('foundation generation receipt matches the actual artifact bytes and geometry', () => {
  assert.equal(run(foundation, '--manifest', path.join(models, 'foundation-manifest.json')).valid, true);
});

test('completed world manifest matches the shipped asset bytes and geometry', () => {
  assert.equal(run('--manifest', path.join(models, 'manifest.json')).valid, true);
});

test('a malformed GLB header is rejected', () => {
  const filename = fixture(() => {});
  const bytes = readFileSync(filename);
  bytes.writeUInt32LE(bytes.length + 4, 8);
  writeFileSync(filename, bytes);
  rejected(filename, /declared length/);
});

test('declared vertex bounds must match the actual binary positions', () => {
  const filename = fixture(document => {
    const positions = document.meshes[0].primitives[0].attributes.POSITION;
    document.accessors[positions].max[0] += 10;
  });
  rejected(filename, /declared max differs from bytes/);
});

test('out-of-range triangle indices are rejected', () => {
  const filename = fixture((document, binary) => {
    const primitive = document.meshes[0].primitives[0];
    const accessor = document.accessors[primitive.indices];
    const view = document.bufferViews[accessor.bufferView];
    const count = document.accessors[primitive.attributes.POSITION].count;
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    delete accessor.min; delete accessor.max;
    if (accessor.componentType === 5123) binary.writeUInt16LE(count, offset);
    else if (accessor.componentType === 5125) binary.writeUInt32LE(count, offset);
    else binary.writeUInt8(count, offset);
  });
  rejected(filename, /index references missing vertex/);
});

test('external texture URLs cannot silently escape the self-contained GLB contract', () => {
  const filename = fixture(document => {
    delete document.images[0].bufferView;
    document.images[0].uri = 'https://example.invalid/atlas.png';
  });
  rejected(filename, /texture URI is not embedded/);
});

test('a structurally valid all-black PNG is rejected before browser integration', () => {
  const filename = fixture((document, binary) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(8); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.alloc((8 * 3 + 1) * 8))), pngChunk('IEND', Buffer.alloc(0))]);
    const offset = binary.length;
    const view = document.bufferViews[document.images[0].bufferView];
    view.byteOffset = offset; view.byteLength = png.length;
    document.buffers[0].byteLength = binary.length + png.length;
    return Buffer.concat([binary, png]);
  });
  rejected(filename, /atlas is constant\/black/);
});
