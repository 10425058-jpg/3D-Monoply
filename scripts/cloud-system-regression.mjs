import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

// Cloud-only lifecycle, failure and composite checks against the built app.
// There are no production globals or fixtures added by this harness.
const origin = process.env.CLOUD_URL || 'http://127.0.0.1:4227';
const out = 'docs/cloud-system-overhaul/evidence/regression';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(out, { recursive: true });
const report = { passed: false, origin, startedAt: new Date().toISOString() };
const save = () => writeFile(`${out}/cloud-regression.json`, JSON.stringify(report, null, 2) + '\n');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
});

async function pageFor(quality = 'low', motion = 'reduce', size = [1440, 900]) {
  const page = await browser.newPage();
  const errors = [], warnings = [], consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warn') warnings.push(message.text());
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: motion }]);
  await page.evaluateOnNewDocument(tier => {
    localStorage.setItem('monopoly-graphics-quality', tier);
    let seed = 10425058;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }, quality);
  return { page, errors, warnings, consoleErrors };
}
async function load(page, audit = true) {
  await page.goto(`${origin}/${audit ? '?graphicsAudit' : ''}#solo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (audit) await page.waitForFunction(() => window.__graphicsAudit && window.__phase2Environment?.ready && window.__centralCityAudit?.ready,
    { timeout: 90000 });
  await pause(1000);
}
function compare(before, after, rectangle, filename) {
  return JSON.parse(execFileSync(process.env.PYTHON || 'python', [
    'tools/compare_board_capture.py', before, after, '--rect', ...rectangle.map(String), '--output', `${out}/${filename}.json`,
  ], { encoding: 'utf8' }));
}
async function posed(page) {
  // A click in open scenery invokes existing OrbitControls.onStart and stops
  // automatic preset settling after a media-query update. No board is selected.
  await page.mouse.click(350, 500);
  await page.evaluate(() => window.__graphicsAudit.camera([0, 37, 65], [0, -12, -20]));
  await pause(250);
}
async function capture(page, name) {
  const filename = `${out}/${name}.png`;
  await page.screenshot({ path: filename });
  return filename;
}

try {
  // A cloud-containing region outside the board and HUD must freeze exactly.
  // The composite includes falling water; a moving comparison is not presented
  // as a direct uniform/time measurement of the individual cloud material.
  {
    const { page, errors, consoleErrors } = await pageFor('balanced', 'reduce', [2048, 1170]);
    await load(page); await posed(page);
    const rectangle = [320, 520, 280, 360];
    const a = await capture(page, 'reduced-before'); await pause(700);
    const b = await capture(page, 'reduced-after');
    const reduced = compare(a, b, rectangle, 'reduced-cloud-composite');
    assert.equal(reduced.pixelIdentical, true, 'reduced motion freezes the cloud-containing composite');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await pause(250); await posed(page); await pause(500);
    const c = await capture(page, 'moving-before'); await pause(1000);
    const d = await capture(page, 'moving-after');
    const moving = compare(c, d, rectangle, 'moving-cloud-composite');
    assert.ok(moving.changedPixels > 0, 'normal-motion cloud-containing composite advances');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await pause(250);
    const e = await capture(page, 'hidden-before'); await pause(700);
    const f = await capture(page, 'hidden-after');
    const hidden = compare(e, f, rectangle, 'hidden-cloud-composite');
    assert.equal(hidden.pixelIdentical, true, 'hidden document freezes the cloud-containing composite');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await pause(350);
    const resumedBefore = await page.evaluate(() => window.__graphicsAudit.environment()); await pause(350);
    const resumedAfter = await page.evaluate(() => window.__graphicsAudit.environment());
    assert.ok(resumedAfter.waterfalls['waterfall-left'] > resumedBefore.waterfalls['waterfall-left'], 'shared environment motion resumes');
    await load(page, false);
    assert.equal(await page.evaluate(() => '__graphicsAudit' in window || '__phase2Environment' in window), false);
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    report.motion = { reduced, moving, hidden, resumedEnvironmentMotion: true, noProductionAuditGlobals: true, errors };
    await page.close(); await save(); console.log('PASS cloud-containing composite motion/reduced/hidden handling');
  }

  {
    const { page, errors, consoleErrors } = await pageFor();
    const downloads = [], cycles = [];
    page.on('response', response => {
      if (/\.glb$/.test(response.url()) || /cloud-volume-v3-.*\.png$/.test(response.url())) downloads.push({ url: response.url(), status: response.status() });
    });
    await page.setCacheEnabled(false); await load(page);
    for (let index = 0; index < 4; index++) {
      await page.waitForFunction(() => window.__graphicsAudit && window.__phase2Environment?.ready && window.__centralCityAudit?.ready,
        { timeout: 90000 });
      await pause(500);
      const state = await page.evaluate(() => ({
        metadata: window.__graphicsAudit.metadata(), environment: window.__graphicsAudit.environment(),
        canvasCount: document.querySelectorAll('canvas').length,
        modelUrls: window.__phase2Environment.assetUrls, textureUrls: window.__phase2Environment.textureUrls,
      }));
      assert.equal(state.canvasCount, 1); assert.equal(state.environment.fallbacks, 0);
      assert.ok(state.textureUrls.some(url => url.endsWith('/cloud-volume-v3-low.png')));
      if (cycles.length) {
        assert.equal(state.environment.meshes, cycles[0].environment.meshes);
        assert.deepEqual(state.metadata.allocationEstimates, cycles[0].metadata.allocationEstimates, 'live cloud buffer/image allocations stay bounded');
        assert.deepEqual(state.metadata.memory, cycles[0].metadata.memory, 'renderer allocations stay bounded');
      }
      cycles.push(state);
      await page.evaluate(() => { location.hash = 'home'; });
      await page.waitForFunction(() => !document.querySelector('canvas') && !window.__graphicsAudit && !window.__phase2Environment);
      if (index < 3) await page.evaluate(() => { location.hash = 'solo'; });
    }
    for (const url of [...cycles[0].modelUrls, ...cycles[0].textureUrls]) {
      assert.equal(downloads.filter(response => response.url === url).length, 1, `one actual download across four mounts: ${url}`);
      assert.equal(downloads.find(response => response.url === url)?.status, 200);
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    report.remounts = { cycles, downloads, errors };
    await page.close(); await save(); console.log('PASS four remounts and one v3 atlas download');
  }

  {
    const { page, errors, warnings, consoleErrors } = await pageFor();
    const rejected = [];
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().endsWith('/cloud-volume-v3-low.png')) { rejected.push(request.url()); request.abort('failed'); }
      else request.continue();
    });
    await page.goto(`${origin}/?graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__graphicsAudit?.environment().landmarks.length === 3 && window.__centralCityAudit?.ready,
      { timeout: 90000 });
    await pause(1200);
    assert.ok(rejected.length > 0, 'a real v3 atlas request was rejected');
    assert.ok(warnings.some(warning => warning.includes('sky cloud atlas') && warning.includes('fallback')));
    assert.ok(warnings.some(warning => warning.includes('soft cloud atlas') && warning.includes('fallback')));
    const data = await page.evaluate(() => ({
      tiles: window.__graphicsAudit.tiles(), metadata: window.__graphicsAudit.metadata(), environment: window.__graphicsAudit.environment(),
    }));
    assert.equal(data.environment.fallbacks, 0, 'healthy island GLBs stay mounted');
    assert.ok(data.metadata.materialTextures.some(texture => texture.name.startsWith('Sunset atmosphere ')), 'gradient sky fallback remains mounted');
    data.tiles.forEach(tile => { assert.equal(tile.pickableTileId, tile.id); assert.equal(tile.occludedByEnvironment, false); });
    const tile = data.tiles.find(item => item.id === 1);
    await page.mouse.click(tile.x, tile.y);
    await page.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === 1);
    await capture(page, 'failed-v3-atlas-fallback');
    assert.deepEqual(errors, [], 'atlas rejection is contained by decorative error boundaries');
    report.failedAtlas = { rejected, warnings, consoleErrors, pageErrors: errors, skyFallbackMounted: true, boardPicking: true,
      healthyLandmarks: data.environment.landmarks, metadata: data.metadata };
    await page.close(); await save(); console.log('PASS failed v3 atlas retains sky, islands and board picking');
  }

  report.contexts = [];
  for (const quality of ['low', 'balanced', 'high']) {
    const { page, errors, consoleErrors } = await pageFor(quality);
    await load(page); await pause(1200);
    const metadata = await page.evaluate(() => window.__graphicsAudit.metadata());
    assert.ok(metadata.materialTextures.some(texture => texture.name.startsWith('Sunset atmosphere ')));
    const before = await capture(page, `context-${quality}-before`);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const extension = gl.getExtension('WEBGL_lose_context');
      if (!extension) throw Error('Browser does not expose WEBGL_lose_context');
      window.__cloudContextTest = { lost: false, restored: false };
      canvas.addEventListener('webglcontextlost', () => { window.__cloudContextTest.lost = true; }, { once: true });
      canvas.addEventListener('webglcontextrestored', () => { window.__cloudContextTest.restored = true; }, { once: true });
      window.__restoreCloudContext = () => extension.restoreContext(); extension.loseContext();
    });
    await page.waitForFunction(() => window.__cloudContextTest.lost); await pause(250);
    await page.evaluate(() => window.__restoreCloudContext());
    await page.waitForFunction(() => window.__cloudContextTest.restored, { timeout: 30000 }); await pause(2200);
    const after = await capture(page, `context-${quality}-after`);
    const comparison = compare(before, after, [450, 15, 380, 65], `context-${quality}-sky`);
    assert.equal(comparison.pixelIdentical, true, 'textured sky is regenerated byte-for-byte after context restoration');
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    report.contexts.push({ quality, dpr: metadata.dpr, contextLost: true, contextRestored: true, comparison, errors });
    await page.close(); await save(); console.log(`PASS ${quality} sky context restoration`);
  }
  report.passed = true; report.completedAt = new Date().toISOString(); await save();
} catch (error) {
  report.failure = { message: error.message, recordedAt: new Date().toISOString() }; await save();
  throw error;
} finally { await browser.close(); }
