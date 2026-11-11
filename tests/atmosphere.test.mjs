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
    for (const [quality,count] of [['low',20],['balanced',32],['high',44]]) {
      const clouds=atmosphere.atmosphereCloudLayout(quality);
      assert.equal(clouds.length,count);
      assert.deepEqual(clouds,atmosphere.atmosphereCloudLayout(quality));
      clouds.forEach(({position:[x,y,z],size:[width,height]})=>{
        assert.ok(Math.hypot(x,z)-width/2>30,'cloud footprint must not fill the board column');
        assert.ok(y+height/2 < -38,'cloud tops stay behind and below the board');
        assert.ok(width<45&&height<14,'no enormous foreground bank');
      });
    }
  } finally { Math.random=original; }
});
