import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const url = process.env.MOTION_CANDIDATE_URL ?? 'http://127.0.0.1:4271';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.MOTION_ANGLE ? ['--use-gl=angle', `--use-angle=${process.env.MOTION_ANGLE}`] : [],
});

async function withGame(viewport, reduced, test) {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await page.bringToFront();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ deviceScaleFactor: 1, ...viewport });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('monopoly-graphics-quality', 'balanced');
      localStorage.setItem('monopoly-audio-muted', 'true');
      const webgl = WebGL2RenderingContext.prototype;
      const getExtension = webgl.getExtension;
      webgl.getExtension = function (name) {
        return name === 'EXT_disjoint_timer_query_webgl2' ? null : getExtension.call(this, name);
      };
      window.motionClears = 0;
      const clear = webgl.clear;
      webgl.clear = function (mask) {
        window.motionClears++;
        return clear.call(this, mask);
      };
    });
    await page.goto(`${url}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__graphicsAudit && window.__soloTest &&
      window.__phase2Environment?.ready && window.__centralCityAudit?.ready, { timeout: 90000 });
    const pose = () => page.evaluate(() => window.__graphicsAudit.metadata().camera);
    const frames = count => page.evaluate(count => new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('Animation frame deadline exceeded')), 10000);
      function step() {
        if (--count > 0) requestAnimationFrame(step);
        else { clearTimeout(deadline); resolve(); }
      }
      requestAnimationFrame(step);
    }), count);
    await frames(3);
    await test(page, pose, frames);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

const radius = pose => Math.hypot(...pose.position.map((value, axis) => value - pose.target[axis]));

async function settledPose(read, frames) {
  let previous = await read();
  for (let attempt = 0; attempt < 30; attempt++) {
    await frames(3);
    const current = await read();
    if (current.position.every((value, index) => value === previous.position[index])) return current;
    previous = current;
  }
  throw new Error('The camera did not settle');
}

try {
  await withGame({ width: 1440, height: 900 }, false, async (page, pose, frames) => {
    const opening = await pose();
    await wait(300);
    assert.deepEqual(await pose(), opening, 'The opening view holds immediately');

    const tile = await page.evaluate(() => window.__graphicsAudit.tiles().find(tile => tile.id === 1));
    await page.mouse.move(tile.x, tile.y);
    await page.waitForFunction(() => window.__graphicsAudit.game().hoveredSpaceId === 1);
    await page.mouse.click(tile.x, tile.y);
    await page.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === 1);
    await page.click('[aria-label="Close property card"]');
    await page.waitForFunction(() => window.__graphicsAudit.game().selectedSpaceId === null);
    assert.deepEqual(await pose(), opening, 'The property card preserves the view');

    await page.mouse.move(1000, 535);
    await page.mouse.down();
    await page.mouse.move(775, 600, { steps: 12 });
    await page.mouse.up();
    const orbit = await settledPose(pose, frames);
    assert.notDeepEqual(orbit.position, opening.position);
    assert.deepEqual(orbit.target, opening.target);
    await page.mouse.wheel({ deltaY: -120 });
    const zoom = await settledPose(pose, frames);
    assert.ok(radius(zoom) < radius(orbit));
    assert.deepEqual(zoom.target, orbit.target);

    await page.evaluate(() => {
      window.__soloTest.fixture('arcade-gallery-empty');
      const random = Math.random;
      const rolls = [.1, .22];
      try {
        Math.random = () => rolls.length ? rolls.shift() : random();
        document.querySelector('[aria-label="Roll dice"]').click();
      } finally { Math.random = random; }
    });
    await page.waitForFunction(() => window.__soloTest.state().turnPhase === 'LANDED_ACTION', { timeout: 20000 });
    assert.deepEqual(await pose(), zoom, 'Dice, movement, and landing preserve the chosen camera');

    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await frames(2);
    const resized = await pose();
    assert.deepEqual(resized.position, zoom.position);
    assert.deepEqual(resized.target, zoom.target);
    const clears = await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      return window.motionClears;
    });
    await wait(350);
    assert.equal(await page.evaluate(() => window.motionClears), clears);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await frames(2);
    assert.deepEqual(await pose(), resized);

    await page.click('[aria-label="Toggle overhead camera"]');
    await page.waitForFunction(() => window.__graphicsAudit.game().cameraMode === 'top');
    await page.waitForFunction(() => {
      const { target, position } = window.__graphicsAudit.metadata().camera;
      const offset = position.map((value, i) => value - target[i]);
      return offset[1] / Math.hypot(...offset) > .98;
    }, { polling: 100, timeout: 20000 });
    const overhead = await pose();
    assert.notDeepEqual(overhead.position, zoom.position);
    assert.ok((overhead.position[1] - overhead.target[1]) / radius(overhead) > .98);
  });
  console.log('Desktop: property picking, drag, wheel, roll/movement, resize, visibility and overhead view passed');

  await withGame({ width: 390, height: 844, isMobile: true, hasTouch: true }, true, async (page, pose, frames) => {
    const start = await pose();
    const cdp = await page.createCDPSession();
    const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    await touch('touchStart', [{ x: 180, y: 425, id: 1 }]);
    await touch('touchMove', [{ x: 255, y: 458, id: 1 }]);
    await touch('touchEnd', []);
    await frames(1);
    const rotated = await pose();
    assert.notDeepEqual(rotated.position, start.position);
    assert.deepEqual(rotated.target, start.target);
    await frames(4);
    assert.deepEqual(await pose(), rotated, 'Reduced-motion orbit has no trailing movement');
    await touch('touchStart', [{ x: 205, y: 435, id: 1 }, { x: 250, y: 435, id: 2 }]);
    await touch('touchMove', [{ x: 170, y: 435, id: 1 }, { x: 290, y: 435, id: 2 }]);
    await touch('touchEnd', []);
    await frames(1);
    const zoomed = await pose();
    assert.ok(radius(zoomed) < radius(rotated));
    await frames(4);
    assert.deepEqual(await pose(), zoomed, 'Reduced-motion pinch has no trailing movement');
    await cdp.detach();
  });
  console.log('Touch: drag, pinch, limits and reduced motion passed');
} finally { await browser.close(); }
