import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const out = process.env.ENVIRONMENT_REGRESSION_OUT || 'docs/phase2-world/evidence/regression';
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
try {
  await mkdir(out,{recursive:true});
  const page = await browser.newPage();
  page.on('pageerror',error => errors.push(error.message));
  page.on('console',message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality','low'));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.goto(`${origin}/?graphicsAudit`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => !!window.__graphicsAudit && window.__phase2Environment?.ready);
  await pause(500);
  const snapshot = () => page.evaluate(() => window.__graphicsAudit.environment());
  const first = await snapshot(); await pause(500); const moving = await snapshot();
  assert.equal(moving.oldValleyPresent,false);
  assert.equal(moving.oldKingdomPresent,false);
  assert.equal(moving.shadowCasters,0);
  assert.equal(Object.keys(moving.waterfalls).length,2);
  // Low now includes one existing simplified distant island for depth. The
  // complete environment, including water and airship, still has a hard cap.
  assert.ok(moving.triangles < 36000,'low environment geometry budget');
  assert.notDeepEqual(moving.airship,first.airship,'airship advances');
  assert.ok(moving.waterfalls['waterfall-left'] > first.waterfalls['waterfall-left'],'water advances');

  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await pause(200); const reduced = await snapshot(); await pause(500);
  assert.deepEqual(await snapshot(),reduced,'live reduced motion freezes water and airship');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await pause(500); const resumed = await snapshot();
  assert.ok(resumed.waterfalls['waterfall-left'] > reduced.waterfalls['waterfall-left'],'motion resumes');
  // Exercise visibilitychange plus the live document.hidden guard while still
  // allowing the test page to be inspected; no production property is changed.
  await page.evaluate(() => {
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pause(200); const hidden = await snapshot(); await pause(500);
  assert.deepEqual(await snapshot(),hidden,'hidden document freezes motion');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await pause(500);
  assert.ok((await snapshot()).waterfalls['waterfall-left'] > hidden.waterfalls['waterfall-left']);

  await page.goto(origin,{waitUntil:'domcontentloaded'}); await pause(1500);
  assert.equal(await page.evaluate(() => '__graphicsAudit' in window || '__phase2Environment' in window),false,'ordinary play has no audit globals');
  assert.deepEqual(errors,[]);
  const result = {passed:true,oldTerrainRemoved:true,zeroEnvironmentShadowCasters:true,
    normalMotion:true,liveReducedMotion:true,liveVisibility:true,noProductionAuditGlobals:true,
    lowEnvironmentTriangles:moving.triangles,errors};
  await writeFile(`${out}/environment-motion.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
