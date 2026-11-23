import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
// Run the targeted café-roof material regression in existing graphics CI.
import './blue-cafe-roof.test';
import { finishCastleMaterial } from '../src/components/3d/castle/finishCastleMaterial';

test('city finishing preserves the cached GLTF material, shared atlas and authored stone color', () => {
  const atlas = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ map: atlas, color: '#e9dfca', roughness: 0.77 });
  source.name = 'Ivory limestone';
  const finished = finishCastleMaterial(source) as THREE.MeshStandardMaterial;
  assert.notEqual(finished, source);
  assert.equal(finished.map, atlas);
  assert.equal(finished.color.getHex(), source.color.getHex());
  assert.equal(source.roughness, 0.77);
  assert.equal(finished.metalness, 0);
  assert.ok(finished.roughness >= 0.8);
  finished.dispose(); source.dispose(); atlas.dispose();
});

test('city stone, slate, metal and glazing retain distinct responses without new textures', () => {
  const atlas = new THREE.Texture();
  const materials = Object.fromEntries(['Carved sandstone', 'Royal blue glazed slate', 'Brushed antique gold', 'Warm lit glass'].map(name => {
    const source = new THREE.MeshStandardMaterial({ map: atlas, emissive: '#ffad58', emissiveIntensity: 1.65 });
    source.name = name;
    const finished = finishCastleMaterial(source) as THREE.MeshStandardMaterial;
    assert.equal(finished.map, atlas);
    assert.equal(source.emissiveIntensity, 1.65);
    source.dispose();
    return [name, finished];
  }));
  assert.ok(materials['Carved sandstone'].roughness > materials['Royal blue glazed slate'].roughness);
  assert.equal(materials['Carved sandstone'].metalness, 0);
  assert.ok(materials['Brushed antique gold'].metalness > 0.5);
  assert.ok(materials['Royal blue glazed slate'].metalness < 0.1);
  assert.ok(materials['Warm lit glass'].emissiveIntensity > 0 && materials['Warm lit glass'].emissiveIntensity < 1);
  Object.values(materials).forEach(material => material.dispose()); atlas.dispose();
});

test('unknown optional city materials keep their original appearance', () => {
  const source = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0.17, color: '#dfa0b7' });
  source.name = 'Future optional decoration';
  const finished = finishCastleMaterial(source) as THREE.MeshStandardMaterial;
  assert.equal(finished.roughness, source.roughness);
  assert.equal(finished.metalness, source.metalness);
  assert.equal(finished.color.getHex(), source.color.getHex());
  finished.dispose(); source.dispose();
});
