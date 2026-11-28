import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const urls = {
  before: process.env.MOTION_BASELINE_URL ?? 'http://127.0.0.1:4270',
  after: process.env.MOTION_CANDIDATE_URL ?? 'http://127.0.0.1:4271',
};
for (const url of Object.values(urls)) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const output = process.env.MOTION_OUTPUT ?? 'docs/camera-motion/evidence';
const qualities = (process.env.MOTION_QUALITY ?? 'balanced,high').split(',');
const poses = {
  overview: { position: [0, 35, 37], target: [0, .5, 0] },
  orbit: { position: [27, 22, 25], target: [0, .7, 0] },
  'zoom-settings': { position: [11, 13, 18], target: [0, .7, 0] },
};
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  // Keep CSS border antialiasing deterministic while WebGL still uses the GPU.
  args: ['--disable-gpu-rasterization', ...(process.env.MOTION_ANGLE ? ['--use-gl=angle', `--use-angle=${process.env.MOTION_ANGLE}`] : [])],
});

async function capture(build, quality, save = true) {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.evaluateOnNewDocument(quality => {
      localStorage.setItem('monopoly-graphics-quality', quality);
      localStorage.setItem('monopoly-audio-muted', 'true');
      let seed = 10425058, clock = 1000;
      Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
      performance.now = () => clock;
      const webgl = WebGL2RenderingContext.prototype;
      const getExtension = webgl.getExtension;
      webgl.getExtension = function (name) {
        return name === 'EXT_disjoint_timer_query_webgl2' ? null : getExtension.call(this, name);
      };
      window.motionFrame = delta => new Promise(resolve => {
        clock += delta;
        const stop = window.__graphicsAudit.observeRender(() => { stop(); resolve(); });
      });
    }, quality);
    await page.goto(`${urls[build]}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
    const when = predicate => page.waitForFunction(predicate, { polling: 80, timeout: 90000 });
    await when(() => window.__soloTest && window.__graphicsAudit && window.__phase2Environment?.ready && window.__centralCityAudit?.ready);
    await page.evaluate(() => window.__soloTest.fixture('arcade-gallery-empty'));
    await when(() => window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 4 &&
      window.__graphicsAudit.islands().islands.every(island => island.statueDraws > 0));
    await page.evaluate(async () => { for (let i = 0; i < 35; i++) await window.motionFrame(100); });
    const results = {};
    for (const [name, pose] of Object.entries(poses)) {
      if (name === 'zoom-settings') {
        await page.evaluate(() => document.querySelector('[aria-label="Game Settings & New Game"]').click());
        await page.waitForSelector('dialog[open].setup-modal', { visible: true });
      }
      const metadata = await page.evaluate(async ({ position, target }) => {
        const audit = window.__graphicsAudit;
        audit.camera(position, target);
        await document.fonts.ready;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 900;
        }
        await window.motionFrame(16);
        await window.motionFrame(0);
        const { camera, viewport, dpr, drawingBuffer, renderer, three } = audit.metadata();
        const roll = document.querySelector('.fantasy-roll');
        const { left, right, top, bottom } = roll.getBoundingClientRect();
        const { background, boxShadow, border, filter, transform } = getComputedStyle(roll);
        return { camera: { ...camera, view: camera.view?.enabled ? camera.view : null },
          viewport, dpr, drawingBuffer, renderer, three, timeMs: performance.now(),
          roll: { left, right, top, bottom, background, boxShadow, border, filter, transform } };
      }, pose);
      const canvasPng = await page.evaluate(() => new Promise(resolve => {
        const stop = window.__graphicsAudit.observeRender(() => {
          stop();
          resolve(document.querySelector('canvas[data-engine]').toDataURL('image/png').split(',')[1]);
        });
      }));
      const path = join(output, `${quality}-${name}-${build}.png`);
      const png = await page.screenshot(save ? { path } : {});
      results[name] = { png: Buffer.from(png).toString('base64'), canvasPng, metadata, path };
    }
    assert.deepEqual(errors, []);
    return results;
  } finally { await context.close(); }
}

function comparePixels(page, before, after, roll = null) {
  return page.evaluate(async (before, after, roll) => {
    async function decode(png) {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      return { width: bitmap.width, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    }
    const [{ data: a, width }, { data: b }] = await Promise.all([decode(before), decode(after)]);
    let changed = 0, aboveThree = 0, maxChannelDelta = 0, outsideRoll = 0;
    for (let i = 0; i < a.length; i += 4) {
      const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (!delta) continue;
      changed++;
      if (delta > 3) aboveThree++;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      const x = (i / 4) % width, y = Math.floor(i / 4 / width);
      if (!roll || x < roll.left || x >= roll.right || y < roll.top || y >= roll.bottom) outsideRoll++;
    }
    return { changed, aboveThree, maxChannelDelta, outsideRoll, total: a.length / 4 };
  }, before, after, roll);
}

try {
  await mkdir(output, { recursive: true });
  const results = {};
  for (const quality of qualities) {
    const before = await capture('before', quality);
    const after = await capture('after', quality);
    const repeat = await capture('before', quality, false);
    const page = await browser.newPage();
    try {
      results[quality] = {};
      for (const name of Object.keys(poses)) {
        const a = before[name], b = after[name], control = repeat[name];
        const rounded = value => JSON.parse(JSON.stringify(value, (_, item) =>
          typeof item === 'number' ? Math.round(item * 1e9) / 1e9 : item));
        assert.deepEqual(rounded(a.metadata), rounded(b.metadata), `Matched ${quality} ${name} capture conditions`);
        assert.deepEqual(rounded(a.metadata), rounded(control.metadata), `Matched ${quality} ${name} repeat conditions`);
        const pixels = await comparePixels(page, a.png, b.png, a.metadata.roll);
        const repeatPixels = await comparePixels(page, a.png, control.png, a.metadata.roll);
        const canvasPixels = await comparePixels(page, a.canvasPng, b.canvasPng);
        const canvasHashes = [a, b].map(image => createHash('sha256').update(Buffer.from(image.canvasPng, 'base64')).digest('hex'));
        results[quality][name] = { before: a.path, after: b.path, metadata: b.metadata, pixels, repeatPixels,
          canvasPixels, canvasHashes };
        console.log(JSON.stringify({ quality, name, pixels, repeatPixels, canvasPixels }));
      }
    } finally { await page.close(); }
  }
  await writeFile(join(output, 'visual-comparison.json'), JSON.stringify({ viewport, results }, null, 2) + '\n');
  for (const quality of qualities) for (const [name, { pixels, canvasPixels }] of Object.entries(results[quality])) {
    assert.ok(canvasPixels.changed <= 8 && canvasPixels.maxChannelDelta <= 1, `${quality} ${name}: WebGL pixel drift`);
    assert.ok(pixels.outsideRoll <= 64, `${quality} ${name}: excessive full-page differences outside the Roll button`);
    assert.ok(pixels.changed < 500, `${quality} ${name}: excessive Roll button raster differences`);
  }
} finally { await browser.close(); }
