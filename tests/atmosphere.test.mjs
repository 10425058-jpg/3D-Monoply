import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const transpile = filename => ts.transpileModule(readFileSync(new URL(filename,import.meta.url),'utf8'), {
  compilerOptions: {target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext},
}).outputText;
const asModule = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const layoutUrl = asModule(transpile('../src/components/environment/environmentLayout.ts'));
const source = transpile('../src/components/environment/atmosphereLayout.ts')
  .replace("'./environmentLayout'",JSON.stringify(layoutUrl));
const atmosphere = await import(asModule(source));
const cloudSource=transpile('../src/components/environment/cloudAtlas.ts')
  .replace("'three'",JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href))
  .replace("'./environmentLayout'",JSON.stringify(layoutUrl));
const {createCloudAtlas}=await import(asModule(cloudSource));

test('generated cloud pixels have soft alpha and no cyan byte-overflow flecks',()=>{
  const texture=createCloudAtlas('balanced'),pixels=texture.image.data;
  let transparent=0,soft=0,solid=0;
  for(let i=0;i<pixels.length;i+=4) {
    const [r,g,b,a]=pixels.subarray(i,i+4);
    if(!a)transparent++;
    else if(a<128)soft++;
    else {
      solid++;
      assert.equal(g>r+30&&b>r+30,false,'bright cloud highlights cannot wrap their red byte to cyan');
    }
  }
  assert.ok(transparent>1000&&soft>100&&solid>1000,'atlas includes empty sky, feathered silhouettes and billow bodies');
  texture.dispose();
});

test('mountain ridges close without a seam, remain distant and have four atmospheric depths', () => {
  assert.equal(atmosphere.MOUNTAIN_LAYERS.length,4);
  for (let layer=0;layer<4;layer++) {
    const profile=atmosphere.MOUNTAIN_LAYERS[layer];
    assert.ok(profile.radius>=110);
    assert.ok(Math.abs(atmosphere.mountainHeight(0,layer)-atmosphere.mountainHeight(Math.PI*2,layer))<1e-8);
    const heights=Array.from({length:180},(_,index)=>atmosphere.mountainHeight(index/180*Math.PI*2,layer));
    assert.ok(heights.every(height=>Number.isFinite(height)&&height < -35));
    assert.ok(Math.max(...heights)-Math.min(...heights)>8,'silhouette has meaningful, bounded peak variation');
    if(layer) {
      assert.ok(profile.radius < atmosphere.MOUNTAIN_LAYERS[layer-1].radius);
      assert.ok(profile.opacity > atmosphere.MOUNTAIN_LAYERS[layer-1].opacity);
    }
  }
});

test('new cloud banks are deterministic, bounded and leave the under-board column empty', () => {
  const original=Math.random;
  Math.random=()=>{throw new Error('clouds consumed gameplay random stream');};
  try {
    for (const [quality,count] of [['low',28],['balanced',44],['high',60]]) {
      const clouds=atmosphere.atmosphereCloudLayout(quality);
      assert.equal(clouds.length,count);
      assert.deepEqual(clouds,atmosphere.atmosphereCloudLayout(quality));
      clouds.forEach(({position:[x,y,z],size:[width,height]})=>{
        assert.ok(Math.hypot(x,z)-Math.hypot(width,height)/2>25,'cloud footprint must clear the board column');
        assert.ok(y+height/2 < (Math.hypot(x,z)>130?12:-18),'higher clouds remain at a distant sky depth');
        assert.ok(width<61&&height<40,'cloud bank dimensions remain bounded');
      });
    }
  } finally { Math.random=original; }
});
