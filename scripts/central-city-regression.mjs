import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const origin='http://127.0.0.1:4190',out='docs/premium-central-city/evidence/regression';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
async function pageFor(quality='low',motion='reduce'){
  const page=await browser.newPage();await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:motion}]);
  await page.evaluateOnNewDocument(q=>{localStorage.setItem('monopoly-graphics-quality',q);let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},quality);
  return page;
}
async function ready(page){await page.waitForFunction(()=>window.__graphicsAudit&&window.__phase2Environment?.ready&&window.__centralCityAudit?.ready,{timeout:60000});await pause(600);}
const results={levels:[],contexts:[],mounts:[]};
try{
  for(const quality of ['low','balanced','high']){
    const page=await pageFor(quality),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${origin}/?graphicsAudit#solo`);await ready(page);
    const game=await page.evaluate(()=>window.__graphicsAudit.game());let previous=0;
    for(let level=1;level<=5;level++){
      await page.evaluate(l=>window.__centralCityAudit.previewLevel(l),level);
      await page.waitForFunction(l=>window.__centralCityAudit.snapshot().level===l,{},level);await pause(180);
      const state=await page.evaluate(()=>({city:window.__centralCityAudit.snapshot(),tiles:window.__graphicsAudit.tiles(),game:window.__graphicsAudit.game()}));
      assert.ok(state.city.triangles>previous);previous=state.city.triangles;
      assert.equal(state.city.lights,0);assert.ok(state.city.meshes<=40);
      state.tiles.forEach(tile=>{assert.equal(tile.pickableTileId,tile.id);assert.equal(tile.occludedByCity,false,`${quality} level${level}: city hides tile${tile.id}`);assert.equal(tile.occludedByEnvironment,false);});
      assert.deepEqual(state.game,game,'visual progression never writes authoritative gameplay');
      results.levels.push({quality,level,city:state.city,clearTiles:40});
    }
    await page.screenshot({path:`${out}/level-five-${quality}.png`});
    if(quality==='high'){
      await page.evaluate(()=>window.__graphicsAudit.camera([-8,20,-29],[0,1,0]));await pause(300);
      await page.screenshot({path:`${out}/level-five-rear.png`});
      await page.evaluate(()=>window.__graphicsAudit.camera([0,49.96679067741256,19.153921663717956],[0,.7,0]));await pause(300);
    }
    await page.evaluate(()=>window.__centralCityAudit.previewLevel(null));await pause(250);
    // Context recovery must restore the city's actual atlas and shadowed model.
    const before=`${out}/context-${quality}-before.png`,after=`${out}/context-${quality}-after.png`;
    await page.screenshot({path:before});
    await page.evaluate(()=>{
      const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');
      if(!ext)throw new Error('Context-loss extension unavailable');
      window.__cityContext={lost:false,restored:false};
      canvas.addEventListener('webglcontextlost',()=>window.__cityContext.lost=true,{once:true});
      canvas.addEventListener('webglcontextrestored',()=>window.__cityContext.restored=true,{once:true});
      window.__restoreCity=()=>ext.restoreContext();ext.loseContext();
    });
    await page.waitForFunction(()=>window.__cityContext.lost);await pause(250);await page.evaluate(()=>window.__restoreCity());
    await page.waitForFunction(()=>window.__cityContext.restored,{timeout:30000});await pause(1800);await page.screenshot({path:after});
    const pixels=JSON.parse(execFileSync(process.env.PYTHON||'python',['tools/compare_board_capture.py',before,after,'--rect','550','250','430','440','--output',`${out}/context-${quality}.json`],{encoding:'utf8'}));
    assert.ok(pixels.meanAbsoluteChannelDelta<.5,'restored central atlas/model must visually match within sub-byte mean tolerance');
    assert.deepEqual(errors,[]);
    results.contexts.push({quality,errors,pixels});await page.close();
  }
  const motion=await pageFor('low','no-preference');await motion.goto(`${origin}/?graphicsAudit#solo`);await ready(motion);
  const times=()=>motion.evaluate(()=>window.__centralCityAudit.snapshot().motion);
  const movingA=await times();await pause(350);const movingB=await times();
  for(const key of Object.keys(movingA))assert.ok(movingB[key]>movingA[key],`${key} animates`);
  await motion.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await pause(100);const reducedA=await times();await pause(300);assert.deepEqual(await times(),reducedA);
  await motion.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);await pause(150);
  await motion.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await pause(100);const hiddenA=await times();await pause(300);assert.deepEqual(await times(),hiddenA);
  results.motion={normal:true,liveReducedMotion:true,hiddenTab:true,movingA,movingB};await motion.close();
  const page=await pageFor(),responses=[];await page.setCacheEnabled(false);
  page.on('response',r=>{if(r.url().includes('/models/central-city/'))responses.push({url:r.url(),status:r.status()});});
  await page.goto(`${origin}/?graphicsAudit#solo`);
  for(let i=0;i<4;i++){
    await ready(page);const snapshot=await page.evaluate(()=>({city:window.__centralCityAudit.snapshot(),metadata:window.__graphicsAudit.metadata(),canvases:document.querySelectorAll('canvas').length}));
    assert.equal(snapshot.canvases,1);
    if(i){assert.deepEqual(snapshot.metadata.memory,results.mounts[0].metadata.memory);assert.deepEqual(snapshot.metadata.allocationEstimates,results.mounts[0].metadata.allocationEstimates);}
    results.mounts.push(snapshot);await page.evaluate(()=>location.hash='home');
    await page.waitForFunction(()=>!document.querySelector('canvas')&&!window.__centralCityAudit);
    if(i<3)await page.evaluate(()=>location.hash='solo');
  }
  assert.equal(responses.length,1);assert.equal(responses[0].status,200);results.assetCache=responses;await page.close();
  const broken=await pageFor(),warnings=[],faultErrors=[];await broken.setCacheEnabled(false);await broken.setRequestInterception(true);
  broken.on('request',r=>r.url().includes('/central-royal-district-low.glb')?r.abort('failed'):r.continue());
  broken.on('console',m=>{if(m.type()==='warn')warnings.push(m.text());});broken.on('pageerror',e=>faultErrors.push(e.message));
  await broken.goto(`${origin}/?graphicsAudit#solo`);
  await broken.waitForFunction(()=>window.__graphicsAudit&&window.__phase2Environment?.ready);await pause(1200);
  assert.ok(warnings.some(m=>m.includes('[Central city] district asset unavailable')));assert.deepEqual(faultErrors,[]);
  const tiles=await broken.evaluate(()=>window.__graphicsAudit.tiles());tiles.forEach(t=>{assert.equal(t.pickableTileId,t.id);assert.equal(t.occludedByCity,false);});
  const tile=tiles.find(t=>t.id===1);await broken.mouse.click(tile.x,tile.y);await broken.waitForFunction(()=>window.__graphicsAudit.game().selectedSpaceId===1);
  await broken.screenshot({path:`${out}/existing-city-asset-fallback.png`});results.fallback={warnings,errors:faultErrors,clearTiles:40,pointerSelection:true};await broken.close();
  const nested=await pageFor();await nested.goto('http://127.0.0.1:4191/3D-Monoply/?graphicsAudit#solo');await ready(nested);
  const nestedUrl=await nested.evaluate(()=>window.__centralCityAudit.url);assert.ok(nestedUrl.startsWith('http://127.0.0.1:4191/3D-Monoply/assets/models/central-city/'));
  results.prefix={url:nestedUrl,loaded:true};await nested.close();
  const ordinary=await pageFor();await ordinary.goto(`${origin}/#solo`);await pause(2500);
  assert.equal(await ordinary.evaluate(()=>!!window.__centralCityAudit||!!window.__graphicsAudit||!!window.__phase2Environment),false);await ordinary.close();
  await writeFile(`${out}/central-city.json`,JSON.stringify({passed:true,...results},null,2));
  console.log('Passed five visual levels at all tiers, context recovery, motion, four mounts, asset fallback, prefix and audit isolation.');
}finally{await browser.close();}
