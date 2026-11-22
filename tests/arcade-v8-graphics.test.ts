import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BOARD_SPACES, getSpaceTransform } from '../src/data/boardData';
import {
  ARCADE_PROPERTY_STAGES, CONSTRUCTION_MS, HOTEL_CONSTRUCTION_MS, OWNER_PENNANT_MATERIAL,
  arcadeConstructionPose, arcadePlotPlacement, arcadePropertyAsset,
} from '../src/components/3d/arcadePropertyLayout';

const readPublic = (path: string) => readFileSync(new URL(`../public/${path}`, import.meta.url));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readPublic('assets/models/arcade-properties/manifest.json').toString());

test('the four rendered models use distinct geometry, a shared atlas and a tintable ownership pennant', () => {
  const atlasHashes = new Set<string>();
  const dimensions: number[] = [];
  for (const [level, stage] of ARCADE_PROPERTY_STAGES.entries()) {
    const bytes = readPublic(arcadePropertyAsset(stage, 'glb'));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    const jsonEnd = 20 + bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString('utf8', 20, jsonEnd));
    const receipt = manifest.assets[level];
    assert.equal(receipt.sha256, sha(bytes));
    assert.equal(receipt.level, level);
    assert.equal(gltf.nodes[0].extras.development_level, level);
    assert.equal(gltf.nodes[0].extras.plot_front, '+Z');
    assert.equal(gltf.meshes.length, 1);
    assert.ok(gltf.meshes[0].primitives.length <= 5);
    assert.ok(receipt.triangles < 5500 && bytes.length < 450_000);
    assert.ok(gltf.materials.some(({ name }: { name: string }) => name === OWNER_PENNANT_MATERIAL));
    if (level > 0) assert.ok(gltf.materials.some(({ name, emissiveFactor }: { name: string; emissiveFactor?: number[] }) =>
      name === 'Arcade Lit glass' && emissiveFactor?.some(channel => channel > 0.4)));
    assert.equal(gltf.images.length, 1);
    const view = gltf.bufferViews[gltf.images[0].bufferView];
    const imageOffset = jsonEnd + 8 + (view.byteOffset ?? 0);
    atlasHashes.add(sha(bytes.subarray(imageOffset, imageOffset + view.byteLength)));

    const preview = readPublic(arcadePropertyAsset(stage, 'png'));
    assert.equal(receipt.previewSha256, sha(preview));
    assert.equal(preview.readUInt32BE(16), 320);
    assert.equal(preview.readUInt32BE(20), 280);
    assert.equal(preview[25], 6, 'Blender previews retain their transparent background');
    dimensions.push(receipt.bounds.max[1]);
  }
  assert.equal(atlasHashes.size, 1);
  assert.ok(dimensions.every((height, i) => i === 0 || height > dimensions[i - 1] + .1));
});

test('every street keeps the actual miniature footprint inside its own inward tile strip', () => {
  const orientations = new Set<number>();
  for (const space of BOARD_SPACES.filter(tile => tile.type === 'property')) {
    const tile = getSpaceTransform(space.id);
    const plot = arcadePlotPlacement(space.id, null, null);
    const offsetX = plot.position[0] - tile.position[0];
    const offsetZ = plot.position[2] - tile.position[2];
    const localDepth = Math.sin(plot.rotationY) * offsetX + Math.cos(plot.rotationY) * offsetZ;
    orientations.add(plot.rotationY);
    assert.equal(plot.rotationY, tile.rotationY);
    assert.ok(Math.abs(Math.cos(plot.rotationY) * offsetX - Math.sin(plot.rotationY) * offsetZ) < 1e-10);
    for (const { bounds } of manifest.assets) {
      assert.equal(bounds.min[1], 0);
      assert.ok(bounds.min[0] > -tile.width / 2 + .15 && bounds.max[0] < tile.width / 2 - .15);
      assert.ok(localDepth + bounds.min[2] > -tile.depth / 2 + .03);
      assert.ok(localDepth + bounds.max[2] < -.755, 'lot stands behind the label and token lane');
    }
    assert.ok(arcadePlotPlacement(space.id, space.id, null).position[1] > plot.position[1] + .10);
  }
  assert.equal(orientations.size, 4);
});

test('construction rises briefly and fully settles after its committed lifetime', () => {
  const start = arcadeConstructionPose(0, CONSTRUCTION_MS);
  const midway = arcadeConstructionPose(CONSTRUCTION_MS / 2, CONSTRUCTION_MS);
  assert.ok(start.height > 0 && midway.height > start.height);
  assert.ok(HOTEL_CONSTRUCTION_MS > CONSTRUCTION_MS && HOTEL_CONSTRUCTION_MS < 1000);
  assert.deepEqual(arcadeConstructionPose(10_000, CONSTRUCTION_MS), { t: 1, width: 1, height: 1 });
});
