import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finishEnvironmentMaterial,isScenicEnvironmentAsset} from '../src/components/environment/environmentMaterial';

test('scenic finishing excludes every board-foundation and dressing LOD',()=>{
  for(const id of ['crown-foundation','royal-garden-dressing'])for(const suffix of ['.glb','-low.glb','-balanced.glb','-v4.glb','-v4-balanced.glb'])assert.equal(isScenicEnvironmentAsset(id+suffix),false);
  for(const id of ['royal-island-left','royal-island-right','royal-island-citadel','fantasy-airship','sky-windmill'])assert.equal(isScenicEnvironmentAsset(`${id}-balanced.glb`),true);
});

test('background shader retains immutable source atlas, colors and contact tint attributes',()=>{
  const map=new THREE.Texture(),source=new THREE.MeshStandardMaterial({map,color:'#f6e4c6',vertexColors:true});source.name='Ivory limestone';
  const original=source.color.clone(),result=finishEnvironmentMaterial(source,.2) as THREE.ShaderMaterial;
  assert.equal(result.uniforms.uMap.value,map);assert.equal(result.vertexColors,true);assert.equal(result.uniforms.uStone.value,1);
  assert.equal(result.uniforms.uScenic.value,1);assert.equal(source.color.getHex(),original.getHex());assert.equal(source.map,map);
  const board=finishEnvironmentMaterial(source,0,undefined,false) as THREE.ShaderMaterial;
  assert.equal(board.uniforms.uScenic.value,0);
  const expected=source.color.clone().multiply(new THREE.Color().setRGB(1.04,.96,.85));
  assert.deepEqual(board.uniforms.uColor.value.toArray(),expected.toArray());
  result.dispose();board.dispose();source.dispose();map.dispose();
});
