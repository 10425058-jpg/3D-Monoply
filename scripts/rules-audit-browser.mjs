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
async function clickText(selector, label, options) {
  const buttons = await page.$$(selector);
  for (const button of buttons) {
    if ((await button.evaluate(element => element.textContent.trim())) === label) {
      assert.equal(await button.evaluate(element => element.disabled), false, `${label} is enabled`);
      await button.click(options);
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
  await page.evaluate(() => {
    document.addEventListener('click', event => {
      if (event.target.closest('.debt-resolution button')?.textContent.trim() === 'Settle $10') {
        window.__birthdaySettlement = structuredClone(window.__soloTest.state());
      }
    }, {once: true});
  });
  await clickText('.debt-resolution button', 'Settle $10');
  // Capture the committed continuation before the active AI begins its next action.
  await wait(() => window.__birthdaySettlement?.pendingDebt === null);
  const birthdaySettlement = await page.evaluate(() => window.__birthdaySettlement);
  assert.deepEqual(birthdaySettlement.players.map(player => player.money), [1520, 0, 1480]);
  assert.equal(birthdaySettlement.currentPlayerIndex, 0);
  passed.push('S-02 non-active human debtor during an AI card turn');

  await fixture('auction-small-bid');
  await wait(() => !!document.querySelector('#auction-title'));
  await clickText('[aria-labelledby="auction-title"] button', 'Bid $11');
  await wait(() => window.__soloTest.state().auction?.currentBid === 11);
  await clickText('[aria-labelledby="auction-title"] button', 'Pass bid');
  await clickText('[aria-labelledby="auction-title"] button', 'Pass bid');
  await wait(() => window.__soloTest.state().auction === null);
  assert.equal((await state()).properties[3].ownerId, 1);
  assert.equal((await state()).players[1].money, 0);
  passed.push('S-01 exact-cash $11 raise and auction settlement');

  await fixture('opening');
  await clickText('.landmark-upgrade button', 'Upgrade for $400', {clickCount: 2});
  await wait(() => window.__soloTest.state().players[0].landmarkLevel === 1);
  assert.equal((await state()).players[0].money, 1100);
  assert.equal((await state()).players[0].landmarkLevel, 1, 'double-click continuation cannot buy another level');
  assert.match(await page.$eval('.landmark-upgrade', element => element.textContent), /GO income.*250/);
  assert.match(await page.$eval('.landmark-upgrade', element => element.textContent), /750/);
  await page.setViewport({width: 390, height: 844});
  await page.waitForSelector('.players-collapse', {visible: true});
  await page.focus('.players-collapse');
  await page.keyboard.press('Enter');
  await wait(() => document.querySelector('.landmark-upgrade button')?.getBoundingClientRect().height > 0);
  assert.equal(await page.$eval('.landmark-upgrade button', element => element.disabled), false);
  await page.setViewport({width: 1440, height: 900});
  passed.push('S-03 reachable landmark upgrade, price and GO income on desktop and mobile');

  await fixture('six-players');
  await wait(() => document.querySelectorAll('.kingdom-player').length === 6);
  assert.equal(await page.evaluate(() => document.querySelector('.fantasy-players').getBoundingClientRect().bottom <= document.querySelector('.action-tray').getBoundingClientRect().top), true, 'player panel clears the action tray');
  await page.hover('.players-content');
  await page.mouse.wheel({deltaY: 800});
  await wait(() => {
    const panel = document.querySelector('.players-content').getBoundingClientRect();
    const last = document.querySelector('.kingdom-player:last-child').getBoundingClientRect();
    return last.top >= panel.top && last.bottom <= panel.bottom;
  });
  await page.screenshot({path: `${output}/six-player-panel.png`});
  passed.push('S-03 all six players remain reachable above the action tray');

  for (const ownership of ['unowned', 'self', 'opponent']) {
    await fixture(`utility-${ownership}`);
    await wait(() => !!document.querySelector('.card-reveal'));
    const instructions = await page.$eval('.card-reveal', element => element.textContent);
    assert.match(instructions, /10 times/);
    assert.match(instructions, /same two dice.*land on Chance/);
    assert.match(instructions, /Do not roll again/);
    await clickText('.card-reveal button', 'Resolve this card');
    await wait(() => window.__soloTest.state().players[0].position === 12 && !['CARD_DRAWN', 'MOVING'].includes(window.__soloTest.state().turnPhase));
    await wait(() => !document.querySelector('.card-reveal'));
    assert.equal((await state()).players[0].money, ownership === 'opponent' ? 1430 : 1500);
    assert.deepEqual((await state()).dice, [3, 4]);
    passed.push(`UI-01 Solo Nearest Utility instructions and ${ownership} utility`);
  }

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
