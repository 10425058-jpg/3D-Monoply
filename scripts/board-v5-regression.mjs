import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.V5_TEST_URL||'http://127.0.0.1:4193',out=process.env.V5_EVIDENCE_OUT||'docs/board-rules-v5/evidence/regression';
const pause=ms=>new Promise(r=>setTimeout(r,ms));await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,
  args:process.env.CI?['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
const page=await browser.newPage(),errors=[],results={dice:[],scenarios:[],mounts:[]};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
await page.evaluateOnNewDocument(()=>{localStorage.setItem('monopoly-graphics-quality','balanced');let seed=10425058;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
const state=()=>page.evaluate(()=>window.__soloTest.state());
const wait=fn=>page.waitForFunction(fn,{timeout:60000});
const fixture=async(name,settle=true)=>{await page.evaluate(n=>window.__soloTest.fixture(n),name);if(settle)await pause(2600);};
const capture=async name=>{await page.screenshot({path:`${out}/${name}.png`});results.scenarios.push({name,state:await state(),board:await page.evaluate(()=>window.__graphicsAudit.board()),actors:await page.evaluate(()=>window.__graphicsAudit.actors())});console.log(`Passed browser scenario: ${name}`);};
async function roll(a=1,b=2){
  await wait(()=>{const b=document.querySelector('[aria-label="Roll dice"]');return b&&!b.disabled&&b.getBoundingClientRect().width>0;});
  await page.evaluate(faces=>{
    const randomFaces=[...faces],original=Math.random;Math.random=()=>{const value=(randomFaces.shift()-.5)/6;if(!randomFaces.length)Math.random=original;return value;};
    const observation=window.__v5DiceObservation={found:null,samples:[]},until=performance.now()+60000;
    // Observe after R3F updates and renders each frame. A separate RAF can
    // run before those updates and miss a short result on software WebGL.
    const audit=window.__graphicsAudit,originalFrame=audit.frame;
    const observe=()=>{
      const state=window.__soloTest.state(),dice=window.__graphicsAudit.dice();
      const sample={stored:state.dice,rendered:dice,phase:state.turnPhase,at:performance.now()};
      if(observation.samples.length<120)observation.samples.push(sample);
      if(state.turnPhase!=='ROLLING'&&state.dice.every((v,i)=>v===faces[i])&&dice.every((d,i)=>d.visible&&d.up>.999&&d.face===faces[i]))observation.found=sample;
      if(observation.found||performance.now()>=until)audit.frame=originalFrame;
    };
    audit.frame=()=>{originalFrame();queueMicrotask(observe);};
  },[a,b]);
  await page.click('[aria-label="Roll dice"]');
  // Optional stress case: retrieve all six face observations after the normal
  // fade. It applies only to the face matrix, not timed transaction HUD tests.
  if(results.dice.length<6)await pause(Math.min(5000,Math.max(0,Number(process.env.V5_DICE_READ_DELAY_MS)||0)));
  const settled=await wait(()=>window.__v5DiceObservation.found);
  const observation=await settled.jsonValue();await settled.dispose();
  assert.deepEqual(observation.stored,[a,b]);assert.deepEqual(observation.rendered.map(d=>d.face),[a,b]);
  await wait(()=>!['ROLLING','MOVING'].includes(window.__soloTest.state().turnPhase));
  assert.deepEqual((await state()).dice,[a,b]);results.dice.push(observation);
}
async function footer(label){for(const b of await page.$$('footer button'))if(await b.evaluate((e,s)=>e.textContent.trim()===s,label)){await b.click();return;}throw Error(`Missing ${label}`);}
async function debtAction(label){for(const b of await page.$$('.debt-resolution button'))if(await b.evaluate((e,s)=>e.textContent.trim()===s,label)){await b.click();return;}throw Error(`Missing ${label}`);}
try{
  await page.goto(`${origin}/?graphicsAudit&soloTest#solo`);
  await wait(()=>window.__soloTest&&window.__graphicsAudit&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready);
  await fixture('opening');await capture('opening');
  const atlas=(await page.evaluate(()=>window.__graphicsAudit.board())).textures;
  assert.equal(atlas.length,1);assert.equal(atlas[0].width,1024);assert.ok(atlas[0].mipmaps);
  // Warm the real money-effect path before measuring the short dice window.
  // Its first font/shader upload can stall a software renderer for that whole
  // window. Wait for completed frames after a verified payment, not a delay.
  await fixture('rent',false);
  await page.evaluate(()=>{
    const faces=[1,2],original=Math.random;Math.random=()=>{const value=(faces.shift()-.5)/6;if(!faces.length)Math.random=original;return value;};
    const audit=window.__graphicsAudit,originalFrame=audit.frame;
    window.__moneyWarmupFrames=0;
    audit.frame=()=>{originalFrame();queueMicrotask(()=>{
      const state=window.__soloTest.state();
      if(state.turnPhase==='END_TURN'&&state.players[0].money===1496){
        window.__moneyWarmupFrames++;
        if(window.__moneyWarmupFrames>=3)audit.frame=originalFrame;
      }
    });};
  });
  await page.click('[aria-label="Roll dice"]');
  await wait(()=>window.__moneyWarmupFrames>=3);
  assert.deepEqual((await state()).players.map(player=>player.money),[1496,1504,1500]);
  results.rendererWarmup={renderedFrames:await page.evaluate(()=>window.__moneyWarmupFrames),verifiedRent:4};
  console.log('Passed renderer warmup with committed rent and completed frames.');
  for(const [a,b] of [[1,2],[2,3],[3,1],[4,5],[5,6],[6,4]]){await fixture('opening',false);await pause(150);await roll(a,b);}
  await capture('dice-landing');
  await fixture('opening');await roll();await footer('Buy');
  let s=await state();assert.equal(s.properties[3].ownerId,0);assert.equal(s.players[0].money,1440);
  await wait(()=>window.__graphicsAudit.board().meshes['board-owner-trim']===1);await capture('purchase');
  await page.evaluate(()=>window.__soloTest.state());assert.equal((await state()).players[0].position,3);
  const token=(await page.evaluate(()=>window.__graphicsAudit.actors())).tokens[0];assert.ok(Math.abs(token.position[0]-3.6)<.6&&Math.abs(token.position[2]-9.55)<.6&&token.position[1]>=.34);
  await fixture('rent');await roll();s=await state();assert.equal(s.players[0].money,1496);assert.equal(s.players[1].money,1504);
  await wait(()=>document.querySelector('.receipt-rent')?.getAttribute('aria-label')==='You paid $4 to Rival 1 · Rent on Baltic Avenue');
  const rentReceipt=await page.$eval('.receipt-rent',element=>element.textContent);
  assert.match(rentReceipt,/You.*1,496.*Rival 1.*1,504/);
  assert.equal(await page.$$('.receipt-rent').then(receipts=>receipts.length),1);
  await capture('rent-payment');
  await fixture('building');await page.click('button[title="Build on this property"]');
  await wait(()=>window.__soloTest.state().properties[1].houses===1);s=await state();assert.equal(s.players[0].money,1450);await capture('house-construction');
  assert.equal((await page.evaluate(()=>window.__graphicsAudit.actors())).buildings[0].models,1);
  await fixture('hotel');await page.click('button[title="Build on this property"]');await wait(()=>window.__soloTest.state().properties[1].houses===5);await capture('hotel-upgrade');
  await fixture('ownership');const board=await page.evaluate(()=>window.__graphicsAudit.board());assert.equal(board.meshes['board-owner-trim'],5);assert.equal(board.meshes['board-owner-mortgage-marks'],6);
  assert.equal(board.textures[0].uuid,atlas[0].uuid,'ownership updates reuse the exact atlas');await capture('ownership-mortgage');
  await fixture('go-to-jail');await roll();s=await state();assert.equal(s.players[0].position,10);assert.equal(s.players[0].inJail,true);assert.equal(s.players[0].money,1500);await capture('jail-entry');
  await fixture('jail');await capture('jail-options');await page.click('.solo-decision-strip button:nth-of-type(1)');s=await state();assert.equal(s.players[0].inJail,false);assert.equal(s.players[0].money,1450);
  await fixture('jail');await page.click('.solo-decision-strip button:nth-of-type(2)');s=await state();assert.equal(s.players[0].inJail,false);assert.equal(s.players[0].getOutOfJailCards,0);
  for(const name of ['chance','chest','card-chain']){
    await fixture(name);await roll();await wait(()=>!!document.querySelector('.card-reveal'));await capture(`${name}-reveal`);
    await page.click('.card-reveal .modal-primary');
    if(name==='card-chain'){await wait(()=>document.querySelector('dialog[open].card-reveal.deck-chest'));await pause(250);await page.click('.card-reveal .modal-primary');}
    await wait(()=>!['CARD_DRAWN','ROLLING','MOVING'].includes(window.__soloTest.state().turnPhase));
    s=await state();assert.equal(s.players[0].money,name==='chance'?1550:name==='chest'?1900:1700);
  }
  await fixture('debt');await roll();await wait(()=>!!document.querySelector('.debt-resolution'));await capture('debt-resolution');
  await page.click('.debt-holding button:last-of-type');await wait(()=>window.__soloTest.state().players[0].money===220);
  await debtAction('Settle $200');s=await state();assert.equal(s.players[0].money,20);assert.equal(s.pendingDebt,null);
  await fixture('opening');await roll();await footer('Auction');await wait(()=>!!document.querySelector('#auction-title'));
  await page.click('[aria-labelledby="auction-title"] button:nth-of-type(2)');await page.click('[aria-labelledby="auction-title"] button:nth-of-type(1)');await page.click('[aria-labelledby="auction-title"] button:nth-of-type(1)');
  s=await state();assert.equal(s.properties[3].ownerId,0);assert.equal(s.players[0].money,1490);await capture('auction-won');
  await fixture('bankruptcy');await roll();await debtAction('Declare bankruptcy');s=await state();assert.ok(s.players[0].isBankrupt);assert.equal(s.currentPlayerIndex,1);assert.equal(s.turnPhase,'PRE_ROLL');await capture('bankruptcy');
  await fixture('victory');await roll();await debtAction('Declare bankruptcy');await wait(()=>window.__soloTest.state().turnPhase==='GAME_OVER');await capture('victory');
  assert.equal(await page.$eval('[aria-label="Roll dice"]',e=>e.disabled),true);
  const finishedGameId=(await state()).gameId;
  await footer('Start a new game');
  await wait(()=>document.querySelector('dialog[open].setup-modal')&&!document.querySelector('dialog[open].winner-modal'));
  await page.click('.setup-modal .modal-primary');
  await wait(()=>window.__soloTest.state().gameId>0&&window.__soloTest.state().turnPhase==='PRE_ROLL');
  assert.ok((await state()).gameId>finishedGameId);
  assert.ok((await state()).players.every(p=>p.money===1500&&p.position===0&&!p.isBankrupt));
  await fixture('six-players');await pause(300);const positions=(await page.evaluate(()=>window.__graphicsAudit.actors())).tokens.map(t=>t.position);assert.equal(new Set(positions.map(p=>`${p[0]},${p[2]}`)).size,6);await capture('six-player-start');
  await fixture('ai');await roll();await footer('Buy');await footer('End Turn');await wait(()=>window.__soloTest.state().currentPlayerIndex!==0);
  const deadline=Date.now()+90000;
  while(Date.now()<deadline){
    const s=await state();if(s.currentPlayerIndex===0&&s.turnPhase==='PRE_ROLL')break;
    const pass=await page.$('[aria-labelledby="auction-title"] button');if(pass&&!await pass.evaluate(e=>e.disabled))await pass.click();await pause(250);
  }
  s=await state();assert.equal(s.currentPlayerIndex,0);assert.equal(s.turnPhase,'PRE_ROLL');assert.ok(s.logs.some(l=>l.message.startsWith('Rival 2 rolled')));await capture('ai-full-round');
  await roll();if((await state()).turnPhase==='LANDED_ACTION')await footer('Buy');if((await state()).turnPhase==='END_TURN')await footer('End Turn');await pause(100);
  await fixture('opening');await pause(2500);s=await state();assert.ok(s.players.every(p=>p.position===0&&p.money===1500));assert.equal(s.turnPhase,'PRE_ROLL');
  results.restart={noStaleTimers:true};
  // Calibrate on a clean mount: prior scenarios uploaded optional money-label
  // and dice resources, so comparing their history to an untouched mount is
  // not an equal workload. Every measured cycle now plays the same roll.
  await page.evaluate(()=>location.hash='home');await wait(()=>!window.__graphicsAudit&&!document.querySelector('canvas'));
  await page.evaluate(()=>location.hash='solo');await wait(()=>window.__soloTest&&window.__graphicsAudit&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready);
  for(let i=0;i<4;i++){
    await fixture('opening');await roll();await fixture('opening');
    await pause(1000);const metadata=await page.evaluate(()=>window.__graphicsAudit.metadata());results.mounts.push({memory:metadata.memory,allocations:metadata.allocationEstimates});
    if(i)assert.deepEqual(results.mounts[i],results.mounts[0]);
    await page.evaluate(()=>location.hash='home');await wait(()=>!window.__graphicsAudit&&!window.__soloTest&&!document.querySelector('canvas'));
    if(i<3){await page.evaluate(()=>location.hash='solo');await wait(()=>window.__soloTest&&window.__graphicsAudit&&window.__centralCityAudit?.ready&&window.__phase2Environment?.ready);await fixture('opening');}
  }
  await page.goto(`${origin}/#solo`);await pause(3000);assert.equal(await page.evaluate(()=>!!window.__soloTest||!!window.__graphicsAudit),false);
  assert.deepEqual(errors,[]);results.errors=errors;results.passed=true;
  await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log('Passed live Solo opening, rendered dice, purchase, rent, buildings, Jail, cards, debt, auction, bankruptcy, victory, AI, restart and four mounts.');
}catch(error){
  const diagnostic=await page.evaluate(()=>({state:window.__soloTest?.state(),dice:window.__graphicsAudit?.dice(),observation:window.__v5DiceObservation})).catch(()=>null);
  await writeFile(`${out}/failure.json`,JSON.stringify(diagnostic,null,2));console.error('Final browser diagnostics:',JSON.stringify(diagnostic));
  await page.screenshot({path:`${out}/failure.png`});throw error;
}finally{await browser.close();}
