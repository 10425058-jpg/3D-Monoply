import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
const label=process.argv[2]||'after';assert.ok(['before','after','checkpoint'].includes(label));
const origin=process.env.BACKGROUND_URL||`http://127.0.0.1:${label==='before'?4216:label==='checkpoint'?4217:4217}`;
const root='docs/final-background-overhaul/evidence',out=`${root}/${label}`;await mkdir(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const scenarios=[
  {name:'overview',quality:'balanced'},
  {name:'fantasy-world',quality:'high',size:[1920,1080],position:[4.5,27,40]},
  {name:'world-wide',quality:'balanced',position:[28,45,60]},
  {name:'island-left',quality:'high',position:[-23,-6,13],target:[-29,-25,-20],detail:true},
  {name:'island-right',quality:'high',position:[46,-3,13],target:[28,-24,-20],detail:true},
  {name:'waterfall',quality:'high',position:[-7,-10,9],target:[-30,-30,-18],detail:true},
  {name:'sky-depth',quality:'high',position:[4.5,20,55],target:[0,-12,-40],detail:true},
  {name:'phone',quality:'low',size:[390,844]},
  {name:'landscape',quality:'balanced',size:[844,390]},
];
const selected=process.env.BACKGROUND_VIEWS?.split(',');
if(process.env.BACKGROUND_QUALITY)scenarios.forEach(s=>{s.quality=process.env.BACKGROUND_QUALITY;});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-first-run','--no-default-browser-check']});
const views=[],performanceResults=[];
const before=label==='after'?JSON.parse(await readFile(`${root}/before/views.json`,'utf8')):null;
async function open(quality,size=[1440,900],motion='reduce'){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewport({width:size[0],height:size[1],deviceScaleFactor:1});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:motion}]);
  await page.evaluateOnNewDocument(q=>{localStorage.setItem('monopoly-graphics-quality',q);let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},quality);
  const started=Date.now();await page.goto(`${origin}/?graphicsAudit#solo`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__graphicsAudit&&window.__phase2Environment?.ready&&window.__centralCityAudit?.ready,{timeout:90000});await pause(1600);
  return {page,errors,readyMs:Date.now()-started};
}
function summary(samples){const percentile=(key,p)=>{const v=samples.map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.floor(v.length*p))]??null;};
  return {fps:1000/(samples.reduce((s,v)=>s+v.frameMs,0)/samples.length),frameP50:percentile('frameMs',.5),frameP95:percentile('frameMs',.95),frameP99:percentile('frameMs',.99),gpuP50:percentile('gpuMs',.5),cpuP50:percentile('renderCpuMs',.5),calls:percentile('calls',.5),triangles:percentile('triangles',.5),textures:percentile('textures',.5),geometries:percentile('geometries',.5),samples:samples.length};}
// OrbitControls can differ by a few floating-point ULPs after the same pose.
// Compare at sub-micrometre precision, well below a visible pixel.
const stablePose=value=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='number'?Math.round(item*1e8)/1e8:item));
try{
  for(const scenario of scenarios.filter(s=>!selected||selected.includes(s.name))){
    const {page,errors,readyMs}=await open(scenario.quality,scenario.size);
    if(scenario.position){await page.evaluate(s=>window.__graphicsAudit.camera(s.position,s.target||[0,.7,0]),scenario);await pause(500);}
    const data=await page.evaluate(()=>({metadata:window.__graphicsAudit.metadata(),tiles:window.__graphicsAudit.tiles(),environment:window.__graphicsAudit.environment()}));
    if(!scenario.detail){data.tiles.forEach(t=>assert.equal(t.occludedByEnvironment,false,`${scenario.name}: tile ${t.id}`));if(!scenario.position)data.tiles.forEach(t=>{assert.equal(t.pickableTileId,t.id);assert.equal(t.occludedByCity,false);});}
    assert.equal(data.environment.fallbacks,0);assert.equal(data.environment.shadowCasters,0);assert.deepEqual(errors,[]);
    if(before){const old=before.find(s=>s.name===scenario.name);assert.deepEqual(stablePose(data.metadata.camera),stablePose(old.metadata.camera));assert.deepEqual(data.metadata.viewport,old.metadata.viewport);assert.equal(data.metadata.dpr,old.metadata.dpr);}
    await page.screenshot({path:`${out}/${scenario.name}.png`});views.push({...scenario,readyMs,errors,...data});await page.close();console.log(`${label}: ${scenario.name}`);
  }
  await writeFile(`${out}/views.json`,JSON.stringify(views)+'\n');
  if(!selected&&label!=='checkpoint'&&!process.argv.includes('--screenshots-only'))for(const quality of ['low','balanced','high']){
    const {page,errors,readyMs}=await open(quality,[1440,900],'no-preference');await pause(2000);
    await page.evaluate(()=>window.__graphicsAudit.start());await pause(6000);const data=await page.evaluate(()=>window.__graphicsAudit.stop());
    const metrics=await page.metrics();assert.deepEqual(errors,[]);const result={quality,readyMs,summary:summary(data.samples),metrics,errors,...data};performanceResults.push(result);
    console.log(JSON.stringify({label,quality,...result.summary}));await page.close();
  }
  if(performanceResults.length){const dir=label==='before'?'.final-baseline-dist/assets':'dist/assets',bundles=[];for(const name of await readdir(dir))if(/\.(js|css)$/.test(name))bundles.push({name,bytes:(await stat(`${dir}/${name}`)).size});await writeFile(`${out}/performance.json`,JSON.stringify({conditions:{seed:10425058,viewport:[1440,900],dpr:1,motion:'normal',sampleMs:6000,node:process.version},bundles,results:performanceResults})+'\n');}
}finally{await browser.close();}
