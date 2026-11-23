import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const origin = process.env.V6_FALLBACK_URL || 'http://127.0.0.1:4198';
const out = process.env.V6_FALLBACK_OUT || 'docs/final-graphics-v6/evidence/fallback';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const results = { blockedRequests: [], warnings: [], consoleErrors: [], consoleErrorDetails: [], pageErrors: [], unexpectedNetworkFailures: [] };
const centralModel = /\/assets\/models\/central-city\/central-royal-district(?:-(?:low|balanced))?\.glb(?:\?|$)/;
const page = await browser.newPage();
const wait = fn => page.waitForFunction(fn, { timeout: 90000 });
const snapshot = () => page.evaluate(() => window.__fallbackFountainAudit.snapshot());
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('monopoly-graphics-quality', 'balanced');
    let seed = 10425058;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (centralModel.test(request.url())) { results.blockedRequests.push(request.url()); request.abort('failed'); }
    else request.continue();
  });
  page.on('requestfailed', request => {
    if (!centralModel.test(request.url())) results.unexpectedNetworkFailures.push({ url: request.url(), error: request.failure()?.errorText });
  });
  page.on('pageerror', error => results.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warn') results.warnings.push(message.text());
    if (message.type() === 'error') {
      results.consoleErrors.push(message.text());
      results.consoleErrorDetails.push({ text: message.text(), url: message.location().url });
    }
  });
  await page.goto(`${origin}/?graphicsAudit&soloTest#solo`, { waitUntil: 'domcontentloaded' });
  await wait(() => window.__soloTest && window.__graphicsAudit && window.__phase2Environment?.ready && window.__fallbackFountainAudit);
  await pause(500);
  assert.ok(results.blockedRequests.length > 0, 'the central model request actually fails');
  assert.ok(results.warnings.some(text => text.includes('[Central city] district asset unavailable')), 'the model error is handled by the existing fallback boundary');
  await page.evaluate(() => window.__soloTest.fixture('opening'));
  await pause(250);
  const reducedA = await snapshot(); await pause(450); const reducedB = await snapshot();
  assert.deepEqual(reducedB, reducedA, 'fallback fountain remains still with reduced motion');
  assert.deepEqual(reducedA.sprayPosition, [0, 1.66, 0], 'static jets retain their original nozzle anchor');
  assert.ok(reducedA.lowerWaterY + 0.02 > 0.35 && reducedA.lowerWaterY + 0.02 < 0.44, 'lower water surface is visible above its cap and inside the rim');
  assert.ok(reducedA.middleWaterY + 0.02 > 0.94 && reducedA.middleWaterY + 0.02 < 0.995, 'middle water surface is visible above its cap and inside the rim');
  assert.ok(Math.abs(reducedA.rippleRotation[0] + Math.PI / 2) < 1e-9, 'ripples lie on the horizontal water plane');
  results.reducedMotion = { before: reducedA, after: reducedB };
  const tiles = await page.evaluate(() => window.__graphicsAudit.tiles());
  for (const tile of tiles) {
    assert.equal(tile.pickableTileId, tile.id, `fallback: tile ${tile.id} remains pickable`);
    assert.equal(tile.occludedByCity, false, `fallback: city does not cover tile ${tile.id}`);
    assert.equal(tile.occludedByEnvironment, false, `fallback: environment does not cover tile ${tile.id}`);
  }
  results.clearPlayableTiles = tiles.length;
  await page.screenshot({ path: `${out}/reduced-motion-overview.png` });
  const tile = tiles.find(tile => tile.id === 1);
  await page.mouse.click(tile.x, tile.y);
  await wait(() => window.__graphicsAudit.game().selectedSpaceId === 1);
  await page.click('[aria-label="Close property card"]');
  await wait(() => window.__graphicsAudit.game().selectedSpaceId === null);
  results.pointerSelection = true;
  await page.evaluate(() => window.__graphicsAudit.camera([14, 17, 24], [0, 2.3, -1.8]));
  await pause(300);
  results.reducedCamera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
  await page.screenshot({ path: `${out}/reduced-motion-castle-fountain.png` });

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await wait(() => window.__fallbackFountainAudit.snapshot().sprayRotation[1] > 0);
  const motion = [];
  for (let index = 0; index < 8; index++) { motion.push(await snapshot()); await pause(100); }
  assert.ok(motion.at(-1).sprayRotation[1] > motion[0].sprayRotation[1], 'normal fountain motion advances');
  motion.forEach(value => {
    assert.ok(value.sprayPosition[1] >= 1.64 && value.sprayPosition[1] <= 1.68, 'moving jets stay at 1.66 +/- 0.02 rather than falling to ground');
    assert.ok(value.lowerWaterY + 0.02 > 0.35 && value.lowerWaterY + 0.02 < 0.44, 'moving lower water stays above its cap and below its rim');
    assert.ok(value.middleWaterY + 0.02 > 0.94 && value.middleWaterY + 0.02 < 0.995, 'moving middle water stays above its cap and below its rim');
    assert.ok(Math.abs(value.rippleRotation[0] + Math.PI / 2) < 1e-9, 'moving ripples stay horizontal');
    assert.equal(value.rippleScale[0], value.rippleScale[1], 'horizontal ripple axes expand equally');
    assert.equal(value.rippleScale[2], 1, 'ripple thickness stays constant');
  });
  results.normalMotion = motion;
  results.normalCamera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
  await page.screenshot({ path: `${out}/normal-motion-castle-fountain.png` });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await pause(150);
  const frozenA = await snapshot(); await pause(300); const frozenB = await snapshot();
  assert.deepEqual(frozenB, frozenA, 'live reduced-motion toggle stops fallback movement');
  results.liveMotionToggle = true;
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pause(150);
  const hiddenA = await snapshot(); await pause(300); assert.deepEqual(await snapshot(), hiddenA, 'hidden tab stops fallback motion');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  results.hiddenTabPause = true;

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => window.__graphicsAudit.camera([0, 29, 27], [0, 0.7, 0])); await pause(200);
  await page.evaluate(() => {
    let faces = [1, 2]; const original = Math.random;
    Math.random = () => { const value = (faces.shift() - 0.5) / 6; if (!faces.length) Math.random = original; return value; };
  });
  await page.click('[aria-label="Roll dice"]');
  await wait(() => window.__soloTest.state().turnPhase === 'LANDED_ACTION');
  await page.click('footer button[title^="Buy Baltic"]');
  await wait(() => window.__soloTest.state().properties[3].ownerId === 0);
  const purchased = await page.evaluate(() => window.__soloTest.state());
  assert.deepEqual(purchased.dice, [1, 2]);
  assert.equal(purchased.players[0].position, 3);
  assert.equal(purchased.players[0].money, 1440);
  assert.equal(purchased.turnPhase, 'END_TURN');
  results.gameplay = { dice: purchased.dice, position: 3, owner: 0, balance: 1440, phase: purchased.turnPhase };
  await page.screenshot({ path: `${out}/fallback-purchase.png` });
  // React's development build reports the deliberately rejected loader error
  // to window.onerror before the city boundary recovers. Accept only that
  // exact blocked URL/message; every unrelated exception still fails the run.
  const expectedModelError = text => results.blockedRequests.some(url => text === `Could not load ${url}: Failed to fetch`);
  results.expectedModelPageErrors = results.pageErrors.filter(expectedModelError);
  results.unexpectedPageErrors = results.pageErrors.filter(text => !expectedModelError(text));
  assert.deepEqual(results.unexpectedPageErrors, []);
  assert.deepEqual(results.unexpectedNetworkFailures, []);
  results.unexpectedConsoleErrors = results.consoleErrorDetails.filter(({ text, url }) => !(
    expectedModelError(text) ||
    (centralModel.test(url || '') && text === 'Failed to load resource: net::ERR_FAILED') ||
    (text.startsWith('The above error occurred in the <RoyalDistrict> component:') && text.includes('CityAssetBoundary'))
  ));
  assert.deepEqual(results.unexpectedConsoleErrors, []);
  await page.evaluate(() => { location.hash = 'home'; });
  await wait(() => !document.querySelector('canvas') && !window.__fallbackFountainAudit);
  results.auditCleanup = true;
  results.passed = true;
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await rm(`${out}/failure.png`, { force: true });
  console.log('Passed forced central GLB failure: reduced/normal fountain transforms, live motion toggle, hidden-tab pause, 40 clear tiles, pointer selection, real roll/purchase and audit cleanup.');
} catch (error) {
  results.passed = false; results.failure = error.stack;
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
