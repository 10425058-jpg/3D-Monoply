import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const urls = {
  before: process.env.V10_BASELINE_URL ?? 'http://127.0.0.1:4270',
  after: process.env.V10_CANDIDATE_URL ?? 'http://127.0.0.1:4271',
};
const viewport = { width: 1440, height: 900, deviceScaleFactor: 1 };
const frameTarget = 9;
const output = process.env.V11_OUTPUT ?? 'docs/v11-game-feel/evidence';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const runs = [];
try {
  const pages = {};
  for (const [build, url] of Object.entries(urls)) {
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
    const context = await browser.createBrowserContext();
    const page = pages[build] = await context.newPage();
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('monopoly-graphics-quality', 'balanced');
      localStorage.setItem('monopoly-audio-muted', 'true');
      let seed = 10425058;
      Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    });
    await page.goto(`${url}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__soloTest && window.__graphicsAudit &&
      window.__phase2Environment?.ready && window.__centralCityAudit?.ready);
  }

  for (const workload of ['idle', 'classicLateGame']) {
    for (const page of Object.values(pages)) {
      await page.bringToFront();
      await page.evaluate(workload => {
        if (workload === 'idle') {
          window.__soloTest.fixture('arcade-gallery-empty');
        } else {
          const { properties } = window.__soloTest.fixture('hotel');
          [[1, 3], [6, 8, 9], [11, 13, 14], [16, 18, 19]].forEach((group, index) => {
            group.forEach(id => Object.assign(properties[id], { ownerId: index % 3, houses: index === 3 ? 5 : 4 }));
          });
        }
      }, workload);
      await page.waitForFunction(workload => workload === 'idle'
        ? window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 4
        : window.__graphicsAudit.actors().buildings.reduce((count, plot) => count + (plot.models ?? 0), 0) === 35,
      { polling: 100 }, workload);
      // A pointer gesture releases the opening camera before setting a fixed pose.
      await page.mouse.move(720, 430);
      await page.mouse.down();
      await page.mouse.up();
      await page.mouse.move(7, 7);
    }

    for (let pair = 0; pair < 4; pair++) {
      const order = pair % 2 ? ['after', 'before'] : ['before', 'after'];
      for (const build of order) {
        const page = pages[build];
        await page.bringToFront();
        await page.waitForFunction(() => !document.hidden, { polling: 50 });
        await page.evaluate(() => window.__graphicsAudit.camera([0, 35, 37], [0, .5, 0]));
        await wait(650);
        const { samples, metadata } = await page.evaluate(target => new Promise(resolve => {
          const audit = window.__graphicsAudit;
          let frames = 0;
          const finish = () => { stop(); clearTimeout(deadline); resolve(audit.stop()); };
          const deadline = setTimeout(finish, 12_000);
          const stop = audit.observeRender(() => {
            if (++frames === target) setTimeout(finish, 0);
          });
          audit.start();
        }), frameTarget);
        assert.ok(samples.length >= frameTarget - 1, `${workload} submitted its measured frames`);
        const { view, ...camera } = metadata.camera;
        runs.push({ workload, pair: pair + 1, build, samples,
          camera: { ...camera, view: view?.enabled ? view : null }, renderer: metadata.renderer });
      }
      const [first, second] = runs.slice(-2);
      assert.deepEqual(first.camera, second.camera);
      assert.equal(first.renderer, second.renderer);
    }
  }
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'settled-frame-times.json'),
    JSON.stringify({ viewport, browser: await browser.version(), frameTarget, runs }) + '\n');
  console.log('Captured four interleaved pairs each for idle and Classic stress scenes.');
} finally {
  await browser.close();
}
