import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

// Loopback-only fixtures, real UI actions and post-render observations. The
// fixture RNG supplies committed test results; production RNG is untouched.
const origin = process.env.V6_TEST_URL || 'http://127.0.0.1:4198';
const out = process.env.V6_DICE_OUT || 'docs/final-graphics-v6/evidence/dice';
await mkdir(out, {recursive: true});
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const results = {passed: false, cases: [], errors: []};
let page;
const wait = fn => page.waitForFunction(fn, {timeout: 60000});
const state = () => page.evaluate(() => window.__soloTest.state());
const dieVisible = d => d.visible && d.scale?.every(v => v > .99);

async function fixture() {
  await page.evaluate(() => {
    window.__v6DiceStop?.();
    window.__soloTest.fixture('opening');
    document.querySelector('.speed-options button').click(); // Existing 1x UI.
    const audit = window.__graphicsAudit, originalFrame = audit.frame;
    window.__v6ResetFrames = 0;
    audit.frame = () => {originalFrame(); queueMicrotask(() => {
      if (audit.dice().every(d => !d.visible)) window.__v6ResetFrames++;
      if (window.__v6ResetFrames >= 2) audit.frame = originalFrame;
    });};
  });
  await wait(() => window.__v6ResetFrames >= 2);
}

async function observeRoll(faces, {rapid = false, captureRolling = false, captureResult} = {}) {
  await wait(() => {
    const button = document.querySelector('[aria-label="Roll dice"]');
    return button && !button.disabled;
  });
  await page.evaluate(({faces, rapid}) => {
    window.__v6DiceStop?.();
    const audit = window.__graphicsAudit, originalFrame = audit.frame;
    const observation = window.__v6DiceObservation = {faces, rolling: [], result: null, frames: 0};
    const originalRandom = Math.random;
    let consumed = 0;
    Math.random = () => (++consumed <= 2 ? (faces[consumed - 1] - .5) / 6 : originalRandom());
    const stop = () => {audit.frame = originalFrame; Math.random = originalRandom;};
    window.__v6DiceStop = stop;
    audit.frame = () => {originalFrame(); queueMicrotask(() => {
      observation.frames++;
      const game = window.__soloTest.state(), dice = audit.dice();
      const sample = {phase: game.turnPhase, stored: [...game.dice], dice, at: performance.now()};
      if (game.turnPhase === 'ROLLING' && observation.rolling.length < 30) observation.rolling.push(sample);
      if (game.turnPhase !== 'ROLLING' && game.dice.every((v, i) => v === faces[i]) &&
        dice.every((d, i) => d.visible && d.scale.every(v => v > .99) && d.up > .999 && d.face === faces[i])) {
        observation.result = sample;
        stop();
      }
    });};
    const button = document.querySelector('[aria-label="Roll dice"]');
    for (let i = 0; i < (rapid ? 12 : 1); i++) button.click();
    observation.rngConsumedByClickBurst = consumed;
    Math.random = originalRandom;
  }, {faces, rapid});
  if (captureRolling) {
    await wait(() => window.__v6DiceObservation.rolling.some(s => s.dice.every(d => d.visible && d.scale.every(v => v > .99))));
    await page.screenshot({path: `${out}/normal-rolling.png`});
  }
  await wait(() => window.__v6DiceObservation.result);
  const observation = await page.evaluate(() => window.__v6DiceObservation);
  assert.equal(observation.rngConsumedByClickBurst, 2, 'one authoritative roll consumes exactly two fixture dice');
  assert.ok(observation.rolling.length > 0, 'observe a rendered rolling frame');
  assert.ok(observation.rolling.some(s => s.dice.every(dieVisible)), 'both tumbling dice have a nonzero visible scale');
  assert.deepEqual(observation.result.stored, faces);
  assert.deepEqual(observation.result.dice.map(d => d.face), faces);
  assert.ok(observation.result.dice.every(d => d.up > .999 && dieVisible(d)));
  // Capture at the landing before a destination card can cover the dice.
  if (captureResult) await page.screenshot({path: `${out}/${captureResult}.png`});
  await wait(() => !['ROLLING', 'MOVING'].includes(window.__soloTest.state().turnPhase));
  return observation;
}

async function footer(text) {
  for (const button of await page.$$('footer button')) {
    if (await button.evaluate((el, text) => el.textContent.trim() === text, text)) {
      await button.click(); return;
    }
  }
  throw Error(`Missing footer action ${text}`);
}

try {
  for (const motion of ['no-preference', 'reduce']) {
    const mode = motion === 'reduce' ? 'reduced' : 'normal';
    page = await browser.newPage();
    page.on('pageerror', e => results.errors.push({mode, error: e.message}));
    page.on('console', m => {if (m.type() === 'error') results.errors.push({mode, error: m.text()});});
    await page.setViewport({width: 1440, height: 900, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: motion}]);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('monopoly-graphics-quality', 'balanced');
      let seed = 10425058;
      Math.random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
    });
    await page.goto(`${origin}/?graphicsAudit&soloTest#solo`, {waitUntil: 'domcontentloaded'});
    await wait(() => window.__soloTest && window.__graphicsAudit && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
    await fixture();
    // First visible dice draw warms the die/particle shaders. The matrix then
    // checks each face under identical warm rendering conditions.
    const warmup = await observeRoll([1, 2]);
    results.cases.push({mode, name: 'shader-warmup', observation: warmup});
    for (const faces of [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]]) {
      await fixture();
      const observation = await observeRoll(faces, {rapid: faces[0] === 1, captureRolling: mode === 'normal' && faces[0] === 1,
        captureResult: faces[0] === 6 ? `${mode}-6-1-landing` : undefined});
      results.cases.push({mode, name: `faces-${faces.join('-')}`, observation});
      console.log(`Passed ${mode}: faces ${faces.join('/')} and rendered rolling visibility.`);
    }
    // True consecutive rolls through the unchanged doubles/End Turn flow.
    await fixture();
    const doubles = [];
    for (const faces of [[2, 2], [3, 3], [6, 6]]) {
      doubles.push(await observeRoll(faces));
      if (faces[0] !== 6) {
        assert.equal((await state()).turnPhase, 'END_TURN');
        await footer('End Turn');
        await wait(() => window.__soloTest.state().turnPhase === 'PRE_ROLL');
        assert.equal((await state()).currentPlayerIndex, 0, 'doubles retain the same player');
      }
    }
    const thirdDouble = await state();
    assert.equal(thirdDouble.players[0].inJail, true);
    assert.equal(thirdDouble.players[0].position, 10);
    results.cases.push({mode, name: 'consecutive-doubles', observations: doubles, final: thirdDouble});

    await fixture();
    // Reset from the first rendered roll frame; the old roll timeout must not
    // move a token, replay money, or revive an old die in the new game.
    await page.evaluate(() => {
      const random = Math.random; let i = 0;
      Math.random = () => (++i <= 2 ? 5.5 / 6 : random());
      const audit = window.__graphicsAudit, frame = audit.frame;
      window.__v6ResetDuring = {done: false, frames: 0, revived: false, start: 0};
      audit.frame = () => {frame(); queueMicrotask(() => {
        const result = window.__v6ResetDuring, game = window.__soloTest.state();
        if (!result.done && game.turnPhase === 'ROLLING' && audit.dice().every(d => d.visible && d.scale.every(v => v > .99))) {
          result.done = true; result.start = performance.now(); window.__soloTest.fixture('opening');
        } else if (result.done) {
          result.frames++;
          if (audit.dice().some(d => d.visible)) result.revived = true;
          if (performance.now() - result.start > 1600 && result.frames > 2) {result.complete = true; audit.frame = frame;}
        }
      });};
      document.querySelector('[aria-label="Roll dice"]').click();
      Math.random = random;
    });
    await wait(() => window.__v6ResetDuring.complete);
    const reset = await page.evaluate(() => ({observation: window.__v6ResetDuring, state: window.__soloTest.state(), dice: window.__graphicsAudit.dice()}));
    assert.equal(reset.observation.revived, false);
    assert.equal(reset.state.turnPhase, 'PRE_ROLL');
    assert.equal(reset.state.players[0].position, 0);
    assert.equal(reset.state.players[0].money, 1500);
    assert.ok(reset.dice.every(d => !d.visible));
    results.cases.push({mode, name: 'reset-during-roll', ...reset});
    await observeRoll([4, 6]);
    await fixture();
    assert.ok((await page.evaluate(() => window.__graphicsAudit.dice())).every(d => !d.visible));
    results.cases.push({mode, name: 'reset-after-landing', passed: true});
    results[`${mode}Renderer`] = await page.evaluate(() => window.__graphicsAudit.metadata().renderer);
    await page.close();
    console.log(`Passed ${mode}: rapid clicks, consecutive doubles, reset during and after roll.`);
  }
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.failure = error.stack;
  if (page && !page.isClosed()) {
    results.lastObservation = await page.evaluate(() => ({state: window.__soloTest?.state(), observation: window.__v6DiceObservation,
      reset: window.__v6ResetDuring, dice: window.__graphicsAudit?.dice()})).catch(() => null);
    await page.screenshot({path: `${out}/failure.png`}).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results) + '\n');
  await browser.close();
}
