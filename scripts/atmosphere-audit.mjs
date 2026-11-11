import puppeteer from 'puppeteer-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Reproducible production workload: seeded game, frozen environment motion,
// 1440x900 CSS pixels, DPR 1, 4s warmup, 5s per camera, all quality tiers.
// This measures this browser/GPU, not a promise of student-laptop performance.
const label = process.argv[2] || 'after';
const out = path.resolve(process.env.AUDIT_EVIDENCE_ROOT || 'docs/fantasy-polish/evidence', label);
const origin = process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const qualities = process.env.AUDIT_QUALITIES?.split(',') || ['low', 'balanced', 'high'];
const sampleMs = Number(process.env.AUDIT_SAMPLE_MS || 5000);
assert.ok(sampleMs >= 1000 && Number.isFinite(sampleMs), 'sample window must be at least 1s');
assert.ok(qualities.every(quality => ['low', 'balanced', 'high'].includes(quality)), 'unknown quality');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
});
const summaries = [];
try {
  for (const quality of qualities) {
    const page = await browser.newPage();
    // Each tier needs an observed 200 + body hash, even when another tab loaded
    // the same distant GLB. Exclude conditional 304 responses from this gate.
    await page.setCacheEnabled(false);
    const errors = [], assetLoads = [], failedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => {
      if (/\/assets\/models\/environment\/.*\.glb(?:\?|$)/.test(response.url())) {
        assetLoads.push(response.buffer().then(body => ({ url: response.url(), status: response.status(),
          bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }))
          .catch(error => ({ url: response.url(), status: response.status(), error: error.message })));
      }
    });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(tier => {
      let seed = 10425058;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      localStorage.setItem('monopoly-graphics-quality', tier);
    }, quality);
    await page.goto(`${origin}/?graphicsAudit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__graphicsAudit, { timeout: 60000 });
    await page.waitForFunction(() => window.__phase2Environment?.ready, { timeout: 60000 });
    await pause(4000);
    const scenarios = [];
    for (const cameraName of ['overview', 'reference']) {
      if (cameraName === 'reference') {
        await page.evaluate(() => window.__graphicsAudit.camera([4.5, 27, 40], [0, .7, 0]));
        await pause(1000);
      }
      const camera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
      const tiles = await page.evaluate(() => window.__graphicsAudit.tiles());
      for (const tile of tiles) assert.equal(tile.occludedByEnvironment, false, `environment hides tile ${tile.id} in ${cameraName}`);
      if (cameraName === 'overview') {
        assert.equal(tiles.length, 40);
        for (const tile of tiles) {
          assert.ok(tile.x >= 0 && tile.x <= 1440 && tile.y >= 0 && tile.y <= 900 && tile.depth > -1 && tile.depth < 1, `tile ${tile.id} outside viewport`);
          assert.equal(tile.pickableTileId, tile.id, `tile ${tile.id} physical ray`);
          assert.equal(tile.occludedByCity, false, `city hides tile ${tile.id}`);
          if ('occludedByEnvironment' in tile) assert.equal(tile.occludedByEnvironment, false, `environment hides tile ${tile.id}`);
        }
      }
      await page.evaluate(() => window.__graphicsAudit.start());
      await pause(sampleMs);
      const measurement = await page.evaluate(() => window.__graphicsAudit.stop());
      // Keep visible evidence even if an unexpectedly slow candidate fails the
      // frame gate below; final comparisons still require enough real samples.
      await page.screenshot({ path: path.join(out, `${quality}-${cameraName}.png`) });
      const sorted = key => measurement.samples.map(sample => sample[key]).filter(value => value !== null).sort((a, b) => a - b);
      const percentile = (key, amount = .5) => { const values = sorted(key); return values.length ? values[Math.min(values.length - 1, Math.floor(values.length * amount))] : null; };
      // Short art checkpoints must still capture a slow candidate for diagnosis.
      // Final 5-second comparisons retain the original >30-frame requirement.
      assert.ok(measurement.samples.length > (sampleMs < 3000 ? 10 : 30), 'measurement window must contain real frames');
      const summary = {
        fps: 1000 / (measurement.samples.reduce((sum, sample) => sum + sample.frameMs, 0) / measurement.samples.length),
        frameP50: percentile('frameMs'), frameP95: percentile('frameMs', .95),
        renderCpuP50: percentile('renderCpuMs'), gpuP50: percentile('gpuMs'),
        calls: percentile('calls'), triangles: percentile('triangles'), textures: percentile('textures'),
        geometries: percentile('geometries'), samples: measurement.samples.length,
      };
      const result = { cameraName, camera, tiles, summary, ...measurement };
      scenarios.push(result);
      summaries.push({ quality, camera: cameraName, ...summary });
      console.log(JSON.stringify({ label, quality, camera: cameraName, ...summary }));
    }
    const environment = await page.evaluate(() => window.__phase2Environment || null);
    const assetResponses = await Promise.all(assetLoads);
    assert.deepEqual(errors, [], 'browser rendering errors');
    assert.deepEqual(failedRequests, [], 'failed browser network requests');
    assert.ok(environment?.ready && environment.assetUrls?.length, 'loaded asset readiness');
    for (const assetUrl of environment.assetUrls) {
      const response = assetResponses.find(response => response.url.endsWith(assetUrl));
      assert.ok(response && response.status === 200, `GLB loaded successfully: ${assetUrl}`);
      const artifact = await readFile(path.resolve('public/assets/models/environment', path.basename(new URL(assetUrl, origin).pathname)));
      assert.equal(response.sha256, createHash('sha256').update(artifact).digest('hex'), `served GLB matches exported public artifact: ${assetUrl}`);
    }
    if (label !== 'before') {
      const before = JSON.parse(await readFile(path.resolve(out, '../before', `${quality}.json`), 'utf8'));
      scenarios.forEach((scenario, index) => {
        assert.deepEqual(scenario.camera, before.scenarios[index].camera, 'identical camera required');
        assert.deepEqual(scenario.metadata.viewport, before.scenarios[index].metadata.viewport);
        assert.equal(scenario.metadata.dpr, before.scenarios[index].metadata.dpr);
      });
    }
    await writeFile(path.join(out, `${quality}.json`), JSON.stringify({ label, quality, motion: 'reduced', sampleMs, warmupMs: 4000, environment, assetResponses, failedRequests, errors, scenarios }, null, 2));
    await page.close();
  }
  await writeFile(path.join(out, 'summary.json'), JSON.stringify(summaries, null, 2));
} finally { await browser.close(); }
