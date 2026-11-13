import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const label = process.argv[2] || 'after';
assert.ok(['before','after'].includes(label));
const origin = process.env.AUDIT_URL || `http://127.0.0.1:${label === 'before' ? 4176 : 4175}`;
const out = `docs/premium-fantasy-world/evidence/${label}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const scenarios = [
  { name:'balanced-wide', quality:'balanced', size:[1440,900], position:[28,45,60], target:[0,.7,0] },
  { name:'balanced-orbit', quality:'balanced', size:[1440,900], position:[45,30,-22], target:[0,.7,0] },
  { name:'balanced-reverse', quality:'balanced', size:[1440,900], position:[-10,32,-48], target:[0,.7,0] },
  { name:'balanced-close', quality:'balanced', size:[1440,900], position:[0,21,23], target:[0,.7,0] },
  { name:'balanced-laptop', quality:'balanced', size:[1366,768] },
  { name:'high-desktop', quality:'high', size:[1920,1080] },
  { name:'low-portrait', quality:'low', size:[390,844], mobile:true },
  { name:'balanced-landscape', quality:'balanced', size:[844,390], mobile:true },
];
await mkdir(out,{recursive:true});
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results = [];
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewport({width:scenario.size[0],height:scenario.size[1],deviceScaleFactor:1,isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.evaluateOnNewDocument(quality => {
      localStorage.setItem('monopoly-graphics-quality',quality);
      let seed=10425058; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    },scenario.quality);
    const started = Date.now();
    await page.goto(`${origin}/?graphicsAudit#solo`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__graphicsAudit && window.__phase2Environment?.ready,{timeout:60000});
    const readyMs = Date.now()-started;
    await pause(1200);
    if (scenario.position) {
      await page.evaluate(({position,target})=>window.__graphicsAudit.camera(position,target),scenario);
      await pause(250);
    }
    const state = await page.evaluate(()=>({metadata:window.__graphicsAudit.metadata(),tiles:window.__graphicsAudit.tiles(),
      environment:window.__graphicsAudit.environment(),
      assets:performance.getEntriesByType('resource').filter(entry=>entry.name.endsWith('.glb')).map(entry=>({url:new URL(entry.name).pathname,duration:entry.duration,transferSize:entry.transferSize})),
    }));
    assert.equal(state.tiles.length,40);
    assert.ok(state.tiles.every(tile=>!tile.occludedByEnvironment),`${scenario.name} environment occlusion`);
    if (!scenario.position) {
      state.tiles.forEach(tile=>{
        assert.equal(tile.pickableTileId,tile.id,`${scenario.name} tile ${tile.id}`);
        assert.equal(tile.occludedByCity,false);
        assert.ok(tile.x>0 && tile.x<scenario.size[0] && tile.y>0 && tile.y<scenario.size[1] && tile.depth>-1 && tile.depth<1);
      });
    }
    if (label === 'after') {
      assert.equal(state.environment.fallbacks,0);
      assert.equal(state.environment.landmarks.length,3);
      const distance=Math.hypot(...state.metadata.camera.position);
      assert.ok(state.metadata.fogRange[0]>distance-18,'board stays clear of opaque fog');
      assert.ok(state.metadata.fogRange[1]>distance+50,'fog ends beyond the playable board');
      assert.ok(state.metadata.clipping[1]>distance+100,'distant view retains background geometry');
      const before = JSON.parse(await readFile('docs/premium-fantasy-world/evidence/before/views.json','utf8')).find(item=>item.name===scenario.name);
      assert.deepEqual(state.metadata.camera,before.metadata.camera);
      assert.deepEqual(state.metadata.viewport,before.metadata.viewport);
      assert.equal(state.metadata.dpr,before.metadata.dpr);
    }
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/${scenario.name}.png`});
    results.push({name:scenario.name,readyMs,errors,...state});
    console.log(`${label}: ${scenario.name}, 40 tile rays clear, ready ${readyMs}ms`);
    await page.close();
  }
  await writeFile(`${out}/views.json`,JSON.stringify(results,null,2));
} finally { await browser.close(); }
