import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

// Paired production-preview runs, counterbalanced A/B then B/A at each tier.
// Keep all other browser captures/builds idle while sampling this one browser.
const origins = {
  before: process.env.FINAL_BEFORE_URL || 'http://127.0.0.1:4216',
  after: process.env.FINAL_AFTER_URL || 'http://127.0.0.1:4217',
};
const output = path.resolve('docs/final-background-overhaul/evidence/paired-performance.json');
const seed = 10425058;
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const warmupMs = 3000, sampleMs = 5000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const percentile = (values, p) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;
};
function summarize(samples) {
  const values = key => samples.map(sample => sample[key]);
  const frameMeanMs = samples.reduce((sum, sample) => sum + sample.frameMs, 0) / samples.length;
  return {
    samples: samples.length,
    fps: 1000 / frameMeanMs,
    frameMeanMs,
    frameP50Ms: median(values('frameMs')),
    frameP95Ms: percentile(values('frameMs'), .95),
    frameP99Ms: percentile(values('frameMs'), .99),
    gpuP50Ms: median(values('gpuMs')),
    cpuP50Ms: median(values('renderCpuMs')),
    callsP50: median(values('calls')),
    trianglesP50: median(values('triangles')),
    texturesP50: median(values('textures')),
    geometriesP50: median(values('geometries')),
    passesP50: median(values('passes')),
  };
}
const stablePose = value => JSON.parse(JSON.stringify(value, (_key, item) =>
  typeof item === 'number' ? Math.round(item * 1e8) / 1e8 : item));
function assertCameraMatches(actual, expected, message) {
  // Normal-motion responsive camera settling can differ by a few micrometres
  // with fresh-page load timing. One millimetre is far below one screen pixel.
  for (const key of ['position', 'target']) actual[key].forEach((value, axis) =>
    assert.ok(Math.abs(value - expected[key][axis]) < .001, `${message}: ${key}[${axis}]`));
  assert.ok(Math.abs(actual.fov - expected.fov) < .000001, `${message}: fov`);
  assert.deepEqual(stablePose(actual.view), stablePose(expected.view), `${message}: viewport offset`);
}

const report = {
  schema: 'monopoly.final-background.paired-performance.v1',
  startedAt: new Date().toISOString(),
  conditions: {
    origins, seed, viewport: [viewport.width, viewport.height], browserDpr: 1,
    expectedRenderDpr: { low: .9, balanced: 1, high: 1 },
    cameraPositionToleranceMetres: .001,
    motion: 'normal', warmupMs, sampleMs,
    orderPerQuality: ['before', 'after', 'after', 'before'],
    isolation: 'One fresh browser context and one page per run; pages are closed sequentially.',
    note: 'Local observed measurements; no inference of another device or driver performance.',
  },
  runtime: {
    node: process.version, v8: process.versions.v8, platform: process.platform, architecture: process.arch,
    puppeteer: JSON.parse(await readFile(new URL('../node_modules/puppeteer-core/package.json', import.meta.url), 'utf8')).version,
  },
  runs: [],
  comparisons: [],
};
await mkdir(path.dirname(output), { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
report.runtime.chrome = await browser.version();
report.runtime.userAgent = await browser.userAgent();

async function sample(quality, label, index) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.evaluateOnNewDocument(({ quality, initialSeed }) => {
      localStorage.setItem('monopoly-graphics-quality', quality);
      let value = initialSeed;
      Math.random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
    }, { quality, initialSeed: seed });
    const startedAt = new Date().toISOString(), started = performance.now();
    await page.goto(`${origins[label]}/?graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__graphicsAudit && window.__phase2Environment?.ready && window.__centralCityAudit?.ready,
      { timeout: 90000 });
    const readyMs = performance.now() - started;
    await pause(warmupMs);
    const before = await page.evaluate(() => ({
      metadata: window.__graphicsAudit.metadata(),
      environment: window.__graphicsAudit.environment(),
      game: window.__graphicsAudit.game(),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
    assert.equal(before.metadata.quality, quality);
    assert.deepEqual(before.metadata.viewport, [viewport.width, viewport.height]);
    assert.equal(before.metadata.dpr, report.conditions.expectedRenderDpr[quality]);
    assert.equal(before.environment.fallbacks, 0);
    assert.equal(before.environment.shadowCasters, 0);
    assert.equal(before.reducedMotion, false);
    const heapBefore = await page.metrics();
    const sampleStarted = performance.now();
    await page.evaluate(() => window.__graphicsAudit.start());
    await pause(sampleMs);
    const data = await page.evaluate(() => ({
      ...window.__graphicsAudit.stop(), environment: window.__graphicsAudit.environment(), game: window.__graphicsAudit.game(),
    }));
    const actualSampleMs = performance.now() - sampleStarted;
    const heapAfter = await page.metrics();
    assert.ok(data.samples.length >= 5, `${label}/${quality}: insufficient rendered frames`);
    assert.ok(data.samples.every(frame => Number.isFinite(frame.frameMs) && frame.frameMs > 0));
    assert.deepEqual(errors, [], `${label}/${quality}: browser errors`);
    assertCameraMatches(data.metadata.camera, before.metadata.camera, 'camera stayed fixed');
    assert.deepEqual(data.game, before.game, 'game state stayed fixed during measurement');
    const run = {
      index, pair: index < 2 ? 'AB' : 'BA', label, quality, url: origins[label], startedAt,
      readyMs, actualSampleMs, summary: summarize(data.samples),
      heap: {
        usedBeforeBytes: heapBefore.JSHeapUsedSize, usedAfterBytes: heapAfter.JSHeapUsedSize,
        totalBeforeBytes: heapBefore.JSHeapTotalSize, totalAfterBytes: heapAfter.JSHeapTotalSize,
      },
      metadata: data.metadata,
      environment: data.environment,
      game: data.game,
      errors,
      samples: data.samples,
    };
    const previous = report.runs.find(item => item.quality === quality);
    if (previous) {
      assertCameraMatches(run.metadata.camera, previous.metadata.camera, 'paired camera pose matches');
      assert.equal(run.metadata.renderer, previous.metadata.renderer, 'paired renderer matches');
      assert.equal(run.metadata.three, previous.metadata.three, 'paired Three.js runtime matches');
      assert.equal(run.metadata.dpr, previous.metadata.dpr, 'paired renderer DPR matches');
      assert.deepEqual(run.metadata.drawingBuffer, previous.metadata.drawingBuffer, 'paired drawing buffer matches');
    }
    report.runs.push(run);
    await writeFile(output, JSON.stringify(report) + '\n');
    console.log(JSON.stringify({ quality, pair: run.pair, label, ...run.summary, heapUsedBytes: run.heap.usedAfterBytes }));
  } finally {
    await page.close();
    await context.close();
  }
}

try {
  for (const quality of ['low', 'balanced', 'high']) {
    for (const [index, label] of ['before', 'after', 'after', 'before'].entries()) await sample(quality, label, index);
    const qualityRuns = report.runs.filter(run => run.quality === quality);
    const combined = label => {
      const runs = qualityRuns.filter(run => run.label === label);
      const pooled = summarize(runs.flatMap(run => run.samples));
      // Preserve each repetition's FPS: pooling samples weights a faster run
      // more strongly, so comparisons use the median of equal-duration runs.
      return {
        ...pooled,
        fps: median(runs.map(run => run.summary.fps)),
        repetitionFps: runs.map(run => run.summary.fps),
        heapUsedP50Bytes: median(runs.map(run => run.heap.usedAfterBytes)),
      };
    };
    const before = combined('before'), after = combined('after');
    const change = key => before[key] && after[key] !== null ? (after[key] / before[key] - 1) * 100 : null;
    report.comparisons.push({ quality, before, after, changePercent: {
      fps: change('fps'), frameP50Ms: change('frameP50Ms'), gpuP50Ms: change('gpuP50Ms'),
      cpuP50Ms: change('cpuP50Ms'), callsP50: change('callsP50'), trianglesP50: change('trianglesP50'),
      heapUsedP50Bytes: change('heapUsedP50Bytes'),
    } });
  }
  report.completedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report) + '\n');
  console.log(JSON.stringify({ output, comparisons: report.comparisons }));
} catch (error) {
  report.failure = { message: error.message, recordedAt: new Date().toISOString() };
  await writeFile(output, JSON.stringify(report) + '\n');
  throw error;
} finally {
  await browser.close();
}
