import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

const origin = process.env.V5_TEST_URL || 'http://127.0.0.1:4193';
const output = process.env.V5_EVIDENCE_OUT || '.online-test/rules-audit';
await mkdir(output, {recursive: true});
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage();
const errors = [];
const passed = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
await page.setViewport({width: 1440, height: 900});
await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
const wait = predicate => page.waitForFunction(predicate, {timeout: 30000});
const state = () => page.evaluate(() => window.__soloTest.state());
async function fixture(name) {
  await page.evaluate(name => window.__soloTest.fixture(name), name);
  await wait(() => !document.querySelector('#trade-title'));
}
async function clickText(selector, label) {
  const buttons = await page.$$(selector);
  for (const button of buttons) {
    if ((await button.evaluate(element => element.textContent.trim())) === label) {
      assert.equal(await button.evaluate(element => element.disabled), false, `${label} is enabled`);
      await button.click();
      return;
    }
  }
  assert.fail(`Missing ${label}`);
}
async function requestCash(amount) {
  const input = await page.$('.trade-cash-grid label:last-child input');
  await input.focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await input.type(String(amount));
  assert.equal(await input.evaluate(element => element.value), String(amount));
}

try {
  await page.goto(`${origin}/?soloTest#solo`);
  await wait(() => !!window.__soloTest && !!document.querySelector('.fantasy-dock'));

  await fixture('debt-trade');
  await wait(() => !!document.querySelector('.debt-resolution'));
  const before = await state();
  await clickText('.debt-resolution button', 'Trade to raise funds');
  await wait(() => !!document.querySelector('#trade-title'));
  assert.match(await page.$eval('.trade-modal', element => element.textContent), /You/);
  await requestCash(270);
  await clickText('.trade-modal button', 'Send offer');
  await wait(() => !!document.querySelector('#trade-consent-title'));
  assert.deepEqual((await state()).players, before.players, 'proposal needs consent');
  await clickText('[aria-labelledby="trade-consent-title"] button', 'Reject trade');
  await wait(() => !!document.querySelector('.debt-resolution'));
  assert.deepEqual((await state()).players, before.players, 'rejection preserves cash');
  assert.deepEqual((await state()).properties, before.properties, 'rejection preserves deeds');
  await clickText('.debt-resolution button', 'Trade to raise funds');
  await wait(() => !!document.querySelector('#trade-title'));
  await requestCash(270);
  await clickText('.trade-modal button', 'Send offer');
  await wait(() => !!document.querySelector('#trade-consent-title'));
  await clickText('[aria-labelledby="trade-consent-title"] button', 'Accept trade');
  await wait(() => window.__soloTest.state().players[0].money === 270);
  await clickText('.debt-resolution button', 'Settle $270');
  await wait(() => window.__soloTest.state().pendingDebt === null);
  assert.equal((await state()).players[0].isBankrupt, false);
  assert.equal((await state()).properties[39].ownerId, 1);
  passed.push('S-02 human debt trade, rejection, consent and payment');

  await fixture('birthday-trade');
  await wait(() => document.querySelector('#debt-title')?.textContent.includes('Rival 1'));
  await clickText('.debt-resolution button', 'Trade to raise funds');
  await wait(() => !!document.querySelector('#trade-title'));
  assert.match(await page.$eval('.trade-modal', element => element.textContent), /Rival 1/);
  await page.select('.trade-field select', '2');
  await requestCash(10);
  await clickText('.trade-modal button', 'Send offer');
  await wait(() => !!document.querySelector('#trade-consent-title'));
  assert.equal((await state()).pendingTrade.fromPlayerId, 1);
  await clickText('[aria-labelledby="trade-consent-title"] button', 'Accept trade');
  await wait(() => window.__soloTest.state().players[1].money === 10);
  await clickText('.debt-resolution button', 'Settle $10');
  await wait(() => window.__soloTest.state().pendingDebt === null);
  assert.deepEqual((await state()).players.map(player => player.money), [1520, 0, 1480]);
  assert.equal((await state()).currentPlayerIndex, 0);
  passed.push('S-02 non-active human debtor during an AI card turn');

  assert.deepEqual(errors, []);
  await writeFile(`${output}/rules-audit-results.json`, JSON.stringify({passed, errors}, null, 2));
  console.log(`Passed ${passed.length} focused rules-audit browser scenarios.`);
} catch (error) {
  console.error('Rules audit diagnostics', await page.evaluate(() => ({state: window.__soloTest?.state(), dialogs: [...document.querySelectorAll('[role="dialog"]')].map(element => element.textContent)})));
  await page.screenshot({path: `${output}/rules-audit-failure.png`});
  throw error;
} finally {
  await browser.close();
}
