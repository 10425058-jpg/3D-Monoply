import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = process.env.ISLANDS_URL || 'http://127.0.0.1:5195';
const baseline = process.env.ISLANDS_BASELINE_URL;
const output = process.env.ISLANDS_EVIDENCE_DIR || 'docs/royal-player-islands/evidence';
const layoutOnly = process.argv.includes('--layout-only');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader'],
});
const views = [];
const desktop = { width: 1440, height: 900, deviceScaleFactor: 1 };
const mobile = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const denominations = [1, 5, 10, 20, 50, 100, 500, 1000];
const errors = [];
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.jpg`), quality: 90 });

async function loadPage(viewport, url = origin, reduce = true) {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality', 'balanced'));
  await page.goto(`${url}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => window.__graphicsAudit && window.__soloTest && window.__phase2Environment?.ready,
    { timeout: 90_000 });
  await page.evaluate(() => window.__soloTest.fixture('royal-tokens'));
  await page.waitForFunction(() => {
    const tokens = window.__graphicsAudit.royalTokens();
    return tokens.length === 4 && tokens.every(actor => actor.drawMeshes > 0);
  }, { timeout: 90_000 });
  if (url === origin) await page.waitForFunction(() => {
    const audit = window.__graphicsAudit.islands();
    return audit.islands.length === 4 && audit.islands.every(island => island.statueDraws === 2);
  }, { timeout: 90_000 });
  return page;
}

async function view(page, name, overview = true) {
  const audit = await page.evaluate(() => ({
    ...window.__graphicsAudit.islands(true), tiles: window.__graphicsAudit.tiles(),
    hud: [...document.querySelectorAll('.kingdom-brand, .resource-bar, .fantasy-players, .fantasy-shortcuts, .solo-turn-cue, .action-tray, .dice-controls, .dock-utilities, .city-solo-home')]
      .map(node => ({ name: node.classList[0], ...node.getBoundingClientRect().toJSON() })).filter(rect => rect.width && rect.height),
  }));
  assert.equal(audit.islands.length, 4);
  assert.deepEqual(audit.islands.map(({ seat, edge, statue }) => [seat, edge, statue]), [
    [0, 'east', 'RoyalGriffin'], [1, 'north', 'RoyalUnicorn'], [2, 'west', 'RoyalCarriage'], [3, 'south', 'RoyalPegasus'],
  ]);
  const expectedSigns = [1, -1, -1, 1];
  for (const [index, island] of audit.islands.entries()) {
    const axis = index % 2 === 0 ? 0 : 2;
    const mount = expectedSigns[index] > 0 ? island.chainBounds.min[axis] : -island.chainBounds.max[axis];
    assert.ok(mount > 12.4 && mount < 12.8, `${island.edge} chain reaches the board wall`);
    assert.ok(Math.abs(island.chainBounds.min[2 - axis]) < .4 && Math.abs(island.chainBounds.max[2 - axis]) < .4);
    assert.ok(island.chainBounds.max[axis] - island.chainBounds.min[axis] < 2.1, `${island.edge} chain stays short`);
    assert.ok(Math.abs(island.position[2 - axis]) < 1e-6);
    assert.ok(Math.abs(island.position[axis] - 17.82 * expectedSigns[index]) < 1e-6);
    assert.deepEqual(island.coins, denominations);
    assert.equal(island.plaque.balance, 1500);
    assert.equal(island.statueDraws, 2);
    assert.ok(island.statueTriangles < 10_000);
    const [across, , depth] = island.layout.footprint;
    for (const diameter of [across, depth]) assert.ok(diameter / 25.4 >= .25 && diameter / 25.4 <= .30);
    assert.ok(Math.abs(across - audit.islands[0].layout.footprint[0]) < 1e-5);
    assert.ok(Math.abs(depth - audit.islands[0].layout.footprint[2]) < 1e-5);
    assert.equal(island.layout.statueScale, 1.24);
    if (overview) {
      const { width, height } = page.viewport();
      const { left, right, top, bottom } = island.layout.screen;
      assert.ok(left > 0 && right < width && top > 0 && bottom < height, `${name} ${island.edge} shoreline clips the viewport`);
      const covering = audit.hud.filter(rect => rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top);
      assert.deepEqual(covering.map(rect => rect.name), [], `${name} ${island.edge} island overlaps the HUD`);
    }
  }
  const hidden = audit.tiles.filter(tile => tile.occludedByPlayerIslands ||
    (overview && (tile.occludedByCity || tile.occludedByEnvironment || tile.pickableTileId !== tile.id)));
  assert.deepEqual(hidden.map(tile => tile.id), [], `${name} tile centers`);
  assert.deepEqual(audit.signals, []);
  await shot(page, name);
  views.push({ name, islands: audit.islands, unobstructedTileCenters: audit.tiles.length });
  console.log(`${name}: four statues, four chains, all eight coin denominations, and ${audit.tiles.length} tile centers checked`);
  return audit.tiles;
}

async function samples(page) {
  // Use the same production scene, viewport, quality and warm-up on both builds.
  await page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    const stop = window.__graphicsAudit.observeRender(() => { if (++frames === 20) { stop(); resolve(); } });
  }));
  return page.evaluate(() => new Promise(resolve => {
    const audit = window.__graphicsAudit;
    audit.start();
    let frames = 0;
    const stop = audit.observeRender(() => {
      if (++frames !== 65) return;
      stop();
      const { samples, metadata } = audit.stop();
      const percentile = (key, t) => {
        const data = samples.map(sample => sample[key]).filter(value => Number.isFinite(value)).sort((a, b) => a - b);
        return data.length ? Math.round(data[Math.floor(t * (data.length - 1))] * 100) / 100 : null;
      };
      resolve({ renderer: metadata.renderer, frames: samples.length, callsP50: percentile('calls', .5),
        trianglesP50: percentile('triangles', .5), frameMsP50: percentile('frameMs', .5), frameMsP95: percentile('frameMs', .95),
        cpuMsP50: percentile('renderCpuMs', .5), gpuMsP50: percentile('gpuMs', .5) });
    });
  }));
}

async function roll(page, faces) {
  await page.evaluate(faces => {
    const random = Math.random;
    try {
      Math.random = () => faces.length ? (faces.shift() - .5) / 6 : random();
      document.querySelector('[aria-label="Roll dice"]').click();
    } finally { Math.random = random; }
  }, faces);
}

async function rent(page, name, reduce) {
  await page.evaluate(() => window.__soloTest.fixture('rent'));
  await roll(page, [1, 2]);
  await page.locator('dialog[open].rent-payment [data-variant="primary"]').click();
  await page.waitForFunction(reduce => {
    const { signals, flights } = window.__graphicsAudit.islands();
    return signals.length === 2 && (reduce || flights.some(coin => coin.value === 1));
  }, { timeout: 40_000 }, reduce);
  const { signals, islands, flights } = await page.evaluate(() => window.__graphicsAudit.islands());
  assert.deepEqual(signals.map(({ seat, amount, label }) => [seat, amount, label]), [[0, -4, '−$4'], [1, 4, '+$4']]);
  assert.deepEqual(islands.slice(0, 2).map(island => island.plaque.balance), [1496, 1504]);
  if (reduce) assert.deepEqual(flights, []);
  await page.waitForSelector('.match-notice[data-activity-notice="rent"]', { visible: true });
  const covered = await page.evaluate(() => {
    const receipt = document.querySelector('.match-notice[data-activity-notice="rent"]').getBoundingClientRect();
    return window.__graphicsAudit.islands(true).islands.filter(({ layout: { screen } }) =>
      receipt.left < screen.right && receipt.right > screen.left && receipt.top < screen.bottom && receipt.bottom > screen.top)
      .map(island => island.edge);
  });
  assert.deepEqual(covered, [], `${name} receipt overlaps the islands`);
  await shot(page, name);
  await page.waitForFunction(() => window.__graphicsAudit.islands().signals.length === 0);
  return { signals, flights };
}

try {
  const game = await loadPage(desktop);
  const tiles = await view(game, 'overview');
  const results = { views, benchmark: {} };
  if (!layoutOnly) results.benchmark.islands = await samples(game);
  const baltic = tiles.find(tile => tile.id === 3);
  await game.mouse.move(baltic.x, baltic.y);
  assert.equal((await game.evaluate(() => window.__graphicsAudit.game())).selectedSpaceId, null);
  await game.mouse.click(baltic.x, baltic.y);
  await game.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === 3);
  await game.click('[aria-label="Close property card"]');
  await game.click('[aria-label="Toggle overhead camera"]');
  await game.waitForFunction(() => window.__graphicsAudit.metadata().camera.position[2] < 5);
  await view(game, 'overhead');
  await game.evaluate(() => window.__graphicsAudit.camera([6, 20, 27], [0, .8, 0]));
  await view(game, 'gameplay-angle', false);
  await game.evaluate(() => window.__graphicsAudit.camera([10, 5.4, 8.6], [17, -.35, 0]));
  await shot(game, 'statue-and-coins');
  await game.close();

  if (baseline && !layoutOnly) {
    const earlier = await loadPage(desktop, baseline);
    results.benchmark.baseline = await samples(earlier);
    await earlier.close();
  }

  const phone = await loadPage(mobile);
  const spaces = await view(phone, 'mobile-overview');
  const mediterranean = spaces.find(tile => tile.id === 1);
  await phone.touchscreen.tap(mediterranean.x, mediterranean.y);
  await phone.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === 1);
  await phone.click('[aria-label="Close property card"]');
  if (!layoutOnly) results.reducedMotionRent = await rent(phone, 'reduced-motion-rent', true);
  await phone.close();

  for (const [name, viewport] of [['compact-desktop', { ...desktop, width: 1024, height: 768 }],
    ['compact-phone', { ...mobile, width: 360, height: 640 }]]) {
    const page = await loadPage(viewport);
    await view(page, name);
    if (!layoutOnly && name === 'compact-phone') await rent(page, 'compact-phone-rent', true);
    await page.close();
  }

  if (!layoutOnly) {
    const animated = await loadPage(desktop, origin, false);
    results.animatedRent = await rent(animated, 'rent-transfer', false);
    await animated.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'validation.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ views: views.map(view => view.name), ...results.benchmark,
    rent: results.animatedRent, mobileReducedMotion: Boolean(results.reducedMotionRent) }, null, 2));
} finally {
  await browser.close();
}
