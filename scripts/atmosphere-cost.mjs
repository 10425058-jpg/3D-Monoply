import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Diagnostic only: isolate the existing atmosphere passes on a production build.
// Keep a separate label so this never replaces matched before/after evidence.
const label = process.argv[2] || 'cost-isolation';
const origin = process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const out = `docs/fantasy-polish/evidence/${label}`;
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('console',message => {if(message.type()==='error')errors.push(message.text());});
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('monopoly-graphics-quality','balanced');
    let seed=10425058; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  });
  await page.goto(`${origin}/?graphicsAudit#solo`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__graphicsAudit && window.__phase2Environment?.ready);
  await pause(4000);
  await page.evaluate(()=>window.__graphicsAudit.camera([4.5,27,40],[0,.7,0]));
  await pause(1000);
  const results=[];
  for(const [scenario,clouds,mountains] of [['all-visible',true,true],['clouds-off',false,true],['mountains-off',true,false],['both-off',false,false]]) {
    const toggled=await page.evaluate(({clouds,mountains})=>[
      window.__graphicsAudit.environmentLayer('kingdom-cloud-layers',clouds),
      window.__graphicsAudit.environmentLayer('mountain-ranges',mountains)
    ],{clouds,mountains});
    assert.deepEqual(toggled,[true,true]);
    await pause(350);
    await page.evaluate(()=>window.__graphicsAudit.start());
    await pause(3000);
    const measurement=await page.evaluate(()=>window.__graphicsAudit.stop());
    const p50=key=>{const values=measurement.samples.map(sample=>sample[key]).filter(value=>value!==null).sort((a,b)=>a-b);return values[Math.floor(values.length*.5)]??null;};
    const result={scenario,fps:1000/(measurement.samples.reduce((n,s)=>n+s.frameMs,0)/measurement.samples.length),gpuP50:p50('gpuMs'),renderCpuP50:p50('renderCpuMs'),calls:p50('calls'),triangles:p50('triangles'),samples:measurement.samples.length};
    results.push(result); console.log(JSON.stringify(result));
  }
  assert.deepEqual(errors,[]);
  await mkdir(out,{recursive:true});
  await writeFile(`${out}/cost-isolation.json`,JSON.stringify({viewport:[1440,900],quality:'balanced',camera:[4.5,27,40],sampleMs:3000,results,errors},null,2));
} finally {await browser.close();}
