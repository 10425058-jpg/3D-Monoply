import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'public/assets/models/central-city');
const manifest=JSON.parse(readFileSync(path.join(folder,'manifest.json'),'utf8'));
test('central district actual bytes meet the explicit city geometry, material, texture and origin policy',()=>{
  assert.equal(manifest.assets.length,3);
  for(const [file,hash] of Object.entries(manifest.sourceHashes)){
    const source=readFileSync(path.join(root,'tools/blender',file),'utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(source).digest('hex'),hash,`${file} matches the portable authoring receipt`);
  }
  const report=JSON.parse(execFileSync(process.env.PYTHON||'python',['tools/blender/validate_assets.py',...manifest.assets.map(a=>path.join(folder,a.file)),
    '--profile','central-city','--manifest',path.join(folder,'manifest.json')],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(report.valid,true);assert.equal(report.assets.length,3);
  assert.ok(report.assets.every(a=>a.images.length===1&&a.materials<=15&&a.drawPrimitives<=64));
});
test('all five landmark progression groups and the shared effect anchors exist at every quality',()=>{
  for(const asset of manifest.assets){
    const bytes=readFileSync(path.join(folder,asset.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
    assert.deepEqual(doc.nodes.filter(n=>n.mesh!==undefined).map(n=>n.extras.unlock_level).sort(),[1,2,3,4,5]);
    assert.deepEqual(Object.keys(asset.levelTriangles),['1','2','3','4','5']);
    assert.equal(Object.values(asset.levelTriangles).reduce((a,b)=>a+b,0),asset.triangles);
    assert.ok(Object.values(asset.levelTriangles).every(n=>n>0));
    assert.ok(doc.nodes.some(n=>n.extras?.city_effect==='fountain'));
    assert.equal(doc.nodes.filter(n=>n.extras?.city_effect==='lantern').length,10);
    assert.equal(doc.nodes.filter(n=>n.extras?.city_effect==='flag').length,9);
    assert.ok(doc.nodes.filter(n=>n.mesh===undefined).every(n=>!n.scale||n.scale.every(v=>v===1)));
    for(const mesh of doc.meshes)for(const part of mesh.primitives)assert.deepEqual(Object.keys(part.attributes).filter(k=>k.startsWith('TEXCOORD_')),['TEXCOORD_0']);
  }
});
test('lower tiers reduce actual geometry while retaining the same safe district footprint',()=>{
  const byTier=Object.fromEntries(manifest.assets.map(a=>[a.tier,a]));
  assert.ok(byTier.high.triangles>byTier.balanced.triangles&&byTier.balanced.triangles>byTier.low.triangles);
  for(const asset of manifest.assets){
    assert.ok(asset.bounds.max[1]<10.8&&asset.bounds.min[1]>=-.5);
    for(const axis of [0,2])assert.ok(Math.max(Math.abs(asset.bounds.min[axis]),Math.abs(asset.bounds.max[axis]))<=7.651);
  }
});
