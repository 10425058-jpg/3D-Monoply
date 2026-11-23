import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { recolorCafeRedToBlue } from '../src/components/3d/castle/blueCafeMansard';

// A shared red batch like the exported royal district: only the left café
// roof and café awning may change; the castle stairs and other houses may not.
const triangles = [
  [[-5.5, 2.6, 0], [-4.7, 3.4, 0], [-4.4, 2.7, 0]], // café roof
  [[-5.7, 1.5, 1.2], [-5.0, 1.7, 1.2], [-4.5, 1.5, 1.2]], // CAFÉ RED AWNING
  [[-0.5, 0.3, 1.2], [0, 0.3, 1.2], [0.5, 0.3, 1.2]], // castle RED stairs
  [[4.7, 3.1, 0], [5.2, 3.3, 0], [5.6, 2.8, 0]], // another house
  [[-5.7, 1.5, -1.2], [-5.0, 1.7, -1.2], [-4.5, 1.5, -1.2]], // back-side red accent
];
function batch(indexed: boolean, name = 'Royal district red') {
  const points = triangles.flat(1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(points.flatMap(() => [0,1,0]), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(() => [0.625,0.625]), 2));
  if (indexed) geometry.setIndex(points.map((_, i) => i));
  const material = new THREE.MeshStandardMaterial();
  material.name = name;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  return {geometry,material,mesh};
}

for (const indexed of [false,true]) {
  test(`only red café awning and existing blue roof are recolored, ${indexed ? 'indexed' : 'unindexed'}`, () => {
    const {geometry,material,mesh}=batch(indexed);
    const result = recolorCafeRedToBlue(mesh);
    assert.ok(result, 'a color correction is produced');
    assert.notStrictEqual(result, geometry, 'cached GLB untouched');
    const changed = result.getAttribute('uv');
    const original = geometry.getAttribute('uv');
    for(let i=0;i<15;i++) {
      const expected = i < 6 ? 0.125 : 0.625;
      assert.ok(Math.abs(changed.getY(i)-expected)<1e-6,`vertex ${i} got unexpected blue`);
      assert.equal(original.getY(i),0.625,'source remains original');
    }
    // Crucially: no physical model geometry or transforms can change.
    for(const name of ['position','normal'])
      assert.deepEqual(Array.from(result.getAttribute(name).array),Array.from(geometry.getAttribute(name).array),`${name} identical`);
    assert.deepEqual(result.index?.array,geometry.index?.array,'topology unchanged');
    assert.deepEqual(mesh.matrixWorld.elements,new THREE.Matrix4().elements,'transform unchanged');
    result.dispose(); geometry.dispose(); material.dispose();
  });
}

test('cream/white awning stripes must keep original white material UVs', () => {
  const {geometry,material,mesh}=batch(true,'Royal district cream.001');
  assert.equal(recolorCafeRedToBlue(mesh),null);
  geometry.dispose(); material.dispose();
});
test('only actual red surfaces in left café footprint are touched', () => {
  const {geometry,material,mesh}=batch(true);
  mesh.position.x=20;
  mesh.updateMatrixWorld(true);
  assert.equal(recolorCafeRedToBlue(mesh),null);
  geometry.dispose(); material.dispose();
});
test('V-inverted glTF atlas still maps café red stripes into royal blue', () => {
  const {geometry,material,mesh}=batch(false);
  const uv=geometry.getAttribute('uv');
  for(let i=0;i<6;i++)uv.setY(i,0.375);
  const result=recolorCafeRedToBlue(mesh);
  assert.ok(result);
  for(let i=0;i<15;i++) assert.ok(Math.abs(result.getAttribute('uv').getY(i)-(i<6?0.875:0.625))<1e-6);
  result.dispose(); geometry.dispose(); material.dispose();
});
