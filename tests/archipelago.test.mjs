import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const source = readFileSync(new URL('../src/components/environment/archipelagoLayout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { ARCHIPELAGO } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const receipt = JSON.parse(readFileSync(new URL('../public/assets/models/environment/archipelago-manifest.json', import.meta.url), 'utf8'));
const sunsetSource=readFileSync(new URL('../src/components/environment/sunsetKingdomLayout.ts',import.meta.url),'utf8');
const sunsetJs=ts.transpileModule(sunsetSource,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {SUNSET_KINGDOM,LEFT_ISLAND,RIGHT_ISLAND}=await import(`data:text/javascript;base64,${Buffer.from(sunsetJs).toString('base64')}`);
const sunsetReceipt=JSON.parse(readFileSync(new URL('../public/assets/models/environment/sunset-manifest.json',import.meta.url),'utf8'));
const refinedReceipt=JSON.parse(readFileSync(new URL('../public/assets/models/environment/v4-manifest.json',import.meta.url),'utf8'));
const originalReceipt=JSON.parse(readFileSync(new URL('../public/assets/models/environment/manifest.json',import.meta.url),'utf8'));

test('actual exported landmark bounds stay below gameplay and outside its column at every tier', () => {
  let instances = 0;
  for (const [kind, sites] of Object.entries(ARCHIPELAGO)) {
    instances += sites.length;
    for (const site of sites) for (const tier of ['high', 'balanced', 'low']) {
      const asset = receipt.assets.find(asset => asset.id === `sky-${kind}` && asset.tier === tier);
      assert.ok(asset);
      const { min, max } = asset.bounds;
      assert.ok(site.position[1] + max[1] * site.scale < -6, `${kind} highest architecture stays below the tiles`);
      const radius = Math.hypot(Math.max(Math.abs(min[0]), Math.abs(max[0])), Math.max(Math.abs(min[2]), Math.abs(max[2]))) * site.scale;
      assert.ok(Math.hypot(site.position[0], site.position[2]) - radius > 15, `${kind} clears the board column`);
    }
  }
  assert.equal(instances, 10);
  const directions = Object.values(ARCHIPELAGO).flat().map(site => Math.atan2(site.position[0], site.position[2])).sort((a,b) => a-b);
  const gaps = directions.map((a,i) => ((directions[(i+1)%directions.length]-a)+Math.PI*2)%(Math.PI*2));
  assert.ok(Math.max(...gaps) < Math.PI, 'an orbit never exposes a completely unpopulated hemisphere');
});

test('rendered V4 island footprints remain separate at every exported quality tier',()=>{
  const sites=[{id:'royal-island-left',site:LEFT_ISLAND},{id:'royal-island-right',site:RIGHT_ISLAND}];
  for(const [kind,entries] of Object.entries(ARCHIPELAGO))entries.forEach(site=>sites.push({id:`sky-${kind}`,site}));
  for(const [id,entries] of Object.entries(SUNSET_KINGDOM))if(!['crown-foundation','royal-garden-dressing'].includes(id))entries.forEach(site=>sites.push({id,site}));
  const models=[...originalReceipt.assets,...receipt.assets,...sunsetReceipt.assets,...refinedReceipt.assets];
  for(const tier of ['high','balanced','low']){
    const boxes=sites.map(({id,site},index)=>{
      const modelId=['royal-island-left','royal-island-right','royal-island-citadel'].includes(id)?`${id}-v4`:id;
      const asset=models.find(record=>record.id===modelId&&record.tier===tier);assert.ok(asset);
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...site.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),site.rotation||0),new THREE.Vector3().setScalar(site.scale));
      const box=new THREE.Box3(new THREE.Vector3(...asset.bounds.min),new THREE.Vector3(...asset.bounds.max)).applyMatrix4(matrix);
      assert.ok(box.max.y<-6,`${tier}: ${id} architecture remains below gameplay`);
      const radius=Math.hypot(Math.max(...[asset.bounds.min[0],asset.bounds.max[0]].map(Math.abs)),Math.max(...[asset.bounds.min[2],asset.bounds.max[2]].map(Math.abs)))*site.scale;
      assert.ok(Math.hypot(site.position[0],site.position[2])-radius>15,`${tier}: ${id} clears the board column`);
      return{id:`${id}:${index}`,box};
    });
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(boxes[i].box.intersectsBox(boxes[j].box),false,`${tier}: ${boxes[i].id} intersects ${boxes[j].id}`);
  }
});

test('sunset landmarks clear the playable column with actual exported bounds at every LOD',()=>{
  for(const [id,sites] of Object.entries(SUNSET_KINGDOM))for(const site of sites)for(const tier of ['high','balanced','low']) {
    const asset=sunsetReceipt.assets.find(asset=>asset.id===id&&asset.tier===tier);
    assert.ok(asset,`${id} ${tier} has a real exported LOD`);
    if(id==='crown-foundation') {
      assert.ok(asset.bounds.max[1]<-.5,'rock and banners remain below the chassis');
      continue;
    }
    const {min,max}=asset.bounds;
    const radius=Math.hypot(Math.max(Math.abs(min[0]),Math.abs(max[0])),Math.max(Math.abs(min[2]),Math.abs(max[2])))*site.scale;
    assert.ok(Math.hypot(site.position[0],site.position[2])-radius>15,`${id} clears board even at the widest corner`);
  }
  const directions=Object.entries(SUNSET_KINGDOM).filter(([id])=>!['crown-foundation','royal-garden-dressing'].includes(id))
    .flatMap(([,sites])=>sites.map(site=>Math.atan2(site.position[0],site.position[2]))).sort((a,b)=>a-b);
  const gaps=directions.map((angle,i)=>(directions[(i+1)%directions.length]-angle+Math.PI*2)%(Math.PI*2));
  assert.ok(Math.max(...gaps)<Math.PI,'new skyline spans every orbit hemisphere');
});
