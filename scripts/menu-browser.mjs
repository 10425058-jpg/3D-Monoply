// Verify the production bundle: the menu/settings/auth routes never load gameplay.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertNoGameplay, initialJavaScript, observeCanvasCreation } from './menu-boundary.mjs';

const origin = process.env.ONLINE_TEST_URL || 'http://localhost:3000';
const output = path.resolve(process.env.MENU_TEST_OUT || '.online-test/menu');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const errors = []; const results = [];
async function click(page, text) {
  const button = await page.evaluateHandle(label => [...(document.querySelector('dialog[open]') ?? document).querySelectorAll('button')].find(b => b.textContent.includes(label)), text);
  assert.ok(button.asElement(), `Find ${text}`); await button.asElement().click(); await button.dispose();
}
try {
  for (const [width, height] of [[1440, 900], [390, 844], [360, 640], [844, 390]]) {
    const context = await browser.createBrowserContext(); const page = await context.newPage(); const requests = [];
    await observeCanvasCreation(page); await page.setViewport({ width, height, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.querySelector('.main-menu-art')?.naturalWidth === 1672);
    await assertNoGameplay(page, requests, `Fresh menu ${width}×${height}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const startupScripts = requests.filter(url => url.endsWith('.js'));
    assert.ok(startupScripts.every(url => initialJavaScript.some(file => url.endsWith(file))), 'Only the menu entry graph is fetched');
    await page.screenshot({ path: path.join(output, `menu-${width}x${height}.png`), fullPage: true });
    await click(page, 'Settings & sound'); await page.waitForSelector('dialog[open]');
    await page.select('dialog select', 'low');
    assert.equal(await page.evaluate(() => localStorage.getItem('monopoly-graphics-quality')), 'low');
    await assertNoGameplay(page, requests, 'Menu settings');
    await click(page, 'Done');
    // A diagnostic query must not bypass the first screen.
    await page.goto(`${origin}/?graphicsAudit`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.main-menu-panel'); await assertNoGameplay(page, requests, 'Diagnostic query menu');
    await click(page, 'PLAY ONLINE'); await page.waitForSelector('input[name=email]');
    await assertNoGameplay(page, requests, 'Play Online authentication');
    await click(page, 'Main menu'); await page.waitForSelector('.main-menu-panel');
    await assertNoGameplay(page, requests, 'Returned main menu');
    if (width === 1440) {
      await click(page, 'PLAY SOLO');
      await page.waitForSelector('.monopoly-app canvas', { timeout: 120000 });
      await page.waitForFunction(() => !!window.__graphicsAudit?.game()?.players.length, { timeout: 120000 });
      assert.ok((await page.evaluate(() => window.__webglContextRequests)).length > 0);
      const before = await page.evaluate(() => window.__graphicsAudit.game());
      await click(page, 'Main menu'); await page.waitForSelector('.main-menu-panel');
      assert.equal(await page.$$eval('canvas', nodes => nodes.length), 0, 'Gameplay is unmounted after returning home');
      await click(page, 'PLAY SOLO'); await page.waitForFunction(() => !!window.__graphicsAudit?.game()?.players.length, { timeout: 120000 });
      assert.deepEqual((await page.evaluate(() => window.__graphicsAudit.game())).players, before.players, 'Solo state survives a menu round trip');
    }
    results.push({ viewport: [width, height], menuCanvasCount: 0, menuWebglContexts: 0, gameplayRequestsBeforeStart: 0, settings: true, onlineNavigation: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  const initialBytes = (await Promise.all(initialJavaScript.map(file => stat(path.join('dist', file))))).reduce((sum, item) => sum + item.size, 0);
  assert.ok(initialBytes < 250000, 'Initial menu JavaScript stays under 250 KB uncompressed');
  const receipt = { initialJavaScriptBytes: initialBytes, menuImageBytes: (await stat('public/assets/menu/fantasy-city-menu.jpg')).size, results, errors };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ passed: true, ...receipt }));
} finally { await browser.close(); }
