import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const label=process.argv[2]||'after',selected=process.argv[3]?.split(',');
assert.ok(['before','after','checkpoint'].includes(label));
const root='docs/premium-central-city/evidence',out=`${root}/${label}`;
const origin=`http://127.0.0.1:${label==='before'?4189:4190}`;
const cases=[
  {name:'overview-medium',quality:'balanced'},
  {name:'overview-high',quality:'high',size:[1920,1080]},
  {name:'front',quality:'high',position:[10,18,27],target:[0,1,0]},
  {name:'rear',quality:'high',position:[-8,20,-29],target:[0,1,0]},
  {name:'castle-front',quality:'high',position:[0,11,17],target:[0,3,-2],detail:true},
  {name:'castle-rear',quality:'high',position:[8,10,-19],target:[0,3,-3],detail:true},
  {name:'fountain-plaza',quality:'high',position:[7,9,16],target:[0,1.2,2.8],detail:true},
  {name:'garden-buildings',quality:'high',position:[-13,8,13],target:[-2.4,1.1,1.9],detail:true},
  {name:'east',quality:'balanced',position:[31,25,0],target:[0,.7,0]},
  {name:'top',quality:'balanced',position:[0,48,2],target:[0,.7,0]},
  {name:'portrait-low',quality:'low',size:[390,844],mobile:true},
  {name:'landscape-medium',quality:'balanced',size:[844,390],mobile:true},
];
await mkdir(out,{recursive:true});
const prior=label==='after'?JSON.parse(await readFile(`${root}/before/views.json`,'utf8')):null;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
try{
  for(const c of cases.filter(c=>!selected||selected.includes(c.name))){
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const [width,height]=c.size||[1440,900];
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:!!c.mobile,hasTouch:!!c.mobile});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.evaluateOnNewDocument(quality=>{
      localStorage.setItem('monopoly-graphics-quality',quality);
      let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    },c.quality);
    await page.goto(`${origin}/?graphicsAudit#solo`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__graphicsAudit&&window.__phase2Environment?.ready,{timeout:60000});
    if(label!=='before')await page.waitForFunction(()=>window.__centralCityAudit?.ready,{timeout:60000});
    await pause(1600);
    if(c.position){await page.evaluate(c=>window.__graphicsAudit.camera(c.position,c.target),c);await pause(450);}
    const data=await page.evaluate(()=>({metadata:window.__graphicsAudit.metadata(),tiles:window.__graphicsAudit.tiles(),
      city:window.__centralCityAudit?.snapshot()||null,environment:window.__graphicsAudit.environment()}));
    assert.deepEqual(errors,[]);assert.equal(data.environment.fallbacks,0);
    assert.equal(data.tiles.length,40);
    if(!c.position)for(const tile of data.tiles){assert.equal(tile.pickableTileId,tile.id);assert.equal(tile.occludedByCity,false);assert.equal(tile.occludedByEnvironment,false);}
    if(prior){const old=prior.find(item=>item.name===c.name);assert.ok(old);assert.deepEqual(data.metadata.camera,old.metadata.camera);assert.deepEqual(data.metadata.viewport,old.metadata.viewport);assert.equal(data.metadata.dpr,old.metadata.dpr);}
    await page.screenshot({path:`${out}/${c.name}.png`});
    results.push({name:c.name,quality:c.quality,detail:!!c.detail,errors,...data});
    console.log(`${label} ${c.name}: loaded, no rendering errors`);
    await page.close();
  }
  let merged=results;
  if(selected){try{const old=JSON.parse(await readFile(`${out}/views.json`,'utf8'));const map=new Map(old.map(v=>[v.name,v]));results.forEach(v=>map.set(v.name,v));merged=[...map.values()];}catch(e){if(e.code!=='ENOENT')throw e;}}
  await writeFile(`${out}/views.json`,JSON.stringify(merged,null,2));
}finally{await browser.close();}
