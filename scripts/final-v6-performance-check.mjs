import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

// Counterbalanced, sequential A/B runs. Only one loaded game page is kept open;
// this measures repeatability without competing baseline/candidate canvases.
const out = process.env.V6_PERFORMANCE_OUT || 'docs/final-graphics-v6/evidence/performance-check';
const urls = {before: process.env.V6_BASELINE_URL || 'http://127.0.0.1:4196',
  after: process.env.V6_CANDIDATE_URL || 'http://127.0.0.1:4197'};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(out, {recursive: true});
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
});
const results = {passed: false, conditions: {viewport: [1440, 900], quality: 'balanced', dpr: 1,
  motion: 'reduce', seed: 10425058, idleMs: 5000, gameplayMs: 3000,
  warmup: 'same real committed [1,2] rent turn and 1800ms settle as final-graphics-v6-review',
  order: [['before', 'after'], ['after', 'before'], ['before', 'after']], node: process.version}, runs: []};
function summarize(samples) {
  const series = key => samples.map(s => s[key]).filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (key, q) => {const v = series(key); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * q))] : null;};
  return {samples: samples.length, fps: 1000 / (samples.reduce((total, s) => total + s.frameMs, 0) / samples.length),
    frameP50: percentile('frameMs', .5), frameP95: percentile('frameMs', .95), frameP99: percentile('frameMs', .99),
    calls: percentile('calls', .5), triangles: percentile('triangles', .5), textures: percentile('textures', .5),
    geometries: percentile('geometries', .5), renderCpuP50: percentile('renderCpuMs', .5), gpuP50: percentile('gpuMs', .5)};
}
async function measure(label, pair) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  try {
    await page.setViewport({width: 1440, height: 900, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('monopoly-graphics-quality', 'balanced');
      let seed = 10425058;
      Math.random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
    });
    const start = Date.now();
    await page.goto(`${urls[label]}/?graphicsAudit&soloTest#solo`, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__soloTest && window.__graphicsAudit &&
      window.__centralCityAudit?.ready && window.__phase2Environment?.ready, {timeout: 90000});
    const readyMs = Date.now() - start;
    await page.evaluate(() => window.__soloTest.fixture('opening'));
    await pause(1800);
    await page.mouse.move(2, 450);
    const camera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
    await page.evaluate(() => window.__graphicsAudit.start());
    await pause(5000);
    const idle = await page.evaluate(() => window.__graphicsAudit.stop());
    const roll = async () => {
      await page.evaluate(() => {
        let faces = [1, 2], original = Math.random;
        Math.random = () => {const v = (faces.shift() - .5) / 6; if (!faces.length) Math.random = original; return v;};
      });
      await page.click('[aria-label="Roll dice"]');
      await page.waitForFunction(() => window.__soloTest.state().turnPhase === 'END_TURN', {timeout: 60000});
    };
    await page.evaluate(() => window.__soloTest.fixture('rent')); await pause(250); await roll(); await pause(1800);
    await page.evaluate(() => window.__soloTest.fixture('rent')); await pause(250);
    const gameplayStart = Date.now();
    await page.evaluate(() => window.__graphicsAudit.start());
    await roll();
    await pause(Math.max(0, 3000 - (Date.now() - gameplayStart)));
    const gameplay = await page.evaluate(() => window.__graphicsAudit.stop());
    const money = await page.evaluate(() => window.__soloTest.state().players.map(player => player.money));
    assert.deepEqual(money, [1496, 1504, 1500]);
    assert.deepEqual(errors, []);
    assert.ok(idle.samples.length > 30 && gameplay.samples.length > 30, 'both workloads contain real rendered frames');
    const result = {pair, label, readyMs, camera, errors, money, memory: await page.metrics(),
      idle: {...idle, summary: summarize(idle.samples)}, gameplay: {...gameplay, summary: summarize(gameplay.samples)}};
    console.log(JSON.stringify({pair, label, idle: result.idle.summary, gameplay: result.gameplay.summary}));
    return result;
  } finally {await page.close();}
}
try {
  for (let pair = 0; pair < results.conditions.order.length; pair++) {
    for (const label of results.conditions.order[pair]) results.runs.push(await measure(label, pair + 1));
    const pairRuns = results.runs.filter(run => run.pair === pair + 1);
    assert.deepEqual(pairRuns[0].camera, pairRuns[1].camera, 'matched camera in each pair');
    assert.equal(pairRuns[0].idle.metadata.renderer, pairRuns[1].idle.metadata.renderer);
    assert.equal(pairRuns[0].idle.metadata.dpr, pairRuns[1].idle.metadata.dpr);
  }
  const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
  results.comparison = Object.fromEntries(['idle', 'gameplay'].map(workload => [workload,
    Object.fromEntries(['before', 'after'].map(label => [label,
      Object.fromEntries(['fps', 'frameP50', 'frameP95', 'renderCpuP50', 'gpuP50', 'calls', 'triangles', 'textures', 'geometries'].map(metric => {
        const values = results.runs.filter(run => run.label === label).map(run => run[workload].summary[metric]).filter(Number.isFinite);
        return [metric, {median: values.length ? median(values) : null,
          min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null}];
      }))]))]));
  results.passed = true;
  console.log(JSON.stringify({passed: true, comparison: results.comparison}));
} catch (error) {
  results.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results) + '\n');
  await browser.close();
}
