import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = process.env.V12_TEST_URL ?? 'http://127.0.0.1:4271';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.V12_OUTPUT ?? 'docs/v12-interactive-gameplay/evidence';
await mkdir(output, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const checks = [];
const errors = [];
const page = await browser.newPage();
page.setDefaultTimeout(45_000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('monopoly-graphics-quality', 'balanced');
  localStorage.setItem('monopoly-audio-muted', 'false');
  localStorage.setItem('monopoly-audio-volume', '0.25');
  localStorage.setItem('monopoly-activity-notices', 'important');
  const start = OscillatorNode.prototype.start;
  const setValue = AudioParam.prototype.setValueAtTime;
  const frequencies = new WeakMap();
  window.v12Notes = [];
  AudioParam.prototype.setValueAtTime = function (value, when) {
    if (!frequencies.has(this)) frequencies.set(this, value);
    return setValue.call(this, value, when);
  };
  OscillatorNode.prototype.start = function (when) {
    window.v12Notes.push(frequencies.get(this.frequency));
    return start.call(this, when);
  };
});

const wait = (predicate, ...args) => page.waitForFunction(predicate, { polling: 40 }, ...args);
const state = () => page.evaluate(() => window.__soloTest.state());
const fixture = name => page.evaluate(name => window.__soloTest.fixture(name), name);
const capture = async name => {
  await page.evaluate(async () => {
    const animations = document.querySelector('dialog[open]').getAnimations({ subtree: true });
    await Promise.allSettled(animations.map(animation => animation.finished));
  });
  await page.screenshot({ path: join(output, `${name}.jpg`), quality: 91 });
};
const card = 'dialog[open].card-reveal';
const rent = 'dialog[open].rent-payment';
const money = game => game.players.slice(0, 2).map(player => player.money);
const recorded = (game, kind) => game.activity.filter(event => event.kind === kind);
async function click(scope, label) {
  const button = await wait((scope, label) => [...document.querySelectorAll(`${scope} button`)]
    .find(el => !el.disabled && el.getClientRects().length && el.textContent.trim() === label), scope, label);
  try { await button.asElement().click(); } finally { await button.dispose(); }
}
const primary = scope => page.locator(`${scope} button[data-variant="primary"]`).click();
const textOf = selector => page.$eval(selector, element => element.textContent);

async function roll(first = 1, second = 2) {
  await page.waitForSelector('[aria-label="Roll dice"]:enabled');
  await page.evaluate((first, second) => {
    const values = [first, second];
    const random = Math.random;
    Math.random = () => values.length ? (values.shift() - .5) / 6 : random();
    try { document.querySelector('[aria-label="Roll dice"]').click(); } finally { Math.random = random; }
  }, first, second);
}

async function draw(scope = card) {
  await click(scope, 'Draw Card');
  await page.waitForSelector(`${scope} .card-parchment`, { visible: true });
}

async function cannotDismiss(scope) {
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  assert.ok(await page.$(scope));
  assert.equal(await page.$(`${scope} .royal-dialog-close`), null);
}

try {
  await page.goto(`${origin}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
  await wait(() => window.__soloTest && window.__graphicsAudit && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);
  await page.mouse.click(288, 118); // Unlock the existing Web Audio gate.

  await fixture('railroad-rent');
  await roll(2, 2);
  await page.waitForSelector(`${card} .card-back`, { visible: true });
  assert.equal((await state()).turnPhase, 'CARD_PENDING');
  assert.equal((await state()).activeCard, null);
  assert.doesNotMatch(await textOf(card), /Nearest Railroad|Confirm/);
  assert.equal(await page.$eval('[aria-label="Roll dice"]', el => el.disabled), true);
  await cannotDismiss(card);
  await capture('01-chance-draw');
  await draw();
  await wait(() => window.v12Notes.includes(330) && window.v12Notes.includes(660));
  assert.match(await textOf(`${card} .card-parchment`), /nearest Railroad and pay owner rental due/i);
  assert.deepEqual(money(await state()), [1500, 1500]);
  assert.equal(recorded(await state(), 'card').length, 0);
  await capture('02-chance-revealed');
  await click(card, 'Confirm');
  await page.waitForSelector(rent, { visible: true });
  assert.match(await textOf(rent), /Pennsylvania Railroad/);
  assert.deepEqual(money(await state()), [1500, 1500]);
  assert.equal((await state()).railroadRaid, null);
  await click(rent, 'Pay $25');
  await page.waitForSelector('dialog[open].raid-modal', { visible: true, timeout: 8000 })
    .catch(async error => {
      console.error(await page.$$eval('dialog', nodes => nodes.map(node => [node.className, node.open])));
      throw error;
    });
  await page.waitForSelector('dialog[open].raid-modal .match-notice--center.receipt-rent', { visible: true });
  assert.match(await textOf('dialog[open].raid-modal .match-notice--center.receipt-rent'), /You paid \$25 rent to Rival 1 for Pennsylvania Railroad/);
  assert.equal(await page.$$('.receipt-rent').then(receipts => receipts.length), 1);
  assert.equal(recorded(await state(), 'rent').length, 1);
  assert.equal(recorded(await state(), 'card')[0].spaceId, 15);
  await page.locator('dialog[open].raid-modal .receipt-rent .match-notice-close').click();
  await page.locator('dialog[open] .raid-skip').click();
  await page.waitForSelector('dialog[open].raid-modal', { hidden: true });
  await click('.action-tray', 'End Turn');
  assert.equal((await state()).currentPlayerIndex, 0);
  assert.equal((await state()).turnPhase, 'PRE_ROLL');
  checks.push('Face-down Chance, draw audio, card-directed railroad rent notice over the raid dialog, and doubles');

  await fixture('go-to-jail');
  await roll();
  await page.waitForSelector('.match-notice--center[data-activity-notice="jail"]', { visible: true });
  assert.equal((await state()).players[0].inJail, true);

  await fixture('card-chain');
  await roll();
  await draw();
  await click(card, 'Confirm');
  const chest = `${card}.deck-chest`;
  await page.waitForSelector(`${chest} .card-back`, { visible: true });
  assert.equal((await state()).activeCard, null);
  assert.equal((await state()).players[0].money, 1500);
  await draw(chest);
  await click(chest, 'Confirm');
  await wait(() => window.__soloTest.state().turnPhase === 'END_TURN');
  assert.equal((await state()).players[0].money, 1700);
  assert.deepEqual(recorded(await state(), 'card').map(event => event.card.id), ['ch_8', 'cc_1']);
  checks.push('Chained Community Chest draw and one outcome per card');

  await fixture('arcade-rent');
  await page.evaluate(() => { window.v12Notes.length = 0; });
  await roll();
  await page.waitForSelector(rent, { visible: true });
  assert.match(await textOf(rent), /Oriental Avenue.*Victoria.*Level 2 · Apartment/s);
  assert.deepEqual(await page.$$eval(`${rent} dd`, elements => elements.map(el => el.textContent.trim())), ['$1,500', '$1,230']);
  assert.deepEqual(money(await state()), [1500, 1500]);
  assert.equal(recorded(await state(), 'rent').length, 0);
  assert.deepEqual(await page.evaluate(() => window.__graphicsAudit.islands().transactions), []);
  assert.equal(await page.evaluate(() => window.v12Notes.includes(620)), false);
  await cannotDismiss(rent);
  await capture('03-rent-payment');
  await primary(rent);
  await wait(() => window.__graphicsAudit.islands().transactions.length === 1);
  await wait(() => window.v12Notes.includes(1050));
  await wait(() => window.__graphicsAudit.islands().islands[0].displayedBalance === 1230);
  assert.deepEqual(money(await state()), [1230, 1770]);
  assert.deepEqual(await page.evaluate(() => window.__graphicsAudit.islands().islands.slice(0, 2).map(island => island.displayedBalance)), [1230, 1770]);
  assert.equal(recorded(await state(), 'rent').length, 1);
  assert.equal(await page.evaluate(() => window.v12Notes.filter(note => note === 620).length), 1);
  checks.push('Explicit rent payment, one transfer, both island balances and payment sound');

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await fixture('arcade-rent-short');
  await roll();
  await page.waitForSelector(rent, { visible: true });
  assert.equal(await page.$eval(`${rent} button[data-variant="primary"]`, el => el.disabled), true);
  assert.match(await textOf(rent), /Raise \$210 to pay rent/);
  await click(rent, 'Trade to raise funds');
  await page.locator('dialog[open] [aria-label="Close trade"]').click();
  await click(rent, 'Sell $25');
  await click(rent, 'Mortgage $200');
  assert.deepEqual(money(await state()), [285, 1500]);
  assert.equal(recorded(await state(), 'rent').length, 0);
  await primary(rent);
  assert.deepEqual(money(await state()), [15, 1770]);
  checks.push('Mobile and reduced-motion rent with trade access, sale and mortgage');

  await fixture('ai-rent');
  await wait(() => window.__soloTest.state().activity.some(event => event.kind === 'rent'));
  assert.deepEqual(money(await state()), [1504, 1496]);
  assert.equal(await page.$(rent), null);
  await fixture('ai-chance');
  await wait(() => window.__soloTest.state().activity.some(event => event.card?.id === 'ch_6'));
  assert.equal((await state()).players[1].money, 1550);
  assert.equal(await page.$(card), null);
  checks.push('AI resolves both a card and a rent obligation without human input');

  await page.emulateMediaFeatures([]);
  await fixture('chance');
  await roll();
  await page.waitForSelector(`${card} .card-back`);
  await page.evaluate(() => {
    document.querySelector('dialog[open].card-reveal .modal-primary').click();
    window.__soloTest.fixture('opening');
  });
  await wait(() => !document.querySelector('dialog.card-reveal'));
  const restarted = await state();
  assert.equal(restarted.turnPhase, 'PRE_ROLL');
  assert.equal(restarted.activeCard, null);
  assert.equal(restarted.players[0].money, 1500);
  assert.deepEqual(errors, []);
  checks.push('Restart discards the previous draw and restores the opening turn');
  await writeFile(join(output, 'browser.json'), JSON.stringify({ browser: await browser.version(), checks, errors }, null, 2) + '\n');
  console.log(checks.join('\n'));
} catch (error) {
  console.error('V12 browser diagnostics', await state().then(game => ({
    phase: game.turnPhase, debt: game.pendingDebt, raid: game.railroadRaid, balances: money(game), checks, errors,
  })).catch(() => ({ errors })));
  throw error;
} finally {
  await browser.close();
}
