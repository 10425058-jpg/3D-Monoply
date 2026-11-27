import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

// Run against Vite previews of main and the candidate. Both use the existing
// graphicsAudit and loopback Solo fixtures in a fresh browser context per run.
const output = process.env.V10_OUTPUT ?? 'docs/v10-performance/evidence';
const quality = process.env.V10_QUALITY ?? 'balanced';
const rounds = Number(process.env.V10_ROUNDS ?? 2);
const urls = { before: process.env.V10_BASELINE_URL ?? 'http://127.0.0.1:4270',
  after: process.env.V10_CANDIDATE_URL ?? 'http://127.0.0.1:4271' };
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const overview = [[0, 35, 37], [0, 0.5, 0]];
const streets = [1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39];
const baselineOnly = process.argv.includes('--baseline');
const warmDice = process.argv.includes('--warm-dice');
const rollSamples = warmDice ? 6 : 1;
const software = process.env.V10_SOFTWARE === '1';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: software ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) * fraction)] : null;
}

function summarize({ samples, wallMs, longTasks }, scenario) {
  assert.ok(samples.length >= 3, `${scenario} submitted only ${samples.length} measured frames`);
  const metric = (name, p = .5) => percentile(samples.map(frame => frame[name]), p);
  const mean = samples.reduce((total, frame) => total + frame.frameMs, 0) / samples.length;
  return {
    frames: samples.length, wallMs, fps: 1000 / mean, frameP50: metric('frameMs'), frameP95: metric('frameMs', .95),
    cpuP50: metric('renderCpuMs'), cpuP95: metric('renderCpuMs', .95), gpuP50: metric('gpuMs'), gpuP95: metric('gpuMs', .95),
    calls: metric('calls'), triangles: metric('triangles'), textures: metric('textures'), geometries: metric('geometries'),
    longTasks: longTasks.length, longTaskMs: longTasks.reduce((sum, task) => sum + task.duration, 0),
  };
}

async function run(label, round) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().endsWith('.glb')) requests.push(request.url()); });
  try {
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument(tier => {
      localStorage.setItem('monopoly-graphics-quality', tier);
      localStorage.setItem('monopoly-audio-muted', 'true');
      let seed = 10425058;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
      const tasks = [];
      new PerformanceObserver(list => tasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration }))))
        .observe({ type: 'longtask', buffered: true });
      const shader = { compile: 0, link: 0, submitMs: 0, linkStatusMs: 0 };
      const native = WebGL2RenderingContext.prototype;
      for (const [method, counter] of [['compileShader', 'compile'], ['linkProgram', 'link']]) {
        const original = native[method];
        native[method] = function (...args) {
          const start = performance.now();
          try { return original.apply(this, args); }
          finally { shader[counter]++; shader.submitMs += performance.now() - start; }
        };
      }
      const getProgramParameter = native.getProgramParameter;
      native.getProgramParameter = function (program, key) {
        if (key !== this.LINK_STATUS) return getProgramParameter.call(this, program, key);
        const start = performance.now();
        try { return getProgramParameter.call(this, program, key); }
        finally { shader.linkStatusMs += performance.now() - start; }
      };
      let started, initialShader;
      window.__v10 = {
        tasks, shader,
        start() {
          started = performance.now();
          initialShader = { ...shader };
          window.__graphicsAudit.start();
        },
        stop() {
          const ended = performance.now();
          return { ...window.__graphicsAudit.stop(), wallMs: ended - started,
            shader: Object.fromEntries(Object.entries(shader).map(([key, value]) => [key, value - initialShader[key]])),
            longTasks: tasks.filter(task => task.startTime >= started && task.startTime < ended) };
        },
      };
    }, quality);
    page.setDefaultTimeout(90000);
    await page.goto(`${urls[label]}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const when = (predicate, ...args) => page.waitForFunction(predicate, { polling: 35 }, ...args);
    await when(() => window.__soloTest && window.__graphicsAudit && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
    await page.evaluate(() => window.__soloTest.fixture('arcade-gallery-empty'));
    await when(() => window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 4 &&
      window.__graphicsAudit.islands().islands.every(island => island.statueDraws > 0));
    await wait(1950);
    const initial = await page.evaluate(() => ({ atMs: performance.now(), shader: window.__v10.shader,
      longTasks: window.__v10.tasks, metadata: window.__graphicsAudit.metadata() }));
    const camera = (position, target) => page.evaluate((p, t) => window.__graphicsAudit.camera(p, t), position, target);
    const measure = async (action, duration = 2600) => {
      await page.evaluate(() => window.__v10.start());
      const start = performance.now();
      await action?.();
      await wait(Math.max(0, duration - (performance.now() - start)));
      return page.evaluate(() => window.__v10.stop());
    };
    const render = async () => page.evaluate(() => new Promise(resolve => {
      const unsubscribe = window.__graphicsAudit.observeRender(() => { unsubscribe(); resolve(); });
    }));
    const workloads = {};
    if (warmDice) {
      // Compile roll and token materials outside the measured windows on both builds.
      await page.evaluate(() => {
        window.__soloTest.fixture('arcade-evolution');
        window.__soloTest.setSpeed(1);
        const random = Math.random, faces = [2, 4];
        try {
          Math.random = () => faces.length ? (faces.shift() - .5) / 6 : random();
          document.querySelector('.fantasy-roll').click();
        } finally { Math.random = random; }
      });
      await when(() => window.__soloTest.state().turnPhase === 'LANDED_ACTION');
      await page.evaluate(() => window.__soloTest.fixture('arcade-gallery-empty'));
      await wait(900);
    }
    await camera(...overview);
    await page.mouse.move(7, 7);
    await render();
    workloads.idle = await measure();

    const beforeOrbit = workloads.idle.metadata.camera;
    workloads.orbit = await measure(async () => {
      await page.mouse.move(1010, 455);
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        await page.mouse.move(1010 - 7 * i, 455 + 2 * i);
        await wait(40);
      }
      await page.mouse.up();
      for (const deltaY of [-160, -160, 160, 160]) {
        await page.mouse.wheel({ deltaY });
        await wait(150);
      }
      await page.mouse.move(7, 7);
    });
    assert.notDeepEqual(workloads.orbit.metadata.camera.position, beforeOrbit.position, 'Orbit input moved the camera');
    await wait(500);
    await camera(...overview);

    await page.evaluate(ids => {
      const snapshot = window.__soloTest.fixture('arcade-gallery');
      // The fixture returns the active property map. Expand it synchronously
      // before React commits the fixture, with one developed lot per street.
      ids.forEach((id, i) => Object.assign(snapshot.properties[id], { ownerId: i % 4, developmentLevel: i % 3 + 1 }));
    }, streets);
    await when(count => window.__graphicsAudit.arcade().buildings.filter(building => building.source === 'gltf').length === count, streets.length);
    await render();
    workloads.lateGame = await measure();

    const showSettings = '[aria-label="Game Settings & New Game"]';
    const closeSettings = '[aria-label="Close settings"]';
    const beforePopup = requests.length;
    const canvas = await page.$('canvas');
    workloads.popup = await measure(async () => {
      for (let i = 0; i < 3; i++) {
        await page.click(showSettings);
        await page.waitForSelector('dialog[open].setup-modal', { visible: true });
        await wait(220);
        await page.click(closeSettings);
        await page.waitForSelector('dialog[open].setup-modal', { hidden: true });
      }
    });
    assert.ok(await canvas.evaluate(element => element.isConnected), 'Popup kept the same canvas');
    assert.equal(requests.length, beforePopup, 'Popup issued no additional GLB requests');

    const turns = [];
    for (let index = 0; index < rollSamples; index++) {
      await page.evaluate(() => {
        window.__soloTest.fixture('arcade-evolution');
        window.__soloTest.setSpeed(1);
      });
      await when(() => document.querySelector('.fantasy-roll:enabled'));
      await page.evaluate(() => {
        const measure = window.__v10;
        window.__v10Turn = new Promise(resolve => {
          const phases = {};
          let previous;
          const stop = window.__soloTest.observeTurn(({ phase }) => {
            if (phase === previous) return;
            if (previous === 'ROLLING' || previous === 'MOVING') phases[previous] = measure.stop();
            previous = phase;
            if (phase === 'ROLLING' || phase === 'MOVING') measure.start();
            if (phase === 'LANDED_ACTION') { stop(); resolve(phases); }
          });
        });
        const random = Math.random, faces = [2, 4];
        try {
          Math.random = () => faces.length ? (faces.shift() - .5) / 6 : random();
          document.querySelector('.fantasy-roll').click();
        } finally { Math.random = random; }
      });
      await when(() => window.__soloTest.state().turnPhase === 'LANDED_ACTION');
      turns.push(await page.evaluate(() => window.__v10Turn));
    }
    const combine = phase => {
      const parts = turns.map(turn => turn[phase]);
      const { metadata } = parts.at(-1);
      const shader = Object.fromEntries(Object.keys(parts[0].shader)
        .map(key => [key, parts.reduce((total, part) => total + part.shader[key], 0)]));
      return { metadata, shader, samples: parts.flatMap(part => part.samples),
        longTasks: parts.flatMap(part => part.longTasks), wallMs: parts.reduce((total, part) => total + part.wallMs, 0) };
    };
    workloads.dice = warmDice ? combine('ROLLING') : turns[0].ROLLING;
    workloads.token = warmDice ? combine('MOVING') : turns[0].MOVING;
    assert.equal(await page.evaluate(() => window.__soloTest.state().players[0].position), 6);

    await page.evaluate(() => [...document.querySelectorAll('.action-tray button')]
      .find(button => button.textContent.trim() === 'Build').click());
    await when(() => document.querySelector('.evolution-footer button')?.textContent.includes('Buy'));
    await page.click('.evolution-footer button');
    await when(() => window.__graphicsAudit.arcade().buildings.some(building => building.level === 0 && building.source === 'gltf'));
    await when(() => document.querySelector('.evolution-footer button')?.textContent.includes('House'));
    workloads.construction = await measure(async () => {
      await page.click('.evolution-footer button');
      await when(() => window.__graphicsAudit.arcade().buildings.some(building => building.level === 1 && building.source === 'gltf'));
    }, 1300);
    assert.equal(await page.evaluate(() => window.__soloTest.state().players[0].money), 1350);

    await page.evaluate(() => {
      const { properties } = window.__soloTest.fixture('hotel');
      [[1, 3], [6, 8, 9], [11, 13, 14], [16, 18, 19]].forEach((group, index) => {
        group.forEach(id => Object.assign(properties[id], { ownerId: index % 3, houses: index === 3 ? 5 : 4 }));
      });
    });
    await when(() => window.__graphicsAudit.actors().buildings.reduce((count, plot) => count + (plot.models ?? 0), 0) === 35);
    await wait(950);
    await camera(...overview);
    await render();
    workloads.classicLateGame = await measure();

    const memory = await page.metrics();
    const shader = await page.evaluate(() => window.__v10.shader);
    const summaries = Object.fromEntries(Object.entries(workloads).map(([name, sample]) => [name, summarize(sample, name)]));
    console.log(JSON.stringify({ label, round, renderer: initial.metadata.renderer,
      gpuTimer: initial.metadata.gpuTimerAvailable, shader, summaries }));
    assert.deepEqual(errors, []);
    return { label, round, initial, shader, memory, requests, errors, summaries, workloads };
  } finally {
    await context.close();
  }
}

const report = { conditions: { quality, viewport, motion: 'normal', seed: 10425058, software, warmDice, rollSamples,
  browser: await browser.version(), node: process.version, platform: os.platform(), cpu: os.cpus()[0].model,
  logicalCores: os.cpus().length, ramBytes: os.totalmem(), urls }, runs: [] };
try {
  await mkdir(output, { recursive: true });
  for (let round = 1; round <= (baselineOnly ? 1 : rounds); round++) {
    const order = baselineOnly ? ['before'] : round % 2 ? ['before', 'after'] : ['after', 'before'];
    for (const label of order) report.runs.push(await run(label, round));
    if (!baselineOnly) {
      const [first, second] = report.runs.slice(-2);
      for (const field of ['renderer', 'viewport', 'drawingBuffer', 'dpr']) {
        assert.deepEqual(first.initial.metadata[field], second.initial.metadata[field], `Matched ${field}`);
      }
      assert.deepEqual(first.workloads.idle.metadata.camera, second.workloads.idle.metadata.camera, 'Matched idle camera pose');
    }
  }
} catch (error) {
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(join(output, `${baselineOnly ? 'baseline' : 'benchmark'}-${quality}.json`), JSON.stringify(report) + '\n');
}
