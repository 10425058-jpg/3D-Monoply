import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { blossomMipmaps } from '../src/components/environment/sakuraAtlas';
import { BOARD_SAKURA, FALLBACK_SAKURA, scenicSakura } from '../src/components/environment/sakuraLayout';
import { expandBlossomSprays, widenSakuraTrunk } from '../src/components/environment/sakuraModel';

const folder = new URL('../public/assets/models/sakura/', import.meta.url);

test('Sakura use the original masked GLBs with embedded textures and individual flowers', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
  assert.deepEqual(manifest.assets.map((asset: { detail: string }) => asset.detail), ['full', 'lite']);
  for (const { file, sha256, triangles } of manifest.assets) {
    const bytes = readFileSync(new URL(file, folder));
    const jsonLength = bytes.readUInt32LE(12);
    const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
    assert.deepEqual(model.nodes.filter((node: { mesh?: number }) => node.mesh !== undefined).map((node: { name: string }) => node.name),
      ['Bark_And_Branches', 'Pink_Blossom_Sprays', file.endsWith('_Lite.glb') ? 'Five_Petal_Flowers' : 'Individual_Five_Petal_Flowers']);
    assert.equal(model.materials[0].alphaMode, 'MASK');
    assert.equal(model.materials[0].doubleSided, true);
    assert.equal(typeof model.images[0].bufferView, 'number');
    assert.equal(model.meshes.reduce((total: number, mesh: { primitives: { indices: number }[] }) =>
      total + model.accessors[mesh.primitives[0].indices].count / 3, 0), triangles);
    const sprays = model.meshes[1].primitives[0];
    const indices = model.accessors[sprays.indices];
    const vertexCount = model.accessors[sprays.attributes.POSITION].count;
    const offset = 28 + jsonLength + (indices.byteOffset ?? 0) + (model.bufferViews[indices.bufferView].byteOffset ?? 0);
    const stride = indices.componentType === 5125 ? 4 : 2;
    assert.equal(indices.count / 6, vertexCount / 4);
    for (let i = 0; i < indices.count; i += 6) {
      const vertices = new Set(Array.from({ length: 6 }, (_, side) => bytes.readUIntLE(offset + (i + side) * stride, stride)));
      assert.equal(vertices.size, 4);
      assert.equal(Math.min(...vertices), i / 6 * 4);
      assert.equal(Math.max(...vertices), i / 6 * 4 + 3);
    }
  }
});

test('the authored Sakura trunk widens by 60 percent about each ring without shifting the roots or branches', () => {
  const bytes = readFileSync(new URL('Sakura_Cherry_Blossom_Tree_Lite.glb', folder));
  const jsonLength = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const bark = model.meshes[0].primitives[0];
  const positions = model.accessors[bark.attributes.POSITION];
  const view = model.bufferViews[positions.bufferView];
  const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (positions.byteOffset ?? 0);
  const coords = Float32Array.from({ length: positions.count * 3 }, (_, i) => bytes.readFloatLE(offset + i * 4));
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(coords, 3));
  const widened = widenSakuraTrunk(geometry);
  const original = geometry.getAttribute('position');
  const rendered = widened.getAttribute('position');
  for (let start = 0; start < 168; start += 12) {
    const ring = Array.from({ length: 12 }, (_, i) => start + i);
    for (const axis of ['getX', 'getZ'] as const) {
      const before = ring.map(i => original[axis](i));
      const after = ring.map(i => rendered[axis](i));
      assert.ok(Math.abs((Math.max(...after) - Math.min(...after)) / (Math.max(...before) - Math.min(...before)) - 1.6) < 1e-6);
      assert.ok(Math.abs(after.reduce((sum, x, i) => sum + x - before[i], 0)) < 1e-6);
    }
    assert.deepEqual(ring.map(i => rendered.getY(i)), ring.map(i => original.getY(i)));
  }
  assert.deepEqual(rendered.array.slice(168 * 3), coords.slice(168 * 3));
  assert.deepEqual(original.array, coords);
  assert.equal(widenSakuraTrunk(geometry), widened);
});

test('blossom fullness trims blank margins while keeping spray centers and triangle indices', () => {
  const source = new BufferGeometry();
  const positions = [
    -1, 1.4, -1, 1, 1.4, -1, 1, 1.4, 1, -1, 1.4, 1,
    -1, 3.7, -1, 1, 3.7, -1, 1, 3.7, 1, -1, 3.7, 1,
  ];
  source.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const uv = [0, .25, .25, .25, .25, 0, 0, 0];
  source.setAttribute('uv', new Float32BufferAttribute([...uv, ...uv], 2));
  source.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const expanded = expandBlossomSprays(source, [{ left: .025, top: .025, right: .225, bottom: .225 }]);
  const rendered = expanded.getAttribute('position');
  const renderedUV = expanded.getAttribute('uv');
  assert.equal(rendered.count, 8);
  assert.equal(expanded.index, source.index);
  assert.deepEqual([...source.getAttribute('uv').array], [...uv, ...uv]);
  assert.deepEqual([...source.getAttribute('position').array], Array.from(Float32Array.from(positions)));
  for (const [start, height, size] of [[0, 1.4, 1.24], [4, 3.7, 1.38]]) {
    const center = new Vector3();
    for (let i = start; i < start + 4; i++) center.add(new Vector3().fromBufferAttribute(rendered, i));
    assert.ok(center.multiplyScalar(.25).distanceTo(new Vector3(0, height, 0)) < 1e-6);
    assert.ok(Math.abs(rendered.getX(start) + .8 * size) < 1e-6);
    assert.ok(Math.abs(renderedUV.getX(start) - .025) < 1e-6);
    assert.ok(Math.abs(renderedUV.getY(start) - .225) < 1e-6);
  }
});

test('blossom mipmaps retain petal color and apply a bounded coverage gain', () => {
  const width = 32, data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y += 4) {
    for (let x = 0; x < width; x += 4) data.set([251, 164, 195, 255], (y * width + x) * 4);
  }
  const source = data.slice();
  const levels = blossomMipmaps({ data, width, height: width });
  assert.deepEqual(levels.map(level => [level.width, level.height]), [[32, 32], [16, 16], [8, 8], [4, 4], [2, 2], [1, 1]]);
  assert.equal(levels[0].data, data);
  assert.deepEqual(data, source);
  assert.deepEqual(Array.from(levels[1].data.slice(0, 4)), [251, 164, 195, 64]);
  assert.deepEqual(levels.slice(2).map(level => level.data[3]), [16, 17, 18, 19]);
});

test('each existing quality and fallback retain their Sakura planting sites', () => {
  assert.equal(BOARD_SAKURA.length, 8);
  assert.equal(FALLBACK_SAKURA.length, 8);
  for (const [quality, count] of [['low', 48], ['balanced', 53], ['high', 58]] as const) {
    const sites = [...BOARD_SAKURA, ...scenicSakura(quality)];
    assert.equal(sites.length, count);
    assert.equal(new Set(sites.map(site => site.id)).size, count);
    assert.ok(sites.every(site => site.position.every(Number.isFinite) && site.scale > 0));
  }
});
