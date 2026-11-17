import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'after',root='docs/board-rules-v5/evidence',out=`${root}/${label}`;
assert.ok(['before','after'].includes(label));await mkdir(out,{recursive:true});
const origin=`http://127.0.0.1:${label==='before'?4192:4193}`,pause=ms=>new Promise(r=>setTimeout(r,ms));
const cases=[{name:'overview',quality:'balanced'},{name:'top',quality:'high',top:true},
  {name:'south-labels',quality:'high',pose:[0,25,24],target:[0,.5,9.55]},
  {name:'west-labels',quality:'high',pose:[-25,25,0],target:[-9.55,.5,0]},
  {name:'north-labels',quality:'high',pose:[0,25,-24],target:[0,.5,-9.55]},
  {name:'east-labels',quality:'high',pose:[25,25,0],target:[9.55,.5,0]},
  {name:'phone',quality:'low',size:[390,844]}];
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],before=label==='after'?JSON.parse(await readFile(`${root}/before/views.json`,'utf8')):[];
try{for(const c of cases){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const [width,height]=c.size||[1440,900];await page.setViewport({width,height,deviceScaleFactor:1});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(q=>{localStorage.setItem('monopoly-graphics-quality',q);let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},c.quality);
  await page.goto(`${origin}/?graphicsAudit#solo`);await page.waitForFunction(()=>window.__graphicsAudit&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready,{timeout:90000});await pause(1600);
  if(c.top){await page.click('button[title="Switch to Top-Down View"]');await pause(500);}
  if(c.pose){await page.evaluate(c=>window.__graphicsAudit.camera(c.pose,c.target),c);await pause(500);}
  const data=await page.evaluate(()=>({metadata:window.__graphicsAudit.metadata(),tiles:window.__graphicsAudit.tiles()}));
  assert.deepEqual(errors,[]);if(!c.pose)data.tiles.forEach(t=>{assert.equal(t.pickableTileId,t.id);assert.equal(t.occludedByCity,false);assert.equal(t.occludedByEnvironment,false);});
  if(label==='after'){const old=before.find(v=>v.name===c.name);assert.deepEqual(data.metadata.camera,old.metadata.camera);assert.equal(data.metadata.dpr,old.metadata.dpr);}
  await page.screenshot({path:`${out}/${c.name}.png`});results.push({name:c.name,quality:c.quality,errors,...data});await page.close();console.log(`${label}: ${c.name}`);
}await writeFile(`${out}/views.json`,JSON.stringify(results,null,2));}finally{await browser.close();}
