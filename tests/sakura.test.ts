import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOARD_SAKURA, FALLBACK_SAKURA, scenicSakura } from '../src/components/environment/sakuraLayout';

test('Sakura use the original masked GLBs with embedded textures and individual flowers', () => {
  const folder = new URL('../public/assets/models/sakura/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
  assert.deepEqual(manifest.assets.map((asset: { detail: string }) => asset.detail), ['full', 'lite']);
  for (const { file, sha256, triangles } of manifest.assets) {
    const bytes = readFileSync(new URL(file, folder));
    const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
    assert.deepEqual(model.nodes.filter((node: { mesh?: number }) => node.mesh !== undefined).map((node: { name: string }) => node.name),
      ['Bark_And_Branches', 'Pink_Blossom_Sprays', file.endsWith('_Lite.glb') ? 'Five_Petal_Flowers' : 'Individual_Five_Petal_Flowers']);
    assert.equal(model.materials[0].alphaMode, 'MASK');
    assert.equal(model.materials[0].doubleSided, true);
    assert.equal(typeof model.images[0].bufferView, 'number');
    assert.equal(model.meshes.reduce((total: number, mesh: { primitives: { indices: number }[] }) =>
      total + model.accessors[mesh.primitives[0].indices].count / 3, 0), triangles);
  }
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
