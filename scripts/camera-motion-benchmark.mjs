import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const urls = {
  before: process.env.MOTION_BASELINE_URL ?? 'http://127.0.0.1:4270',
  after: process.env.MOTION_CANDIDATE_URL ?? 'http://127.0.0.1:4271',
};
for (const url of Object.values(urls)) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const output = process.env.MOTION_OUTPUT ?? 'docs/camera-motion/evidence';
const quality = process.env.MOTION_QUALITY ?? 'balanced';
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const pose = { position: [0, 26, 36], target: [0, .7, 0] };
const origin = [1010, 540];
const referenceHz = 60;
const seed = 10425058;
const orbit = Array.from({ length: 100 }, (_, i) => ({ at: 12 * i,
  x: origin[0] - Math.round((i + 1) * 2.8), y: origin[1] + Math.round((i + 1) * .42) }));
const zoom = Array.from({ length: 14 }, (_, i) => ({ at: 87 * i, deltaY: i < 7 ? -120 : 120 }));
const pilot = process.argv.includes('--profile');
const gpu = process.argv.includes('--gpu');
const angle = process.env.MOTION_ANGLE;
const beforeOnly = process.argv.includes('--before-only');
const rounds = beforeOnly ? 1 : Number(process.env.MOTION_ROUNDS ?? 4);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: angle ? ['--use-gl=angle', `--use-angle=${angle}`] : [],
});

function percentile(values, quantile) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}

function summarize({ samples, longTasks, dispatchMs }) {
  assert.ok(samples.length > 0, 'No rendered frames');
  const metric = (name, p = .5) => percentile(samples.map(sample => sample[name]), p);
  const frameTimes = samples.map(sample => sample.frameMs);
  return { frames: samples.length, fps: 1000 * samples.length / frameTimes.reduce((sum, ms) => sum + ms, 0),
    frameP50: metric('frameMs'), frameP95: metric('frameMs', .95), frameP99: metric('frameMs', .99),
    missed60HzSlots: frameTimes.reduce((sum, ms) => sum + Math.max(0, Math.round(ms * referenceHz / 1000) - 1), 0),
    renderCpuP50: metric('renderCpuMs'), renderCpuP95: metric('renderCpuMs', .95),
    gpuP50: metric('gpuMs'), gpuP95: metric('gpuMs', .95), gpuSamples: samples.filter(sample => sample.gpuMs !== null).length,
    callsP50: metric('calls'), trianglesP50: metric('triangles'),
    dispatchP50: percentile(dispatchMs, .5), dispatchP95: percentile(dispatchMs, .95),
    longTasks: longTasks.length, longTaskMs: longTasks.reduce((sum, task) => sum + task.duration, 0) };
}

async function run(build, round) {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.evaluateOnNewDocument((quality, seed, gpu) => {
      localStorage.setItem('monopoly-graphics-quality', quality);
      localStorage.setItem('monopoly-audio-muted', 'true');
      Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
      // The audit's synchronous disjoint query can stall the main thread on
      // D3D11. Enable it only in separate GPU diagnostics.
      if (!gpu) {
        const webgl = WebGL2RenderingContext.prototype;
        const getExtension = webgl.getExtension;
        webgl.getExtension = function (name) {
          return name === 'EXT_disjoint_timer_query_webgl2' ? null : getExtension.call(this, name);
        };
      }
      window.motionLongTasks = [];
      new PerformanceObserver(list => {
        for (const { startTime, duration } of list.getEntries()) window.motionLongTasks.push({ startTime, duration });
      }).observe({ type: 'longtask', buffered: true });
    }, quality, seed, gpu);
    await page.goto(`${urls[build]}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
    const when = predicate => page.waitForFunction(predicate, { polling: 80, timeout: 90000 });
    await when(() => window.__soloTest && window.__graphicsAudit && window.__phase2Environment?.ready && window.__centralCityAudit?.ready);
    await page.evaluate(() => window.__soloTest.fixture('arcade-gallery-empty'));
    await when(() => window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 4 &&
      window.__graphicsAudit.islands().islands.every(island => island.statueDraws > 0));
    await page.bringToFront();
    await page.mouse.move(...origin);
    assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, origin), 'CANVAS');
    // Release the opening presentation before setting the same QA pose on both builds.
    await page.mouse.down({ button: 'middle' });
    await page.mouse.up({ button: 'middle' });
    const reset = async () => {
      await page.evaluate(({ position, target }) => window.__graphicsAudit.camera(position, target), pose);
      await wait(750);
    };
    await reset();
    await wait(2000);
    const initial = await page.evaluate(() => {
      const { renderer, gpuTimerAvailable, viewport, drawingBuffer, camera } = window.__graphicsAudit.metadata();
      return { renderer, gpuTimerAvailable, viewport, drawingBuffer, camera };
    });
    console.log(`${build} ${round}: ${initial.renderer}`);

    const layers = {};
    if (gpu) {
      for (const layer of ['all', 'low-cloud-deck', 'kingdom-cloud-layers']) {
        const sample = await page.evaluate(async layer => {
          const audit = window.__graphicsAudit;
          if (layer !== 'all' && !audit.environmentLayer(layer, false)) throw new Error(`Missing layer ${layer}`);
          await new Promise(resolve => setTimeout(resolve, 700));
          audit.start();
          await new Promise(resolve => setTimeout(resolve, 2400));
          const result = audit.stop();
          if (layer !== 'all') audit.environmentLayer(layer, true);
          return result.samples;
        }, layer);
        layers[layer] = { samples: sample, gpuP50: percentile(sample.map(frame => frame.gpuMs), .5) };
      }
    }

    async function workload(kind, actions) {
      await reset();
      await page.mouse.move(...origin);
      if (kind === 'orbit') await page.mouse.down();
      const result = await page.evaluate(async (kind, actions, origin) => {
        const audit = window.__graphicsAudit;
        const canvas = document.querySelector('canvas[data-engine]');
        const dispatchMs = [];
        const start = performance.now();
        const initialCamera = audit.metadata().camera.position;
        audit.start();
        // A real pointer-down starts the drag. Deliver every move and wheel delta
        // from the same schedule without waiting on a DevTools round trip per event.
        for (const action of actions) {
          await new Promise(resolve => setTimeout(resolve, Math.max(0, start + action.at - performance.now())));
          const event = kind === 'orbit'
            ? new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 1,
              buttons: 1, clientX: action.x, clientY: action.y })
            : new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: action.deltaY,
              clientX: origin[0], clientY: origin[1] });
          const dispatched = performance.now();
          canvas.dispatchEvent(event);
          dispatchMs.push(performance.now() - dispatched);
        }
        const inputMs = performance.now() - start;
        const endOfInput = audit.metadata().camera.position;
        await new Promise(resolve => setTimeout(resolve, 550));
        const end = performance.now();
        const { samples, metadata } = audit.stop();
        return { initialCamera, endOfInput, endPose: metadata.camera, samples, inputMs, dispatchMs,
          longTasks: window.motionLongTasks.filter(task => task.startTime >= start && task.startTime < end) };
      }, kind, actions, origin);
      if (kind === 'orbit') await page.mouse.up();
      return result;
    }

    // Warm the same shader and picking paths in each new browser context.
    await workload('orbit', orbit);
    await workload('zoom', zoom);
    await wait(2200);
    const workloads = { orbit: await workload('orbit', orbit), zoom: await workload('zoom', zoom) };
    assert.notDeepEqual(workloads.orbit.endPose.position, workloads.orbit.initialCamera);
    assert.notDeepEqual(workloads.zoom.endOfInput, workloads.zoom.initialCamera);
    const summaries = Object.fromEntries(Object.entries(workloads).map(([name, result]) => [name, summarize(result)]));
    console.log(`${build} ${round}: measured ${summaries.orbit.frames} orbit and ${summaries.zoom.frames} zoom frames`);

    const latency = { orbit: [], zoom: [] };
    for (const kind of Object.keys(latency)) {
      for (let i = 0; i < 5; i++) {
        // Alternate directions so any residual baseline damping can't be
        // mistaken for the response to a new gesture.
        const direction = i % 2 ? 1 : -1;
        await reset();
        await page.mouse.move(...origin);
        if (kind === 'orbit') await page.mouse.down();
        await page.evaluate((kind, direction) => {
          const audit = window.__graphicsAudit;
          const camera = audit.metadata().camera;
          const axis = position => {
            const [x, y, z] = position.map((value, index) => value - camera.target[index]);
            return kind === 'orbit' ? Math.atan2(x, z) : Math.hypot(x, y, z);
          };
          const previous = axis(camera.position);
          window.motionLatency = new Promise(resolve => {
            const eventName = kind === 'orbit' ? 'pointermove' : 'wheel';
            let stop;
            const finish = sample => {
              document.removeEventListener(eventName, start, true);
              stop?.();
              clearTimeout(deadline);
              resolve(sample);
            };
            function start(event) {
              const handledAt = performance.now();
              stop = audit.observeRender(({ at }) => {
                const { position } = audit.metadata().camera;
                const delta = axis(position) - previous;
                const change = kind === 'orbit' ? Math.atan2(Math.sin(delta), Math.cos(delta)) : delta;
                if (change * direction < .00001) return;
                finish({ eventToSubmitMs: at - event.timeStamp, handlerToSubmitMs: at - handledAt });
              });
            }
            const deadline = setTimeout(() => finish(null), 5000);
            document.addEventListener(eventName, start, { once: true, capture: true });
          });
        }, kind, direction);
        if (kind === 'orbit') await page.mouse.move(origin[0] - direction * 18, origin[1] + 3);
        else await page.mouse.wheel({ deltaY: direction * 120 });
        const sample = await page.evaluate(() => window.motionLatency);
        latency[kind].push(sample);
        if (kind === 'orbit') await page.mouse.up();
      }
    }
    for (const [kind, samples] of Object.entries(latency)) {
      const submitted = samples.filter(Boolean).map(sample => sample.eventToSubmitMs);
      summaries[kind].inputP50 = percentile(submitted, .5);
      summaries[kind].inputP95 = percentile(submitted, .95);
      summaries[kind].inputTimeouts = samples.length - submitted.length;
    }

    if (pilot) {
      const cdp = await page.createCDPSession();
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
      await cdp.send('Profiler.start');
      await workload('orbit', orbit);
      await workload('zoom', zoom);
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(join(output, `${build}-${quality}${gpu ? '-gpu' : ''}.cpuprofile`), JSON.stringify(profile));
      await cdp.detach();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ build, round, renderer: initial.renderer, summaries }));
    return { build, round, initial, workloads, summaries, latency, layers };
  } finally {
    await context.close();
  }
}

const report = { startedAt: new Date().toISOString(), conditions: { quality, viewport, referenceHz, pose, origin, seed, orbit, zoom, urls, gpu, angle,
  browser: await browser.version(), node: process.version, platform: os.platform(), cpu: os.cpus()[0].model,
  logicalCores: os.cpus().length, ramBytes: os.totalmem() }, runs: [] };
try {
  await mkdir(output, { recursive: true });
  for (let round = 1; round <= rounds; round++) {
    const order = beforeOnly ? ['before'] : round % 2 ? ['before', 'after'] : ['after', 'before'];
    for (const build of order) report.runs.push(await run(build, round));
    if (!beforeOnly) {
      const [first, second] = report.runs.slice(-2);
      for (const field of ['renderer', 'gpuTimerAvailable', 'viewport', 'drawingBuffer']) {
        assert.deepEqual(first.initial[field], second.initial[field]);
      }
      for (const { initial } of [first, second]) {
        assert.ok(initial.camera.position.every((value, index) => Math.abs(value - pose.position[index]) < 1e-8));
        assert.deepEqual(initial.camera.target, pose.target);
        assert.equal(initial.camera.fov, 40);
        assert.ok(!initial.camera.view?.enabled);
      }
    }
  }
} catch (error) {
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(join(output, `${beforeOnly ? 'baseline' : 'comparison'}-${quality}${gpu ? '-gpu' : ''}.json`), JSON.stringify(report) + '\n');
}
