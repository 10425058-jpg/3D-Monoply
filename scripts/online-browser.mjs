// Real UI + NestJS + disposable PostgreSQL. No mocked API responses or seeded game state.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.ONLINE_TEST_URL || 'http://localhost:5174';
const output = path.resolve(process.env.ONLINE_TEST_OUT || '.online-test');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const observations = new Map(); const errors = []; const results = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await pause(150); }
  throw new Error(`Timed out: ${message}`);
}
async function click(page, label) {
  await page.bringToFront();
  await page.waitForFunction(text => [...(document.querySelector('dialog[open]') ?? document).querySelectorAll('button')].some(b => b.textContent.trim() === text && !b.disabled), { timeout: 30000 }, label);
  const handle = await page.evaluateHandle(text => [...(document.querySelector('dialog[open]') ?? document).querySelectorAll('button')].find(b => b.textContent.trim() === text && !b.disabled), label);
  await handle.asElement().click(); await handle.dispose();
}
async function pageFor(context, width = 1440, height = 900) {
  const page = await context.newPage(); observations.set(page, { match: null, actions: [], credentials: null });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality', 'low'));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/WebGL.*(lost|error)|THREE.*error|shader.*error/i.test(message.text())) console.log('Renderer:', message.text().slice(0, 250)); });
  page.on('requestfailed', request => { if (request.url().includes('/api/')) console.log('API network failure:', new URL(request.url()).pathname, request.failure()?.errorText); });
  page.on('response', async response => {
    try {
      const url = new URL(response.url()); const state = observations.get(page);
      if (!url.pathname.startsWith('/api/v1/')) return;
      if (!response.ok()) { if (response.status() >= 400) console.log('API response:', url.pathname, response.status(), (await response.json()).error?.code); return; }
      const data = (await response.json()).data;
      if (/\/auth\/(register|login)$/.test(url.pathname)) state.credentials = data;
      if (/\/matches\/[^/]+$/.test(url.pathname)) state.match = data;
      if (url.pathname.includes('/actions/')) state.actions.push({ route: url.pathname, body: JSON.parse(response.request().postData()), receipt: data });
    } catch { /* navigation may cancel an obsolete response */ }
  });
  return page;
}
async function go(page, hash) { await page.goto(`${origin}/?graphicsAudit#${hash}`, { waitUntil: 'domcontentloaded' }); }
async function shot(page, name) {
  await pause(900);
  const mask = await page.addStyleTag({ content: '.city-invite strong,.city-invite small,input[name="inviteCode"]{visibility:hidden!important}' });
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }); await mask.evaluate(el => el.remove());
}
async function replaceInput(page, selector, value) {
  await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(selector, value);
}
async function register(page, label) {
  await go(page, 'online/lobby'); await page.waitForSelector('input[name=email]');
  await click(page, 'Create an account');
  await page.waitForSelector('input[name=username]');
  const username = `${label}_${randomUUID().slice(0, 7)}`; const email = `${username}@example.test`; const password = randomUUID();
  await page.type('input[name=username]', username); await page.type('input[name=email]', email);
  await page.type('input[name=password]', password); await page.type('input[name=confirm]', password);
  await click(page, 'Create account'); await page.waitForSelector('.city-lobby-actions');
  return { username, email, password };
}
async function matchReady(page) {
  await page.bringToFront();
  await page.waitForSelector('.city-match');
  await page.waitForFunction(() => document.querySelector('.city-match-header .city-connection.connected'));
  await page.waitForFunction(() => !!window.__graphicsAudit?.game()?.players.length);
  await until(() => observations.get(page).match, 'match snapshot');
}
async function synchronized(a, b) {
  await until(async () => {
    const x = observations.get(a).match, y = observations.get(b).match;
    if (!x || !y || x.stateVersion !== y.stateVersion) return false;
    return JSON.stringify(x.players.map(p => [p.playerId, p.position, p.money, p.isBankrupt])) === JSON.stringify(y.players.map(p => [p.playerId, p.position, p.money, p.isBankrupt])) && JSON.stringify(x.properties) === JSON.stringify(y.properties);
  }, 'identical committed snapshots');
  for (const p of [a, b]) {
    const snapshot = observations.get(p).match;
    await p.waitForFunction(expected => {
      const scene = window.__graphicsAudit?.game();
      return scene && !['ROLLING', 'MOVING'].includes(scene.turnPhase) && expected.players.every(player => scene.players.find(p => p.id === player.seatOrder)?.position === player.position) && (!expected.dice || JSON.stringify(scene.dice) === JSON.stringify(expected.dice.values));
    }, {}, snapshot);
    const scene = await p.evaluate(() => window.__graphicsAudit.game());
    for (const player of snapshot.players) {
      assert.equal(scene.players.find(p => p.id === player.seatOrder)?.position, player.position, '3D token follows committed UUID/seat mapping');
      assert.equal(scene.players.find(p => p.id === player.seatOrder)?.money, player.money);
    }
    if (snapshot.dice) assert.deepEqual(scene.dice, snapshot.dice.values);
    for (const property of snapshot.properties) assert.equal(scene.properties[property.spaceId].ownerId,
      property.ownerPlayerId === null ? null : snapshot.players.find(p => p.playerId === property.ownerPlayerId).seatOrder);
  }
}
function passed(name) { results.push({ scenario: name, passed: true }); console.log(`PASS ${name}`); }
let a, b;
try {
  const ca = await browser.createBrowserContext(); const cb = await browser.createBrowserContext();
  a = await pageFor(ca); b = await pageFor(cb);
  await go(a, 'home'); await a.waitForSelector('.city-menu-panel'); await a.waitForFunction(() => !!window.__graphicsAudit); await pause(2500); await shot(a, '01-menu-desktop');
  await go(a, 'online/lobby'); await a.waitForSelector('input[name=email]'); await shot(a, '02-auth-desktop');
  await a.setViewport({ width: 390, height: 844 }); await shot(a, '02-auth-mobile');
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await a.setViewport({ width: 1440, height: 900 });
  const alice = await register(a, 'Alice');
  await click(a, 'My profile'); await click(a, 'Sign out'); await a.waitForSelector('.city-menu-panel');
  await go(a, 'online/lobby'); await a.waitForSelector('input[name=email]'); await a.type('input[name=email]', alice.email); await a.type('input[name=password]', alice.password); await click(a, 'Sign in');
  await a.waitForSelector('.city-lobby-actions'); await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForSelector('.city-lobby-actions');
  assert.ok((await ca.cookies()).some(c => c.name === 'refresh_token' && c.httpOnly && c.sameSite === 'Lax'));
  const stored = await a.evaluate(() => ({ ...localStorage, ...sessionStorage }));
  assert.ok(!Object.keys(stored).some(k => /token|csrf|password/i.test(k))); passed('B: register, logout, login, CSRF reload restoration, memory-only credentials');
  const bob = await register(b, 'Bob');
  await shot(a, '03-lobby-desktop');
  await click(a, 'Create a room'); await a.click('input[name=players][value="2"]'); await click(a, 'Create room');
  await a.waitForSelector('.city-seats'); const roomId = new URL(a.url()).hash.split('/').at(-1);
  await click(b, 'Refresh'); await b.waitForFunction(id => [...document.querySelectorAll('.city-room-row')].some(r => r.textContent.includes(id.slice(0, 8).toUpperCase())), {}, roomId);
  const row = await b.evaluateHandle(id => [...document.querySelectorAll('.city-room-row')].find(r => r.textContent.includes(id.slice(0, 8).toUpperCase())).querySelector('button'), roomId);
  await row.asElement().click(); await b.waitForSelector('.city-seats');
  await a.waitForFunction(name => document.querySelector('.city-seats').textContent.includes(name), {}, bob.username);
  await click(b, 'I’m ready'); await a.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Start game') && !b.disabled));
  await shot(a, '05-waiting-room');
  await click(a, 'Start game'); await matchReady(a); await matchReady(b);
  assert.equal(observations.get(a).match.matchId, observations.get(b).match.matchId); passed('C: public room, live membership/readiness, host start, both clients enter existing 3D scene');
  await synchronized(a, b);
  let duplicateChecked = false;
  for (let turn = 0; turn < 2; turn++) {
    let turnEnded = false;
    for (let step = 0; step < 14 && !turnEnded; step++) {
      await synchronized(a, b);
      const snapshot = observations.get(a).match;
      const player = snapshot.players.find(p => p.playerId === snapshot.currentPlayerId);
      const actor = player.userId === observations.get(a).credentials.user.id ? a : b;
      const personal = observations.get(actor).match;
      const action = personal.allowedActions.includes('roll-dice') ? 'roll-dice' : personal.allowedActions.includes('buy-property') ? 'buy-property' : personal.allowedActions.includes('end-turn') ? 'end-turn' : 'decline-property';
      const label = action === 'roll-dice' ? 'Roll dice' : action === 'end-turn' ? 'End turn' : action === 'decline-property' ? 'Pass on property' : null;
      const version = snapshot.stateVersion;
      if (action === 'buy-property') {
        await actor.waitForFunction(() => [...document.querySelectorAll('.city-dock-actions button')].some(b => b.textContent.startsWith('Buy property') && !b.disabled));
        await actor.evaluate(() => [...document.querySelectorAll('.city-dock-actions button')].find(b => b.textContent.startsWith('Buy property')).click());
      } else await click(actor, label);
      await until(() => observations.get(a).match?.stateVersion > version && observations.get(b).match?.stateVersion > version, 'action reaches both browsers');
      await synchronized(a, b);
      if (action === 'roll-dice' && !duplicateChecked) {
        const completed = observations.get(actor).actions.at(-1);
        const countBefore = observations.get(actor).actions.length;
        const replay = await actor.evaluate(async ({ route, body, token }) => {
          const response = await fetch(route, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
          return response.json();
        }, { route: completed.route, body: completed.body, token: observations.get(actor).credentials.accessToken });
        assert.equal(replay.data.actionId, completed.receipt.actionId); assert.equal(replay.data.stateVersion, completed.receipt.stateVersion);
        duplicateChecked = true; passed('H: exact action replay returns the original committed roll');
      }
      if (action === 'end-turn') turnEnded = true;
    }
    assert.ok(turnEnded, 'Complete a player turn');
  }
  await shot(a, '06-online-match-desktop');
  await a.setViewport({ width: 390, height: 844 }); await shot(a, '06-online-match-mobile');
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await a.setViewport({ width: 1440, height: 900 }); passed('E: server dice, 3D movement, balances, ownership and turn handoff agree');
  const matchUrl = b.url(); await b.reload({ waitUntil: 'domcontentloaded' }); await matchReady(b); await synchronized(a, b); passed('F: reload restores session and rejoins the same committed match');
  const secondTab = await pageFor(cb); await go(secondTab, 'online/lobby'); await secondTab.waitForSelector('.city-lobby-actions');
  await Promise.all([b.reload({ waitUntil: 'domcontentloaded' }), secondTab.reload({ waitUntil: 'domcontentloaded' })]);
  await matchReady(b); await secondTab.waitForSelector('.city-lobby-actions');
  assert.ok(await secondTab.$eval('.city-sidebar-profile', (el, expected) => el.textContent.includes(expected), bob.username));
  await secondTab.close(); await pause(6000);
  assert.equal(observations.get(a).match.players.find(p => p.userId !== observations.get(a).credentials.user.id).connectionStatus, 'CONNECTED');
  passed('Multiple tabs: concurrent CSRF restoration preserves identity and match presence');
  const beforeDisconnect = observations.get(a).match;
  await b.close(); await until(() => observations.get(a).match?.status === 'PAUSED', 'server grace period pauses match', 22000);
  await shot(a, '07-paused-match');
  b = await pageFor(cb); await b.goto(matchUrl, { waitUntil: 'domcontentloaded' }); await matchReady(b);
  await until(() => observations.get(a).match.status === 'IN_PROGRESS' && observations.get(b).match.status === 'IN_PROGRESS', 'original game resumes');
  assert.equal(observations.get(b).match.matchId, beforeDisconnect.matchId); assert.equal(observations.get(b).match.turnPhase, beforeDisconnect.turnPhase);
  await synchronized(a, b); passed('G: real socket loss, authoritative pause, cookie recovery and resume');
  await click(b, 'Forfeit'); await b.waitForSelector('dialog[open]'); await click(b, 'Forfeit');
  await until(() => observations.get(a).match?.status === 'FINISHED' && observations.get(b).match?.status === 'FINISHED', 'server declares a common result');
  await a.waitForSelector('.city-results'); await shot(a, '07-results');
  await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForSelector('.city-result-row');
  assert.equal(await a.$$eval('.city-result-row', rows => rows.length), 2); passed('I: server terminal state, identical results and standings survive reload');
  await click(a, 'Back to lobby'); await b.waitForSelector('.city-results'); await click(b, 'Back to lobby');
  await click(a, 'Create a room'); await a.click('input[name=visibility][value="private"]'); await click(a, 'Create room'); await a.waitForSelector('.city-invite strong');
  const privateRoom = new URL(a.url()).hash.split('/').at(-1); const invite = await a.$eval('.city-invite strong', e => e.textContent);
  await click(b, 'Refresh'); assert.equal(await b.evaluate(id => document.querySelector('.city-room-list')?.textContent.includes(id.slice(0, 8).toUpperCase()) ?? false, privateRoom), false);
  await click(b, 'Join private'); await b.type('input[name=roomId]', privateRoom); await b.type('input[name=inviteCode]', 'wrong-code'); await click(b, 'Join room');
  await b.waitForFunction(() => document.querySelector('dialog .city-error')?.textContent.includes('incorrect'));
  await click(a, 'Replace code'); await until(async () => await a.$eval('.city-invite strong', e => e.textContent) !== invite, 'rotated invite');
  const rotated = await a.$eval('.city-invite strong', e => e.textContent);
  await replaceInput(b, 'input[name=inviteCode]', invite);
  const oldRejected = b.waitForResponse(r => r.url().endsWith(`/rooms/${privateRoom}/join`) && r.status() === 409);
  await click(b, 'Join room'); await oldRejected;
  await replaceInput(b, 'input[name=inviteCode]', rotated);
  assert.ok(await b.$eval('input[name=inviteCode]', (el, expected) => el.value === expected, rotated), 'Rotated code was entered completely');
  await click(b, 'Join room'); await b.waitForSelector('.city-seats');
  await a.waitForFunction(name => document.querySelector('.city-seats').textContent.includes(name), {}, bob.username); passed('D: private room hidden, wrong/old codes rejected, rotated invite joins through real authorization');
  await click(b, 'Leave room'); await click(a, 'Leave room');
  await a.waitForSelector('.city-lobby-actions'); await b.waitForSelector('.city-lobby-actions');
  // Seed only the existing Solo RNG: 1 + 2 lands on a purchasable property at space 3.
  await go(a, 'solo'); await a.waitForFunction(() => !!window.__graphicsAudit?.game()?.players.length);
  await a.evaluate(() => {
    const original = Math.random; let n = 0; Math.random = () => n++ % 2 ? .2 : 0;
    document.querySelector('button[aria-label="Roll dice"]').click(); Math.random = original;
  });
  assert.deepEqual(await a.evaluate(() => window.__graphicsAudit.game().dice), [1, 2]);
  await a.waitForFunction(() => !['PRE_ROLL', 'ROLLING', 'MOVING'].includes(window.__graphicsAudit.game().turnPhase));
  const phase = await a.evaluate(() => window.__graphicsAudit.game().turnPhase);
  if (phase === 'LANDED_ACTION') await click(a, 'Buy');
  if (phase === 'CARD_DRAWN') await click(a, 'Resolve this card');
  await a.waitForFunction(() => window.__graphicsAudit.game().turnPhase === 'END_TURN'); await click(a, 'End Turn');
  await a.waitForFunction(() => window.__graphicsAudit.game().currentPlayerIndex > 0);
  await a.waitForFunction(() => window.__graphicsAudit.game().players.some(p => p.id > 0 && p.position > 0));
  await shot(a, '08-solo-regression'); passed('A: Solo roll, property action, turn handoff and AI movement still work');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, results, browserErrors: errors }, null, 2));
  console.log(`All ${results.length} real-browser scenarios passed. Evidence: ${output}`);
} catch (error) {
  console.error(error.stack);
  for (const [page, label] of [[a, 'alice-failure'], [b, 'bob-failure']]) if (page && !page.isClosed()) {
    await shot(page, label).catch(() => {});
    console.error(label, await page.evaluate(() => ({ hash: location.hash, notices: [...document.querySelectorAll('.city-error,.city-connection')].map(el => el.textContent) })).catch(() => ({})));
  }
  process.exitCode = 1;
} finally { await browser.close(); }
