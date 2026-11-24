import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = process.env.ISLANDS_REFINEMENT_URL || 'http://127.0.0.1:5215';
const baseline = process.env.ISLANDS_BASELINE_URL || 'http://127.0.0.1:5217';
const destination = process.env.ISLANDS_REFINEMENT_OUT || 'docs/royal-player-islands/refinement';
await mkdir(destination, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader'] });
const desktop = { width: 1440, height: 900, deviceScaleFactor: 1 };
const errors = [];
const report = { layout: {}, timing: {}, effects: {} };
const shot = (page, name) => page.screenshot({ path: path.join(destination, `${name}.jpg`), quality: 89 });
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function open(url, reduced = false, viewport = desktop) {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality', 'balanced'));
  await page.goto(`${url}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__graphicsAudit && window.__soloTest && window.__phase2Environment?.ready, { timeout: 90000 });
  await fixture(page, 'arcade-gallery-empty');
  await page.waitForFunction(() => window.__graphicsAudit.islands().islands.filter(island => island.statueDraws === 2).length === 4);
  return page;
}

const fixture = (page, name) => page.evaluate(name => window.__soloTest.fixture(name), name);

async function button(page, text, scope = 'button') {
  const handle = await page.waitForFunction((text, scope) => [...document.querySelectorAll(scope)].find(button =>
    button.textContent.trim() === text && !button.disabled && button.getBoundingClientRect().width > 0), {}, text, scope);
  await handle.asElement().click();
  await handle.dispose();
}

async function tradeOffer(page) {
  await button(page, 'Trade', '.fantasy-dock button');
  await page.waitForSelector('.trade-modal');
  await page.select('.trade-modal select', '1');
  for (const [index, value] of ['500', '35'].entries()) {
    await page.locator(`.trade-cash-grid label:nth-child(${index + 1}) input`).fill(value);
  }
  await page.locator('.trade-modal-actions .primary:not([disabled])').click();
  await page.waitForFunction(() => !!window.__soloTest.state().pendingTrade && !document.querySelector('.trade-modal'));
}

async function roll(page, first, second) {
  await page.evaluate(([first, second]) => {
    const random = Math.random, faces = [first, second];
    try {
      Math.random = () => faces.length ? (faces.shift() - .5) / 6 : random();
      document.querySelector('button[aria-label="Roll dice"]').click();
    } finally { Math.random = random; }
  }, [first, second]);
}

const auditIslands = page => page.evaluate(() => window.__graphicsAudit.islands(true));

async function boardsClear(page) {
  const blockers = await page.evaluate(() => {
    const audit = window.__graphicsAudit;
    const hud = [...document.querySelectorAll('.kingdom-brand, .resource-bar, .fantasy-players, .fantasy-shortcuts, .solo-turn-cue, .action-tray, .dice-controls, .city-solo-home')]
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    const hudOverlaps = audit.islands(true).islands.filter(island => {
      const box = island.layout.screen;
      return box.left < 0 || box.right > innerWidth || box.top < 0 || box.bottom > innerHeight ||
        hud.some(rect => rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top);
    }).map(island => island.edge);
    return { hudOverlaps, tiles: audit.tiles().filter(tile => tile.pickableTileId !== tile.id || tile.occludedByCity ||
      tile.occludedByEnvironment || tile.occludedByPlayerIslands).map(tile => tile.id) };
  });
  assert.deepEqual(blockers, { hudOverlaps: [], tiles: [] });
}

async function aim(page, position, target, close = true) {
  await page.evaluate(({ position, target, close }) => window.__graphicsAudit.camera(position, target, close), { position, target, close });
  await delay(140);
}

async function startRecording(page) {
  return page.evaluate(() => new Promise(resolve => {
    if (!window.MediaRecorder?.isTypeSupported('video/webm;codecs=vp8')) { resolve(false); return; }
    const webgl = document.querySelector('.world-layer canvas');
    const canvas = document.createElement('canvas');
    canvas.width = webgl.width; canvas.height = webgl.height;
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 3_500_000 });
    const pieces = [];
    recorder.ondataavailable = event => { if (event.data.size) pieces.push(event.data); };
    let capturedAt = -Infinity;
    // Copy immediately after Three finishes the frame, before its default drawing buffer is cleared.
    const stopCapture = window.__graphicsAudit.observeRender(({ at }) => {
      if (at - capturedAt < 1000 / 24) return;
      context.drawImage(webgl, 0, 0);
      capturedAt = at;
      if (recorder.state === 'inactive') { recorder.start(); resolve(true); }
    });
    window.__islandClip = { recorder, pieces, stream, stopCapture };
  }));
}

async function saveRecording(page) {
  const recording = await page.evaluate(() => new Promise((resolve, reject) => {
    const { recorder, pieces, stream, stopCapture } = window.__islandClip;
    stopCapture();
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); reader.onerror = reject;
      reader.readAsDataURL(new Blob(pieces, { type: 'video/webm' }));
      delete window.__islandClip;
    };
    recorder.stop();
  }));
  const playback = await browser.newPage();
  try {
    const playable = await playback.evaluate(src => new Promise(resolve => {
      const video = document.createElement('video');
      video.muted = true; video.preload = 'auto';
      const timeout = setTimeout(() => resolve(false), 7000);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 8;
      const ctx = canvas.getContext('2d');
      const check = () => {
        ctx.drawImage(video, 0, 0, 8, 8);
        const colors = ctx.getImageData(0, 0, 8, 8).data;
        if (video.videoWidth > 0 && colors.some((channel, index) => index % 4 !== 3 && channel > 32)) {
          clearTimeout(timeout); resolve(true);
        } else video.requestVideoFrameCallback(check);
      };
      video.onerror = () => { clearTimeout(timeout); resolve(false); };
      video.onloadeddata = check;
      video.src = src;
      void video.play();
    }), recording);
    assert.ok(playable, 'the captured WebM decodes to a rendered frame');
  } finally { await playback.close(); await page.bringToFront(); }
  await writeFile(path.join(destination, 'two-way-transfer.webm'), Buffer.from(recording.split(',')[1], 'base64'));
}

async function timed(page, span, action) {
  await page.evaluate(() => window.__graphicsAudit.start());
  if (action) await action();
  await delay(span);
  return page.evaluate(() => {
    const { samples, metadata } = window.__graphicsAudit.stop();
    const quantile = (field, percentile) => {
      const sorted = samples.map(sample => sample[field]).filter(Number.isFinite).sort((a, b) => a - b);
      return sorted.length ? Math.round(sorted[Math.floor(percentile * (sorted.length - 1))] * 100) / 100 : null;
    };
    return { renderer: metadata.renderer, frames: samples.length, fps: Math.round(10000 / quantile('frameMs', .5)) / 10,
      medianFrameMs: quantile('frameMs', .5), p95FrameMs: quantile('frameMs', .95), cpuMedianMs: quantile('renderCpuMs', .5),
      gpuMedianMs: quantile('gpuMs', .5), drawCalls: quantile('calls', .5), p95DrawCalls: quantile('calls', .95), triangles: quantile('triangles', .5),
      textures: metadata.memory.textures, geometries: metadata.memory.geometries, approximateMemory: metadata.allocationEstimates };
  });
}

try {
  for (const [name, url] of [['before', baseline], ['after', origin]]) {
    const page = await open(url);
    await delay(650);
    report.timing[name] = { idle: await timed(page, 1250) };
    await tradeOffer(page);
    report.timing[name].simultaneous = await timed(page, 1700, () => button(page, 'Accept trade'));
    assert.deepEqual(await page.evaluate(() => window.__soloTest.state().players.map(player => player.money)), [1035, 1965, 1500, 1500]);
    await page.close();
    console.log(`${name}: matched overview and two-way trade timings captured`);
  }

  const before = await open(baseline, true);
  report.layout.before = (await auditIslands(before)).islands;
  await shot(before, 'before-overview');
  await aim(before, [10.32, 2.9, 15.4], [17.82, -.88, 0], false);
  await shot(before, 'before-griffin');
  await before.close();

  const showcase = await open(origin, true);
  await boardsClear(showcase);
  report.layout.after = (await auditIslands(showcase)).islands;
  const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'];
  report.layout.hudColors = await showcase.$$eval('.kingdom-player', cards => cards.map(card => ({
    card: card.style.getPropertyValue('--player-color').trim(),
    portrait: card.querySelector('.player-portrait circle[r="46"]')?.getAttribute('stroke'),
  })));
  assert.deepEqual(report.layout.hudColors, colors.map(color => ({ card: color, portrait: color })));
  for (const island of report.layout.after) {
    const earlier = report.layout.before.find(before => before.seat === island.seat);
    assert.deepEqual(island.position, earlier.position);
    const fields = ['statueScale', 'statueHeight'];
    for (const field of fields) assert.equal(island.layout[field], earlier.layout[field]);
    for (const index of [0, 2]) assert.equal(island.layout.footprint[index], earlier.layout.footprint[index]);
    assert.deepEqual(island.plaque, earlier.plaque);
    assert.equal(island.color, colors[island.seat]);
    assert.equal(island.links, 5);
    assert.ok(island.layout.rockDepth > 3.55 && island.layout.rockDepth < 4.07);
    assert.deepEqual(island.stacks.map(stack => [stack.value, stack.count]), [[1000, 1], [500, 1]]);
  }
  await shot(showcase, 'after-overview');
  await showcase.click('[aria-label="Toggle overhead camera"]');
  await showcase.waitForFunction(() => window.__graphicsAudit.metadata().camera.position[2] < 5);
  await boardsClear(showcase);
  await shot(showcase, 'overhead');
  await aim(showcase, [10.32, 2.9, 15.4], [17.82, -.88, 0], false);
  await shot(showcase, 'after-griffin-matched');
  for (const { edge, position: [x, , z] } of report.layout.after) {
    await aim(showcase, [x - 5.15, 1.73, z + 10.9], [x, -.97, z]);
    await shot(showcase, `${edge}-island`);
  }
  await aim(showcase, [17.90, .74, -6.75], [17.82, -.32, -.20]);
  await shot(showcase, 'pedestal');
  await aim(showcase, [13.65, .28, 3.25], [13.5, -.52, 0]);
  await shot(showcase, 'chain-anchors');
  const mint = await showcase.evaluate(() => window.__graphicsAudit.mintPreview());
  await writeFile(path.join(destination, 'coin-obverse-and-reverse.png'), Buffer.from(mint.split(',')[1], 'base64'));
  await showcase.close();

  const mobile = await open(origin, true, { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await boardsClear(mobile);
  await shot(mobile, 'mobile-overview');
  await tradeOffer(mobile);
  await button(mobile, 'Accept trade');
  await mobile.waitForFunction(() => window.__graphicsAudit.islands().transactions.length === 2);
  const reduced = await auditIslands(mobile);
  assert.deepEqual(reduced.flights, []);
  assert.ok(reduced.transactions.every(transaction => transaction.pieces.length === 0));
  assert.deepEqual(reduced.islands.map(island => island.displayedBalance), [1035, 1965, 1500, 1500]);
  await mobile.close();

  const demo = await open(origin);
  await tradeOffer(demo);
  const recording = await startRecording(demo);
  await button(demo, 'Accept trade');
  await demo.waitForFunction(() => window.__graphicsAudit.islands().flights.some(flight => flight.value === 500) &&
    window.__graphicsAudit.islands().flights.some(flight => flight.value === 20));
  const active = await auditIslands(demo);
  assert.deepEqual(active.transactions.map(({ fromId, toId, amount, pieces }) => ({ fromId, toId, amount, pieces })), [
    { fromId: 0, toId: 1, amount: 500, pieces: [500] }, { fromId: 1, toId: 0, amount: 35, pieces: [20, 10, 5] },
  ]);
  assert.equal(active.signals.length, 4);
  assert.deepEqual(active.islands.map(island => island.plaque.balance), [1035, 1965, 1500, 1500]);
  assert.deepEqual(active.islands.map(island => island.displayedBalance), [1500, 1500, 1500, 1500]);
  await delay(260);
  await shot(demo, 'simultaneous-transfer');
  await demo.waitForFunction(() => window.__graphicsAudit.islands().islands.every(island => island.displayedBalance === island.plaque.balance));
  const settled = await auditIslands(demo);
  for (const island of settled.islands) assert.equal(island.stacks.reduce((sum, stack) => sum + stack.value * stack.count, 0), island.displayedBalance);
  await shot(demo, 'settled-treasuries');
  await demo.waitForFunction(() => window.__graphicsAudit.islands().transactions.length === 0 && window.__graphicsAudit.islands().flights.length === 0);
  if (recording) await saveRecording(demo);
  report.effects.trade = { routes: active.transactions, signals: active.signals,
    balances: settled.islands.map(({ displayedBalance, stacks }) => ({ displayedBalance, stacks })), recording };
  await demo.reload({ waitUntil: 'domcontentloaded' });
  await demo.waitForFunction(() => window.__graphicsAudit?.islands().islands?.length === 4);
  const hydrated = await demo.evaluate(() => window.__graphicsAudit.islands());
  assert.deepEqual(hydrated.transactions, []);

  const focusTreasury = () => aim(demo, [23.85, 5.3, 10.1], [18.96, -.13, .47]);
  await fixture(demo, 'chest');
  await focusTreasury();
  await roll(demo, 1, 1);
  await demo.waitForFunction(() => window.__graphicsAudit.islands().transactions.some(transaction => transaction.fromId === null && transaction.toId === 0 && transaction.amount === 200) &&
    window.__graphicsAudit.islands().flights.some(flight => flight.value === 100));
  assert.equal(await demo.evaluate(() => window.__soloTest.state().players[0].money), 1700);
  await delay(205);
  await shot(demo, 'go-money-gain');
  report.effects.gain = (await auditIslands(demo)).transactions;

  await fixture(demo, 'chest');
  await focusTreasury();
  await roll(demo, 1, 2);
  await demo.waitForSelector('.card-reveal-backdrop', { visible: true });
  const duringCard = await demo.evaluate(() => ({
    cash: window.__soloTest.state().players[0].money,
    flights: window.__graphicsAudit.islands().flights,
    transactions: window.__graphicsAudit.islands().transactions,
  }));
  assert.deepEqual(duringCard, { cash: 1700, flights: [], transactions: [] });
  await button(demo, 'Resolve this card');
  await demo.waitForSelector('.card-reveal-backdrop', { hidden: true });
  await demo.waitForFunction(() => {
    const audit = window.__graphicsAudit.islands();
    return audit.transactions.length === 2 && audit.flights.some(flight => flight.value === 100);
  });
  const afterCard = await auditIslands(demo);
  assert.deepEqual(afterCard.transactions.map(({ fromId, toId, amount, pieces }) => ({ fromId, toId, amount, pieces })),
    Array.from({ length: 2 }, () => ({ fromId: null, toId: 0, amount: 200, pieces: [100, 100] })));
  assert.equal(await demo.evaluate(() => window.__soloTest.state().players[0].money), 1900);
  await delay(160);
  await shot(demo, 'card-and-go-gain');
  report.effects.card = { duringCard, transactions: afterCard.transactions };

  await fixture(demo, 'opening');
  await focusTreasury();
  await roll(demo, 1, 2);
  await demo.waitForFunction(() => window.__soloTest.state().turnPhase === 'LANDED_ACTION');
  await demo.click('footer button[title^="Buy Baltic"]');
  await demo.waitForFunction(() => window.__graphicsAudit.islands().transactions.some(transaction => transaction.fromId === 0 && transaction.toId === null && transaction.amount === 60) &&
    window.__graphicsAudit.islands().flights.some(flight => flight.value === 50));
  await delay(205);
  await shot(demo, 'purchase-money-loss');
  report.effects.loss = (await auditIslands(demo)).transactions;
  await demo.close();

  assert.deepEqual(errors, []);
  await writeFile(path.join(destination, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ timing: report.timing, trade: report.effects.trade.routes, video: report.effects.trade.recording }, null, 2));
} finally { await browser.close(); }
