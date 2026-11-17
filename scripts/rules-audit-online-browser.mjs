// Real authenticated UI + Nest + disposable PostgreSQL. The isolated card
// fixture runs the actual engine and persists its result under the match lock.
// Requires the built backend, running same-origin server, and DATABASE_URL.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';

const origin = process.env.ONLINE_TEST_URL || 'http://localhost:3000';
assert.ok(process.env.DATABASE_URL, 'Use a disposable PostgreSQL DATABASE_URL');
for (const url of [origin, process.env.DATABASE_URL]) {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname), 'Card fixtures require loopback test services');
}
const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
const {PrismaClient} = requireBackend('@prisma/client');
const {applyAction} = requireBackend('./dist/game/rules/engine');
const {CONTENT, lockMatch, loadMatch, toEngineState, saveEngineState, appendEvents} = requireBackend('./dist/matches/match-store');
const prisma = new PrismaClient();
const output = `${process.env.ONLINE_TEST_OUT || '.online-test/rules-audit'}/utility-card`;
await mkdir(output, {recursive: true});
const users = [];
let roomId, browser;
async function api(method, path, token, body) {
  const response = await fetch(`${origin}/api/v1${path}`, {method,
    headers: {...(token ? {Authorization: `Bearer ${token}`} : {}), ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000)});
  const result = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(result.error)}`);
  return result.data;
}
try {
  for (let index = 0; index < 2; index++) {
    const username = `utility_${randomUUID().slice(0, 8)}`;
    const email = `${username}@example.test`, password = randomUUID();
    const session = await api('POST', '/auth/register', null, {username, email, password});
    users.push({...session, email, password});
  }
  const room = (await api('POST', '/rooms', users[0].accessToken,
    {mapId: 'central-castle', maxPlayers: 2, isPrivate: false})).room;
  roomId = room.roomId;
  await api('POST', `/rooms/${roomId}/join`, users[1].accessToken, {});
  await api('PATCH', `/rooms/${roomId}/ready`, users[1].accessToken, {isReady: true});
  const {matchId} = await api('POST', `/rooms/${roomId}/start`, users[0].accessToken,
    {rulesetId: 'mini-v1', contentVersion: 'central-castle@1'});
  await prisma.$transaction(async tx => {
    assert.equal(await lockMatch(tx, matchId), true);
    const before = await loadMatch(tx, matchId), state = toEngineState(before);
    state.players[0].position = 4;
    state.decks.chance = ['ch_4', ...state.decks.chance.filter(id => id !== 'ch_4')];
    state.owners[12] = state.players[1].playerId;
    const faces = [0, 1], now = new Date(), version = before.stateVersion + 1;
    const result = applyAction(state, {type: 'roll-dice', actorPlayerId: state.players[0].playerId},
      {content: CONTENT, now: now.toISOString(), stateVersion: version, rng: {int: maximum => {
        assert.equal(maximum, 6); assert.ok(faces.length); return faces.shift();
      }}});
    assert.equal(result.state.players[0].money, 1470);
    assert.equal(result.state.players[1].money, 1530);
    await saveEngineState(tx, before, result.state, version, now);
    await appendEvents(tx, matchId, version, result.events, now);
  });
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({width: 1440, height: 900});
  await page.goto(`${origin}/#online/lobby`);
  await page.waitForSelector('input[name=email]');
  await page.type('input[name=email]', users[0].email);
  await page.type('input[name=password]', users[0].password);
  const signIn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Sign in'));
  await signIn.asElement().click(); await signIn.dispose();
  await page.waitForSelector('.city-lobby-actions');
  await page.goto(`${origin}/#online/match/${matchId}`);
  await page.waitForSelector('.city-last-card', {timeout: 120000});
  const instructions = await page.$eval('.city-last-card p', element => element.textContent);
  assert.match(instructions, /10 times/);
  assert.match(instructions, /same two dice.*land on Chance/);
  assert.match(instructions, /Do not roll again/);
  assert.match(instructions, /unowned.*buy/i);
  assert.equal(await page.$('.landmark-upgrade'), null, 'Solo upgrades are absent from Online mini-v1');
  await page.setViewport({width: 390, height: 844});
  await page.waitForFunction(() => {
    const bounds = document.querySelector('.city-last-card p')?.getBoundingClientRect();
    return bounds && bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth;
  });
  assert.deepEqual(errors, []);
  await page.screenshot({path: `${output}/online-utility-mobile.png`});
  await writeFile(`${output}/results.json`, JSON.stringify({passed: ['UI-01 authenticated Online card instructions and existing-dice 10x rent', 'Online mini-v1 excludes Solo landmark controls'], errors}, null, 2));
  console.log('Passed Online Nearest Utility card instructions with a persisted engine fixture.');
} finally {
  await browser?.close();
  if (roomId) {
    await prisma.match.deleteMany({where: {roomId}});
    await prisma.room.deleteMany({where: {id: roomId}});
  }
  await prisma.user.deleteMany({where: {id: {in: users.map(user => user.user.id)}}});
  await prisma.$disconnect();
}
