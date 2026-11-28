import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = process.env.V11_TEST_URL ?? 'http://127.0.0.1:4271';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const output = process.env.V11_OUTPUT ?? 'docs/v11-game-feel/evidence';
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});

const page = await browser.newPage();
const errors = [];
const captures = [];
page.on('pageerror', error => errors.push(error.message));
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('monopoly-graphics-quality', 'balanced');
  localStorage.setItem('monopoly-audio-muted', 'false');
  localStorage.setItem('monopoly-audio-volume', '0.25');
  const now = performance.now.bind(performance);
  let heldAt;
  performance.now = () => heldAt ?? now();
  window.v11Hold = () => { heldAt ??= now(); };
  window.v11Resume = () => { heldAt = undefined; };
  const start = OscillatorNode.prototype.start;
  const setValue = AudioParam.prototype.setValueAtTime;
  const frequencies = new WeakMap();
  window.v11Notes = [];
  AudioParam.prototype.setValueAtTime = function (value, when) {
    if (!frequencies.has(this)) frequencies.set(this, value);
    return setValue.call(this, value, when);
  };
  OscillatorNode.prototype.start = function (when) {
    window.v11Notes.push({ frequency: frequencies.get(this.frequency), at: performance.now() });
    return start.call(this, when);
  };
});
page.setDefaultTimeout(60_000);
const wait = (fn, ...args) => page.waitForFunction(fn, { polling: 45 }, ...args);
const state = () => page.evaluate(() => window.__soloTest.state());
const fixture = (name, speed = 1) => page.evaluate((name, speed) => {
  window.__soloTest.fixture(name);
  window.__soloTest.setSpeed(speed);
}, name, speed);
const camera = (position, target) => page.evaluate((p, t) => window.__graphicsAudit.camera(p, t, true), position, target);
const capture = async (name) => {
  const file = `${name}.jpg`;
  await page.evaluate(() => window.v11Hold());
  try {
    await page.screenshot({ path: join(output, file), type: 'jpeg', quality: 88 });
  } finally {
    await page.evaluate(() => window.v11Resume());
  }
  captures.push(file);
};
async function roll(first, second) {
  await wait(() => document.querySelector('[aria-label="Roll dice"]:enabled'));
  await page.evaluate((first, second) => {
    const values = [first, second];
    const button = document.querySelector('[aria-label="Roll dice"]');
    const random = Math.random;
    Math.random = () => values.length ? (values.shift() - .5) / 6 : random();
    try { button.click(); } finally { Math.random = random; }
  }, first, second);
}
const dock = text => page.evaluate(text => {
  const button = [...document.querySelectorAll('.action-tray button')].find(button => button.textContent.trim() === text);
  if (button?.disabled || !button) throw new Error(`Action unavailable: ${text}`);
  button.click();
}, text);

async function startRecording() {
  await page.evaluate(() => {
    const source = document.querySelector('.world-layer canvas[data-engine]');
    const stream = source.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2_200_000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    window.v11Clip = () => new Promise(resolve => {
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.stop();
    });
    recorder.start();
  });
}

async function saveRecording(name) {
  const encoded = await page.evaluate(() => window.v11Clip());
  const bytes = Buffer.from(encoded, 'base64');
  assert.ok(bytes.length > 4000, 'Recording contains captured WebGL frames');
  await writeFile(join(output, name), bytes);
  captures.push(name);
}

async function settledDice(values) {
  await wait(values => {
    const dice = window.__graphicsAudit.dice();
    return window.__soloTest.state().turnPhase !== 'ROLLING' &&
      dice.every((die, index) => die.visible && die.highlighted && die.face === values[index] && die.up > .999);
  }, values);
}

try {
  await page.goto(`${origin}/?graphicsAudit&soloTest#solo`, { waitUntil: 'domcontentloaded' });
  await wait(() => window.__soloTest && window.__graphicsAudit && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
  await page.mouse.click(288, 118);
  await fixture('arcade-evolution');
  await wait(() => window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 4);
  await camera([2, 16, 14], [0, .8, 4.2]);
  await roll(1, 2);
  await settledDice([1, 2]);
  await fixture('arcade-evolution');
  await camera([2, 16, 14], [0, .8, 4.2]);
  await startRecording();
  await roll(3, 3);
  await settledDice([3, 3]);
  await wait(() => {
    const badge = document.querySelector('.dice-result[data-doubles]');
    if (!badge?.textContent.includes('3 + 3 = 6') || !window.__graphicsAudit.dice().every(die => die.highlighted)) return false;
    window.v11Hold();
    return true;
  });
  await capture('01-doubles');
  await camera([2, 12, 21], [3, .5, 8.2]);
  await wait(() => window.__soloTest.state().turnPhase === 'LANDED_ACTION');
  await saveRecording('dice-and-token.webm');
  assert.deepEqual((await state()).dice, [3, 3]);
  const notes = await page.evaluate(() => window.v11Notes.map(note => note.frequency));
  assert.ok(notes.some(frequency => [164, 206, 265].includes(frequency)) && notes.includes(1175),
    `Actual Web Audio oscillators scheduled a collision and the doubles chime, got ${JSON.stringify(notes)}`);

  await camera([.9, 6.5, 16.4], [.9, .55, 9.4]);
  await dock('Build');
  await page.waitForSelector('.evolution-footer button');
  await startRecording();
  await page.click('.evolution-footer button');
  await wait(() => window.__graphicsAudit.cues().includes('effect-ownership-6'));
  assert.equal((await state()).players[0].money, 1400);
  assert.equal((await state()).properties[6].ownerId, 0);
  await capture('02-property-purchase');
  await wait(() => document.querySelector('.evolution-footer button')?.textContent.includes('House'));
  await page.click('.evolution-footer button');
  await wait(() => window.__graphicsAudit.arcade().construction.some(cue => cue.spaceId === 6 && cue.level === 1));
  await capture('03-house-construction');
  await wait(() => window.__graphicsAudit.arcade().buildings.some(model =>
    model.spaceId === 6 && model.level === 1 && model.source === 'gltf' && model.scale[1] > .999));
  await saveRecording('purchase-and-build.webm');
  assert.equal((await state()).players[0].money, 1350);
  assert.equal((await state()).activity.filter(event => event.kind === 'upgrade').length, 1);

  await fixture('royal-tokens');
  await wait(() => window.__graphicsAudit.royalTokens().filter(token => token.asset && token.tile === 0).length === 4);
  const shared = await page.evaluate(() => window.__graphicsAudit.royalTokens());
  assert.equal(new Set(shared.map(token => token.position.join(','))).size, 4);

  await fixture('chest');
  await camera([15, 9, 19], [9.2, .4, 9.4]);
  await page.evaluate(() => {
    window.v11Steps = [];
    window.v11StopSteps = window.__soloTest.observeTurn(turn => {
      if (turn.phase === 'MOVING' && window.v11Steps.at(-1) !== turn.tile) window.v11Steps.push(turn.tile);
    });
  });
  await roll(1, 2);
  await wait(() => window.__graphicsAudit.cues().includes('effect-transaction-0'));
  await page.locator('dialog[open].card-reveal.deck-chest .modal-primary').filter('button => button.textContent.trim() === "Draw Card"').click();
  await page.waitForSelector('dialog[open].card-reveal.deck-chest .card-parchment');
  assert.deepEqual(await page.evaluate(() => window.v11Steps), [39, 0, 1, 2]);
  await page.evaluate(() => window.v11StopSteps());
  await capture('04-community-chest');
  await page.click('.card-reveal .modal-primary');

  await fixture('rent');
  await camera([13, 41, 35], [0, .5, 0]);
  await startRecording();
  await roll(1, 2);
  await page.locator('dialog[open].rent-payment [data-variant="primary"]').click();
  await wait(() => window.__graphicsAudit.islands().flights.length > 0);
  const rent = await state();
  assert.deepEqual(rent.players.slice(0, 2).map(player => player.money), [1496, 1504]);
  const transactions = await page.evaluate(() => window.__graphicsAudit.islands().transactions);
  assert.deepEqual(transactions.map(({ fromId, toId, amount }) => ({ fromId, toId, amount })), [{ fromId: 0, toId: 1, amount: 4 }]);
  await wait(() => {
    const islands = window.__graphicsAudit.islands().islands;
    return islands[0].displayedBalance === 1496 && islands[1].displayedBalance === 1504;
  });
  await capture('05-rent-transfer');
  await saveRecording('rent-transfer.webm');

  await fixture('go-to-jail');
  await camera([-12, 9, 18], [-9.5, .4, 9.5]);
  await roll(1, 2);
  await wait(() => window.__graphicsAudit.cues().includes('effect-jail-10'));
  assert.ok((await state()).players[0].inJail);
  await capture('06-jail');

  await fixture('arcade-gallery');
  await wait(() => window.__graphicsAudit.arcade().buildings.length === 4);
  assert.deepEqual(await page.evaluate(() => window.__graphicsAudit.arcade().construction), []);
  await wait(() => window.__graphicsAudit.dice().every(die => !die.visible) &&
    window.__graphicsAudit.islands().transactions.length === 0 && !document.querySelector('.dice-result'));

  const cdp = await page.createCDPSession();
  const resourceSample = async () => {
    await fixture('opening');
    await wait(() => !window.__graphicsAudit.cues().length && !window.__graphicsAudit.islands().transactions.length);
    await cdp.send('HeapProfiler.collectGarbage');
    const resources = await page.evaluate(async () => {
      const audit = window.__graphicsAudit;
      audit.start();
      await new Promise(resolve => {
        let frames = 0;
        const stop = audit.observeRender(() => {
          if (++frames === 3) { stop(); setTimeout(resolve, 0); }
        });
      });
      const frame = audit.stop().samples.at(-1);
      return { geometries: frame.geometries, textures: frame.textures };
    });
    return { ...resources, heapBytes: (await page.metrics()).JSHeapUsedSize };
  };
  const resourcesBefore = await resourceSample();
  for (let index = 0; index < 5; index++) {
    await fixture('rent', 2);
    await roll(1, 2);
    await page.locator('dialog[open].rent-payment [data-variant="primary"]').click();
    await wait(() => window.__graphicsAudit.islands().flights.length > 0);
    await fixture('opening');
    await wait(() => !window.__graphicsAudit.islands().transactions.length);
  }
  const resourcesAfter = await resourceSample();
  await cdp.detach();
  assert.equal(resourcesAfter.geometries, resourcesBefore.geometries);
  assert.equal(resourcesAfter.textures, resourcesBefore.textures);
  assert.ok(resourcesAfter.heapBytes - resourcesBefore.heapBytes < 5 * 1024 * 1024);

  assert.deepEqual(errors, []);
  const { renderer } = await page.evaluate(() => window.__graphicsAudit.metadata());
  await writeFile(join(output, 'browser.json'), JSON.stringify({ captures, renderer, browser: await browser.version(),
    dice: [3, 3], cornerSteps: [39, 0, 1, 2], rent: [1496, 1504], transactions, resourcesBefore, resourcesAfter, errors }, null, 2) + '\n');
  console.log('V11 browser checks passed', captures);
} finally {
  await browser.close();
}
