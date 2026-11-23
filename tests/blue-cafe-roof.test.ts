import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blueCafeMansard } from '../src/components/3d/castle/blueCafeMansard';

function testBatch(indexed: boolean) {
  // The central GLB contains several separate elements inside one red batch.
  // Only the café's roof at x≈-5, y≈3 may be recolored.
  const points = [
    [-5.5, 2.6, 0], [-4.7, 3.4, 0], [-4.4, 2.7, 0], // café roof
    [-5.5, 1.5, 0], [-4.7, 1.5, 0], [-4.4, 1.5, 0], // shop awning
    [-0.5, 0.3, 0], [0, 0.3, 0], [0.5, 0.3, 0],    // castle stair runner
    [4.7, 3.1, 0], [5.2, 3.3, 0], [5.6, 2.8, 0],  // other house
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(
    points.flatMap((_, i) => [0.625, i < 3 ? 0.625 : 0.625]), 2
  ));
  if (indexed) geometry.setIndex(points.map((_, i) => i));
  const material = new THREE.MeshStandardMaterial();
  material.name = 'Royal district red';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  return { geometry, material, mesh };
}

for (const indexed of [false, true]) {
  test(`only the left café roof changes from burgundy to royal blue in ${indexed ? 'indexed' : 'unindexed'} GLB geometry`, () => {
    const { geometry, material, mesh } = testBatch(indexed);
    const result = blueCafeMansard(mesh);
    assert.ok(result);
    assert.notEqual(result, geometry, 'never mutate GLTF loader cache');
    const changedUv = result.getAttribute('uv');
    const originalUv = geometry.getAttribute('uv');
    for (let i = 0; i < 12; i++) {
      assert.ok(Math.abs(changedUv.getY(i) - (i < 3 ? 0.125 : 0.625)) < 1e-6, `vertex ${i}`);
      assert.equal(originalUv.getY(i), 0.625, 'original UV remains untouched');
    }
    result.dispose(); geometry.dispose(); material.dispose();
  });
}

test('red decorative materials and non-café meshes are preserved', () => {
  const { mesh, geometry, material } = testBatch(true);
  material.name = 'Royal district cream.001';
  assert.equal(blueCafeMansard(mesh), null);
  material.name = 'Royal district red';
  mesh.position.x = 20;
  mesh.updateMatrixWorld(true);
  assert.equal(blueCafeMansard(mesh), null);
  geometry.dispose(); material.dispose();
});

test('blue roof mapping supports vertically flipped glTF atlas UVs', () => {
  const { geometry, material, mesh } = testBatch(false);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < 3; i++) uv.setY(i, 0.375);
  const result = blueCafeMansard(mesh);
  assert.ok(result);
  for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(result.getAttribute('uv').getY(i) - 0.875) < 1e-6);
  result.dispose(); geometry.dispose(); material.dispose();
});
