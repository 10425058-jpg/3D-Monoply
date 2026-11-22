// Real Chromium, NestJS, Socket.IO, and a migrated disposable PostgreSQL database.
// Build the frontend and backend before running. DATABASE_URL must be loopback.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

assert.ok(process.env.DATABASE_URL, 'Use a migrated disposable PostgreSQL database');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
const port = Number(process.env.ONLINE_TEST_PORT ?? 3029);
const origin = `http://127.0.0.1:${port}`;
process.env.CORS_ORIGIN = origin;
process.env.JWT_ACCESS_SECRET = randomUUID() + randomUUID();
process.env.COOKIE_SECURE = 'false';
process.env.DISCONNECT_GRACE_SECONDS = '2';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AllExceptionsFilter } = require('./dist/common/http-exception.filter');
const { EnvelopeInterceptor } = require('./dist/common/envelope.interceptor');
const { PrismaService } = require('./dist/prisma/prisma.service');
const { RealtimeService } = require('./dist/realtime/realtime.service');
const { applyAction } = require('./dist/game/rules/engine');
const { CONTENT, lockMatch, loadMatch, toEngineState, saveEngineState, appendEvents } = require('./dist/matches/match-store');
const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
app.setGlobalPrefix('api/v1');
app.enableCors({ origin, credentials: true });
app.useGlobalFilters(new AllExceptionsFilter());
app.useGlobalInterceptors(new EnvelopeInterceptor());
app.useStaticAssets(resolve('dist'), { index: 'index.html' });
const prisma = app.get(PrismaService);
const realtime = app.get(RealtimeService);
const roomIds = [];
const users = [];
const pages = [];
const browserErrors = [];
const timeout = 90000;
const output = process.env.ONLINE_TEST_OUT ?? 'docs/arcade-v8/evidence';
let browser;

async function api(method, path, token, body, expected = 200) {
  const response = await fetch(`${origin}/api/v1${path}`, { method, signal: AbortSignal.timeout(20000),
    headers: { Origin: origin, ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });
  const value = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${value.error?.code ?? 'unexpected status'}`);
  return value.data;
}

async function createMatch(playerCount) {
  const host = users[0].accessToken;
  const { room } = await api('POST', '/rooms', host, { mapId: 'central-castle', maxPlayers: playerCount, isPrivate: false }, 201);
  roomIds.push(room.roomId);
  for (const { accessToken } of users.slice(1, playerCount)) {
    await api('POST', `/rooms/${room.roomId}/join`, accessToken, {});
    await api('PATCH', `/rooms/${room.roomId}/ready`, accessToken, { isReady: true });
  }
  return api('POST', `/rooms/${room.roomId}/start`, host, { rulesetId: 'mini-v1', contentVersion: 'central-castle@1' }, 201);
}

async function fixture(matchId, edit, faces) {
  const broadcasts = await prisma.$transaction(async tx => {
    assert.equal(await lockMatch(tx, matchId), true);
    const before = await loadMatch(tx, matchId);
    const state = toEngineState(before);
    edit?.(state);
    const now = new Date();
    const stateVersion = before.stateVersion + 1;
    if (!faces) {
      await saveEngineState(tx, before, state, stateVersion, now);
      return [];
    }
    const result = applyAction(state, { type: 'roll-dice', actorPlayerId: state.currentPlayerId }, {
      content: CONTENT, now: now.toISOString(), stateVersion, rng: { int: max => {
        assert.equal(max, 6);
        assert.ok(faces.length);
        return faces.shift() - 1;
      } },
    });
    await saveEngineState(tx, before, result.state, stateVersion, now);
    return appendEvents(tx, matchId, stateVersion, result.events, now);
  });
  realtime.toMatch(matchId, broadcasts);
}

async function signIn(account) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  pages.push(page);
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality', 'low'));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  assert.ok(await page.evaluate(async ({ email, password }) => (await fetch('/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })).ok, { email: account.email, password: account.password }));
}

async function openMatch(page, matchId) {
  await page.bringToFront();
  const url = `${origin}/?graphicsAudit&testMatch=${matchId}#online/match/${matchId}`;
  if (page.url() === url) await page.reload({ waitUntil: 'domcontentloaded' });
  else await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.city-match-header .city-connection')?.textContent === 'Connected', { timeout });
  await page.waitForSelector('.match-activity-toggle', { visible: true, timeout });
  await page.click('.match-activity-toggle');
}

async function matchingRow(page, kind, text) {
  await page.waitForFunction((kind, text) => [...document.querySelectorAll(`[data-activity-kind="${kind}"]`)]
    .some(row => row.textContent.includes(text)), { timeout }, kind, text);
  return page.$$eval(`[data-activity-kind="${kind}"]`, (rows, text) => rows.find(row => row.textContent.includes(text)).textContent, text);
}

async function shot(page, name) {
  await page.bringToFront();
  await page.waitForFunction(() => !!window.__graphicsAudit && !!window.__phase2Environment?.ready, { timeout });
  await page.screenshot({ path: `${output}/online-${name}.png` });
}

async function focusReady(page) {
  await page.bringToFront();
  await page.waitForFunction(() => !document.hidden && !!window.__phase2Environment?.ready &&
    document.querySelector('.city-match-header .city-connection')?.textContent === 'Connected', { timeout });
}

async function cardNotice(page) {
  await page.waitForFunction(() => {
    const notice = document.querySelector('[data-activity-notice="card"]');
    return notice && Number(getComputedStyle(notice).opacity) > 0.95;
  }, { timeout });
}

try {
  await mkdir(output, { recursive: true });
  await app.listen(port, '127.0.0.1');
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--disable-background-timer-throttling', '--no-sandbox', '--disable-dev-shm-usage',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const name of ['Ada', 'Ben', 'Cleo', 'Dev']) {
    const username = `${name}_${randomUUID().slice(0, 5)}`;
    const email = `${username}@example.test`;
    const password = randomUUID();
    const session = await api('POST', '/auth/register', null, { username, email, password }, 201);
    users.push({ ...session, username, email, password });
    await signIn(users.at(-1));
  }
  const two = await createMatch(2);
  await fixture(two.matchId, state => {
    state.players[0].position = 4;
    state.owners[12] = state.players[1].playerId;
    state.decks.chance = ['ch_4', ...state.decks.chance.filter(id => id !== 'ch_4')];
  });
  await openMatch(pages[0], two.matchId);
  await openMatch(pages[1], two.matchId);
  await focusReady(pages[0]);
  await fixture(two.matchId, null, [1, 2]);
  await cardNotice(pages[0]);
  await shot(pages[0], 'chance-live');
  const compareRows = async (playerPages, kind, text) => {
    const rows = [];
    for (const page of playerPages) {
      await page.bringToFront();
      rows.push(await matchingRow(page, kind, text));
    }
    assert.ok(rows.every(row => row === rows[0]));
    return rows[0];
  };
  const chance = await compareRows(pages.slice(0, 2), 'card', 'drew Chance');
  assert.match(chance, /Nearest Utility.*10 times.*moved to Electric Company/s);
  const rent = await compareRows(pages.slice(0, 2), 'rent', 'paid $30 rent');
  assert.match(rent, /Electric Company.*1,470.*1,530/s);
  await pages[1].click('[data-activity-kind="rent"] summary');
  await shot(pages[1], 'two-player-rent');
  await openMatch(pages[1], two.matchId);
  await matchingRow(pages[1], 'rent', 'paid $30 rent');
  assert.equal(await pages[1].$('[data-activity-notice="rent"]'), null);
  const restored = await api('GET', `/matches/${two.matchId}?activityAfter=0`, users[0].accessToken);
  assert.equal(restored.activityEvents.filter(event => event.type === 'game:rent_paid').length, 1);
  assert.ok(!Object.hasOwn(restored, 'decks'));
  await api('GET', `/matches/${two.matchId}?activityAfter=0`, users[2].accessToken, null, 403);
  console.log('Two-player Chance and rent agree across both browsers and restore quietly after refresh.');

  const four = await createMatch(4);
  await fixture(four.matchId, state => {
    state.players[0].position = 14;
    state.decks.chest = ['cc_9', ...state.decks.chest.filter(id => id !== 'cc_9')];
  });
  for (const page of pages) await openMatch(page, four.matchId);
  await focusReady(pages[0]);
  await fixture(four.matchId, null, [1, 2]);
  await cardNotice(pages[0]);
  await shot(pages[0], 'community-chest-live');
  const chest = await compareRows(pages, 'card', 'drew Community Chest');
  assert.match(chest, /It Is Your Birthday/);
  assert.equal((chest.match(/−\$10/g) ?? []).length, 3);
  for (const user of users) assert.ok(chest.includes(user.username));
  await pages[3].click('[data-activity-kind="card"] summary');
  await shot(pages[3], 'four-player-feed');
  await pages[3].setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.equal(await pages[3].evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(await pages[3].evaluate(() => document.querySelector('.match-activity').getBoundingClientRect().bottom <
    document.querySelector('.city-online-dock').getBoundingClientRect().top));
  await shot(pages[3], 'feed-mobile');
  assert.deepEqual(browserErrors, []);
  await writeFile(`${output}/online-results.json`, JSON.stringify({
    twoPlayer: { identicalRows: true, rent: 30, resultingBalances: [1470, 1530], restoredQuietly: true },
    fourPlayer: { identicalRows: true, playersPaid: 3, amountPerPlayer: 10 },
    source: 'Actual Chromium, NestJS, Socket.IO and PostgreSQL with deterministic mini-v1 rolls',
    browserErrors,
  }, null, 2));
  console.log('Verified two-player Chance and rent, four-player Community Chest, refresh and mobile history.');
} catch (error) {
  console.error(error.message);
  for (const [index, page] of pages.entries()) if (!page.isClosed()) {
    await page.screenshot({ path: `.online-test/arcade-online-failure-${index + 1}.png` }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  for (const roomId of roomIds) {
    await prisma.match.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
  }
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.user.id) } } });
  await app.close();
}
