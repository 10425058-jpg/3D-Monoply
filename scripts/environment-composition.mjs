import puppeteer from 'puppeteer-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const label = process.argv[2] || 'after';
const out = path.resolve('docs/environment-composition/evidence', label);
await mkdir(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('monopoly-graphics-quality', 'balanced');
    let seed = 10425058;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await page.goto(`${process.env.AUDIT_URL || 'http://127.0.0.1:4175'}/?graphicsAudit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__graphicsAudit); await pause(3000);
  const camera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
  await page.screenshot({ path: path.join(out, 'overview.png') });
  await page.evaluate(() => window.__graphicsAudit.start()); await pause(5000);
  const measurements = await page.evaluate(() => window.__graphicsAudit.stop());
  const layers = process.argv.includes('--diagnose') ? ['kingdom-valley', 'mountain-ranges', 'kingdom-cloud-layers', 'ancient-stone-bridges', 'kingdom-waterways'] : [];
  for (const name of layers) {
    await page.evaluate(name => window.__graphicsAudit.environmentLayer(name, false), name); await pause(100);
    await page.screenshot({ path: path.join(out, `without-${name}.png`) });
    await page.evaluate(name => window.__graphicsAudit.environmentLayer(name, true), name);
  }
  const tiles = await page.evaluate(() => window.__graphicsAudit.tiles());
  // Existing three-quarter overview remains a useful composition check too.
  await page.evaluate(() => window.__graphicsAudit.camera([0, 32, 30], [0, .5, 0])); await pause(100);
  await page.screenshot({ path: path.join(out, 'three-quarter.png') });
  for (const name of layers) {
    await page.evaluate(name => window.__graphicsAudit.environmentLayer(name, false), name); await pause(100);
    await page.screenshot({ path: path.join(out, `three-quarter-without-${name}.png`) });
    await page.evaluate(name => window.__graphicsAudit.environmentLayer(name, true), name);
  }
  const frames = measurements.samples;
  const median = key => frames.map(frame => frame[key]).filter(value => value !== null).sort((a, b) => a - b)[Math.floor(frames.length / 2)];
  const result = { label, camera, metadata: measurements.metadata, tiles, errors,
    summary: { fps: 1000 / (frames.reduce((sum, f) => sum + f.frameMs, 0) / frames.length),
      calls: median('calls'), triangles: median('triangles'), textures: median('textures'), gpuMs: median('gpuMs') } };
  await writeFile(path.join(out, 'capture.json'), JSON.stringify(result, null, 2));
  if (label === 'after') {
    const before = JSON.parse(await readFile(path.join(out, '../before/capture.json'), 'utf8'));
    assert.deepEqual(camera, before.camera, 'the overview camera must match the before capture exactly');
    assert.deepEqual(result.metadata.viewport, before.metadata.viewport);
    assert.equal(result.metadata.dpr, before.metadata.dpr);
  }
  console.log(JSON.stringify({ label, camera, summary: result.summary, errors }));
} finally { await browser.close(); }
