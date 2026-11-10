import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const out = path.resolve('docs/graphics-phase-1/evidence/regression');
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function clickFooter(page, text) {
  for (const button of await page.$$('footer button')) {
    if (await button.evaluate((element, label) => element.textContent.trim() === label, text)) {
      await button.click(); return;
    }
  }
  throw new Error(`Missing footer button: ${text}`);
}
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('monopoly-graphics-quality', 'balanced');
    let seed = 10425058;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  for (const [width, height] of [[1440, 900], [1366, 768], [768, 1024], [390, 844]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 640, hasTouch: width < 640 });
    await page.goto(`${origin}/?graphicsAudit`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__graphicsAudit);
    await pause(4000);
    const tiles = await page.evaluate(() => window.__graphicsAudit.tiles());
    for (const p of tiles) {
      assert.ok(p.x > 0 && p.x < width && p.y > 0 && p.y < height && p.depth < 1, `tile ${p.id} clipped at ${width}x${height}`);
      assert.equal(p.occludedByCity, false, `tile ${p.id} hidden by city at ${width}x${height}`);
      assert.equal(p.pickableTileId, p.id, `tile ${p.id} physical raycast at ${width}x${height}`);
    }
    await page.screenshot({ path: path.join(out, `overview-${width}x${height}.png`) });
    // All forty spaces must still be reachable by the real pointer raycaster.
    for (const p of tiles) {
      if (width < 640) {
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForFunction(id => window.__graphicsAudit.game().selectedSpaceId === id, { timeout: 3000 }, p.id);
        await page.click('[aria-label="Close property card"]');
        // Closing a deed queues the camera's return to overview. Let that
        // projection update before using coordinates from the overview again.
        await pause(150);
        continue;
      }
      await page.mouse.move(width - 2, height / 2);
      await page.mouse.move(p.x, p.y);
      try { await page.waitForFunction(id => window.__graphicsAudit.hovered.includes(id), { timeout: 3000 }, p.id); }
      catch (error) { throw new Error(`Hover tile ${p.id} at ${width}x${height}: ${JSON.stringify(await page.evaluate(() => window.__graphicsAudit.game()))}`, { cause: error }); }
    }
    results.push({ viewport: [width, height], visibleTileCenters: tiles.length, unoccludedByCity: true,
      picking: { type: width < 640 ? 'touch and geometric raycast' : 'mouse hover and geometric raycast', count: 40 },
      camera: await page.evaluate(() => window.__graphicsAudit.metadata().camera) });
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await page.goto(`${origin}/?graphicsAudit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__graphicsAudit); await pause(3000);
  const tile = await page.evaluate(() => window.__graphicsAudit.tiles().find(p => p.id === 1));
  await page.mouse.click(tile.x, tile.y);
  await page.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === 1);
  await page.click('[aria-label="Close property card"]');
  await page.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === null);
  const topButton = await page.$('button[title="Switch to Top-Down View"]');
  await topButton.click(); await pause(500);
  assert.equal(await page.evaluate(() => window.__graphicsAudit.game().cameraMode), 'top');
  assert.equal((await page.evaluate(() => window.__graphicsAudit.tiles())).filter(p => p.occludedByCity).length, 0);
  await page.screenshot({ path: path.join(out, 'top-view.png') });
  await page.click('button[title="Switch to 3D Isometric View"]'); await pause(500);
  const presets = [];
  for (const preset of ['player', 'dice', 'movement', 'event', 'overview']) {
    await page.select('select[aria-label="Camera view"]', preset); await pause(250);
    const camera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
    assert.equal(!!camera.view?.enabled, preset === 'overview', `projection for ${preset}`);
    presets.push({ preset, position: camera.position });
  }
  await page.click('.camera-toolbar button'); await pause(250);
  const before = await page.evaluate(() => window.__graphicsAudit.metadata().camera.position);
  await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(900, 490, { steps: 12 }); await page.mouse.up();
  await pause(600); const orbit = await page.evaluate(() => window.__graphicsAudit.metadata().camera.position);
  assert.ok(orbit.some((v, i) => Math.abs(v - before[i]) > .2), 'orbit changed position');
  await page.mouse.wheel({ deltaY: -180 }); await pause(600);
  const zoom = await page.evaluate(() => window.__graphicsAudit.metadata().camera.position);
  assert.ok(zoom.some((v, i) => Math.abs(v - orbit[i]) > .2), 'zoom changed position');
  // Drive a real human turn through existing controls. Only dice RNG is fixed.
  await page.evaluate(() => { let roll = 0; Math.random = () => roll++ === 0 ? 0 : .18; });
  await page.click('[aria-label="Roll dice"]');
  await page.waitForFunction(() => window.__graphicsAudit.game().turnPhase === 'LANDED_ACTION', { timeout: 20000 });
  let game = await page.evaluate(() => window.__graphicsAudit.game());
  assert.deepEqual(game.dice, [1, 2]); assert.equal(game.players[0].position, 3);
  await page.click('footer button[title^="Buy Baltic"]');
  await page.waitForFunction(() => window.__graphicsAudit.game().properties[3].ownerId === 0);
  game = await page.evaluate(() => window.__graphicsAudit.game());
  assert.equal(game.players[0].money, 1440); assert.equal(game.turnPhase, 'END_TURN');
  await clickFooter(page, 'End Turn');
  await page.waitForFunction(() => window.__graphicsAudit.game().currentPlayerIndex === 1);
  results.push({ selection: true, topToggle: true, presets, resetView: true, orbit: true, zoom: true, dice: [1, 2], movement: 'GO -> Baltic Avenue',
    purchase: { owner: 0, balance: 1440 }, endTurn: true });
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, results, errors }));
} catch (error) {
  console.error(error);
  const pages = await browser.pages(); await pages.at(-1)?.screenshot({ path: path.join(out, 'failure.png') });
  process.exitCode = 1;
} finally { await browser.close(); }
