import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const origin = process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const out = process.env.ENVIRONMENT_REGRESSION_OUT || 'docs/fantasy-polish/evidence/regression';
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results = [];
try {
  await mkdir(out,{recursive:true});
  for (const quality of ['low','balanced','high']) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('console',message => {if(message.type()==='error')errors.push(message.text());});
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.evaluateOnNewDocument(tier => {
      localStorage.setItem('monopoly-graphics-quality',tier);
      let seed=10425058; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    },quality);
    await page.goto(`${origin}/?graphicsAudit`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__graphicsAudit && window.__phase2Environment?.ready);
    await pause(2500);
    const before = `${out}/context-${quality}-before.png`, after = `${out}/context-${quality}-after.png`;
    await page.screenshot({path:before});
    const metadata = await page.evaluate(()=>window.__graphicsAudit.metadata());
    assert.ok(metadata.materialTextures.some(texture => texture.name.startsWith('Sunset atmosphere ')),'baked sky texture is mounted');
    const supported = await page.evaluate(()=>{
      const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
      const extension=gl.getExtension('WEBGL_lose_context');
      if(!extension)return false;
      window.__contextTest={lost:false,restored:false};
      canvas.addEventListener('webglcontextlost',()=>{window.__contextTest.lost=true;},{once:true});
      canvas.addEventListener('webglcontextrestored',()=>{window.__contextTest.restored=true;},{once:true});
      window.__restoreContext=()=>extension.restoreContext();
      extension.loseContext();
      return true;
    });
    assert.equal(supported,true,'installed browser must expose context-loss testing');
    await page.waitForFunction(()=>window.__contextTest.lost);
    await pause(250);
    await page.evaluate(()=>window.__restoreContext());
    await page.waitForFunction(()=>window.__contextTest.restored,{timeout:30000});
    await pause(2000);
    await page.screenshot({path:after});
    assert.deepEqual(errors,[],'context restoration rendering errors');
    const comparison=JSON.parse(execFileSync(process.env.PYTHON||'python',[
      'tools/compare_board_capture.py',before,after,'--rect','450','15','380','65',
      '--output',`${out}/context-${quality}-sky.json`
    ],{encoding:'utf8'}));
    assert.equal(comparison.pixelIdentical,true,'static sky bake is restored byte-for-byte');
    results.push({quality,contextLost:true,contextRestored:true,skyPixelsIdentical:comparison.pixels,dpr:metadata.dpr,errors});
    await page.close();
  }
  await writeFile(`${out}/context-restore.json`,JSON.stringify({passed:true,results},null,2));
  console.log(JSON.stringify({passed:true,results}));
} finally {await browser.close();}
