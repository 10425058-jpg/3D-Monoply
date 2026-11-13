// Backend integration tests against a RUNNING NestJS server + migrated PostgreSQL.
// Run via npm run test:integration. Requires DATABASE_URL and socket.io-client.
// These tests create disposable users and matches: NEVER point at a real database.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { io } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const SOCKET_URL = new URL(BASE).origin + '/game';
const ORIGIN = 'http://localhost:5173';
const VERSION = 'central-castle@1';
const prisma = new PrismaClient();
test.after(async () => prisma.$disconnect());

function randomName(label) {
  return label + '_' + randomUUID().replaceAll('-', '').slice(0, 10);
}

async function api(method, path, { token, body, cookie, csrf, origin } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const json = await response.json();
  return {
    status: response.status,
    data: json.data,
    error: json.error,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? null,
  };
}

function ok(response, code = 200) {
  assert.equal(response.status, code, JSON.stringify(response.error));
  assert.ok(response.data, 'Missing success envelope data');
  return response.data;
}

function rejected(response, code, errorCode) {
  assert.equal(response.status, code, JSON.stringify(response));
  assert.equal(response.error?.code, errorCode);
}

async function makeUser(label) {
  const username = randomName(label);
  const email = username + '@example.com';
  const password = 'Integration-Password-1234';
  const r = await api('POST', '/auth/register', { body: { username, email, password } });
  const data = ok(r, 201);
  assert.ok(r.cookie?.startsWith('refresh_token='));
  assert.ok(data.accessToken);
  assert.ok(data.csrfToken);
  assert.equal(data.user.username, username);
  assert.ok(!Object.hasOwn(data.user, 'passwordHash'));
  return { username, email, password, id: data.user.id, token: data.accessToken, csrf: data.csrfToken, cookie: r.cookie };
}

function waitFor(socket, event, check = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error('Timed out waiting for Socket.IO event ' + event));
    }, timeoutMs);
    function onEvent(data) {
      if (!check(data)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(data);
    }
    socket.on(event, onEvent);
  });
}

async function connect(token) {
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
    timeout: 7000,
    auth: { token },
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 9000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
      socket.connect();
    });
    return socket;
  } catch (e) {
    socket.disconnect();
    throw e;
  }
}

function emitAck(socket, event, body) {
  return new Promise((resolve, reject) => {
    socket.timeout(7000).emit(event, body, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function subscribe(socket, event, payload, snapshotEvent) {
  const snapshot = waitFor(socket, snapshotEvent);
  const ack = await emitAck(socket, event, payload);
  assert.equal(ack.ok, true, JSON.stringify(ack));
  return (await snapshot).payload;
}

async function waitUntil(fn, desc, timeoutMs = 13000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Timed out waiting for ' + desc);
}

function actionBody(version, extra = {}) {
  return { clientActionId: randomUUID(), expectedStateVersion: version, contentVersion: VERSION, ...extra };
}

test('Authentication: login, CSRF, cookie rotation, replay prevention, logout', async () => {
  const user = await makeUser('auth');
  rejected(await api('GET', '/users/me'), 401, 'UNAUTHORIZED');
  const profile = ok(await api('GET', '/users/me', { token: user.token }));
  assert.equal(profile.id, user.id);
  rejected(await api('POST', '/auth/login', {
    body: { email: user.email, password: 'wrong-password' },
  }), 401, 'INVALID_CREDENTIALS');

  const login = ok(await api('POST', '/auth/login', {
    body: { email: user.email.toUpperCase(), password: user.password },
  }));
  assert.equal(login.user.id, user.id);

  rejected(await api('POST', '/auth/refresh', { cookie: user.cookie, csrf: user.csrf }), 403, 'CSRF_INVALID');
  rejected(await api('POST', '/auth/refresh', { cookie: user.cookie, csrf: user.csrf, origin: 'https://evil.example' }), 403, 'CSRF_INVALID');
  rejected(await api('POST', '/auth/refresh', { cookie: user.cookie, origin: ORIGIN }), 403, 'CSRF_INVALID');

  const csrf = ok(await api('GET', '/auth/csrf', { cookie: user.cookie, origin: ORIGIN })).csrfToken;
  assert.ok(csrf);
  rejected(await api('POST', '/auth/refresh', { cookie: user.cookie, csrf: user.csrf, origin: ORIGIN }), 403, 'CSRF_INVALID');
  const rotated = await api('POST', '/auth/refresh', { cookie: user.cookie, csrf, origin: ORIGIN });
  const tokens = ok(rotated);
  assert.ok(rotated.cookie && rotated.cookie !== user.cookie);
  assert.ok(tokens.accessToken);
  rejected(await api('POST', '/auth/refresh', { cookie: user.cookie, csrf, origin: ORIGIN }), 401, 'UNAUTHORIZED');
  assert.equal(ok(await api('GET', '/users/me', { token: tokens.accessToken })).id, user.id);

  ok(await api('POST', '/auth/logout', { cookie: rotated.cookie, csrf: tokens.csrfToken, origin: ORIGIN }));
  rejected(await api('POST', '/auth/refresh', { cookie: rotated.cookie, csrf: tokens.csrfToken, origin: ORIGIN }), 401, 'UNAUTHORIZED');
});

test('Rooms: private invite rotation, authorization, seat reuse and host transfer', async () => {
  const host = await makeUser('host');
  const first = await makeUser('first');
  const second = await makeUser('second');
  const replacement = await makeUser('replacement');

  const created = ok(await api('POST', '/rooms', {
    token: host.token, body: { mapId: 'central-castle', maxPlayers: 4, isPrivate: true },
  }), 201);
  const roomId = created.room.roomId;
  assert.ok(created.inviteCode);
  assert.equal(created.room.members[0].seatOrder, 0);
  const list = ok(await api('GET', '/rooms', { token: host.token }));
  assert.ok(!list.items.some((room) => room.roomId === roomId), 'Private room leaked to room browser');
  rejected(await api('GET', '/rooms/' + roomId, { token: second.token }), 403, 'FORBIDDEN');
  rejected(await api('POST', '/rooms/' + roomId + '/join', { token: first.token, body: {} }), 409, 'INVALID_INVITE_CODE');

  const joined = ok(await api('POST', '/rooms/' + roomId + '/join', {
    token: first.token, body: { inviteCode: created.inviteCode },
  }));
  assert.equal(joined.members.find((m) => m.userId === first.id).seatOrder, 1);
  ok(await api('POST', '/rooms/' + roomId + '/leave', { token: first.token }));
  assert.equal(ok(await api('GET', '/rooms/' + roomId, { token: host.token })).members.length, 1);

  const rotated = ok(await api('POST', '/rooms/' + roomId + '/invite/rotate', { token: host.token })).inviteCode;
  assert.notEqual(created.inviteCode, rotated);
  rejected(await api('POST', '/rooms/' + roomId + '/join', {
    token: second.token, body: { inviteCode: created.inviteCode },
  }), 409, 'INVALID_INVITE_CODE');
  const seatReused = ok(await api('POST', '/rooms/' + roomId + '/join', {
    token: second.token, body: { inviteCode: rotated },
  }));
  assert.equal(seatReused.members.find((m) => m.userId === second.id).seatOrder, 1);

  ok(await api('POST', '/rooms/' + roomId + '/leave', { token: host.token }));
  const transferred = ok(await api('GET', '/rooms/' + roomId, { token: second.token }));
  assert.equal(transferred.hostUserId, second.id);
  assert.equal(transferred.members[0].isHost, true);
  const next = ok(await api('POST', '/rooms/' + roomId + '/join', {
    token: replacement.token, body: { inviteCode: rotated },
  }));
  assert.equal(next.members.find((m) => m.userId === replacement.id).seatOrder, 0);
  assert.equal(next.members.length, 2);
});

test('REST + Socket.IO: lobby events, match idempotency, privacy, disconnect and recovery', async () => {
  const sockets = [];
  try {
    const alice = await makeUser('alice');
    const bob = await makeUser('bob');
    const outsider = await makeUser('outsider');
    const room = ok(await api('POST', '/rooms', {
      token: alice.token, body: { mapId: 'central-castle', maxPlayers: 2, isPrivate: false },
    }), 201).room;
    const roomId = room.roomId;

    const a = await connect(alice.token); sockets.push(a);
    const b = await connect(bob.token); sockets.push(b);
    const stranger = await connect(outsider.token); sockets.push(stranger);
    const outsiderAck = await emitAck(stranger, 'room:join', { roomId });
    assert.equal(outsiderAck.ok, false);
    assert.equal(outsiderAck.error.code, 'FORBIDDEN');

    const aRoom = await subscribe(a, 'room:join', { roomId }, 'room:snapshot');
    assert.equal(aRoom.roomId, roomId);
    const roomUpdated = waitFor(a, 'room:updated', (event) => event.payload?.members?.length === 2);
    ok(await api('POST', '/rooms/' + roomId + '/join', { token: bob.token, body: {} }));
    assert.equal((await roomUpdated).roomId, roomId);

    const bRoom = await subscribe(b, 'room:join', { roomId }, 'room:snapshot');
    assert.equal(bRoom.members.length, 2);
    const readyUpdate = waitFor(a, 'room:updated', (event) => event.payload?.members?.find((m) => m.userId === bob.id)?.isReady === true);
    ok(await api('PATCH', '/rooms/' + roomId + '/ready', { token: bob.token, body: { isReady: true } }));
    await readyUpdate;

    const startedA = waitFor(a, 'match:started');
    const startedB = waitFor(b, 'match:started');
    const started = ok(await api('POST', '/rooms/' + roomId + '/start', {
      token: alice.token, body: { rulesetId: 'mini-v1', contentVersion: VERSION },
    }), 201);
    const matchId = started.matchId;
    assert.equal((await startedA).payload.matchId, matchId);
    assert.equal((await startedB).payload.matchId, matchId);

    rejected(await api('GET', '/matches/' + matchId, { token: outsider.token }), 403, 'FORBIDDEN');
    const unauthorizedMatch = await emitAck(stranger, 'match:join', { matchId });
    assert.equal(unauthorizedMatch.ok, false);
    assert.equal(unauthorizedMatch.error.code, 'FORBIDDEN');

    const snapA = await subscribe(a, 'match:join', { matchId }, 'match:snapshot');
    const snapB = await subscribe(b, 'match:join', { matchId }, 'match:snapshot');
    assert.equal(snapA.matchId, matchId);
    assert.equal(snapA.stateVersion, 0);
    assert.equal(snapA.players.length, 2);
    assert.ok(!Object.hasOwn(snapA, 'decks'), 'Secret deck revealed in match snapshot');
    assert.ok(!Object.hasOwn(snapB, 'decks'), 'Secret deck revealed to opponent');
    assert.notDeepEqual(snapA.allowedActions, snapB.allowedActions, 'Both players received the same actions');
    const decksInDb = await prisma.matchDeck.findMany({ where: { matchId } });
    assert.equal(decksInDb.length, 2);

    const current = snapA.players.find((p) => p.playerId === snapA.currentPlayerId);
    const actor = current.userId === alice.id ? alice : bob;
    const spectator = actor.id === alice.id ? b : a;
    const actorSnap = ok(await api('GET', '/matches/' + matchId, { token: actor.token }));
    assert.ok(actorSnap.allowedActions.includes('roll-dice'));

    const diceNotification = waitFor(spectator, 'game:dice_rolled');
    const body = actionBody(actorSnap.stateVersion);
    const endpoint = '/matches/' + matchId + '/actions/roll-dice';
    const rolled = ok(await api('POST', endpoint, { token: actor.token, body }));
    const diceEvent = await diceNotification;
    assert.equal(diceEvent.matchId, matchId);
    assert.equal(diceEvent.stateVersion, rolled.stateVersion);
    assert.ok(Number.isInteger(diceEvent.sequence));
    assert.equal(rolled.stateVersion, 1);

    const retried = ok(await api('POST', endpoint, { token: actor.token, body }));
    assert.deepEqual(retried, rolled, 'Identical action retry must return the original result');
    const count = await prisma.processedAction.count({ where: { matchId, clientActionId: body.clientActionId } });
    assert.equal(count, 1, 'Idempotency ledger must record the action once');
    const fresh = ok(await api('GET', '/matches/' + matchId, { token: actor.token }));
    assert.equal(fresh.stateVersion, 1);
    rejected(await api('POST', endpoint, { token: actor.token, body: actionBody(0) }), 409, 'STATE_VERSION_CONFLICT');

    // Leaving the room socket is NOT leaving the room or match.
    assert.equal((await emitAck(b, 'room:leave', { roomId })).ok, true);
    assert.equal(ok(await api('GET', '/rooms/' + roomId, { token: bob.token })).members.length, 2);

    // Disconnect only Bob; Alice stays online. Grace timeout triggers PAUSED.
    const gone = waitFor(a, 'player:connection_changed', (e) =>
      e.payload?.playerId === snapB.players.find((p) => p.userId === bob.id)?.playerId &&
      e.payload.connectionStatus === 'DISCONNECTED'
    );
    b.disconnect();
    await gone;
    const paused = await waitUntil(async () => {
      const state = ok(await api('GET', '/matches/' + matchId, { token: alice.token }));
      return state.status === 'PAUSED' ? state : null;
    }, 'match pause after Bob disconnects');
    assert.equal(paused.pauseReason, 'PLAYER_DISCONNECTED');

    // Reconnect and re-subscribe: persisted turn state survives and game resumes.
    const resumedEvent = waitFor(a, 'game:resumed');
    const b2 = await connect(bob.token); sockets.push(b2);
    const resumedSnapshot = await subscribe(b2, 'match:join', { matchId }, 'match:snapshot');
    assert.equal(resumedSnapshot.matchId, matchId);
    const resumed = await resumedEvent;
    const after = ok(await api('GET', '/matches/' + matchId, { token: alice.token }));
    assert.equal(after.status, 'IN_PROGRESS');
    assert.equal(resumed.stateVersion, after.stateVersion);
    assert.equal(after.currentPlayerId, fresh.currentPlayerId);
    assert.equal(after.turnPhase, fresh.turnPhase);

    // Host goes offline: another connected player becomes host after grace.
    const hostChanged = waitFor(b2, 'room:host_changed', (e) => e.payload?.newHostUserId === bob.id, 18000);
    a.disconnect();
    await hostChanged;
    const hostRoom = ok(await api('GET', '/rooms/' + roomId, { token: bob.token }));
    assert.equal(hostRoom.hostUserId, bob.id);
    const hostPaused = await waitUntil(async () => {
      const state = ok(await api('GET', '/matches/' + matchId, { token: bob.token }));
      return state.status === 'PAUSED' && state.allowedActions.includes('forfeit-player') ? state : null;
    }, 'new host can forfeit overdue disconnected player');
    const alicePlayerId = hostPaused.players.find((p) => p.userId === alice.id).playerId;
    const removed = ok(await api('POST', '/matches/' + matchId + '/actions/forfeit-player', {
      token: bob.token, body: actionBody(hostPaused.stateVersion, { targetPlayerId: alicePlayerId }),
    }));
    assert.equal(removed.status, 'FINISHED');
    const terminal = ok(await api('GET', '/matches/' + matchId, { token: bob.token }));
    assert.equal(terminal.status, 'FINISHED');
    assert.deepEqual(terminal.allowedActions, []);
    assert.equal(terminal.standings.length, 2, 'Results must survive a missed terminal notification');
    assert.equal(terminal.standings[0].playerId, terminal.winnerPlayerId);
    assert.deepEqual(terminal.standings.map((row) => row.rank), [1, 2]);
    assert.ok(terminal.standings.every((row) => Number.isInteger(row.netWorth) && row.netWorth >= row.money));
    assert.deepEqual(ok(await api('GET', '/matches/' + matchId, { token: alice.token })).standings, terminal.standings);
    const closed = ok(await api('GET', '/rooms/' + roomId, { token: bob.token }));
    assert.equal(closed.status, 'CLOSED');
    rejected(await api('POST', '/rooms/' + roomId + '/join', {
      token: outsider.token, body: {},
    }), 409, 'ROOM_CLOSED');
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
});

test('Presence: closing one of two match tabs keeps the player connected', async () => {
  const alice = await makeUser('tabs_a');
  const bob = await makeUser('tabs_b');
  const room = ok(await api('POST', '/rooms', {
    token: alice.token, body: { mapId: 'central-castle', maxPlayers: 2, isPrivate: false },
  }), 201).room;
  ok(await api('POST', '/rooms/' + room.roomId + '/join', { token: bob.token, body: {} }));
  ok(await api('PATCH', '/rooms/' + room.roomId + '/ready', { token: bob.token, body: { isReady: true } }));
  const { matchId } = ok(await api('POST', '/rooms/' + room.roomId + '/start', {
    token: alice.token, body: { rulesetId: 'mini-v1', contentVersion: VERSION },
  }), 201);
  const sockets = [];
  try {
    const a = await connect(alice.token); sockets.push(a);
    const b1 = await connect(bob.token); sockets.push(b1);
    const b2 = await connect(bob.token); sockets.push(b2);
    for (const socket of sockets) await subscribe(socket, 'match:join', { matchId }, 'match:snapshot');
    b1.disconnect();
    await new Promise(resolve => setTimeout(resolve, 250));
    const withSecondTab = ok(await api('GET', '/matches/' + matchId, { token: alice.token }));
    assert.equal(withSecondTab.players.find(p => p.userId === bob.id).connectionStatus, 'CONNECTED');
    assert.equal(withSecondTab.status, 'IN_PROGRESS');
    const gone = waitFor(a, 'player:connection_changed', e => e.payload?.connectionStatus === 'DISCONNECTED');
    b2.disconnect(); await gone;
    const withNoTabs = ok(await api('GET', '/matches/' + matchId, { token: alice.token }));
    assert.equal(withNoTabs.players.find(p => p.userId === bob.id).connectionStatus, 'DISCONNECTED');
    // Close the disposable match through its normal voluntary action.
    ok(await api('POST', '/matches/' + matchId + '/actions/forfeit', {
      token: bob.token, body: actionBody(withNoTabs.stateVersion),
    }));
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
});
