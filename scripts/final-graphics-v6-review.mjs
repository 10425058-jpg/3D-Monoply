import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir, writeFile, readdir, stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';

const label=process.argv[2]||'after';
assert.ok(['before','after'].includes(label));
const origin=process.env.V6_URL||`http://127.0.0.1:${label==='before'?4196:4197}`;
const out=`docs/final-graphics-v6/evidence/${label}`;
await mkdir(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
  args:['--no-first-run','--no-default-browser-check']});
const results=[];
const summarize=samples=>{
  const series=k=>samples.map(s=>s[k]).filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
  const percentile=(k,p)=>{const v=series(k);return v.length?v[Math.min(v.length-1,Math.floor(v.length*p))]:null;};
  return {samples:samples.length,fps:1000/(samples.reduce((s,v)=>s+v.frameMs,0)/samples.length),frameP50:percentile('frameMs',.5),frameP95:percentile('frameMs',.95),frameP99:percentile('frameMs',.99),
    calls:percentile('calls',.5),triangles:percentile('triangles',.5),textures:percentile('textures',.5),geometries:percentile('geometries',.5),renderCpuP50:percentile('renderCpuMs',.5),gpuP50:percentile('gpuMs',.5)};
};
try{
  for(const quality of ['low','balanced','high']){
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.evaluateOnNewDocument(q=>{localStorage.setItem('monopoly-graphics-quality',q);let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},quality);
    const start=Date.now();
    await page.goto(`${origin}/?graphicsAudit&soloTest#solo`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__soloTest&&window.__graphicsAudit&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready,{timeout:90000});
    const readyMs=Date.now()-start;
    await page.evaluate(()=>window.__soloTest.fixture('opening'));
    await pause(1800);
    await page.mouse.move(2,450);
    await page.screenshot({path:`${out}/${quality}-overview.png`});
    await page.evaluate(()=>window.__graphicsAudit.start());await pause(5000);
    const idle=await page.evaluate(()=>window.__graphicsAudit.stop());
    // Identical real rent turn, including committed dice, token movement and HUD.
    // Warm the optional transaction text shader first in both builds.
    const roll=async()=>{
      await page.evaluate(()=>{let faces=[1,2],original=Math.random;Math.random=()=>{const v=(faces.shift()-.5)/6;if(!faces.length)Math.random=original;return v;};});
      await page.click('[aria-label="Roll dice"]');
      await page.waitForFunction(()=>window.__soloTest.state().turnPhase==='END_TURN',{timeout:60000});
    };
    await page.evaluate(()=>window.__soloTest.fixture('rent'));await pause(250);await roll();await pause(1800);
    await page.evaluate(()=>window.__soloTest.fixture('rent'));await pause(250);
    await page.evaluate(()=>window.__graphicsAudit.start());await roll();await pause(1400);
    const gameplay=await page.evaluate(()=>window.__graphicsAudit.stop());
    assert.deepEqual(await page.evaluate(()=>window.__soloTest.state().players.map(p=>p.money)),[1496,1504,1500]);
    const memory=await page.metrics();
    const tiles=await page.evaluate(()=>window.__graphicsAudit.tiles());
    assert.equal(tiles.length,40);
    tiles.forEach(t=>{assert.equal(t.occludedByCity,false);assert.equal(t.occludedByEnvironment,false);assert.equal(t.pickableTileId,t.id);});
    assert.deepEqual(errors,[]);
    const result={quality,readyMs,idle:{summary:summarize(idle.samples),...idle},gameplay:{summary:summarize(gameplay.samples),...gameplay},memory,errors};
    results.push(result);console.log(JSON.stringify({label,quality,readyMs,idle:result.idle.summary,gameplay:result.gameplay.summary}));
    if(quality==='balanced'){
      await page.evaluate(()=>window.__soloTest.fixture('opening'));await pause(300);
      for(const [name,pose,target] of [['board-detail',[0,25,24],[0,.5,9.55]],['west-labels',[-25,25,0],[-9.55,.5,0]],['north-labels',[0,25,-24],[0,.5,-9.55]],['east-labels',[25,25,0],[9.55,.5,0]],['castle',[15,18,19],[0,2,0]]]){
        await page.evaluate((p,t)=>window.__graphicsAudit.camera(p,t),pose,target);await pause(500);await page.screenshot({path:`${out}/${name}.png`});
      }
      await page.click('button[title="Switch to Top-Down View"]');await pause(350);await page.screenshot({path:`${out}/board-overview.png`});
    }
    await page.close();
  }
  const assets=[];
  const dir=label==='before'?'.v6-baseline-dist/assets':'dist/assets';
  for(const name of await readdir(dir))if(/\.(js|css)$/.test(name)){
    const file=`${dir}/${name}`,bytes=(await stat(file)).size;assets.push({name,bytes,gzipBytes:gzipSync(await readFile(file)).length});
  }
  await writeFile(`${out}/measurements.json`,JSON.stringify({label,conditions:{viewport:[1440,900],dpr:1,motion:'reduce',seed:10425058,idleMs:5000,workload:'real committed [1,2] rent turn after identical shader warmup',node:process.version},assets,results})+'\n');
}finally{await browser.close();}
