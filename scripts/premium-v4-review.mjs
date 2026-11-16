import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const label=process.argv[2]||'after';
assert.ok(['before','after','checkpoint'].includes(label));
const origin=process.env.AUDIT_URL||`http://127.0.0.1:${label==='before'?4186:4187}`;
const root='docs/premium-environment-v4/evidence',out=`${root}/${label}`;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Diagnostic detail targets only expose the existing world for QA. They do
// not alter the production camera controls or become gameplay presets.
const scenarios=[
  {name:'supplied-gameplay',title:'Attached current gameplay framing / High',quality:'high',size:[2560,1468],position:[4.5,39,70]},
  {name:'reference-balanced',title:'Supplied gameplay angle / Medium',quality:'balanced',size:[1440,900],position:[4.5,27,40]},
  {name:'reference-high',title:'Supplied gameplay angle / High',quality:'high',size:[1920,1080],position:[4.5,27,40]},
  {name:'wide-balanced',title:'Whole world / Medium',quality:'balanced',size:[1440,900],position:[28,45,60]},
  {name:'wide-high',title:'Whole world / High',quality:'high',size:[1440,900],position:[28,45,60]},
  {name:'overview-balanced',title:'Default overview / Medium',quality:'balanced',size:[1440,900]},
  {name:'overview-high',title:'Default overview / High',quality:'high',size:[1440,900]},
  {name:'east',title:'East orbit',quality:'balanced',size:[1440,900],position:[45,30,-22]},
  {name:'reverse',title:'Reverse orbit',quality:'balanced',size:[1440,900],position:[-10,32,-48]},
  {name:'west',title:'West orbit',quality:'balanced',size:[1440,900],position:[-47,30,14]},
  {name:'coverage-135',title:'135° steep orbit',quality:'balanced',size:[1440,900],position:[13.467726321605838,46.93030062040102,-13.467726321605838]},
  {name:'coverage-225',title:'225° steep orbit',quality:'balanced',size:[1440,900],position:[-13.467726321605838,46.93030062040102,-13.467726321605838]},
  {name:'portrait',title:'Phone portrait / Low',quality:'low',size:[390,844],mobile:true},
  {name:'landscape',title:'Phone landscape / Medium',quality:'balanced',size:[844,390],mobile:true},
  {name:'hero-left-detail',title:'Castle island, terrain and vegetation / High',quality:'high',size:[1440,900],position:[-23,-6,13],target:[-29,-25,-20],detail:true},
  {name:'hero-right-detail',title:'Palace materials and gardens / High',quality:'high',size:[1440,900],position:[46,-3,13],target:[28,-24,-20],detail:true},
  {name:'waterfall-detail',title:'Waterfall sheets, cliff source and mist / High',quality:'high',size:[1440,900],position:[-7,-10,9],target:[-30,-30,-18],detail:true},
];
const selected=(process.env.REVIEW_VIEWS||process.argv[3])?.split(',');
if(selected)assert.ok(selected.every(name=>scenarios.some(s=>s.name===name)),'unknown review view');
await mkdir(out,{recursive:true});
const before=label==='after'?JSON.parse(await readFile(`${root}/before/views.json`,'utf8')):null;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try{
  for(const scenario of scenarios.filter(s=>!selected||selected.includes(s.name))){
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.setViewport({width:scenario.size[0],height:scenario.size[1],deviceScaleFactor:1,isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.evaluateOnNewDocument(quality=>{
      localStorage.setItem('monopoly-graphics-quality',quality);
      let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    },scenario.quality);
    const started=Date.now();
    await page.goto(`${origin}/?graphicsAudit#solo`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__graphicsAudit&&window.__phase2Environment?.ready,{timeout:60000});
    const readyMs=Date.now()-started;
    await pause(1500);
    if(scenario.position){
      await page.evaluate(({position,target})=>window.__graphicsAudit.camera(position,target),{position:scenario.position,target:scenario.target||[0,.7,0]});
      await pause(450);
    }
    const state=await page.evaluate(()=>({metadata:window.__graphicsAudit.metadata(),tiles:window.__graphicsAudit.tiles(),environment:window.__graphicsAudit.environment()}));
    assert.equal(state.tiles.length,40);
    if(!scenario.detail)assert.ok(state.tiles.every(tile=>!tile.occludedByEnvironment),`${scenario.name}: scenery obscures tiles`);
    assert.equal(state.environment.shadowCasters,0);assert.equal(state.environment.fallbacks,0);
    if(!scenario.position)for(const tile of state.tiles){
      assert.equal(tile.pickableTileId,tile.id);assert.equal(tile.occludedByCity,false);
      assert.ok(tile.x>0&&tile.x<scenario.size[0]&&tile.y>0&&tile.y<scenario.size[1]&&Math.abs(tile.depth)<1);
    }
    if(before){
      const original=before.find(s=>s.name===scenario.name);assert.ok(original,`${scenario.name}: missing baseline capture`);
      assert.deepEqual(state.metadata.camera,original.metadata.camera);
      assert.deepEqual(state.metadata.viewport,original.metadata.viewport);assert.equal(state.metadata.dpr,original.metadata.dpr);
    }
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/${scenario.name}.png`});
    results.push({name:scenario.name,title:scenario.title,quality:scenario.quality,diagnosticDetail:!!scenario.detail,readyMs,errors,...state});
    console.log(`${label} ${scenario.name}: ${scenario.detail?'scenery detail; no fallbacks/errors':'40 tile rays clear'}`);
    await page.close();
  }
  if(selected){
    try{
      const previous=JSON.parse(await readFile(`${out}/views.json`,'utf8'));
      const merged=new Map(previous.map(item=>[item.name,item]));results.forEach(item=>merged.set(item.name,item));
      await writeFile(`${out}/views.json`,JSON.stringify([...merged.values()],null,2));
    }catch(error){if(error.code!=='ENOENT')throw error;await writeFile(`${out}/views.json`,JSON.stringify(results,null,2));}
  }else await writeFile(`${out}/views.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}
