import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin=process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const out='docs/premium-fantasy-world/evidence/regression';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage(),errors=[],cycles=[],modelResponses=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.url().endsWith('.glb'))modelResponses.push({url:response.url(),status:response.status()});});
  await page.setCacheEnabled(false);
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(()=>localStorage.setItem('monopoly-graphics-quality','low'));
  await page.goto(`${origin}/?graphicsAudit#solo`);
  for(let i=0;i<4;i++) {
    await page.waitForFunction(()=>!!window.__graphicsAudit && window.__phase2Environment?.ready);
    await pause(500);
    const state=await page.evaluate(()=>({environment:window.__graphicsAudit.environment(),metadata:window.__graphicsAudit.metadata(),
      canvases:document.querySelectorAll('canvas').length,assetUrls:window.__phase2Environment.assetUrls}));
    assert.equal(state.canvases,1);
    assert.equal(state.environment.fallbacks,0);
    assert.equal(state.environment.landmarks.length,3);
    assert.equal(Object.keys(state.environment.waterfalls).length,5);
    if(cycles.length) {
      assert.equal(state.environment.meshes,cycles[0].environment.meshes,'no duplicate environment instances');
      assert.deepEqual(state.metadata.allocationEstimates,cycles[0].metadata.allocationEstimates,'no growing live buffer allocations');
      assert.deepEqual(state.metadata.memory,cycles[0].metadata.memory,'renderer allocations remain bounded');
    }
    cycles.push(state);
    await page.evaluate(()=>{location.hash='home';});
    await page.waitForFunction(()=>!document.querySelector('canvas') && !window.__graphicsAudit && !window.__phase2Environment);
    if(i<3) await page.evaluate(()=>{location.hash='solo';});
  }
  assert.deepEqual(errors,[]);
  for(const url of cycles[0].assetUrls) {
    assert.equal(modelResponses.filter(response=>response.url===url).length,1,'one GLB download across all four mounts');
    assert.equal(modelResponses.find(response=>response.url===url)?.status,200);
  }
  await page.close();
  // Deliberately reject a real optional GLB URL. The rest of the real world,
  // the board and pointer selection must survive, with an explicit warning.
  const broken=await browser.newPage(),warnings=[],faultErrors=[];
  broken.on('pageerror',error=>faultErrors.push(error.message));
  broken.on('console',message=>{if(message.type()==='warn')warnings.push(message.text());});
  await broken.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await broken.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await broken.evaluateOnNewDocument(()=>localStorage.setItem('monopoly-graphics-quality','low'));
  await broken.setRequestInterception(true);
  broken.on('request',request=>request.url().includes('/sky-observatory-low.glb')?request.abort('failed'):request.continue());
  await broken.goto(`${origin}/?graphicsAudit#solo`);
  await broken.waitForFunction(()=>window.__graphicsAudit?.environment().fallbacks>0);
  await pause(1000);
  const fault=await broken.evaluate(()=>({tiles:window.__graphicsAudit.tiles(),environment:window.__graphicsAudit.environment()}));
  assert.ok(warnings.some(warning=>warning.includes('sky-observatory-low.glb') && warning.includes('fallback')));
  assert.deepEqual(faultErrors,[],'asset failure is contained by its R3F boundary');
  assert.equal(fault.environment.landmarks.length,2,'healthy ruin and village GLBs stay visible');
  fault.tiles.forEach(tile=>{assert.equal(tile.pickableTileId,tile.id);assert.equal(tile.occludedByEnvironment,false);});
  const tile=fault.tiles.find(tile=>tile.id===1);
  await broken.mouse.click(tile.x,tile.y);
  await broken.waitForFunction(()=>window.__graphicsAudit.game().selectedSpaceId===1);
  await broken.screenshot({path:`${out}/optional-asset-fallback.png`});
  await broken.close();
  let productionPrefix=null;
  if(process.env.PREFIX_URL) {
    const prefix=process.env.PREFIX_URL.replace(/\/$/,''),nested=await browser.newPage(),responses=[],prefixErrors=[];
    nested.on('response',response=>{if(response.url().endsWith('.glb'))responses.push({url:response.url(),status:response.status()});});
    nested.on('pageerror',error=>prefixErrors.push(error.message));
    await nested.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await nested.evaluateOnNewDocument(()=>localStorage.setItem('monopoly-graphics-quality','low'));
    await nested.goto(`${prefix}/?graphicsAudit#solo`);
    await nested.waitForFunction(()=>window.__phase2Environment?.ready);
    const assetUrls=await nested.evaluate(()=>window.__phase2Environment.assetUrls);
    assetUrls.forEach(url=>{
      assert.ok(url.startsWith(`${prefix}/assets/models/environment/`),'GLB respects deployment subdirectory');
      assert.equal(responses.find(response=>response.url===url)?.status,200);
    });
    assert.deepEqual(prefixErrors,[]);
    productionPrefix={url:prefix,assetUrls,responses,errors:prefixErrors};
    await nested.close();
  }
  const report={passed:true,mountCycles:cycles,modelResponses,missingOptionalAsset:{fallbackVisible:true,boardPointerSelection:true,warnings,faultErrors},productionPrefix};
  await writeFile(`${out}/resilience.json`,JSON.stringify(report,null,2));
  console.log('Four mount/unmount cycles and a failed optional GLB preserve board interaction.');
} finally {await browser.close();}
