import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const transpile=filename=>ts.transpileModule(readFileSync(new URL(filename,import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext},
}).outputText;
const asModule=text=>`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const layoutUrl=asModule(transpile('../src/components/environment/environmentLayout.ts'));
const source=transpile('../src/components/environment/atmosphereLayout.ts').replace("'./environmentLayout'",JSON.stringify(layoutUrl));
const atmosphere=await import(asModule(source));

test('mountain massifs are deterministic, separated from gameplay and span four atmospheric depths',()=>{
  const original=Math.random;Math.random=()=>{throw new Error('terrain consumed gameplay RNG');};
  try{
    const patches=atmosphere.mountainPatches();
    assert.equal(patches.length,30);assert.deepEqual(patches,atmosphere.mountainPatches());
    assert.equal(atmosphere.MOUNTAIN_LAYERS.length,4);
    for(const patch of patches){
      assert.ok(patch.radius-patch.depth/2>115);
      assert.ok(patch.width>60&&patch.width<100&&patch.depth>35&&patch.depth<65);
    }
    for(let layer=1;layer<4;layer++){
      assert.ok(atmosphere.MOUNTAIN_LAYERS[layer].radius<atmosphere.MOUNTAIN_LAYERS[layer-1].radius);
      assert.ok(atmosphere.MOUNTAIN_LAYERS[layer].opacity>atmosphere.MOUNTAIN_LAYERS[layer-1].opacity);
    }
  }finally{Math.random=original;}
});

test('actual terrain height function has asymmetric relief and tapers every patch edge into haze',()=>{
  for(const patch of atmosphere.mountainPatches()){
    const heights=[];
    for(let i=0;i<=20;i++)for(let j=0;j<=20;j++){
      const u=i/10-1,v=j/10-1,h=atmosphere.massifHeight(u,v,patch);heights.push(h);
      assert.ok(Number.isFinite(h)&&h>=patch.base&&h<-35);
      if(Math.abs(u)===1||Math.abs(v)===1)assert.equal(h,patch.base);
    }
    assert.ok(Math.max(...heights)-Math.min(...heights)>15,'massif retains meaningful relief');
    const left=atmosphere.massifHeight(-.37,.21,patch),right=atmosphere.massifHeight(.37,.21,patch);
    assert.notEqual(left,right,'a massif is not a repeated symmetric cone');
  }
});

test('cloud presets retain the same lower/middle/horizon composition with bounded translucent banks',()=>{
  const original=Math.random;Math.random=()=>{throw new Error('clouds consumed gameplay RNG');};
  try{
    const low=atmosphere.atmosphereCloudLayout('low');
    for(const [quality,count] of [['low',24],['balanced',32],['high',40]]){
      const clouds=atmosphere.atmosphereCloudLayout(quality);
      assert.equal(clouds.length,count);assert.deepEqual(clouds.slice(0,24),low);
      assert.deepEqual(clouds,atmosphere.atmosphereCloudLayout(quality));
      clouds.forEach(({position:[x,y,z],size:[width,height],variant,opacity,layer})=>{
        assert.ok(Math.hypot(x,z)-Math.hypot(width,height)/2>15,'impostor footprint clears the board column');
        assert.ok(y+height/2<(layer===3?12:-15),'near banks stay below the playable board');
        assert.ok(width<73&&height<34&&opacity>0&&opacity<.7);
        assert.ok(Number.isInteger(variant)&&variant>=0&&variant<8);
      });
    }
  }finally{Math.random=original;}
});
