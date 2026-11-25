import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const quality = process.env.V10_QUALITY ?? 'balanced';
const output = join(process.env.V10_OUTPUT ?? 'docs/v10-performance/evidence', 'captures', quality);
const builds = {
  before: process.env.V10_BASELINE_URL ?? 'http://127.0.0.1:4270',
  after: process.env.V10_CANDIDATE_URL ?? 'http://127.0.0.1:4271',
};
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const streets = [1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.V10_SOFTWARE === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});

async function captureBuild(label, url) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await mkdir(join(output, label), { recursive: true });
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument(tier => {
      localStorage.setItem('monopoly-graphics-quality', tier);
      localStorage.setItem('monopoly-audio-muted', 'true');
      let seed = 10425058;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };

      // Drive the real presentation callbacks at matched timestamps in both
      // builds. Only the two Solo turn timer durations use this clock.
      let now = 1000, nextHandle = -1;
      let scriptTurn = false;
      const timers = new Map();
      performance.now = () => now;
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => {
        if (!scriptTurn || (delay !== 680 && delay !== 155)) return nativeSetTimeout(callback, delay, ...args);
        const id = nextHandle--;
        timers.set(id, { at: now + delay, call: () => callback(...args) });
        return id;
      };
      window.clearTimeout = id => { if (!timers.delete(id)) nativeClearTimeout(id); };

      const targets = new WeakMap();
      let offscreenDepthClears = 0, screenDepthClears = 0;
      const gl = WebGL2RenderingContext.prototype;
      const glyphShaders = new WeakSet(), glyphPrograms = new WeakSet(), currentPrograms = new WeakMap();
      let upgradeLabelDraws = 0;
      const shaderSource = gl.shaderSource;
      gl.shaderSource = function (shader, source) {
        if (source.includes('uTroikaSDFTexture')) glyphShaders.add(shader);
        return shaderSource.call(this, shader, source);
      };
      const attachShader = gl.attachShader;
      gl.attachShader = function (program, shader) {
        if (glyphShaders.has(shader)) glyphPrograms.add(program);
        return attachShader.call(this, program, shader);
      };
      const useProgram = gl.useProgram;
      gl.useProgram = function (program) {
        currentPrograms.set(this, program);
        return useProgram.call(this, program);
      };
      const drawInstances = gl.drawElementsInstanced;
      gl.drawElementsInstanced = function (mode, count, type, offset, instances) {
        // The $50 upgrade has four glyphs, including the sign. The earlier
        // $100 land purchase uses five, so that draw cannot satisfy the gate.
        if (instances === 4 && glyphPrograms.has(currentPrograms.get(this))) upgradeLabelDraws++;
        return drawInstances.call(this, mode, count, type, offset, instances);
      };
      const bind = gl.bindFramebuffer;
      gl.bindFramebuffer = function (target, buffer) {
        if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER) targets.set(this, buffer);
        return bind.call(this, target, buffer);
      };
      const clear = gl.clear;
      gl.clear = function (mask) {
        if (mask & this.DEPTH_BUFFER_BIT) {
          if (targets.get(this)) offscreenDepthClears++;
          else screenDepthClears++;
        }
        return clear.call(this, mask);
      };

      window.__v10Capture = {
        scriptTurn() { scriptTurn = true; },
        shadowPasses: () => offscreenDepthClears,
        screenClears: () => screenDepthClears,
        upgradeLabelDraws: () => upgradeLabelDraws,
        frame(delta, capture) {
          const target = now + delta;
          for (const [id, timer] of timers) {
            if (timer.at > target) continue;
            now = timer.at;
            timers.delete(id);
            timer.call();
          }
          now = target;
          return new Promise(resolve => {
            const unsubscribe = window.__graphicsAudit.observeRender(() => {
              unsubscribe();
              resolve(capture ? document.querySelector('canvas[data-engine]').toDataURL('image/png').split(',')[1] : null);
            });
          });
        },
      };
    }, quality);

    await page.goto(`${url}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const when = (predicate, ...args) => page.waitForFunction(predicate, { timeout: 90000, polling: 35 }, ...args);
    const frame = (delta = 0) => page.evaluate(tick => window.__v10Capture.frame(tick, false), delta);
    const camera = (p, t) => page.evaluate((position, target) => window.__graphicsAudit.camera(position, target, true), p, t);
    const shadowPasses = () => page.evaluate(() => window.__v10Capture.shadowPasses());
    const report = { images: {}, shadowPasses: {} };
    const shot = async name => {
      await frame();
      const png = await page.evaluate(() => window.__v10Capture.frame(0, true));
      await writeFile(join(output, label, `${name}.png`), Buffer.from(png, 'base64'));
      report.images[name] = await page.evaluate(() => {
        const { camera, viewport, dpr, renderer } = window.__graphicsAudit.metadata();
        return { camera, viewport, dpr, renderer, time: performance.now(), phase: window.__soloTest.state().turnPhase,
          waterfalls: window.__graphicsAudit.environment().waterfalls,
          fountain: window.__centralCityAudit.snapshot().motion['royal-fountain-water'] };
      });
    };
    const scanShadows = async (name, changes) => {
      const before = await shadowPasses();
      await changes();
      report.shadowPasses[name] = (await shadowPasses()) - before;
    };

    await when(() => window.__soloTest && window.__graphicsAudit && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
    await page.evaluate(() => window.__soloTest.fixture('arcade-gallery-empty'));
    await when(() => window.__graphicsAudit.royalTokens().filter(token => token.asset && token.tile === 0).length === 4 &&
      window.__graphicsAudit.islands().islands.every(island => island.statueDraws > 0));
    // Finish the ordinary opening move while the environment runs at the same time in both builds.
    for (let i = 0; i < 34; i++) await frame(100);
    await scanShadows('stationary', async () => { for (let i = 0; i < 4; i++) await frame(30); });
    await shot('01-overview');
    await scanShadows('camera-only', async () => {
      await camera([11, 12, 15], [0, 2.2, -1]);
      await frame(30);
      await frame(30);
    });
    await shot('02-castle');
    await camera([13, 15, 18], [9.6, .4, 9.6]);
    await shot('03-tokens-on-go');
    await camera([-7, -10, 9], [-30, -30, -18]);
    await shot('04-floating-islands-waterfalls');

    await page.evaluate(() => window.__soloTest.fixture('arcade-gallery'));
    await when(() => window.__graphicsAudit.arcade().buildings.filter(model => model.source === 'gltf').length === 4);
    await page.evaluate(ids => {
      const snapshot = window.__soloTest.fixture('arcade-gallery');
      ids.forEach((id, i) => Object.assign(snapshot.properties[id], { ownerId: i % 4, developmentLevel: i % 3 + 1 }));
    }, streets);
    await when(count => window.__graphicsAudit.arcade().buildings.filter(model => model.source === 'gltf').length === count, streets.length);
    await camera([0, 32, 32], [0, .5, 0]);
    await shot('08-late-game');

    await page.evaluate(() => { window.__soloTest.fixture('arcade-evolution'); window.__soloTest.setSpeed(1); });
    await frame();
    await camera([6, 7, 14], [0, .8, 4.2]);
    await page.evaluate(() => {
      window.__v10Capture.scriptTurn();
      const random = Math.random, faces = [2, 4];
      try {
        Math.random = () => faces.length ? (faces.shift() - .5) / 6 : random();
        document.querySelector('.fantasy-roll').click();
      } finally { Math.random = random; }
    });
    await scanShadows('dice', async () => { for (let i = 0; i < 4; i++) await frame(70); });
    assert.equal(await page.evaluate(() => window.__soloTest.state().turnPhase), 'ROLLING');
    await shot('05-dice-rolling');
    await camera([9, 7, 21], [6, .5, 9.6]);
    await scanShadows('movement', async () => { for (let i = 0; i < 7; i++) await frame(70); });
    assert.equal(await page.evaluate(() => window.__soloTest.state().turnPhase), 'MOVING');
    await shot('06-token-moving');
    for (let i = 0; i < 10; i++) await frame(95);
    assert.equal(await page.evaluate(() => window.__soloTest.state().players[0].position), 6);
    await page.evaluate(() => [...document.querySelectorAll('.action-tray button')]
      .find(button => button.textContent.trim() === 'Build').click());
    await when(() => document.querySelector('.evolution-footer button')?.textContent.includes('Buy'));
    await page.evaluate(() => document.querySelector('.evolution-footer button').click());
    await when(() => document.querySelector('.evolution-footer button')?.textContent.includes('House'));
    await camera([-2, 6, 17], [-3.5, .5, 9.9]);
    await page.evaluate(() => document.querySelector('.evolution-footer button').click());
    await when(() => window.__graphicsAudit.arcade().construction.some(entry => entry.level === 1));
    // Wait for the actual label submission while holding the upgrade clock.
    // Unrelated requests can still be active when the text is ready.
    await when(() => window.__v10Capture.upgradeLabelDraws() > 0);
    report.upgradeLabelRendered = true;
    await scanShadows('construction', async () => { for (let i = 0; i < 4; i++) await frame(70); });
    assert.equal(await page.evaluate(() => window.__soloTest.state().properties[6].developmentLevel), 1);
    await shot('07-property-construction');

    await page.evaluate(() => {
      const { properties } = window.__soloTest.fixture('hotel');
      [[1, 3], [6, 8, 9], [11, 13, 14], [16, 18, 19]].forEach((group, index) => {
        group.forEach(id => Object.assign(properties[id], { ownerId: index % 3, houses: index === 3 ? 5 : 4 }));
      });
    });
    await when(() => window.__graphicsAudit.actors().buildings.reduce((count, plot) => count + (plot.models ?? 0), 0) === 35);
    for (let i = 0; i < 4; i++) await frame(80);
    await camera([7, 7, 20], [1, .5, 10]);
    await shot('09-classic-houses-hotels');

    await scanShadows('landmark', async () => {
      await page.evaluate(() => window.__centralCityAudit.previewLevel(5));
      await when(() => window.__centralCityAudit.snapshot().level === 5);
      await frame(30);
    });

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(150);
    const hiddenClears = await page.evaluate(() => window.__v10Capture.screenClears());
    await wait(350);
    report.hiddenFrames = (await page.evaluate(() => window.__v10Capture.screenClears())) - hiddenClears;
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await frame(20);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ label, quality, ...report.shadowPasses }));
    return report;
  } finally {
    await context.close();
  }
}

async function compareImages(names) {
  const page = await browser.newPage();
  try {
    const result = {};
    for (const name of names) {
      const images = await Promise.all(['before', 'after'].map(label => readFile(join(output, label, `${name}.png`))));
      const hash = image => createHash('sha256').update(image).digest('hex');
      const hashes = images.map(hash);
      const differences = hashes[0] === hashes[1] ? { changedPixels: 0, aboveThree: 0, maxChannelDelta: 0 } :
        await page.evaluate(async ([before, after]) => {
          async function pixels(base64) {
            const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
          }
          const a = await pixels(before), b = await pixels(after);
          let changedPixels = 0, aboveThree = 0, maxChannelDelta = 0;
          for (let i = 0; i < a.length; i += 4) {
            const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
            if (delta !== 0) changedPixels++;
            if (delta > 3) aboveThree++;
            maxChannelDelta = Math.max(maxChannelDelta, delta);
          }
          return { changedPixels, aboveThree, maxChannelDelta };
        }, images.map(image => image.toString('base64')));
      result[name] = { hashes, ...differences };
    }
    return result;
  } finally {
    await page.close();
  }
}

try {
  const [before, after] = [await captureBuild('before', builds.before), await captureBuild('after', builds.after)];
  const pixels = await compareImages(Object.keys(before.images));
  await writeFile(join(output, 'conditions.json'), JSON.stringify({ quality, before, after, pixels }, null, 2) + '\n');
  assert.deepEqual(after.images, before.images, 'Matched camera, actual drawable size, game phase and animation times in every pair');
  assert.equal(after.hiddenFrames, 0, 'No scene draws while the tab is hidden');
  console.log(JSON.stringify({ quality, pixels: Object.fromEntries(Object.entries(pixels).map(([name, { changedPixels, aboveThree, maxChannelDelta }]) =>
    [name, { changedPixels, aboveThree, maxChannelDelta }])) }));
  for (const [name, differences] of Object.entries(pixels)) {
    assert.ok(differences.aboveThree <= 8, `${name} has ${differences.aboveThree} pixels with a channel difference greater than 3`);
  }
  if (quality !== 'low') {
    assert.ok(before.shadowPasses.stationary >= 4 && before.shadowPasses['camera-only'] >= 2);
    assert.equal(after.shadowPasses.stationary, 0, 'Idle scenery animation reuses the map');
    assert.equal(after.shadowPasses['camera-only'], 0, 'Camera movement alone reuses the same world-space map');
    for (const view of quality === 'high' ? ['dice', 'movement', 'construction', 'landmark'] : ['dice', 'movement', 'landmark']) {
      assert.ok(after.shadowPasses[view] > 0, `${view} invalidates the shadow map`);
    }
  }
} finally {
  await browser.close();
}
