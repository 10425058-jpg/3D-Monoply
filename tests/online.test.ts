import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ApiClient, ApiError, parseEnvelope } from '../src/online/apiClient';
import { SessionManager } from '../src/online/sessionManager';
import { mapMatch, MatchPresenter } from '../src/online/gamePresentationAdapter';
import { EventTracker } from '../src/online/eventTracker';
import { SocketClient, GAME_EVENTS } from '../src/online/socketClient';
import { OnlineController } from '../src/online/onlineController';
import type { Match } from '../src/online/types';
import { useGameStore } from '../src/store/useGameStore';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from 'three';
import { releaseInstanceBuffers } from '../src/components/environment/instanceResources';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { data, meta: {} } : { error: { code: data, message: 'secret database stack trace' } }), { status });
const user = { id: 'user-a', username: 'Alice', email: 'alice@example.com', avatarUrl: null, createdAt: '' };
const tokens = { accessToken: 'memory-only', csrfToken: 'csrf-in-memory', expiresIn: 900 };
function snapshot(): Match {
  return { matchId: 'match-a', roomId: 'room-a', stateVersion: 0, status: 'IN_PROGRESS', mapId: 'central-castle', rulesetId: 'mini-v1', contentVersion: 'central-castle@1',
    players: [
      { playerId: 'uuid-b', userId: 'user-b', username: 'Bob', seatOrder: 3, color: '#10b981', token: 'yacht', position: 10, money: 1000, inJail: true, jailTurns: 1, heldJailCardIds: [], isBankrupt: false, avatarUrl: null, connectionStatus: 'CONNECTED', disconnectedAt: null },
      { playerId: 'uuid-a', userId: 'user-a', username: 'Alice', seatOrder: 1, color: '#ec4899', token: 'cat', position: 0, money: 1500, inJail: false, jailTurns: 0, heldJailCardIds: ['chest-jail'], isBankrupt: false, avatarUrl: null, connectionStatus: 'CONNECTED', disconnectedAt: null },
    ], properties: [{ spaceId: 1, ownerPlayerId: 'uuid-b', houses: 0, isMortgaged: false }],
    currentPlayerId: 'uuid-a', turnNumber: 1, completedTurns: 0, turnPhase: 'PRE_ROLL', dice: null, doublesCount: 0, pendingExtraRoll: false, pendingPurchaseSpaceId: null,
    lastCardResolved: null, allowedActions: ['roll-dice', 'forfeit'], winnerPlayerId: null, finishReason: null, pausedAt: null, pauseReason: null, allPlayersOfflineSince: null, startedAt: '', updatedAt: '', standings: [] };
}

test('HTTP envelope parsing accepts data and masks internal messages and non-JSON outages', async () => {
  assert.deepEqual(await parseEnvelope(json({ answer: 42 }, 201)), { answer: 42 });
  await assert.rejects(parseEnvelope(json('INTERNAL_ERROR', 500)), (e: ApiError) => !e.message.includes('secret') && e.status === 500);
  await assert.rejects(parseEnvelope(new Response('<h1>Proxy down</h1>', { status: 502 })), /Unavailable/);
  await assert.rejects(parseEnvelope(new Response(JSON.stringify({ wrong: true }))), (e: ApiError) => e.code === 'INVALID_RESPONSE');
});
test('authorized 401 refreshes once and resends the exact action body', async () => {
  let token = 'old'; let refreshes = 0; const calls: RequestInit[] = [];
  const api = new ApiClient('/api', { token: () => token, refresh: async () => { ++refreshes; token = 'new'; } }, (async (_url, options) => {
    calls.push(options!); return calls.length === 1 ? json('UNAUTHORIZED', 401) : json({ ok: true });
  }) as typeof fetch);
  const body = { clientActionId: crypto.randomUUID(), expectedStateVersion: 7 };
  await api.request('/actions/roll-dice', { method: 'POST', body });
  assert.equal(refreshes, 1); assert.equal(calls[0].body, calls[1].body);
  assert.equal((calls[1].headers as Record<string, string>).Authorization, 'Bearer new');
  assert.ok(calls.every(c => c.credentials === 'include'));
});
test('a second 401 is surfaced without an infinite refresh loop', async () => {
  let refreshes = 0; let requests = 0;
  const api = new ApiClient('', { token: () => 'token', refresh: async () => { refreshes++; } }, (async () => { requests++; return json('UNAUTHORIZED', 401); }) as typeof fetch);
  await assert.rejects(api.request('/rooms'), /expired/); assert.equal(refreshes, 1); assert.equal(requests, 2);
});
test('restore and concurrent refresh use CSRF bootstrap before a single cookie rotation', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const manager = new SessionManager('/api', (async (url, init) => {
    calls.push({ url: String(url), init: init! });
    if (String(url).endsWith('/csrf')) return json({ csrfToken: 'bootstrapped' });
    if (String(url).endsWith('/refresh')) return json(tokens);
    return json(user);
  }) as typeof fetch);
  await Promise.all([manager.restore(), manager.restore()]);
  assert.deepEqual(calls.map(c => c.url), ['/api/auth/csrf', '/api/auth/refresh', '/api/users/me']);
  assert.equal((calls[1].init.headers as Record<string, string>)['X-CSRF-Token'], 'bootstrapped');
  assert.equal(manager.getSnapshot().user?.username, 'Alice');
  const n = calls.length; await Promise.all([manager.refresh(), manager.refresh(), manager.refresh()]); assert.equal(calls.length - n, 3);
});
test('failed refresh clears memory authentication; profile failure cannot leave restore spinning', async () => {
  const manager = new SessionManager('', (async url => String(url).endsWith('/csrf') ? json('UNAUTHORIZED', 401) : json(user)) as typeof fetch);
  await manager.restore(); assert.equal(manager.getSnapshot().status, 'anonymous'); assert.equal(manager.getSnapshot().accessToken, null);
  const broken = new SessionManager('', (async url => String(url).endsWith('/csrf') ? json({ csrfToken: 'x' }) : String(url).endsWith('/refresh') ? json(tokens) : json('INTERNAL_ERROR', 500)) as typeof fetch);
  await broken.restore(); assert.equal(broken.getSnapshot().status, 'anonymous'); assert.equal(broken.getSnapshot().accessToken, null);
});
test('offline logout clears local tokens, survives reload and defers cookie revocation safely', async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, val: string) => { memory.set(key, val); },
      removeItem: (key: string) => { memory.delete(key); },
    },
  });
  try {
    let offline = false; let logoutCalls = 0; let refreshCalls = 0;
    const transport = (async (url: string | URL | Request) => {
      const path = String(url);
      if (path.endsWith('/login')) return json({ ...tokens, user });
      if (offline) return json('DEPENDENCY_UNAVAILABLE', 503);
      if (path.endsWith('/csrf')) return json({ csrfToken: 'bootstrapped' });
      if (path.endsWith('/logout')) { logoutCalls++; return json({ success: true }); }
      if (path.endsWith('/refresh')) { refreshCalls++; return json(tokens); }
      return json(user);
    }) as typeof fetch;
    const manager = new SessionManager('', transport);
    await manager.authenticate('login', { email: user.email, password: 'test' });
    assert.equal(manager.getSnapshot().status, 'authenticated');
    offline = true;
    await manager.logout(); // user should be signed out locally even on 503
    assert.equal(manager.getSnapshot().status, 'anonymous');
    assert.equal(manager.getSnapshot().accessToken, null);
    assert.equal(memory.get('miniature-city-pending-logout'), '1');

    // Simulate full-page reload: the HttpOnly cookie may still exist remotely.
    const newPage = new SessionManager('', transport);
    await newPage.restore();
    assert.equal(newPage.getSnapshot().status, 'anonymous');
    assert.equal(refreshCalls, 0, 'Offline logout must never silently restore the old cookie');
    await assert.rejects(newPage.authenticate('login', { email: user.email, password: 'test' }), /sign-out/i);
    offline = false;
    await newPage.authenticate('login', { email: user.email, password: 'test' });
    assert.equal(logoutCalls, 1, 'Pending remote session must be revoked before new login');
    assert.equal(memory.get('miniature-city-pending-logout'), undefined);
    assert.equal(newPage.getSnapshot().status, 'authenticated');
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('UUID mapping preserves server seats, tokens, ownership, bankruptcy and dice across reordered arrays', () => {
  const s = snapshot(); s.dice = { values: [6, 2], total: 8, rolledByPlayerId: 'uuid-a' }; s.players[0].isBankrupt = true;
  const mapped = mapMatch(s); const reordered = mapMatch({ ...s, players: [...s.players].reverse() });
  assert.deepEqual(mapped, reordered); assert.deepEqual(mapped.dice, [6, 2]); assert.equal(mapped.properties[1].ownerId, 3);
  assert.equal(mapped.players[mapped.currentPlayerIndex].id, 1); assert.equal(mapped.players[1].isBankrupt, true);
  assert.equal(mapped.players[1].inJail, true); assert.equal(mapped.players[0].getOutOfJailCards, 1);
  assert.throws(() => mapMatch({ ...s, properties: [{ ...s.properties[0], ownerPlayerId: 'unknown' }] }), /Unknown/);
});
test('online scene has only presentation controls, without Solo commands or future decks', () => {
  const solo = useGameStore.getState();
  const presenter = new MatchPresenter(() => {}); presenter.apply(snapshot(), false);
  assert.ok(!('rollDice' in presenter.store.getState())); assert.ok(!('chanceDeck' in presenter.store.getState()));
  presenter.store.getState().selectSpace(1); assert.equal(presenter.store.getState().selectedSpaceId, 1); presenter.dispose();
  assert.equal(useGameStore.getState(), solo, 'Online presentation must leave the actual Solo store unchanged');
});

test('a canceled committed animation cannot overwrite a newer snapshot', async () => {
  const presenter = new MatchPresenter(() => {}); const before = snapshot(); presenter.apply(before, false);
  const roll = structuredClone(before); roll.stateVersion = 1; roll.players[1].position = 7; roll.dice = { values: [3, 4], total: 7, rolledByPlayerId: 'uuid-a' };
  presenter.apply(roll, true, true);
  const newer = structuredClone(roll); newer.stateVersion = 3; newer.players[1].position = 16; newer.dice.values = [4, 5];
  presenter.apply(newer, false); await new Promise(resolve => setTimeout(resolve, 750));
  assert.equal(presenter.store.getState().players.find(p => p.id === 1)?.position, 16); assert.deepEqual(presenter.store.getState().dice, [4, 5]); presenter.dispose();
});

test('proactive expiry refresh is single-flight and also reconciles cross-tab identity', async () => {
  let rotations = 0;
  const manager = new SessionManager('', (async url => {
    if (String(url).endsWith('/login')) return json({ ...tokens, expiresIn: 1, user });
    if (String(url).endsWith('/csrf')) return json({ csrfToken: 'fresh' });
    if (String(url).endsWith('/refresh')) { rotations++; return json({ ...tokens, accessToken: 'new-user-token' }); }
    return json({ ...user, id: 'changed-user', username: 'Changed' });
  }) as typeof fetch);
  await manager.authenticate('login', { email: user.email, password: 'test' });
  await Promise.all([manager.ensureFresh(), manager.ensureFresh(), manager.ensureFresh()]);
  assert.equal(rotations, 1); assert.equal(manager.getSnapshot().user?.id, 'changed-user'); assert.equal(manager.getSnapshot().accessToken, 'new-user-token');
});
test('event tracker rejects duplicates/out-of-order events, detects gaps and retains same-version presence', () => {
  const tracker = new EventTracker(); const e = { eventId: '1', occurredAt: '', matchId: 'm', stateVersion: 5, sequence: 10, payload: {} };
  assert.equal(tracker.accept(e).accepted, true); assert.equal(tracker.accept(e).accepted, false);
  assert.equal(tracker.accept({ ...e, eventId: '2', sequence: 13 }).gap, true);
  assert.equal(tracker.accept({ ...e, eventId: '3', sequence: 11 }).accepted, false);
  assert.equal(tracker.accept({ ...e, eventId: 'presence', sequence: undefined }).accepted, true);
});
test('socket lifecycle subscribes after connect, reauthenticates, and removes every listener', async () => {
  class FakeSocket extends EventEmitter {
    connected = false; auth: unknown; joins: string[] = [];
    connect() { this.connected = true; this.emit('connect'); return this; }
    disconnect() { this.connected = false; return this; }
    timeout() { return this; }
    async emitWithAck(name: string) { this.joins.push(name); return { ok: true }; }
  }
  const manager = new SessionManager('', (async url => String(url).endsWith('/login') ? json({ ...tokens, user }) : String(url).endsWith('/csrf') ? json({ csrfToken: 'x' }) : String(url).endsWith('/users/me') ? json(user) : json({ ...tokens, accessToken: 'new-token' })) as typeof fetch);
  await manager.authenticate('login', { email: user.email, password: 'test' });
  const sockets: FakeSocket[] = []; let reconciles = 0;
  const client = new SocketClient('/game', manager, { roomId: 'r', matchId: 'm' }, { connection: () => {}, event: () => {}, reconcile: () => reconciles++, error: () => {} }, ((_url, options) => {
    const s = new FakeSocket(); s.auth = options?.auth; sockets.push(s); return s;
  }) as never);
  client.start(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(sockets[0].joins, ['room:join', 'match:join']); assert.equal(reconciles, 1);
  for (const event of GAME_EVENTS) assert.equal(sockets[0].listenerCount(event), 1);
  await manager.refresh(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(sockets.length, 2); assert.equal(sockets[0].eventNames().length, 0); assert.equal(sockets[0].connected, false);
  assert.deepEqual(sockets[1].auth, { token: 'new-token' }); client.stop(); assert.equal(sockets[1].eventNames().length, 0); assert.equal(sockets[1].connected, false);
});
test('uncertain actions block double clicks and manual retry reuses the complete original request', async () => {
  const s = snapshot(); const bodies: string[] = []; let fail = true;
  const manager = new SessionManager('', (async (url, init) => {
    if (String(url).includes('/actions/')) { bodies.push(String(init?.body)); if (fail) throw new TypeError('offline'); return json({ stateVersion: 1, events: [] }); }
    return json(String(url).includes('/matches/') ? s : { roomId: 'room-a', roomRevision: 0, members: [], matchId: null });
  }) as typeof fetch);
  const controller = new OnlineController(manager, '', { matchId: s.matchId }, () => {});
  controller.state.setState({ match: s, connection: 'connected' });
  await Promise.all([controller.act('roll-dice'), controller.act('roll-dice')]); assert.equal(bodies.length, 1);
  assert.ok(controller.state.getState().uncertain); await controller.act('roll-dice'); assert.equal(bodies.length, 1);
  fail = false; await controller.act('roll-dice', {}, true); assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1]);
  assert.equal(controller.state.getState().uncertain, null); controller.stop();
});
test('version conflicts fetch a fresh personalized snapshot and never retry with a fresh UUID', async () => {
  let actions = 0; let reads = 0; const s = snapshot();
  const manager = new SessionManager('', (async url => {
    if (String(url).includes('/actions/')) { actions++; return json('STATE_VERSION_CONFLICT', 409); }
    if (String(url).includes('/matches/')) { reads++; return json({ ...s, stateVersion: 20 }); }
    return json({ roomId: 'room-a', roomRevision: 0, members: [], matchId: null });
  }) as typeof fetch);
  const controller = new OnlineController(manager, '', { matchId: s.matchId }, () => {}); controller.state.setState({ match: s, connection: 'connected' });
  await controller.act('roll-dice'); assert.equal(actions, 1); assert.equal(reads, 1); assert.equal(controller.state.getState().match?.stateVersion, 20); assert.match(controller.state.getState().error!, /game changed/); controller.stop();
});

test('late room notifications cannot redirect or repopulate a screen after it is disposed', () => {
  let redirected = false;
  const manager = new SessionManager('', (async () => json({})) as typeof fetch);
  const controller = new OnlineController(manager, '', { roomId: 'room' }, () => { redirected = true; });
  controller.stop();
  controller.acceptRoom({ roomId: 'room', roomRevision: 2, members: [], status: 'IN_PROGRESS', hostUserId: 'user',
    mapId: 'central-castle', maxPlayers: 2, isPrivate: false, matchId: 'match' });
  assert.equal(redirected, false); assert.equal(controller.state.getState().room, null);
});

test('scene departure releases instance buffers when R3F masks dispose, preserving cached GLB resources', () => {
  const geometry = new BoxGeometry(); const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 1);
  let buffersReleased = false; let geometryReleased = false; let materialReleased = false;
  mesh.addEventListener('dispose', () => { buffersReleased = true; });
  geometry.addEventListener('dispose', () => { geometryReleased = true; });
  material.addEventListener('dispose', () => { materialReleased = true; });
  (mesh as unknown as { dispose: null }).dispose = null;
  assert.doesNotThrow(() => releaseInstanceBuffers(mesh));
  assert.equal(buffersReleased, true); assert.equal(geometryReleased, false); assert.equal(materialReleased, false);
  geometry.dispose(); material.dispose();
});
