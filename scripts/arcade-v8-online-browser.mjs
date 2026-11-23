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
  assert.equal(await page.$('.match-activity'), null, 'floating Match Activity panel removed from Online game');
}

// The floating history UI is intentionally removed. Continue verifying that
// each authenticated player receives the same durable server-confirmed events.
async function committedEvents(page, matchId, kind) {
  const viewerIndex = pages.indexOf(page);
  assert.ok(viewerIndex >= 0, 'known viewer');
  const snapshot = await api('GET', `/matches/${matchId}?activityAfter=0`, users[viewerIndex].accessToken);
  return snapshot.activityEvents.filter(event => event.type === kind).map(event => ({
    id: event.eventId, sequence: event.sequence, payload: event.payload,
  }));
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

async function cardNotice(page, deck) {
  await page.bringToFront();
  const selector = `.match-notice--center[data-activity-notice="card"][data-deck="${deck}"]`;
  await page.waitForFunction(selector => {
    const notice = document.querySelector(selector);
    return notice && Number(getComputedStyle(notice).opacity) > 0.95;
  }, { timeout }, selector);
  const notice = await page.$eval(selector, element => {
    const box = element.getBoundingClientRect();
    return { text: element.textContent, centered: Math.abs(box.x + box.width / 2 - innerWidth / 2) < 4 &&
      Math.abs(box.y + box.height / 2 - innerHeight / 2) < 4, resolvesCard: !!element.querySelector('.modal-primary') };
  });
  assert.equal(notice.centered, true);
  assert.equal(notice.resolvesCard, false);
  return notice.text;
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
  const hostChance = await cardNotice(pages[0], 'chance');
  await shot(pages[0], 'chance-live');
  assert.equal(await cardNotice(pages[1], 'chance'), hostChance);
  const compareCommitted = async (playerPages, matchId, kind) => {
    const all = [];
    for (const page of playerPages) {
      await page.bringToFront();
      all.push(await committedEvents(page, matchId, kind));
    }
    assert.ok(all.every(entries => JSON.stringify(entries) === JSON.stringify(all[0])),
      `all participants receive the same ${kind} events`);
    return all[0];
  };
  const chance = await compareCommitted(pages.slice(0, 2), two.matchId, 'game:card_resolved');
  assert.ok(chance.some(event => event.payload.deck === 'chance' && event.payload.cardId === 'ch_4'));
  const rent = await compareCommitted(pages.slice(0, 2), two.matchId, 'game:rent_paid');
  assert.equal(rent.length, 1);
  assert.equal(rent[0].payload.amount, 30);
  assert.equal(rent[0].payload.spaceId, 12);
  const transfers = await compareCommitted(pages.slice(0, 2), two.matchId, 'game:money_changed');
  assert.ok(transfers.some(event => event.payload.amount === -30 && event.payload.balance === 1470));
  assert.ok(transfers.some(event => event.payload.amount === 30 && event.payload.balance === 1530));
  await shot(pages[1], 'two-player-clear-view');
  await openMatch(pages[1], two.matchId);
  assert.equal((await committedEvents(pages[1], two.matchId, 'game:rent_paid')).length, 1);
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
  const hostChest = await cardNotice(pages[0], 'chest');
  await shot(pages[0], 'community-chest-live');
  for (const page of pages.slice(1)) assert.equal(await cardNotice(page, 'chest'), hostChest);
  const chest = await compareCommitted(pages, four.matchId, 'game:card_resolved');
  assert.ok(chest.some(event => event.payload.cardId === 'cc_9' && event.payload.deck === 'chest'));
  const chestTransfers = await compareCommitted(pages, four.matchId, 'game:money_changed');
  assert.equal(chestTransfers.filter(event => event.payload.amount === -10).length, 3);
  await shot(pages[3], 'four-player-clear-view');
  await pages[3].setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.equal(await pages[3].evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await pages[3].$('.match-activity'), null);
  await shot(pages[3], 'clear-view-mobile');
  assert.deepEqual(browserErrors, []);
  await writeFile(`${output}/online-results.json`, JSON.stringify({
    twoPlayer: { identicalRows: true, rent: 30, resultingBalances: [1470, 1530], restoredQuietly: true },
    fourPlayer: { identicalRows: true, playersPaid: 3, amountPerPlayer: 10 },
    source: 'Actual Chromium, NestJS, Socket.IO and PostgreSQL with deterministic mini-v1 rolls',
    browserErrors,
  }, null, 2));
  console.log('Verified synchronized committed events and popups without floating history panel.');
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
