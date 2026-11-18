import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

// Real production previews. Keep the baseline frozen while the candidate is
// iterated; screenshot captures never replace or composite any scene pixels.
const label = process.argv[2] || 'after';
assert.ok(['before', 'after', 'checkpoint'].includes(label));
const origin = process.env.CLOUD_URL || `http://127.0.0.1:${label === 'before' ? 4226 : 4227}`;
const evidence = 'docs/cloud-system-overhaul/evidence';
const output = `${evidence}/${label}`;
const seed = 10425058;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const scenarios = [
  { name: 'high-angle', quality: 'balanced', size: [2048, 1170], position: [.8, 71, 7.5], target: [0, .7, 0], clearBoard: true },
  { name: 'top-down', quality: 'high', size: [2048, 1170], position: [0, 76, 3.1], target: [0, .7, 0], clearBoard: true },
  { name: 'overview', quality: 'balanced', size: [1440, 900], clearBoard: true },
  { name: 'board-centered', quality: 'high', size: [2048, 1170], position: [4.5, 27, 40], target: [0, .7, 0] },
  { name: 'wide-fantasy', quality: 'balanced', size: [2048, 1170], position: [0, 37, 65], target: [0, -12, -20] },
  { name: 'island-underside-left', quality: 'high', size: [1440, 900], position: [-7, -10, 9], target: [-30, -30, -18], detail: true },
  { name: 'island-underside-right', quality: 'high', size: [1440, 900], position: [46, -3, 13], target: [28, -24, -20], detail: true },
  { name: 'reverse-world', quality: 'balanced', size: [1440, 900], position: [20, 36, -62], target: [0, -8, 0] },
  { name: 'phone', quality: 'low', size: [390, 844], clearBoard: true },
  { name: 'landscape', quality: 'balanced', size: [844, 390], clearBoard: true },
];
const selected = process.env.CLOUD_VIEWS?.split(',');
if (process.env.CLOUD_QUALITY) scenarios.forEach(scenario => { scenario.quality = process.env.CLOUD_QUALITY; });
const stable = value => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'number' ? Math.round(item * 1e8) / 1e8 : item));
function assertCameraMatches(actual, expected, message) {
  for (const key of ['position', 'target']) actual[key].forEach((value, axis) =>
    assert.ok(Math.abs(value - expected[key][axis]) < .001, `${message}: ${key}[${axis}]`));
  assert.ok(Math.abs(actual.fov - expected.fov) < .000001, `${message}: fov`);
  assert.deepEqual(stable(actual.view), stable(expected.view), `${message}: viewport offset`);
}

await mkdir(output, { recursive: true });
const baseline = label === 'after' ? JSON.parse(await readFile(`${evidence}/before/views.json`, 'utf8')) : null;
const previousViews = selected ? await readFile(`${output}/views.json`, 'utf8').then(JSON.parse).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return [];
}) : [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
});
const views = [];
try {
  for (const scenario of scenarios.filter(s => !selected || selected.includes(s.name))) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(), errors = [], responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => {
      if (/cloud[^/]*\.png(?:$|\?)/.test(response.url())) responses.push({ url: response.url(), status: response.status() });
    });
    try {
      await page.setViewport({ width: scenario.size[0], height: scenario.size[1], deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument(({ quality, initialSeed }) => {
        localStorage.setItem('monopoly-graphics-quality', quality);
        let value = initialSeed;
        Math.random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
      }, { quality: scenario.quality, initialSeed: seed });
      const started = Date.now();
      await page.goto(`${origin}/?graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.__graphicsAudit && window.__phase2Environment?.ready && window.__centralCityAudit?.ready,
        { timeout: 90000 });
      await pause(1600);
      if (scenario.position) {
        await page.evaluate(s => window.__graphicsAudit.camera(s.position, s.target), scenario);
        await pause(600);
      }
      const data = await page.evaluate(() => ({
        metadata: window.__graphicsAudit.metadata(), tiles: window.__graphicsAudit.tiles(),
        environment: window.__graphicsAudit.environment(), game: window.__graphicsAudit.game(),
      }));
      assert.equal(data.metadata.quality, scenario.quality);
      assert.deepEqual(data.metadata.viewport, scenario.size);
      assert.equal(data.environment.fallbacks, 0);
      assert.equal(data.environment.shadowCasters, 0);
      assert.equal(data.tiles.length, 40);
      if (!scenario.detail) data.tiles.forEach(tile => assert.equal(tile.occludedByEnvironment, false, `${scenario.name}: tile ${tile.id} scenery occlusion`));
      if (scenario.clearBoard) data.tiles.forEach(tile => {
        assert.equal(tile.pickableTileId, tile.id, `${scenario.name}: tile ${tile.id} real geometric picking`);
        assert.equal(tile.occludedByCity, false, `${scenario.name}: tile ${tile.id} city occlusion`);
      });
      if (baseline) {
        const previous = baseline.find(view => view.name === scenario.name);
        assert.ok(previous, `${scenario.name} has a real baseline capture`);
        assertCameraMatches(data.metadata.camera, previous.metadata.camera, scenario.name);
        assert.equal(data.metadata.dpr, previous.metadata.dpr);
        assert.deepEqual(data.metadata.drawingBuffer, previous.metadata.drawingBuffer);
        assert.deepEqual(data.game, previous.game, 'scene-only work preserves opening game state');
      }
      assert.deepEqual(errors, []);
      const filename = `${output}/${scenario.name}.png`;
      await page.screenshot({ path: filename });
      const screenshotSha256 = createHash('sha256').update(await readFile(filename)).digest('hex');
      const ablations = [];
      if (scenario.name === 'high-angle' && !process.env.CLOUD_SKIP_ABLATION) {
        assert.equal(await page.evaluate(() => window.__graphicsAudit.environmentLayer('kingdom-cloud-layers', false)), true);
        await pause(150);
        const ablation = `${output}/high-angle-sky-only.png`;
        await page.screenshot({ path: ablation });
        ablations.push({ file: ablation, visibleLayer: 'baked sky; world cloud layer disabled through existing audit API',
          sha256: createHash('sha256').update(await readFile(ablation)).digest('hex') });
        await page.evaluate(() => window.__graphicsAudit.environmentLayer('kingdom-cloud-layers', true));
      }
      assert.deepEqual(errors, []);
      views.push({ ...scenario, capturedAt: new Date().toISOString(), readyMs: Date.now() - started,
        seed, browserDpr: 1, reducedMotion: true, screenshot: filename, screenshotSha256, ablations,
        cloudResponses: responses, errors, ...data });
      const merged = new Map(previousViews.map(view => [view.name, view]));
      views.forEach(view => merged.set(view.name, view));
      const ordered = scenarios.map(view => merged.get(view.name)).filter(Boolean);
      await writeFile(`${output}/views.json`, JSON.stringify(ordered) + '\n');
      console.log(`${label}: ${scenario.name}`);
    } finally {
      await page.close(); await context.close();
    }
  }
} finally { await browser.close(); }
