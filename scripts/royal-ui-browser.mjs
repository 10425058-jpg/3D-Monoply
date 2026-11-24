import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
// Use a loopback Vite server. Seed only through the existing Solo QA interface and dev module.
const origin = process.env.V9_TEST_URL ?? 'http://127.0.0.1:5189';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) {
  throw new Error('V9 browser fixtures require a loopback origin.');
}
const output = process.env.V9_EVIDENCE_OUT ?? 'docs/royal-ui-v9/evidence';
const after = join(output, 'after');
await mkdir(after, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage();
const errors = [];
const checks = [];
const viewports = [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1024, 768], [390, 844]];
const wait = (fn, ...args) => page.waitForFunction(fn, { timeout: 25000, polling: 75 }, ...args);
const shown = selector => page.waitForSelector(selector, { visible: true });
const capture = name => page.screenshot({ path: join(after, name + '.jpg'), type: 'jpeg', quality: 87 });
const state = () => page.evaluate(() => window.__soloTest.state());
const ready = () => wait(() => window.__soloTest && window.__centralCityAudit?.ready && window.__phase2Environment?.ready);

async function clickText(selector, label) {
  const handle = await wait((css, text) => Array.from(document.querySelectorAll(css))
    .find(element => element.getClientRects().length && !element.disabled && element.textContent.trim() === text),
  selector, label);
  await handle.asElement().click();
  await handle.dispose();
}

async function fixture(name, variant) {
  await page.evaluate(async (name, variant) => {
    const { useGameStore: game } = await import('/src/store/useGameStore.ts');
    window.__soloTest.fixture(name);
    const changePlayer = (players, id, updates) => players.map(player => player.id === id ? { ...player, ...updates } : player);
    if (variant === 'raid') {
      game.setState(s => ({
        turnPhase: 'END_TURN',
        railroadRaid: { attackerId: 0, mode: 'choose', vaultRewards: [150, 250, 550] },
        players: changePlayer(s.players, 1, { landmarkLevel: 2 }),
      }));
    } else if (variant === 'evolution' || variant === 'trade') {
      game.setState(s => ({
        selectedSpaceId: variant === 'evolution' ? 31 : null,
        properties: { ...s.properties, 31: { ...s.properties[31], ownerId: 0, developmentLevel: 0 },
          26: { ...s.properties[26], ownerId: 1, developmentLevel: 0 } },
      }));
    } else if (variant === 'chest') {
      const { COMMUNITY_CHEST_CARDS } = await import('/src/data/cardsData.ts');
      game.setState({ turnPhase: 'CARD_DRAWN', activeCard: COMMUNITY_CHEST_CARDS.find(card => card.id === 'cc_2') });
    } else if (variant === 'bankruptcy') {
      game.setState(s => ({
        turnPhase: 'DEBT_RESOLUTION',
        pendingDebt: { debtorId: 0, creditorId: null, amount: 4000, reason: 'Income Tax' },
        players: changePlayer(s.players, 0, { money: 10 }),
      }));
    } else if (variant === 'victory') {
      game.setState(s => ({ turnPhase: 'GAME_OVER', winner: s.players[0] }));
    } else if (variant === 'ai-auction' || variant === 'no-funds') {
      game.setState(s => ({ players: changePlayer(s.players, 1, variant === 'ai-auction' ? { isAI: true } : { money: 0 }) }));
    } else if (variant === 'poor-bail') {
      game.setState(s => ({ players: changePlayer(s.players, 0, { money: 20 }) }));
    } else if (variant === 'poor-buy') {
      game.setState(s => ({ turnPhase: 'LANDED_ACTION', players: changePlayer(s.players, 0, { money: 20, position: 31 }), selectedSpaceId: 31 }));
    }
  }, name, variant);
}

async function checkModal(name, { desktopCapture, width, height } = {}) {
  await shown('dialog.royal-dialog[open]');
  await wait(() => Number(getComputedStyle(document.querySelector('dialog[open] .royal-frame')).opacity) > .98);
  const dimensions = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const frame = dialog.querySelector('.royal-frame');
    const body = dialog.querySelector('.royal-dialog-body');
    const viewport = frame.getBoundingClientRect();
    const footer = dialog.querySelector('.royal-dialog-footer');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby'));
    const targets = [...(footer ?? frame).querySelectorAll('.royal-button:not(:disabled)')];
    return {
      viewport: [innerWidth, innerHeight],
      dialogs: document.querySelectorAll('dialog[open]').length,
      label: title?.textContent,
      focus: dialog.contains(document.activeElement),
      bounds: [viewport.left, viewport.top, viewport.right, viewport.bottom],
      scroll: [body.scrollWidth, body.clientWidth, body.scrollHeight, body.clientHeight],
      footer: footer ? targets.map(button => {
        const bounds = button.getBoundingClientRect();
        const point = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return { reachable: button.contains(point), height: bounds.height };
      }) : [],
    };
  });
  const [vw, vh] = dimensions.viewport;
  const [left, top, right, bottom] = dimensions.bounds;
  const [content, available] = dimensions.scroll;
  assert.equal(dimensions.dialogs, 1, name + ' has exactly one active dialog');
  assert.ok(dimensions.label?.trim() && dimensions.focus, name + ' is labelled and holds focus');
  assert.ok(left >= 0 && top >= 0 && right <= vw && bottom <= vh && content <= available + 1,
    name + ' fits ' + vw + ' × ' + vh + ' ' + JSON.stringify(dimensions));
  assert.ok(dimensions.footer.every(target => target.reachable && target.height >= 43), name + ' footer is reachable');
  if (width) assert.deepEqual(dimensions.viewport, [width, height]);
  checks.push({ name, ...dimensions });
  if (desktopCapture) await capture(name);
}

async function captureNotice(name, label) {
  await wait(text => {
    const notice = document.querySelector('.match-notice--center');
    return notice?.textContent.includes(text) && Number(getComputedStyle(notice).opacity) > .98;
  }, label);
  await capture(name);
}

async function closeOptional() {
  await page.keyboard.press('Escape');
  await wait(() => !document.querySelector('dialog[open]'));
}

async function clickShortcut(name) {
  await page.click('[aria-label="' + name + '"]');
}

async function cameraPose() {
  return page.evaluate(() => ({
    camera: window.__graphicsAudit.metadata().camera,
    canvas: document.querySelector('canvas').getBoundingClientRect().toJSON(),
  }));
}

try {
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality', 'low'));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(origin + '/?soloTest&graphicsAudit#solo', { waitUntil: 'domcontentloaded' });
  await ready();
  await fixture('arcade-evolution');
  await wait(() => !!window.__graphicsAudit?.metadata().camera);
  await clickShortcut('Game Settings & New Game');
  await checkModal('settings', { desktopCapture: true });
  await closeOptional();
  const initialPose = await cameraPose();
  await page.mouse.move(690, 145);
  await page.mouse.down();
  await page.mouse.move(775, 180, { steps: 12 });
  await page.mouse.up();
  // Let the existing OrbitControls damping settle before comparing the view.
  let lastPose = await cameraPose();
  let quietSamples = 0;
  for (let sample = 0; sample < 45 && quietSamples < 3; sample++) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const next = await cameraPose();
    const drift = next.camera.position.some((value, index) => Math.abs(value - lastPose.camera.position[index]) > .0001);
    quietSamples = drift ? 0 : quietSamples + 1;
    lastPose = next;
  }
  const pose = lastPose;
  await clickShortcut('Game Settings & New Game');
  await checkModal('camera-shield');
  assert.notDeepEqual(pose.camera.position, initialPose.camera.position, 'free orbit moves the camera');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement)), true);
  }
  await page.mouse.move(295, 270);
  await page.mouse.down();
  await page.mouse.move(350, 310, { steps: 8 });
  await page.mouse.up();
  await closeOptional();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Game Settings & New Game');
  const afterPose = await cameraPose();
  for (const [index, value] of pose.camera.position.entries()) {
    assert.ok(Math.abs(afterPose.camera.position[index] - value) < .001, 'the modal shields the manually chosen camera ' + JSON.stringify({ before: pose.camera, after: afterPose.camera }));
  }
  assert.deepEqual(afterPose.canvas, pose.canvas);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  await fixture('arcade-evolution');

  await page.locator('button[title="Game Statistics & Portfolio"]').click();
  await checkModal('statistics', { desktopCapture: true });
  await closeOptional();
  await page.locator('button[title="Monopoly Rules & Guide"]').click();
  await checkModal('rules', { desktopCapture: true });
  await closeOptional();

  await fixture('arcade-evolution', 'trade');
  await clickText('.action-tray button', 'Trade');
  await checkModal('trade', { desktopCapture: true });
  await closeOptional();

  for (const [shortcut, name] of [['Daily', 'journey'], ['Spin', 'lucky-spin'], ['Missions', 'missions'], ['Album', 'album']]) {
    await clickShortcut(shortcut);
    await checkModal(name, { desktopCapture: true });
    if (shortcut === 'Daily') {
      await page.click('.royal-dialog .meta-primary-button:not(:disabled)');
      await wait(() => [...document.querySelectorAll('.royal-dialog button')].some(button => button.disabled && button.textContent.includes('Daily reward claimed')));
    }
    if (shortcut === 'Spin') {
      await clickText('.royal-dialog button', 'Spin the wheel');
      await shown('.wheel-last-win');
    }
    await closeOptional();
  }

  await fixture('arcade-evolution', 'evolution');
  await shown('.deed-evolution');
  await capture('property-deed');
  await page.click('.deed-evolution');
  await shown('.property-evolution');
  await capture('evolution');
  await fixture('arcade-evolution', 'poor-buy');
  await shown('.deed-evolution');
  await page.click('.deed-evolution');
  await shown('.property-evolution');
  const poorBuy = await page.$eval('.evolution-purchase-actions button', button => button.disabled);
  assert.ok(poorBuy, 'property purchase reflects insufficient funds');
  await capture('insufficient-funds');

  await fixture('auction-small-bid');
  await checkModal('auction', { desktopCapture: true });
  await page.keyboard.press('Escape');
  assert.equal(await page.$$eval('dialog[open].auction-modal', dialogs => dialogs.length), 1);
  await fixture('auction-small-bid', 'no-funds');
  await shown('.auction-modal .royal-notice');
  assert.equal(await page.$$eval('.auction-modal .royal-dialog-footer button:disabled', buttons => buttons.length), 3);
  await fixture('auction-small-bid', 'ai-auction');
  await wait(() => document.querySelector('.auction-status')?.textContent.includes('considering a bid'));
  assert.ok(await page.$$eval('.auction-modal .royal-dialog-footer button', buttons => buttons.every(button => button.disabled)));

  await fixture('debt-trade');
  await checkModal('debt', { desktopCapture: true });
  await page.keyboard.press('Escape');
  assert.equal((await state()).turnPhase, 'DEBT_RESOLUTION');

  await fixture('jail', 'poor-bail');
  await shown('[aria-label="Jail options"]');
  assert.equal(await page.$eval('[aria-label="Jail options"] button', button => button.disabled), true);
  await shown('.fantasy-roll:not(:disabled)');
  await capture('jail');

  await fixture('utility-self');
  await checkModal('chance', { desktopCapture: true });
  await page.keyboard.press('Escape');
  assert.equal((await state()).turnPhase, 'CARD_DRAWN');
  await clickText('.card-reveal button', 'Resolve this card');
  await wait(() => !document.querySelector('dialog[open].card-reveal'));
  await fixture('opening', 'chest');
  await checkModal('community-chest', { desktopCapture: true });

  await fixture('arcade-evolution', 'raid');
  await checkModal('railroad', { desktopCapture: true });
  await page.click('.raid-heist');
  await shown('.vault-choice');
  await checkModal('bank-heist', { desktopCapture: true });
  await page.click('.vault-choice:nth-child(2)');
  await captureNotice('heist-reward', 'Vault opened');
  assert.equal((await state()).players[0].money, 1750);
  await fixture('arcade-evolution', 'raid');
  await shown('.raid-target');
  await page.click('.raid-target');
  await captureNotice('shutdown-result', 'Shutdown result');
  assert.equal((await state()).players[1].landmarkLevel, 1);

  await clickShortcut('Missions');
  await shown('.mission-claim:not(:disabled)');
  await page.click('.mission-claim:not(:disabled)');
  await wait(() => [...document.querySelectorAll('.mission-claim')].some(button => button.disabled && button.textContent === 'Claimed'));
  await checkModal('mission-claimed', { desktopCapture: true });
  await closeOptional();
  await clickShortcut('Album');
  await shown('.album-content > .meta-primary-button:not(:disabled)');
  await page.click('.album-content > .meta-primary-button:not(:disabled)');
  await shown('.pack-reveal');
  await page.$eval('.pack-reveal', panel => panel.scrollIntoView({ block: 'end' }));
  await checkModal('pack-reveal', { desktopCapture: true });
  await closeOptional();

  await fixture('opening', 'bankruptcy');
  await clickText('.debt-resolution button', 'Declare bankruptcy');
  await captureNotice('bankruptcy', 'Bankruptcy');
  assert.ok((await state()).players[0].isBankrupt);

  await fixture('arcade-evolution', 'victory');
  await checkModal('victory', { desktopCapture: true });

  for (const [width, height] of viewports) {
    await page.setViewport({ width, height, isMobile: width === 390, hasTouch: width === 390 });
    await ready();
    await fixture('auction-small-bid');
    await checkModal('auction', { width, height });
    await capture('auction-' + width + 'x' + height);
    await fixture('utility-self');
    await checkModal('chance', { width, height });
    if (width === 390) await capture('chance-mobile');
    await fixture('arcade-evolution', 'trade');
    await wait(() => !document.querySelector('dialog[open]'));
    await clickText('.action-tray button', 'Trade');
    await checkModal('trade', { width, height });
    if (width === 390) {
      await capture('trade-mobile');
      await page.$eval('dialog[open] .royal-dialog-body', body => { body.scrollTop = body.scrollHeight; });
      await capture('trade-mobile-summary');
    }
    await closeOptional();
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await clickShortcut('Game Settings & New Game');
  await checkModal('reduced-motion');
  assert.equal(await page.$eval('.royal-frame', frame => getComputedStyle(frame).animationDuration), '0s');
  await page.evaluate(async () => {
    const { useGameStore: game } = await import('/src/store/useGameStore.ts');
    game.setState({ turnPhase: 'DEBT_RESOLUTION', pendingDebt: { amount: 10, reason: 'Income Tax', creditorId: null } });
  });
  await shown('dialog[open].debt-resolution');
  assert.equal(await page.$$eval('dialog[open]', dialogs => dialogs.length), 1);
  await clickText('.debt-resolution button', 'Settle $10');
  await shown('dialog[open].setup-modal');
  await closeOptional();
  assert.deepEqual(errors, []);
  console.log('Passed', checks.length, 'dialog layout checks at six viewports.');
} catch (error) {
  await capture('failure').catch(() => {});
  throw error;
} finally {
  await writeFile(join(output, 'responsive.json'), JSON.stringify({ browser: await browser.version(), viewports, checks, errors }, null, 2));
  await browser.close();
}
