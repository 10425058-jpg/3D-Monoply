import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

// Run against an unchanged build and a candidate build on the same machine.
const origin = process.env.V7_TEST_URL || 'http://127.0.0.1:4197';
const output = process.env.V7_EVIDENCE_OUT || '.online-test/v7-evidence';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('monopoly-graphics-quality', 'balanced');
  localStorage.setItem('monopoly-audio-muted', 'false');
  let seed = 10425058;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  window.__heard = [];
  const createOscillator = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    window.__heard.push({ state: this.state, at: performance.now() });
    return createOscillator.apply(this);
  };
});
const wait = (fn, ...args) => page.waitForFunction(fn, { timeout: 60_000 }, ...args);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const state = () => page.evaluate(() => window.__soloTest.state());
const shot = name => page.screenshot({ type: 'jpeg', quality: 83, path: `${output}/${name}.jpg` });
async function twoFrames() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function fixture(name, speed = 1) {
  await page.evaluate(({ name, speed }) => {
    window.__soloTest.fixture(name);
    document.querySelectorAll('.speed-options button')[speed - 1].click();
  }, { name, speed });
  await twoFrames();
}
async function action(label, selector = 'footer button') {
  const button = await page.evaluateHandle((search, text) => [...document.querySelectorAll(search)]
    .find(element => !element.disabled && element.textContent.trim() === text), selector, label);
  assert.ok(button.asElement(), `Enabled action ${label}`);
  await button.asElement().click();
  await button.dispose();
}
async function roll(dice) {
  await page.evaluate(faces => {
    const random = Math.random;
    let index = 0;
    Math.random = () => {
      const value = (faces[index++] - .5) / 6;
      if (index === faces.length) Math.random = random;
      return value;
    };
  }, dice);
  await page.click('[aria-label="Roll dice"]');
  await wait(() => !['PRE_ROLL', 'ROLLING', 'MOVING'].includes(window.__soloTest.state().turnPhase));
  assert.deepEqual((await state()).dice, dice);
}
const summary = {};
const percentile = (items, p) => {
  const sorted = items.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))].toFixed(2)) : null;
};
async function measure(name, interaction) {
  await page.evaluate(() => window.__graphicsAudit.start());
  await interaction();
  await twoFrames();
  const { samples } = await page.evaluate(() => window.__graphicsAudit.stop());
  assert.ok(samples.length > 1, `${name} must sample completed WebGL frames`);
  summary[name] = {
    frames: samples.length,
    frameMedianMs: percentile(samples.map(sample => sample.frameMs), .5),
    frameP95Ms: percentile(samples.map(sample => sample.frameMs), .95),
    renderCpuMedianMs: percentile(samples.map(sample => sample.renderCpuMs), .5),
    drawCallsMedian: percentile(samples.map(sample => sample.calls), .5),
    drawCallsPeak: Math.max(...samples.map(sample => sample.calls)),
    peakGeometries: Math.max(...samples.map(sample => sample.geometries)),
  };
}

async function recordMotion() {
  await fixture('opening');
  const session = await page.createCDPSession();
  const frames = [];
  session.on('Page.screencastFrame', frame => {
    if (frames.length < 250) frames.push(frame);
    void session.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await page.evaluate(() => {
    const audit = window.__graphicsAudit;
    const original = audit.frame;
    window.__motionTrace = [];
    audit.frame = () => {
      original();
      queueMicrotask(() => {
        const game = window.__soloTest.state();
        const token = audit.actors().tokens[0];
        window.__motionTrace.push({ at: (performance.timeOrigin + performance.now()) / 1000,
          phase: game.turnPhase, tile: token.tile, token: token.position, dice: audit.dice() });
      });
    };
    window.__stopMotionTrace = () => { audit.frame = original; return window.__motionTrace; };
  });
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 77, maxWidth: 1100, maxHeight: 700 });
  await roll([3, 5]);
  await twoFrames();
  await session.send('Page.stopScreencast');
  await session.detach();
  const trace = await page.evaluate(() => window.__stopMotionTrace());
  assert.equal((await state()).players[0].position, 8);
  const rolling = trace.filter(frame => frame.phase === 'ROLLING' && frame.dice.every(die => die.visible));
  const moving = trace.filter(frame => frame.phase === 'MOVING');
  const airborne = moving.filter(frame => frame.token?.[1] > .43);
  assert.ok(rolling.length >= 2 && airborne.length >= 2 && frames.length >= 6, 'record distinct rolling and hopping frames');
  const landing = moving.find(frame => frame.dice.every((die, i) => die.face === [3, 5][i] && die.up > .999 && die.visible));
  assert.ok(landing, 'renderer showed the committed dice faces after the throw');
  const desired = [
    ['01-roll', rolling[Math.floor(rolling.length / 2)]],
    ['02-dice-landed', landing],
    ['03-hop', airborne[0]],
    ['04-crossing', airborne[Math.floor(airborne.length / 2)]],
    ['05-approach', airborne[airborne.length - 1]],
    ['06-destination', trace[trace.length - 1]],
  ];
  const chosen = new Set();
  for (const [name, target] of desired) {
    const closest = frames.filter(frame => !chosen.has(frame)).sort((a, b) =>
      Math.abs(a.metadata.timestamp - target.at) - Math.abs(b.metadata.timestamp - target.at))[0];
    chosen.add(closest);
    await writeFile(`${output}/${name}.jpg`, Buffer.from(closest.data, 'base64'));
  }
  await writeFile(`${output}/motion-trace.json`, JSON.stringify({ frames: frames.length, trace }, null, 2));
  return { recordedFrames: frames.length, renderedRollFrames: rolling.length, renderedHopFrames: airborne.length,
    renderedTiles: [...new Set(moving.map(frame => frame.tile))], finalTile: 8,
    landed: landing.dice.map(die => die.face) };
}

async function sustainedSolo() {
  await fixture('ai', 2);
  let handoffs = 0;
  await measure('sustainedSolo', async () => {
    handoffs = await page.evaluate(() => new Promise((resolve, reject) => {
      let changes = 0;
      let previous = 0;
      const deadline = performance.now() + 90_000;
      const press = (selector, label) => {
        const button = [...document.querySelectorAll(selector)].find(element =>
          !element.disabled && (!label || element.textContent.trim() === label));
        button?.click();
        return !!button;
      };
      const tick = () => {
        const game = window.__soloTest.state();
        if (game.currentPlayerIndex !== previous) { previous = game.currentPlayerIndex; changes++; }
        if (changes >= 9) { resolve(changes); return; }
        if (game.winner || performance.now() >= deadline) { reject(new Error(`Solo soak stopped after ${changes} handoffs`)); return; }
        if (game.turnPhase === 'AUCTION') press('[aria-labelledby="auction-title"] button', 'Pass bid');
        else if (game.turnPhase === 'DEBT_RESOLUTION') {
          if (!press('.debt-resolution .console-button.primary') && !press('.debt-holding button')) {
            press('.debt-resolution .console-button.secondary', 'Declare bankruptcy');
          }
        } else if (previous === 0) {
          if (game.railroadRaid) press('.raid-skip');
          else if (game.turnPhase === 'PRE_ROLL') press('[aria-label="Roll dice"]');
          else if (game.turnPhase === 'LANDED_ACTION' && !press('footer button', 'Buy')) press('.solo-decision-strip button', 'Decline purchase');
          else if (game.turnPhase === 'CARD_DRAWN') press('.card-reveal button');
          else if (game.turnPhase === 'END_TURN') press('footer button', 'End Turn');
        }
        setTimeout(tick, 120);
      };
      tick();
    }));
  });
  return handoffs;
}

try {
  await page.goto(`${origin}/?graphicsAudit&soloTest#solo`, { waitUntil: 'domcontentloaded' });
  await wait(() => window.__soloTest && window.__graphicsAudit && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
  await fixture('rent');
  await roll([1, 2]); // Warm optional 3D labels and dice materials on both builds.
  await fixture('opening');
  await shot('active-game');
  await measure('idle', () => delay(2200));
  await measure('rollAndWalk', async () => {
    for (let i = 0; i < 3; i++) { await fixture('opening'); await roll([3, 5]); }
  });
  await fixture('opening');
  await roll([1, 2]);
  await measure('purchase', async () => { await action('Buy'); await delay(260); });
  assert.equal((await state()).properties[3].ownerId, 0);
  await shot('purchase');
  await fixture('rent');
  await measure('rent', () => roll([1, 2]));
  assert.deepEqual((await state()).players.map(player => player.money), [1496, 1504, 1500]);
  await delay(220);
  await shot('rent');
  await fixture('chest');
  await roll([2, 2]);
  assert.equal((await state()).players[0].money, 1700);
  await delay(220);
  await shot('go-salary');
  await fixture('chance');
  await measure('card', async () => { await roll([1, 2]); await delay(350); });
  await shot('chance');
  await action('Resolve this card', '.card-reveal button');
  await wait(() => window.__soloTest.state().players[0].money === 1550);
  await wait(() => !document.querySelector('.card-reveal'));
  await fixture('building');
  await measure('construction', async () => {
    await action('Build');
    await wait(() => window.__soloTest.state().properties[1].houses === 1);
    await delay(260);
  });
  assert.equal((await state()).properties[1].houses, 1);
  await shot('construction');
  await fixture('auction-small-bid');
  await delay(260);
  await shot('auction');
  await action('Bid $11', '.game-modal button');
  await action('Pass bid', '.game-modal button');
  await action('Pass bid', '.game-modal button');
  assert.equal((await state()).properties[3].ownerId, 1);
  await delay(260);
  await shot('auction-won');
  await fixture('debt-trade');
  await action('Trade to raise funds', '.debt-resolution button');
  await delay(280);
  await shot('trade');
  await page.click('[aria-label="Close trade"]');
  await fixture('go-to-jail');
  await roll([1, 2]); await delay(240); await shot('jail');
  assert.equal((await state()).players[0].position, 10);
  await fixture('bankruptcy');
  await roll([1, 2]); await action('Declare bankruptcy', '.debt-resolution button');
  await delay(240);
  await shot('bankruptcy');
  await fixture('victory');
  await roll([1, 2]); await action('Declare bankruptcy', '.debt-resolution button');
  await delay(280);
  await shot('victory');
  const motion = await recordMotion();
  const soloHandoffs = await sustainedSolo();
  const renderer = await page.evaluate(() => window.__graphicsAudit.metadata());
  const audio = await page.evaluate(() => ({
    voicesCreated: window.__heard.length,
    running: window.__heard.filter(voice => voice.state === 'running').length,
  }));
  assert.ok(audio.running > 0, 'real running Web Audio context scheduled synthesized cues');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await fixture('rent');
  await roll([1, 2]);
  assert.ok(await page.evaluate(() => {
    const dice = document.querySelector('.dice-result')?.getBoundingClientRect();
    const status = document.querySelector('.solo-turn-cue')?.getBoundingClientRect();
    return !status || !dice || dice.bottom <= status.top;
  }), 'move status and dice result stay separately readable on mobile');
  await delay(220);
  await shot('mobile-rent');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ summary, motion, renderer, audio, soloHandoffs }, null, 2));
  console.log(JSON.stringify({ origin, summary, motion, audio, soloHandoffs }, null, 2));
} catch (error) {
  console.error(error);
  await shot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
