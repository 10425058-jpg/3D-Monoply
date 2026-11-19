import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {checkBoardMotion} from './board-v5-motion.mjs';
const origin=process.env.V5_TEST_URL||'http://127.0.0.1:4193',out=process.env.V5_EVIDENCE_OUT||'docs/board-rules-v5/evidence/regression';
const pause=ms=>new Promise(r=>setTimeout(r,ms));await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
  args:process.env.CI?['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
const results={contexts:[]};
const motionOnly=process.argv.includes('--motion-only'),matrix=process.argv.includes('--matrix');
async function open(quality='balanced',motion='reduce'){
  const page=await browser.newPage();await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:motion}]);
  await page.evaluateOnNewDocument(q=>localStorage.setItem('monopoly-graphics-quality',q),quality);await page.goto(`${origin}/?graphicsAudit&soloTest#solo`);
  await page.waitForFunction(()=>window.__graphicsAudit&&window.__soloTest&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready,{timeout:90000});return page;
}
async function motionChecks(){
  const profiles=matrix?['low','balanced','high'].flatMap(quality=>['no-preference','reduce'].flatMap(motion=>
    [1,2].map(speed=>({quality,motion,speed})))):[{quality:'balanced',motion:'no-preference',speed:1}];
  const cases=[];
  for(const profile of profiles){
    const {quality,motion,speed}=profile,page=await open(quality,motion);
    const name=`${quality}-${motion}-${speed}x`;
    try{
      await page.evaluate(()=>window.__soloTest.fixture('opening'));
      await page.click(`.speed-options button:nth-child(${speed})`);
      const result=await checkBoardMotion(page,{out,name,speed,motion});
      cases.push({...profile,renderer:await page.evaluate(()=>window.__graphicsAudit.metadata().renderer),...result});
      if(!matrix)await page.screenshot({path:`${out}/normal-motion-dice.png`});
      if(matrix&&quality==='balanced'&&motion==='no-preference'&&speed===1){
        await page.click('.solo-decision-strip button');
        const endTurn=await page.waitForFunction(()=>[...document.querySelectorAll('footer button')]
          .find(button=>!button.disabled&&button.textContent.trim()==='End Turn'));
        await endTurn.asElement().click();
        await endTurn.dispose();
        const next=await checkBoardMotion(page,{out,name:`${name}-next-turn`,speed,motion});
        assert.equal(next.trace.ready.gameId,result.trace.ready.gameId);
        assert.notEqual(next.trace.ready.playerId,result.trace.ready.playerId);
        cases.push({...profile,consecutive:true,...next});
      }
      console.log(`Passed dice and token motion: ${name}.`);
    }finally{await page.close();}
  }
  results.motion=cases[0];
  if(matrix)results.motionCases=cases;
  await writeFile(`${out}/motion.json`,JSON.stringify(cases,null,2));
}
async function verifyContexts(){
  for(const quality of ['low','balanced','high']){
    const page=await open(quality),before=`${out}/context-${quality}-before.png`,after=`${out}/context-${quality}-after.png`;
    await pause(1200);
    await page.screenshot({path:before});
    await page.evaluate(()=>{
      const gl=document.querySelector('canvas').getContext('webgl2'),extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('Context-loss extension unavailable');
      window.__contextRestored=false;document.querySelector('canvas').addEventListener('webglcontextrestored',()=>window.__contextRestored=true,{once:true});
      window.__restore=()=>extension.restoreContext();extension.loseContext();
    });
    await pause(250);await page.evaluate(()=>window.__restore());await page.waitForFunction(()=>window.__contextRestored,{timeout:30000});await pause(1800);await page.screenshot({path:after});
    const pixels=JSON.parse(execFileSync(process.env.PYTHON||'python',['tools/compare_board_capture.py',before,after,'--rect','480','160','650','565','--output',`${out}/context-${quality}.json`],{encoding:'utf8'}));
    assert.ok(pixels.meanAbsoluteChannelDelta<.5,'atlas, material and board geometry must restore within sub-byte mean pixel tolerance');
    results.contexts.push({quality,pixels,atlas:await page.evaluate(()=>window.__graphicsAudit.board())});await page.close();console.log(`Passed context recovery: ${quality}`);
  }
}
async function verifyOptionalFont(){
  const fault=await browser.newPage();await fault.setViewport({width:1440,height:900,deviceScaleFactor:1});await fault.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await fault.setCacheEnabled(false);await fault.setRequestInterception(true);const blocked=[],workerHooks=[];
  // Worker traffic has its own CDP session. Block and observe it explicitly,
  // rather than depending on page interception winning worker startup races.
  fault.on('workercreated',worker=>{
    const requests=new Map();
    worker.client.on('Network.requestWillBeSent',event=>{if(/unicode-font-resolver/i.test(event.request.url))requests.set(event.requestId,event.request.url);});
    worker.client.on('Network.loadingFailed',event=>{if(requests.has(event.requestId)&&event.blockedReason==='inspector')blocked.push(requests.get(event.requestId));});
    workerHooks.push(worker.client.send('Network.enable').then(()=>worker.client.send('Network.setBlockedURLs',{urls:['*unicode-font-resolver*']})).catch(()=>{}));
  });
  // Troika's installed version resolves its default font through this data
  // package. Block that actual dependency, leaving the HUD's fonts alone.
  fault.on('request',r=>{if(/unicode-font-resolver/i.test(r.url())){blocked.push(r.url());r.abort('failed');}else r.continue();});
  await fault.goto(`${origin}/?graphicsAudit&soloTest#solo`);await fault.waitForFunction(()=>window.__soloTest&&window.__graphicsAudit&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready,{timeout:90000});
  const rentRoll=async()=>{
    await fault.evaluate(()=>window.__soloTest.fixture('rent'));await pause(300);
    await fault.evaluate(()=>{let faces=[1,2],original=Math.random;Math.random=()=>{const value=(faces.shift()-.5)/6;if(!faces.length)Math.random=original;return value;};});
    await fault.click('[aria-label="Roll dice"]');await fault.waitForFunction(()=>window.__soloTest.state().turnPhase==='END_TURN',{timeout:60000});
  };
  // A brief money event can expire while Troika's first worker/preload starts
  // on software WebGL. Warm that real path, require an OBSERVED blocked fetch,
  // then test a fresh committed transaction with the dependency already failed.
  let warmupTransactions=0;
  while(!blocked.length&&warmupTransactions<3){await rentRoll();warmupTransactions++;await pause(1800);}
  await Promise.allSettled(workerHooks);
  assert.ok(blocked.length>0,'actually block the optional 3D font after bounded worker warm-up');
  await fault.evaluate(()=>{
    window.__fontFallbackReceipt=null;const until=performance.now()+60000,priorGameId=window.__soloTest.state().gameId;
    const observe=()=>{
      const state=window.__soloTest.state(),money=state.players.map(p=>p.money),receipt=document.querySelector('.effect-transaction')?.textContent;
      if(state.gameId>priorGameId&&money[0]===1496&&receipt?.includes('Rent on Baltic Avenue'))window.__fontFallbackReceipt={money,receipt,canvas:document.querySelectorAll('canvas').length,
        appVisible:document.querySelector('.monopoly-app')?.getBoundingClientRect().height>0,observedAt:performance.now()};
      else if(performance.now()<until)requestAnimationFrame(observe);
    };requestAnimationFrame(observe);
  });
  await rentRoll();await fault.waitForFunction(()=>window.__fontFallbackReceipt,{timeout:60000});
  const fallback=await fault.evaluate(()=>window.__fontFallbackReceipt);
  assert.equal(fallback.appVisible,true);assert.equal(fallback.canvas,1);assert.deepEqual(fallback.money,[1496,1504,1500]);assert.match(fallback.receipt,/Rent on Baltic Avenue.*\$4.*1,496.*1,504/);
  assert.equal(await fault.$eval('.monopoly-app',e=>e.getBoundingClientRect().height>0),true);
  await fault.screenshot({path:`${out}/optional-font-fallback.png`});results.fontFallback={blocked,warmupTransactions,...fallback};await fault.close();
}
try{
  if(!motionOnly)await verifyContexts();
  await motionChecks();
  if(!motionOnly)await verifyOptionalFont();
  results.passed=true;await writeFile(`${out}/resilience.json`,JSON.stringify(results,null,2));
  if(!motionOnly)console.log('Passed board atlas context recovery at all tiers, dice and token motion, and optional-font failure without blocking gameplay.');
}finally{await browser.close();}
