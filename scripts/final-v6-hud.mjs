import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.V6_HUD_URL || 'http://127.0.0.1:4198';
const out = process.env.V6_HUD_OUT || 'docs/final-graphics-v6/evidence/responsive';
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage();
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = fn => page.waitForFunction(fn, { timeout: 90000 });
const fixture = async name => { await page.evaluate(name => window.__soloTest.fixture(name), name); await pause(300); };

try {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('monopoly-graphics-quality', 'balanced');
    let seed = 10425058;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await page.goto(`${origin}/?graphicsAudit&soloTest#solo`);
  await wait(() => window.__soloTest && window.__graphicsAudit && window.__phase2Environment?.ready);
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await fixture('six-players');
    if (width <= 760) {
      const expanded = await page.$eval('.players-collapse', element => element.getAttribute('aria-expanded'));
      if (expanded !== 'true') await page.click('.players-collapse');
    }
    await pause(500);
    const layout = await page.evaluate(() => {
      const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const panel = rect(document.querySelector('.fantasy-players'));
      const tray = rect(document.querySelector('.action-tray'));
      const buttons = [...document.querySelectorAll('.action-tray button, .fantasy-roll, .fantasy-shortcuts button, .dock-utilities button, .resource-bar button')].map(element => ({
        label: element.getAttribute('aria-label') || element.textContent.trim() || element.title,
        shortcut: !!element.closest('.fantasy-shortcuts'),
        ...rect(element),
        visible: (() => { const r = element.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return at === element || element.contains(at); })(),
      })).filter(element => element.width > 0 && element.height > 0);
      const actionTray = document.querySelector('.action-tray');
      const dock = document.querySelector('.fantasy-dock');
      const desktop = innerWidth > 760;
      const centerTrack = desktop ? parseFloat(getComputedStyle(dock).gridTemplateColumns.split(/\s+/)[1]) : null;
      const originalWidth = desktop ? Math.min(centerTrack, innerWidth >= 1600 ? 900 : Infinity) : null;
      const actionButtons = [...actionTray.querySelectorAll('.dock-action')];
      const sidebar = document.querySelector('.fantasy-players');
      const portraits = [...sidebar.querySelectorAll('.player-portrait')];
      const landmark = sidebar.querySelector('.landmark-upgrade');
      return { panel, tray, buttons, horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        compactPlayers: {
          brandWidth: rect(document.querySelector('.kingdom-brand')).width,
          portraitWidths: portraits.map(portrait => rect(portrait).width),
          count: sidebar.querySelectorAll('.kingdom-player').length,
          landmarkPresent: !!landmark?.querySelector('button'),
          landmarkFits: landmark.scrollWidth <= landmark.clientWidth + 1,
          detailsFit: [...sidebar.querySelectorAll('.player-details')].every(details =>
            details.scrollWidth <= details.clientWidth + 1),
        },
        compactTray: {
          desktop, originalWidth, count: actionButtons.length,
          actualWidth: tray.width,
          minHeight: parseFloat(getComputedStyle(actionButtons[0]).minHeight),
          fontSize: parseFloat(getComputedStyle(actionButtons[0]).fontSize),
          labelsFit: actionButtons.every(button => {
            const label = button.querySelector('span').getBoundingClientRect();
            const bounds = button.getBoundingClientRect();
            return label.left >= bounds.left - 1 && label.right <= bounds.right + 1;
          }),
        },
      };
    });
    assert.equal(layout.horizontalOverflow, false, `${width}×${height}: horizontal overflow`);
    assert.equal(layout.compactTray.count, 6, 'all six actions remain');
    assert.equal(layout.compactPlayers.count, 6, 'all players remain available');
    assert.equal(layout.compactPlayers.landmarkPresent, true, 'Landmark upgrade remains available');
    assert.ok(layout.compactPlayers.landmarkFits && layout.compactPlayers.detailsFit,
      `${width}×${height}: sidebar text clipped`);
    if (width > 760) {
      assert.ok(Math.abs(layout.panel.width - layout.compactPlayers.brandWidth * .8) <= 2,
        `${width}×${height}: sidebar should be 80% of previous width`);
      assert.ok(layout.compactPlayers.portraitWidths.every(size => Math.abs(size - 38.4) <= 1),
        'desktop portraits are 20% smaller');
    } else {
      assert.ok(layout.compactPlayers.portraitWidths.every(size => Math.abs(size - 48) <= 1),
        'mobile portrait sizes remain unchanged');
    }
    assert.ok(layout.compactTray.labelsFit, `${width}×${height}: action labels clipped`);
    if (layout.compactTray.desktop) {
      const expected = layout.compactTray.originalWidth * .85;
      assert.ok(Math.abs(layout.compactTray.actualWidth - expected) <= 2,
        `${width}×${height}: expected 85% action-tray width, got ${layout.compactTray.actualWidth} vs ${expected}`);
      const oldHeight = width >= 1600 ? 78 : width <= 1150 ? 63 : 67;
      assert.ok(Math.abs(layout.compactTray.minHeight - oldHeight * .85) <= 1,
        `${width}×${height}: expected approximately 15% smaller action buttons`);
    } else {
      assert.equal(layout.compactTray.minHeight, 51, 'original mobile hit target retained');
      assert.equal(layout.compactTray.fontSize, 9, 'original mobile text retained');
    }
    assert.ok(layout.panel.bottom <= layout.tray.y, `${width}×${height}: player panel intersects dock`);
    // Expanded mobile players intentionally cover their shortcuts; verify those
    // after collapsing. Every essential action must remain available meanwhile.
    for (const button of layout.buttons.filter(button => !button.shortcut)) {
      assert.ok(button.x >= 0 && button.y >= 0 && button.right <= width && button.bottom <= height, `${width}×${height}: ${button.label} clipped`);
      assert.equal(button.visible, true, `${width}×${height}: ${button.label} blocked`);
    }
    const lastPlayer = await page.evaluate(() => {
      const content = document.querySelector('.players-content'); content.scrollTop = content.scrollHeight;
      const last = document.querySelector('.kingdom-player:last-child').getBoundingClientRect(), panel = content.getBoundingClientRect();
      return { count: document.querySelectorAll('.kingdom-player').length, visible: last.top >= panel.top && last.bottom <= panel.bottom };
    });
    assert.equal(lastPlayer.count, 6);
    assert.equal(lastPlayer.visible, true, `${width}×${height}: sixth player unreachable`);
    await page.screenshot({ path: `${out}/six-players-${width}x${height}.png` });
    if (width <= 760) await page.click('.players-collapse');
    const shortcuts = await page.$$eval('.fantasy-shortcuts button', elements => elements.map(element => {
      const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label: element.textContent.trim(), fits: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, reachable: element === hit || element.contains(hit) };
    }));
    shortcuts.forEach(button => { assert.ok(button.fits, `${width}×${height}: shortcut ${button.label} clipped`); assert.ok(button.reachable, `${width}×${height}: shortcut ${button.label} blocked`); });
    await page.evaluate(() => {
      const original = Math.random, faces = [1, 2];
      Math.random = () => { const value = (faces.shift() - .5) / 6; if (!faces.length) Math.random = original; return value; };
    });
    await page.click('[aria-label="Roll dice"]');
    await wait(() => document.querySelector('.fantasy-roll[aria-busy="true"]'));
    const busyFits = await page.$eval('.fantasy-roll', element => {
      const button = element.getBoundingClientRect(), text = element.querySelector('strong').getBoundingClientRect();
      return text.left >= button.left + 8 && text.right <= button.right - 8 && text.top >= button.top && text.bottom <= button.bottom;
    });
    assert.ok(busyFits, `${width}×${height}: busy ROLLING label extends outside button`);
    await wait(() => !['ROLLING', 'MOVING'].includes(window.__soloTest.state().turnPhase));
    results.push({ viewport: [width, height], layout, lastPlayer, shortcuts, busyFits });
    console.log(`Passed HUD ${width}×${height}`);
  }
  await page.setViewport({ width: 390, height: 844 });
  for (const name of ['chance', 'chest']) {
    await fixture(name);
    await page.evaluate(() => {
      const original = Math.random, faces = [1, 2];
      Math.random = () => { const value = (faces.shift() - .5) / 6; if (!faces.length) Math.random = original; return value; };
    });
    await page.click('[aria-label="Roll dice"]');
    await wait(() => !!document.querySelector('.card-reveal'));
    const card = await page.$eval('.card-reveal', element => {
      const r = element.getBoundingClientRect(), button = element.querySelector('button').getBoundingClientRect();
      return { className: element.className, text: element.textContent, fits: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        resolveVisible: button.top >= r.top && button.bottom <= r.bottom, deckColor: getComputedStyle(element).getPropertyValue('--deck-accent').trim() };
    });
    assert.ok(card.className.includes(`deck-${name}`));
    assert.ok(card.fits && card.resolveVisible, `${name}: mobile card or action clipped`);
    await page.screenshot({ path: `${out}/${name}-mobile.png` });
    await page.click('.card-reveal .modal-primary');
    await wait(() => !document.querySelector('.card-reveal'));
    results.push({ deck: name, ...card });
  }
  assert.equal(new Set(results.filter(result => result.deck).map(result => result.deckColor)).size, 2, 'card decks retain distinct accent colors');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ passed: true, quality: 'balanced', reducedMotion: true, results, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  await writeFile(`${out}/results.json`, JSON.stringify({ passed: false, error: error.message, results, errors }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
