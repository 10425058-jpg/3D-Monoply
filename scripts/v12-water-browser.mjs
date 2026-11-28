import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const urls = {
  before: process.env.V12_BASELINE_URL ?? 'http://127.0.0.1:4270',
  after: process.env.V12_TEST_URL ?? 'http://127.0.0.1:4271',
};
const output = process.env.V12_OUTPUT ?? 'docs/v12-interactive-gameplay/evidence';
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const poses = {
  waterfall: { position: [-40, -7, 9], target: [-31, -28, -17] },
  overview: { position: [4.5, 27, 40], target: [0, .7, 0] },
};
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const errors = [];
const samples = [];
const captures = {};
const page = await browser.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.setViewport(viewport);
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('monopoly-graphics-quality', 'balanced');
  localStorage.setItem('monopoly-audio-muted', 'true');
});

async function open(build, reducedMotion) {
  const url = urls[build];
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }]);
  await page.goto(`${url}/?graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__centralCityAudit?.ready && window.__phase2Environment?.ready &&
    window.__graphicsAudit?.environment().waterfalls['waterfall-left'] !== undefined, { timeout: 60_000 });
  await page.mouse.click(720, 430); // Release the opening camera.
  await page.mouse.move(5, 5);
}

const aim = pose => page.evaluate(({ position, target }) => window.__graphicsAudit.camera(position, target, true), pose);

async function collect(page, count) {
  return page.evaluate(count => new Promise((resolve, reject) => {
    const audit = window.__graphicsAudit;
    let frames = 0;
    const timer = setTimeout(() => {
      stop();
      audit.stop();
      reject(new Error('Timed out waiting for rendered frames'));
    }, 25_000);
    const stop = audit.observeRender(() => {
      if (++frames !== count) return;
      stop();
      clearTimeout(timer);
      setTimeout(() => resolve(audit.stop()), 0);
    });
    audit.start();
  }), count);
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

function summarize(scenario, build) {
  const frames = samples.filter(run => run.scenario === scenario && run.build === build).flatMap(run => run.frames);
  const stats = key => {
    const values = frames.map(frame => frame[key]).filter(Number.isFinite);
    return values.length ? [.5, .95].map(fraction => Number(percentile(values, fraction).toFixed(2))) : null;
  };
  return {
    sampledFrames: frames.length,
    frameMs: stats('frameMs'),
    renderCpuMs: stats('renderCpuMs'),
    gpuMs: stats('gpuMs'),
    calls: percentile(frames.map(frame => frame.calls), .5),
    triangles: percentile(frames.map(frame => frame.triangles), .5),
    passes: percentile(frames.map(frame => frame.passes), .5),
  };
}

try {
  for (const build of Object.keys(urls)) {
    await open(build, true);
    await aim(poses.waterfall);
    const { metadata } = await collect(page, 12);
    assert.equal(await page.evaluate(() => window.__graphicsAudit.environment().fallbacks), 0);
    captures[build] = { camera: metadata.camera, renderer: metadata.renderer };
    await page.screenshot({ path: join(output, `water-${build}.jpg`), quality: 92 });
  }
  assert.deepEqual(captures.before, captures.after, 'Same renderer and camera for the two water captures');

  // Navigate the same active tab for every run so two WebGL scenes cannot compete for the GPU.
  for (let pair = 0; pair < 4; pair++) {
    for (const build of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
      await open(build, false);
      for (const [scenario, pose] of Object.entries(poses)) {
        await aim(pose);
        await collect(page, 24);
        const { samples: frames, metadata } = await collect(page, 31);
        assert.ok(frames.length >= 30);
        assert.equal(metadata.renderer, captures[build].renderer);
        samples.push({ scenario, build, pair: pair + 1, camera: metadata.camera, dpr: metadata.dpr, frames });
      }
    }
  }

  const summary = Object.fromEntries(Object.keys(poses).map(scenario =>
    [scenario, { before: summarize(scenario, 'before'), after: summarize(scenario, 'after') }]));
  for (const run of samples.filter(run => run.build === 'after')) {
    const baseline = samples.find(other => other.build === 'before' && run.scenario === other.scenario && run.pair === other.pair);
    assert.deepEqual(run.camera, baseline.camera);
    assert.equal(run.dpr, baseline.dpr);
  }
  for (const { before, after } of Object.values(summary)) {
    for (const key of ['calls', 'triangles', 'passes']) assert.equal(after[key], before[key], `Unchanged ${key}`);
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'water-performance.json'), JSON.stringify({
    viewport, browser: await browser.version(), percentiles: [50, 95], captures, summary, samples, errors,
  }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
