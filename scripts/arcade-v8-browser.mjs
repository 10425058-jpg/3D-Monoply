import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = process.env.V8_TEST_URL ?? 'http://127.0.0.1:5198';
const output = process.env.V8_EVIDENCE_OUT ?? 'docs/arcade-v8/evidence';
const quality = process.env.V8_QUALITY ?? 'balanced';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
await mkdir(output, { recursive: true });
const page = await browser.newPage();
const errors = [];
const screenshots = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(90_000);
await page.setViewport({ width: 1672, height: 941, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(value => localStorage.setItem('monopoly-graphics-quality', value), quality);

const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 35 }, ...args);
const state = () => page.evaluate(() => window.__soloTest.state());
const stage = () => page.evaluate(() => window.__graphicsAudit.arcade());
const fixture = name => page.evaluate(value => window.__soloTest.fixture(value), name);
const moveMouseOffBoard = () => page.mouse.move(6, 6);
const capture = async name => {
  const file = `${name}.jpg`;
  await page.screenshot({ path: join(output, file), type: 'jpeg', quality: 86 });
  screenshots.push(file);
};
const dock = name => page.evaluate(label => {
  const button = [...document.querySelectorAll('.action-tray button')].find(candidate => candidate.textContent.trim() === label);
  if (!button || button.disabled) throw new Error(`Unavailable action ${label}`);
  button.click();
}, name);
const roll = async (a, b, target) => {
  await page.evaluate((first, second) => {
    const button = document.querySelector('.fantasy-roll');
    if (!button || button.disabled) throw new Error('Roll action unavailable');
    const random = Math.random;
    const values = [(first - 0.75) / 6, (second - 0.75) / 6];
    try {
      Math.random = () => values.shift() ?? random();
      button.click();
    } finally { Math.random = random; }
  }, a, b);
  await wait(expected => window.__soloTest?.state().turnPhase === expected, target);
};
const showNotice = kind => wait(value => {
  const notice = document.querySelector(`[data-activity-notice="${value}"]`);
  return notice && Number(getComputedStyle(notice).opacity) > .94;
}, kind);
const dismiss = () => page.click('.match-notice-close');
const closeEvolution = async () => {
  await page.click('[aria-label="Close property evolution"]');
  await wait(() => !document.querySelector('.property-evolution'));
  await moveMouseOffBoard();
};
const waitForStage = level => wait(value => window.__graphicsAudit.arcade().buildings.some(model =>
  model.spaceId === 6 && model.level === value && model.source === 'gltf'), level);
const openActivity = async () => {
  await page.evaluate(() => {
    const button = document.querySelector('.match-activity-toggle');
    if (button.getAttribute('aria-expanded') === 'false') button.click();
  });
  await wait(() => !!document.querySelector('.match-activity-toggle[aria-expanded="true"]'));
};
const summarize = ({ samples, metadata }) => {
  assert.ok(samples.length >= 5, 'Measured real rendered frames');
  const p = (field, percentile) => {
    const values = samples.map(sample => sample[field]).filter(Number.isFinite).sort((a, b) => a - b);
    return values.length ? Number(values[Math.floor((values.length - 1) * percentile)].toFixed(2)) : null;
  };
  return {
    renderer: metadata.renderer, viewport: metadata.viewport, gpuTimer: metadata.gpuTimerAvailable,
    frames: samples.length, frameMedianMs: p('frameMs', .5), frameP95Ms: p('frameMs', .95),
    renderCpuMedianMs: p('renderCpuMs', .5), gpuMedianMs: p('gpuMs', .5),
    drawCalls: p('calls', .5), triangles: p('triangles', .5),
  };
};
const sample = async () => {
  await page.evaluate(() => window.__graphicsAudit.start());
  await new Promise(resolve => setTimeout(resolve, 2300));
  return summarize(await page.evaluate(() => window.__graphicsAudit.stop()));
};

try {
  await page.bringToFront();
  await page.goto(`${origin}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
  await wait(() => window.__soloTest && window.__graphicsAudit?.arcade && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
  assert.equal((await state()).ruleset, 'arcade');
  await fixture('arcade-evolution');
  await roll(3, 3, 'LANDED_ACTION');
  assert.equal((await state()).players[0].position, 6);
  assert.equal((await state()).properties[6].ownerId, null);
  assert.equal((await stage()).buildings.length, 0);
  await dock('Build');
  await wait(() => document.querySelector('.evolution-header strong')?.textContent === 'Unowned' &&
    [...document.querySelectorAll('.evolution-stages img')].every(image => image.naturalWidth > 0));
  await capture('01-unowned');
  await page.click('.evolution-footer button');
  await waitForStage(0);
  await showNotice('purchase');
  assert.equal((await state()).players[0].money, 1400);
  assert.equal((await state()).properties[6].ownerId, 0);
  await capture('02-purchased-land');
  await dismiss();

  await page.evaluate(() => window.__soloTest.setSpeed(1));
  await page.evaluate(() => {
    window.__arcadeConstruction = [];
    const audit = window.__graphicsAudit;
    const stop = audit.observeRender(({ at }) => {
      const plot = audit.arcade();
      const model = plot.buildings.find(entry => entry.spaceId === 6 && entry.level === 1);
      if (model) window.__arcadeConstruction.push({ at, heightScale: model.scale[1], burst: plot.construction.some(entry => entry.level === 1) });
      if (window.__arcadeConstruction.length > 90) stop();
    });
    const button = document.querySelector('.evolution-footer button');
    button.click();
    button.click();
  });
  await wait(() => window.__arcadeConstruction.some(frame => frame.burst));
  await capture('03-house-construction');
  await waitForStage(1);
  await showNotice('upgrade');
  await wait(() => window.__graphicsAudit.arcade().construction.length === 0);
  const construction = await page.evaluate(() => window.__arcadeConstruction);
  assert.ok(construction.some(frame => frame.burst && frame.heightScale < .95));
  assert.ok(construction.some(frame => !frame.burst && frame.heightScale > .99));
  assert.equal((await state()).players[0].money, 1350);
  assert.equal((await state()).properties[6].developmentLevel, 1);
  assert.equal((await state()).activity.filter(event => event.kind === 'upgrade').length, 1);
  assert.equal(await page.$eval('.evolution-footer button', button => button.disabled), true);
  await capture('04-house');
  await closeEvolution();
  await page.evaluate(() => window.__soloTest.setSpeed(2));
  await dock('End Turn');
  await wait(() => window.__soloTest.state().turnPhase === 'PRE_ROLL');

  await page.evaluate(() => window.__soloTest.prepareArcadeVisit(6));
  await roll(1, 2, 'END_TURN');
  await wait(() => !!document.querySelector('.arcade-upgrade-strip'));
  await page.click('.arcade-upgrade-strip button');
  await wait(() => document.querySelector('.evolution-footer button')?.textContent.includes('Apartment'));
  await page.click('.evolution-footer button');
  await waitForStage(2);
  assert.equal((await state()).players[0].money, 1250);
  await wait(() => document.querySelector('.evolution-facts')?.textContent.includes('$270'));
  await capture('05-apartment');
  await closeEvolution();
  await dock('End Turn');
  for (const seat of [1, 2, 3]) {
    await wait(id => window.__soloTest.state().currentPlayerIndex === id, seat);
    await roll(1, 2, 'END_TURN');
    await dock('End Turn');
  }
  await wait(() => window.__soloTest.state().currentPlayerIndex === 0);
  await page.evaluate(() => window.__soloTest.prepareArcadeVisit(6));
  await roll(1, 2, 'END_TURN');
  await dock('Build');
  await wait(() => document.querySelector('.evolution-footer button')?.textContent.includes('Hotel'));
  await page.click('.evolution-footer button');
  await waitForStage(3);
  assert.equal((await state()).players[0].money, 1100);
  await wait(() => document.querySelector('.evolution-facts')?.textContent.includes('$550'));
  await wait(() => document.querySelector('[data-activity-notice="upgrade"]')?.textContent.includes('Level 3 Hotel'));
  await capture('06-hotel');
  await closeEvolution();
  await openActivity();
  const evolution = (await state()).activity.filter(event => event.kind === 'upgrade').map(event => ({
    level: event.level, cost: event.amount, turn: event.turn, details: event.details,
  }));
  assert.deepEqual(evolution.map(event => [event.level, event.cost]), [[1, 50], [2, 100], [3, 150]]);
  await capture('07-match-activity');
  await page.click('.activity-filters button:nth-child(3)');
  assert.equal(await page.$$eval('.match-activity-row[data-activity-kind="upgrade"]', rows => rows.length), 3);
  assert.equal(await page.$('.match-activity-row[data-activity-kind="roll"]'), null);

  await fixture('arcade-activity');
  await roll(1, 2, 'CARD_DRAWN');
  assert.equal((await state()).activity.filter(event => event.kind === 'card').length, 0);
  await page.click('.card-reveal .modal-primary');
  await showNotice('card');
  await capture('08-chance');
  await dismiss();
  await page.evaluate(() => {
    window.__v8Random = Math.random;
    let draw = 0;
    Math.random = () => (draw++ % 2 ? .2 : .03);
  });
  await dock('End Turn');
  await wait(() => window.__soloTest.state().activity.some(event => event.card?.id === 'cc_2' && event.actor?.name === 'Victoria'));
  await showNotice('card');
  await wait(() => document.querySelector('[data-activity-notice="card"]')?.textContent.includes('Bank Error in Your Favor'));
  await capture('09-community-chest-ai');
  await dismiss();
  await showNotice('rent');
  assert.match(await page.$eval('.receipt-rent', notice => notice.getAttribute('aria-label')), /Arthur paid \$30 to You · Rent on Oriental Avenue/);
  assert.equal(await page.$$eval('.effect-transaction.receipt-rent', notices => notices.length), 1);
  await capture('10-rent-and-ai');
  await wait(() => window.__soloTest.state().currentPlayerIndex === 0 && window.__soloTest.state().turnPhase === 'PRE_ROLL');
  await page.evaluate(() => { Math.random = window.__v8Random; });
  const activity = (await state()).activity;
  assert.equal(activity.filter(event => event.kind === 'rent').length, 1);
  assert.deepEqual(activity.filter(event => event.kind === 'card').map(event => [event.card.id, event.transfers[0].amount]), [['ch_6', 50], ['cc_2', 200]]);
  assert.equal(new Set(activity.filter(event => event.kind === 'roll').map(event => event.actor.id)).size, 4);

  await fixture('arcade-gallery-empty');
  const empty = await sample();
  await fixture('arcade-gallery');
  await wait(() => window.__graphicsAudit.arcade().buildings.length === 4 &&
    window.__graphicsAudit.arcade().buildings.every(model => model.source === 'gltf'));
  assert.equal((await stage()).construction.length, 0, 'A restored scene renders without reconstructing the properties');
  const gallery = await stage();
  const populated = await sample();
  await capture('11-arcade-gallery');

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await wait(() => !!window.__soloTest);
  await fixture('arcade-evolution');
  await roll(3, 3, 'LANDED_ACTION');
  await dock('Build');
  await wait(() => {
    const buy = document.querySelector('.evolution-purchase-actions .is-primary');
    if (!buy) return false;
    const box = buy.getBoundingClientRect();
    return buy.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  });
  await page.click('.evolution-footer button');
  await showNotice('purchase');
  const mobileUpgrade = await page.evaluate(() => {
    const action = document.querySelector('.evolution-footer button').getBoundingClientRect();
    const notice = document.querySelector('.match-notice').getBoundingClientRect();
    const cameraToolbarPresent = document.querySelector('.camera-toolbar') !== null;
    const header = document.querySelector('.resource-bar').getBoundingClientRect();
    return { noticeTop: notice.top, noticeBottom: notice.bottom, actionTop: action.top,
      cameraToolbarPresent, headerBottom: header.bottom };
  });
  assert.ok(mobileUpgrade.noticeBottom <= mobileUpgrade.actionTop, JSON.stringify(mobileUpgrade));
  assert.equal(mobileUpgrade.cameraToolbarPresent, false, 'legacy camera toolbar must be removed');
  await capture('12-mobile-upgrade');
  await page.click('.evolution-footer button');
  await wait(() => window.__soloTest.state().properties[6].developmentLevel === 1);
  await closeEvolution();
  await fixture('arcade-activity');
  await roll(1, 2, 'CARD_DRAWN');
  await page.click('.card-reveal .modal-primary');
  await showNotice('card');
  await dismiss();
  await openActivity();
  await page.click('.activity-filters button:nth-child(4)');
  await page.select('select[aria-label="Filter by player"], .activity-selects label:first-child select', '0');
  assert.equal(await page.$$eval('.match-activity-row', rows => rows.length), 1);
  const layout = await page.evaluate(() => {
    const feed = document.querySelector('.match-activity').getBoundingClientRect();
    const dock = document.querySelector('.fantasy-dock').getBoundingClientRect();
    return { feedBottom: feed.bottom, dockTop: dock.top, withinScreen: feed.right <= innerWidth && feed.left >= 0 };
  });
  assert.ok(layout.withinScreen && layout.feedBottom <= layout.dockTop, JSON.stringify(layout));
  await capture('13-mobile-activity');
  await page.focus('.match-activity-toggle');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.match-activity-toggle', button => button.getAttribute('aria-expanded')), 'false');

  await page.click('[aria-label="Game Settings & New Game"]');
  assert.equal(await page.$eval('input[value="arcade"]', radio => radio.checked), true);
  await page.click('input[value="classic"]');
  await page.click('.setup-modal .modal-primary');
  await wait(() => window.__soloTest.state().ruleset === 'classic');
  assert.equal((await state()).properties[6].developmentLevel, undefined);

  assert.deepEqual(errors, []);
  const report = { quality, screenshots, evolution, constructionFrames: construction.length, activity,
    measuredGallery: gallery, performance: { empty, populated }, mobile: { ...layout, ...mobileUpgrade }, errors };
  await writeFile(join(output, 'solo-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('V8 Solo browser verified', JSON.stringify({ screenshots, evolution, constructionFrames: construction.length, empty, populated, layout }, null, 2));
} catch (error) {
  await page.screenshot({ path: join(output, 'solo-failure.jpg'), type: 'jpeg', quality: 80 }).catch(() => {});
  console.error('V8 Solo browser diagnostics', await state().then(game => ({
    ruleset: game.ruleset, phase: game.turnPhase, currentPlayerIndex: game.currentPlayerIndex,
    balances: game.players.map(player => player.money), activity: game.activity.slice(-7),
  })).catch(() => null), errors);
  throw error;
} finally {
  await browser.close();
}
