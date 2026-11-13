import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Alternate A/B then B/A in one browser, one open game page at a time. Downloads
// and shader warmup are outside each sample. Keep every result, not the best.
const out=`docs/fantasy-master/evidence/${process.env.COMPARISON_LABEL || 'controlled-final'}`;
const qualities=(process.env.COMPARISON_QUALITIES || 'low,balanced,high').split(',');
const cameras=(process.env.COMPARISON_CAMERAS || 'overview,reference').split(',');
const sampleMs=Number(process.env.COMPARISON_SAMPLE_MS || 5000);
const warmupMs=Number(process.env.COMPARISON_WARMUP_MS || 5000);
assert.ok(qualities.every(tier=>['low','balanced','high'].includes(tier)));
assert.ok(cameras.every(camera=>['overview','reference'].includes(camera)));
assert.ok(Number.isFinite(sampleMs)&&sampleMs>=1000&&Number.isFinite(warmupMs)&&warmupMs>=1000);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const records=[];
await mkdir(out,{recursive:true});
try {
  for(let repeat=0;repeat<2;repeat++) for(const quality of qualities) {
    for(const side of repeat===0?['before','after']:['after','before']) {
      const origin=side==='before'?'http://127.0.0.1:4176':'http://127.0.0.1:4175';
      const source=side==='before'?'.audit-master-baseline':'.';
      const page=await browser.newPage(),errors=[],loads=[];
      await page.setCacheEnabled(false);
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      page.on('requestfailed',request=>errors.push(`${request.url()}: ${request.failure()?.errorText}`));
      page.on('response',response=>{
        if(/\/assets\/models\/environment\/.*\.glb$/.test(response.url())) loads.push(response.buffer().then(body=>({url:response.url(),status:response.status(),sha:createHash('sha256').update(body).digest('hex')})));
      });
      await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.evaluateOnNewDocument(tier=>{
        let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        localStorage.setItem('monopoly-graphics-quality',tier);
      },quality);
      await page.goto(`${origin}/?graphicsAudit#solo`,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>!!window.__graphicsAudit&&window.__phase2Environment?.ready,{timeout:60000});
      await wait(warmupMs);
      for(const camera of cameras) {
        if(camera==='reference') {await page.evaluate(()=>window.__graphicsAudit.camera([4.5,27,40],[0,.7,0]));await wait(1000);}
        const metadata=await page.evaluate(()=>window.__graphicsAudit.metadata());
        const tiles=await page.evaluate(()=>window.__graphicsAudit.tiles());
        assert.equal(tiles.length,40);
        tiles.forEach(tile=>{
          assert.equal(tile.occludedByEnvironment,false,`${quality}/${camera} environment tile ${tile.id}`);
          if(camera==='overview') {
            assert.equal(tile.pickableTileId,tile.id);assert.equal(tile.occludedByCity,false);
            assert.ok(tile.x>0&&tile.x<1440&&tile.y>0&&tile.y<900);
          }
        });
        await page.evaluate(()=>window.__graphicsAudit.start());await wait(sampleMs);
        const measurement=await page.evaluate(()=>window.__graphicsAudit.stop());
        assert.ok(measurement.samples.length>30);
        const p=(key,fraction=.5)=>{const values=measurement.samples.map(sample=>sample[key]).filter(value=>value!==null).sort((a,b)=>a-b);return values[Math.floor(values.length*fraction)]??null;};
        const summary={repeat,quality,side,camera,sampleMs,warmupMs,fps:1000/(measurement.samples.reduce((n,s)=>n+s.frameMs,0)/measurement.samples.length),
          frameP95:p('frameMs',.95),gpuP50:p('gpuMs'),calls:p('calls'),triangles:p('triangles'),textures:p('textures')};
        records.push({...summary,metadata,samples:measurement.samples});console.log(JSON.stringify(summary));
        const baseline=records.find(record=>record.repeat===repeat&&record.quality===quality&&record.camera===camera&&record.side!==side);
        if(baseline) {
          assert.deepEqual(metadata.camera,baseline.metadata.camera);assert.deepEqual(metadata.viewport,baseline.metadata.viewport);assert.equal(metadata.dpr,baseline.metadata.dpr);
        }
        if(repeat===0) await page.screenshot({path:`${out}/${side}-${quality}-${camera}.png`});
      }
      const environment=await page.evaluate(()=>window.__phase2Environment),responses=await Promise.all(loads);
      for(const url of environment.assetUrls) {
        const response=responses.find(item=>item.url===url);assert.equal(response?.status,200);
        const bytes=await readFile(path.resolve(source,'public/assets/models/environment',path.basename(new URL(url).pathname)));
        assert.equal(response.sha,createHash('sha256').update(bytes).digest('hex'));
      }
      assert.deepEqual(errors,[]);await page.close();
    }
  }
  await writeFile(`${out}/runs.json`,JSON.stringify(records));
  await writeFile(`${out}/summary.json`,JSON.stringify(records.map(({samples,metadata,...summary})=>summary),null,2));
  console.log('Paired camera/asset/console checks passed; both run orders retained.');
} finally {await browser.close();}
