// Real PostgreSQL transactions against the disposable database used by test:integration.
import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {randomUUID, createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {PrismaClient} from '@prisma/client';
import {MatchesService} from '../dist/matches/matches.service.js';
import {LifecycleService} from '../dist/matches/lifecycle.service.js';
import {RealtimeService} from '../dist/realtime/realtime.service.js';
import {SEAT_PALETTE} from '../dist/rooms/room-state.js';

const require = createRequire(import.meta.url);
const crypto = require('node:crypto');
const prisma = new PrismaClient();
const realtime = new RealtimeService();
const matches = new MatchesService(prisma, realtime);
const lifetime = 24 * 60 * 60 * 1000;
const instant = new Date('2026-11-17T08:00:00.000Z');
after(() => prisma.$disconnect());

async function fixture(t, count = 3) {
  const lifecycle = new LifecycleService(prisma, realtime);
  const users = await Promise.all(Array.from({length: count}, (_, seat) => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    return prisma.user.create({data: {username: `clock_${seat}_${suffix}`, email: `${suffix}@audit.example`, passwordHash: createHash('sha256').update(suffix).digest('hex')}});
  }));
  const room = await prisma.room.create({data: {hostUserId: users[0].id, mapId: 'central-castle', maxPlayers: count, status: 'IN_PROGRESS', isPrivate: false}});
  t.after(async () => {
    await prisma.match.deleteMany({where: {roomId: room.id}});
    await prisma.room.delete({where: {id: room.id}});
    await prisma.user.deleteMany({where: {id: {in: users.map(user => user.id)}}});
  });
  await prisma.roomMember.createMany({data: users.map((user, seatOrder) => ({roomId: room.id, userId: user.id, seatOrder,
    ...SEAT_PALETTE[seatOrder], isHost: seatOrder === 0, isReady: true}))});
  const match = await prisma.$transaction(tx => matches.createMatch(tx, room.id, users.map((user, seatOrder) => ({userId: user.id, seatOrder, username: user.username}))));
  const players = await prisma.matchPlayer.findMany({where: {matchId: match.matchId}, orderBy: {seatOrder: 'asc'}});
  await lifecycle.socketJoined(match.matchId, users[0].id, 'connected-host');
  return {lifecycle, users, players, room, matchId: match.matchId};
}

async function snapshot(f) {
  return prisma.match.findUniqueOrThrow({where: {id: f.matchId}, include: {players: {orderBy: {seatOrder: 'asc'}}}});
}

async function forfeit(f, request) {
  const before = await snapshot(f);
  const body = request ?? {clientActionId: randomUUID(), expectedStateVersion: before.stateVersion, contentVersion: 'central-castle@1'};
  return matches.performAction(f.matchId, f.users[0].id, 'forfeit', body);
}

for (const count of [3, 4]) {
  test(`${count} players: last connected survivor forfeits and duplicate requests start one clock`, async t => {
    t.mock.timers.enable({apis: ['Date'], now: instant});
    const f = await fixture(t, count);
    await prisma.match.update({where: {id: f.matchId}, data: {status: 'PAUSED', pausedAt: instant, pauseReason: 'PLAYER_DISCONNECTED'}});
    const request = {clientActionId: randomUUID(), expectedStateVersion: 0, contentVersion: 'central-castle@1'};
    const [first, duplicate] = await Promise.all([forfeit(f, request), forfeit(f, request)]);
    assert.deepEqual(first, duplicate);
    const saved = await snapshot(f);
    assert.equal(saved.status, 'PAUSED');
    assert.equal(saved.players[0].isBankrupt, true);
    assert.equal(saved.players[0].connectionStatus, 'CONNECTED', 'eliminated spectator remains connected');
    assert.equal(saved.allPlayersOfflineSince?.getTime(), instant.getTime());
    assert.equal(await prisma.processedAction.count({where: {matchId: f.matchId, clientActionId: request.clientActionId}}), 1);
    t.mock.timers.tick(1000);
    await f.lifecycle.socketJoined(f.matchId, f.users[0].id, 'second-spectator-tab');
    assert.equal((await snapshot(f)).allPlayersOfflineSince.getTime(), instant.getTime(), 'spectator cannot clear or restart the clock');
  });
}

for (const cause of ['tax', 'card']) {
  test(`gameplay ${cause} bankruptcy starts the clock from the committed survivor population`, async t => {
    t.mock.timers.enable({apis: ['Date'], now: instant});
    const f = await fixture(t);
    await prisma.matchPlayer.update({where: {id: f.players[0].id}, data: {money: 0, position: cause === 'tax' ? 1 : 4}});
    if (cause === 'card') {
      const deck = await prisma.matchDeck.findUniqueOrThrow({where: {matchId_deckType: {matchId: f.matchId, deckType: 'chance'}}});
      await prisma.matchDeck.update({where: {id: deck.id}, data: {orderedCardIds: ['ch_11', ...deck.orderedCardIds.filter(id => id !== 'ch_11')]}});
    }
    const faces = [0, 1];
    t.mock.method(crypto, 'randomInt', maximum => {assert.equal(maximum, 6); return faces.shift();});
    await matches.performAction(f.matchId, f.users[0].id, 'roll-dice', {clientActionId: randomUUID(), expectedStateVersion: 0, contentVersion: 'central-castle@1'});
    const saved = await snapshot(f);
    assert.equal(saved.players[0].isBankrupt, true);
    assert.equal(saved.allPlayersOfflineSince?.getTime(), instant.getTime());
    assert.equal(saved.currentPlayerId, f.players[1].id);
    assert.equal(saved.completedTurns, 1);
    assert.equal(saved.lastCardResolved?.cardId, cause === 'card' ? 'ch_11' : undefined);
  });
}

test('a surviving reconnect clears the clock while eliminated spectator connections do not', async t => {
  t.mock.timers.enable({apis: ['Date'], now: instant});
  const f = await fixture(t);
  await prisma.match.update({where: {id: f.matchId}, data: {status: 'PAUSED', pausedAt: instant}});
  await forfeit(f);
  assert.equal((await snapshot(f)).allPlayersOfflineSince?.getTime(), instant.getTime());
  t.mock.timers.tick(lifetime - 1);
  await f.lifecycle.socketJoined(f.matchId, f.users[1].id, 'surviving-player');
  assert.equal((await snapshot(f)).allPlayersOfflineSince, null);
  t.mock.timers.tick(1);
  await f.lifecycle.sweep();
  assert.equal((await snapshot(f)).status, 'PAUSED');
  await f.lifecycle.socketLeft(f.matchId, f.users[1].id, 'surviving-player');
  assert.equal((await snapshot(f)).allPlayersOfflineSince.getTime(), instant.getTime() + lifetime);
});

test('abandonment occurs at exactly 24 hours and commits a single terminal event', async t => {
  t.mock.timers.enable({apis: ['Date'], now: instant});
  const f = await fixture(t);
  await prisma.match.update({where: {id: f.matchId}, data: {status: 'PAUSED', pausedAt: instant}});
  await forfeit(f);
  t.mock.timers.tick(lifetime - 1);
  await f.lifecycle.sweep();
  assert.equal((await snapshot(f)).status, 'PAUSED');
  t.mock.timers.tick(1);
  await Promise.all([f.lifecycle.sweep(), f.lifecycle.sweep()]);
  await f.lifecycle.sweep();
  const saved = await snapshot(f);
  assert.equal(saved.status, 'ABANDONED');
  assert.equal(saved.winnerPlayerId, null);
  assert.equal(saved.allPlayersOfflineSince, null);
  assert.equal(await prisma.gameEvent.count({where: {matchId: f.matchId, eventType: 'game:abandoned'}}), 1);
  assert.equal((await prisma.room.findUniqueOrThrow({where: {id: f.room.id}})).status, 'CLOSED');
});

test('concurrent survivor reconnect and last-online forfeit preserve the latest presence under the match lock', async t => {
  const f = await fixture(t, 4);
  await prisma.match.update({where: {id: f.matchId}, data: {status: 'PAUSED', pausedAt: new Date()}});
  await Promise.all([forfeit(f), f.lifecycle.socketJoined(f.matchId, f.users[1].id, 'racing-reconnect')]);
  const saved = await snapshot(f);
  assert.equal(saved.players[0].isBankrupt, true);
  assert.equal(saved.players[1].connectionStatus, 'CONNECTED');
  assert.equal(saved.allPlayersOfflineSince, null);
  assert.equal(saved.status, 'PAUSED');
});

test('a stale offline deadline cannot abandon a match with a connected survivor', async t => {
  t.mock.timers.enable({apis: ['Date'], now: instant});
  const f = await fixture(t);
  await prisma.match.update({where: {id: f.matchId}, data: {status: 'PAUSED', pausedAt: instant, allPlayersOfflineSince: new Date(instant.getTime() - lifetime)}});
  await f.lifecycle.sweep();
  assert.equal((await snapshot(f)).status, 'PAUSED');
  assert.equal(await prisma.gameEvent.count({where: {matchId: f.matchId, eventType: 'game:abandoned'}}), 0);
});

test('normal last-player completion clears the active offline timer and keeps the winner', async t => {
  const f = await fixture(t, 2);
  await forfeit(f);
  const saved = await snapshot(f);
  assert.equal(saved.status, 'FINISHED');
  assert.equal(saved.winnerPlayerId, f.players[1].id);
  assert.equal(saved.allPlayersOfflineSince, null);
});
