import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ApiClient, ApiError, parseEnvelope } from '../src/online/apiClient';
import { SessionManager } from '../src/online/sessionManager';
import { mapMatch, MatchPresenter } from '../src/online/gamePresentationAdapter';
import { committedFeedback, committedMove, type CommittedEvent } from '../src/online/committedPresentation';
import { committedActivity } from '../src/online/committedActivity';
import { collectIslandTransfers } from '../src/presentation/islandMoney';
import { EventTracker } from '../src/online/eventTracker';
import { SocketClient, GAME_EVENTS } from '../src/online/socketClient';
import { OnlineController } from '../src/online/onlineController';
import type { Match, PublicActivityEvent } from '../src/online/types';
import { useGameStore } from '../src/store/useGameStore';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from 'three';
import { releaseInstanceBuffers } from '../src/components/environment/instanceResources';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 400 ? { data, meta: {} } : { error: { code: data, message: 'secret database stack trace' } }), { status });
const user = { id: 'user-a', username: 'Alice', email: 'alice@example.com', avatarUrl: null, createdAt: '' };
const tokens = { accessToken: 'memory-only', csrfToken: 'csrf-in-memory', expiresIn: 900 };
const activityLabels = {
  spaceName: (id: number) => ({ 0: 'GO', 3: 'Baltic Avenue', 7: 'Chance', 10: 'Jail', 12: 'Electric Company', 39: 'Boardwalk' })[id] ?? `space ${id}`,
  card: (id: string) => ({
    utility: { title: 'Advance to the nearest Utility', description: 'Pay ten times the dice roll.' },
    birthday: { title: 'It is your Birthday', description: 'Collect $10 from each player.' },
    dividend: { title: 'Bank pays you a Dividend', description: 'Collect $50.' },
  })[id],
};
function publicEvents(version: number, events: [type: string, payload: Record<string, unknown>][], firstSequence = 1): PublicActivityEvent[] {
  return events.map(([type, payload], index) => ({
    type, payload, stateVersion: version, sequence: firstSequence + index, eventId: `event-${firstSequence + index}`,
    occurredAt: '2026-11-22T00:00:00.000Z',
  }));
}
test('Online Match Activity collapses a committed rent debit and credit to one directional event', () => {
  const s = { ...snapshot(), stateVersion: 1 };
  const original = structuredClone(s);
  const rows = publicEvents(1, [
    ['game:money_changed', { playerId: 'uuid-a', amount: -70, balance: 1430, reason: 'RENT' }],
    ['game:money_changed', { playerId: 'uuid-b', amount: 70, balance: 1070, reason: 'RENT' }],
    ['game:rent_paid', { payerPlayerId: 'uuid-a', ownerPlayerId: 'uuid-b', spaceId: 3, amount: 70 }],
  ]);
  const entries = committedActivity(s, rows, activityLabels);
  assert.equal(entries.length, 1);
  const [rent] = entries;
  assert.equal(rent.title, 'Alice paid $70 rent to Bob for Baltic Avenue.');
  assert.equal(rent.id, 'event-3');
  assert.deepEqual(rent.transfers?.map(transfer => [transfer.from?.id, transfer.fromBalance, transfer.to?.id, transfer.toBalance, transfer.amount]),
    [['uuid-a', 1430, 'uuid-b', 1070, 70]]);
  assert.deepEqual(s, original);
});
test('four Online players see the same multi-party card outcome and recorded bankruptcy asset transfer', () => {
  const s = { ...snapshot(), stateVersion: 2, turnNumber: 3 };
  s.players.push({ ...s.players[0], playerId: 'uuid-c', username: 'Cara', seatOrder: 2 });
  s.players.push({ ...s.players[0], playerId: 'uuid-d', username: 'Dan', seatOrder: 0 });
  const rows = publicEvents(2, [
    ['game:card_resolved', { playerId: 'uuid-a', cardId: 'birthday', deck: 'chest', effects: [{ type: 'collect_from_each_player', amount: 10 }] }],
    ['game:money_changed', { playerId: 'uuid-b', amount: -10, balance: 990, reason: 'CARD' }],
    ['game:money_changed', { playerId: 'uuid-a', amount: 10, balance: 1510, reason: 'CARD' }],
    ['game:player_bankrupt', { playerId: 'uuid-c', creditorPlayerId: 'uuid-a', reason: 'INSOLVENT_TO_PLAYER',
      forfeitedCash: 3, creditorBalance: 1513, transferredSpaceIds: [39] }],
    ['game:money_changed', { playerId: 'uuid-d', amount: -10, balance: 990, reason: 'CARD' }],
    ['game:money_changed', { playerId: 'uuid-a', amount: 10, balance: 1523, reason: 'CARD' }],
    ['game:turn_changed', { currentPlayerId: 'uuid-d', turnPhase: 'PRE_ROLL' }],
  ]);
  const entries = committedActivity(s, rows, activityLabels);
  for (let seat = 0; seat < 4; seat++) {
    const viewer = { ...s, players: [...s.players.slice(seat), ...s.players.slice(0, seat)], allowedActions: [] };
    assert.deepEqual(committedActivity(viewer, rows, activityLabels), entries);
  }
  assert.deepEqual(entries.map(item => [item.kind, item.turn]), [['card', 2], ['bankruptcy', 2], ['turn', 3]]);
  assert.equal(entries[0].title, 'Alice drew Community Chest — It is your Birthday');
  assert.equal(entries[0].card?.instruction, 'Collect $10 from each player.');
  assert.deepEqual(entries[0].transfers?.map(item => [item.from?.name, item.to?.name, item.amount]),
    [['Bob', 'Alice', 10], ['Dan', 'Alice', 10]]);
  assert.match(entries[0].details?.join(' ') ?? '', /Cara went bankrupt/);
  assert.equal(entries[1].transfers?.[0].amount, 3);
  assert.deepEqual(entries[1].details, ['Boardwalk transferred to Alice.']);
});
test('Online Chance records committed movement, rent and card rewards in the correct historical turn', () => {
  const s = { ...snapshot(), stateVersion: 3, turnNumber: 2 };
  const rows = [
    ...publicEvents(1, [
      ['game:dice_rolled', { playerId: 'uuid-a', dice: [2, 2], total: 4 }],
      ['game:player_moved', { playerId: 'uuid-a', fromPosition: 3, toPosition: 7 }],
      ['game:card_resolved', { playerId: 'uuid-a', cardId: 'utility', deck: 'chance', effects: [{ type: 'nearest_utility', targetSpaceId: 12 }] }],
      ['game:player_moved', { playerId: 'uuid-a', fromPosition: 7, toPosition: 12 }],
      ['game:money_changed', { playerId: 'uuid-a', amount: -40, balance: 1460, reason: 'RENT' }],
      ['game:money_changed', { playerId: 'uuid-b', amount: 40, balance: 1040, reason: 'RENT' }],
      ['game:rent_paid', { payerPlayerId: 'uuid-a', ownerPlayerId: 'uuid-b', spaceId: 12, amount: 40 }],
      ['game:extra_roll', { playerId: 'uuid-a' }],
    ]),
    ...publicEvents(2, [['game:turn_changed', { currentPlayerId: 'uuid-b' }]], 9),
    ...publicEvents(3, [
      ['game:card_resolved', { playerId: 'uuid-b', cardId: 'dividend', deck: 'chance', effects: [{ type: 'collect', amount: 50 }] }],
      ['game:money_changed', { playerId: 'uuid-b', amount: 50, balance: 1090, reason: 'CARD' }],
    ], 10),
  ];
  const entries = committedActivity(s, rows, activityLabels);
  assert.deepEqual(entries.map(entry => entry.kind), ['roll', 'land', 'card', 'land', 'rent', 'turn', 'card']);
  assert.deepEqual(entries[0].details, ['Doubles earned another roll.']);
  assert.equal(entries[2].spaceId, 12);
  assert.match(entries[2].details?.join(' ') ?? '', /moved to Electric Company.*paid \$40 to Bob/);
  assert.equal(entries[2].turn, 1);
  assert.equal(entries[2].silent, false, 'A live card remains eligible if a newer commit arrived first');
  assert.equal(entries[4].silent, false, 'A committed rent receipt stays live after the next turn');
  assert.equal(entries[6].turn, 2);
  assert.equal(entries[6].silent, false);
  assert.deepEqual(entries[6].transfers?.map(item => [item.from, item.to?.name, item.amount, item.toBalance]), [[null, 'Bob', 50, 1090]]);
  assert.ok(committedActivity(s, rows, activityLabels, true).every(entry => entry.silent));
});

test('an Online card that sends a player to Jail announces the outcome once', () => {
  const match = { ...snapshot(), stateVersion: 1 };
  const rows = publicEvents(1, [
    ['game:card_resolved', { playerId: 'uuid-a', cardId: 'go-to-jail', deck: 'chance', effects: [{ type: 'go_to_jail' }] }],
    ['game:player_moved', { playerId: 'uuid-a', fromPosition: 7, toPosition: 10 }],
    ['game:jail_changed', { playerId: 'uuid-a', inJail: true, jailTurns: 0 }],
  ]);
  const entries = committedActivity(match, rows, activityLabels);
  assert.deepEqual(entries.map(entry => [entry.kind, entry.silent]), [['card', false], ['jail', true]]);
  assert.deepEqual(entries[0].details, ['Alice was sent to Jail.']);
});

test('Online cursors keep history quiet on initial mount and deduplicate repeated reconciliations', async () => {
  const s = { ...snapshot(), stateVersion: 1 };
  const rows = publicEvents(1, [
    ['game:money_changed', { playerId: 'uuid-a', amount: -60, balance: 1440, reason: 'PURCHASE' }],
    ['game:property_purchased', { playerId: 'uuid-a', spaceId: 3, price: 60, balance: 1440 }],
  ]);
  const cursors: string[] = [];
  const manager = new SessionManager('', (async input => {
    const url = new URL(String(input), 'http://localhost');
    if (!url.pathname.includes('/matches/')) return json({ roomId: 'room-a', roomRevision: 0, members: [], matchId: null });
    cursors.push(url.searchParams.get('activityAfter') ?? '');
    return json({ ...s, activityEvents: rows });
  }) as typeof fetch);
  const controller = new OnlineController(manager, '', { matchId: s.matchId }, () => {});
  controller.state.setState({ connection: 'connected' });
  await controller.reconcile();
  assert.equal(controller.state.getState().activity.length, 0, 'The lazy authorized screen supplies catalog labels.');
  controller.setSpaceNames(new Map([[3, 'Baltic Avenue']]), activityLabels.card);
  const [purchase] = controller.state.getState().activity;
  assert.equal(purchase.title, 'Alice purchased Baltic Avenue for $60');
  assert.equal(purchase.silent, true);
  assert.equal(purchase.transfers?.[0].fromBalance, 1440);
  await controller.reconcile();
  assert.deepEqual(cursors, ['0', '2']);
  assert.deepEqual(controller.state.getState().activity, [purchase]);
  controller.stop();
});

test('a connected Online viewer can receive a live card while their tab is hidden', async t => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = Object.assign(new EventTarget(), { hidden: true });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  let match = snapshot();
  let rows: PublicActivityEvent[] = [];
  const manager = new SessionManager('', (async input => String(input).includes('/matches/')
    ? json({ ...match, activityEvents: rows }) : json({ roomId: match.roomId, roomRevision: 0, members: [] })) as typeof fetch);
  const controller = new OnlineController(manager, '', { matchId: match.matchId }, () => {});
  t.after(() => controller.stop());
  controller.state.setState({ connection: 'connected' });
  controller.setSpaceNames(new Map(), activityLabels.card);
  await controller.reconcile();
  match = { ...match, stateVersion: 1 };
  rows = publicEvents(1, [['game:card_resolved', {
    playerId: 'uuid-a', cardId: 'dividend', deck: 'chance', effects: [{ type: 'collect', amount: 50 }],
  }]]);
  await controller.reconcile();
  assert.equal(controller.state.getState().activity[0].card?.instruction, 'Collect $50.');
  assert.equal(controller.state.getState().activity[0].silent, false);
  document.hidden = false;
  await controller.reconcile();
  assert.equal(controller.state.getState().activity.length, 1);
});

test('the payer, owner and observer each receive one rent notice after a newer committed turn', async t => {
  let match = snapshot();
  match.players.push({ ...match.players[0], playerId: 'uuid-c', userId: 'user-c', username: 'Cara', seatOrder: 2 });
  let rows: PublicActivityEvent[] = [];
  const controllers = match.players.map(viewer => {
    const manager = new SessionManager('', (async input => String(input).includes('/matches/')
      ? json({ ...match, allowedActions: match.currentPlayerId === viewer.playerId ? ['roll-dice'] : [], activityEvents: rows })
      : json({ roomId: match.roomId, roomRevision: 0, members: [] })) as typeof fetch);
    const controller = new OnlineController(manager, '', { matchId: match.matchId }, () => {});
    t.after(() => controller.stop());
    controller.state.setState({ connection: 'connected' });
    controller.setSpaceNames(new Map([[3, 'Baltic Avenue']]));
    return controller;
  });
  const reconcile = () => Promise.all(controllers.map(controller => controller.reconcile()));
  await reconcile();
  match = { ...match, stateVersion: 2, turnNumber: 2, currentPlayerId: 'uuid-b' };
  rows = [...publicEvents(1, [
    ['game:money_changed', { playerId: 'uuid-a', amount: -4, balance: 1496, reason: 'RENT' }],
    ['game:money_changed', { playerId: 'uuid-b', amount: 4, balance: 1004, reason: 'RENT' }],
    ['game:rent_paid', { payerPlayerId: 'uuid-a', ownerPlayerId: 'uuid-b', spaceId: 3, amount: 4 }],
  ]), ...publicEvents(2, [['game:turn_changed', { currentPlayerId: 'uuid-b', turnPhase: 'PRE_ROLL' }]], 4)];
  await reconcile();
  await reconcile();
  for (const controller of controllers) {
    const rents = controller.state.getState().activity.filter(event => event.kind === 'rent');
    assert.deepEqual(rents.map(event => [event.id, event.title, event.silent]),
      [['event-3', 'Alice paid $4 rent to Bob for Baltic Avenue.', false]]);
  }
  assert.equal(committedActivity(match, rows, activityLabels, true).find(event => event.kind === 'rent')?.silent, true);
});

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
  presenter.apply(roll, true, [
    { type: 'game:dice_rolled', payload: { playerId: 'uuid-a', dice: [3, 4], total: 7 } },
    { type: 'game:player_moved', payload: { playerId: 'uuid-a', fromPosition: 0, toPosition: 7 } },
  ]);
  assert.equal(presenter.store.getState().turnPhase, 'ROLLING');
  const newer = structuredClone(roll); newer.stateVersion = 3; newer.players[1].position = 16; newer.dice.values = [4, 5];
  presenter.apply(newer, false); await new Promise(resolve => setTimeout(resolve, 750));
  assert.equal(presenter.store.getState().players.find(p => p.id === 1)?.position, 16); assert.deepEqual(presenter.store.getState().dice, [4, 5]); presenter.dispose();
});

const presentationLabels = {
  spaceName: (id: number) => id === 3 ? 'Baltic Avenue' : `Space ${id}`,
  card: () => ({ title: 'Go Back Three Spaces', description: 'Go back three spaces.', steps: -3 }),
};
const committedEvent = (type: string, payload: CommittedEvent['payload']): CommittedEvent => ({ type, payload });

test('a committed Online roll walks each space and then follows the ordered backward card route', () => {
  const before = snapshot(), after = structuredClone(before);
  after.stateVersion++; after.players[1].position = 4;
  after.dice = { values: [3, 4], total: 7, rolledByPlayerId: 'uuid-a' };
  const events = [
    committedEvent('game:dice_rolled', { playerId: 'uuid-a', dice: [3, 4], total: 7 }),
    committedEvent('game:player_moved', { playerId: 'uuid-a', fromPosition: 0, toPosition: 7 }),
    committedEvent('game:card_resolved', { playerId: 'uuid-a', cardId: 'back-three', effects: [{ type: 'move_relative' }] }),
    committedEvent('game:player_moved', { playerId: 'uuid-a', fromPosition: 7, toPosition: 4 }),
  ];
  const motion = committedMove(before, after, events, presentationLabels);
  assert.equal(motion.rolls, true);
  assert.deepEqual(motion.beats.map(beat => 'card' in beat ? beat.card.label : beat.positions),
    [[1, 2, 3, 4, 5, 6, 7], 'Go Back Three Spaces', [6, 5, 4]]);
  const timelineCard = motion.beats.find(beat => 'card' in beat);
  const resultCard = committedFeedback(before, after, events, mapMatch(after).players, presentationLabels).find(effect => effect.kind === 'card');
  assert.ok(timelineCard && 'card' in timelineCard && resultCard?.activityId);
  assert.equal(timelineCard.card.activityId, resultCard.activityId, 'commit and card reveal share one presentation identity');
  assert.deepEqual(committedMove(before, after, events.slice(0, -1), presentationLabels).beats, []);
});

test('committed Online Jail is a relocation and same-valued newer rolls have their own timeline', () => {
  const before = snapshot(), after = structuredClone(before);
  before.dice = { values: [2, 2], total: 4, rolledByPlayerId: 'uuid-a' };
  after.dice = before.dice; after.stateVersion++; after.players[1].position = 10; after.players[1].inJail = true;
  const events = [
    committedEvent('game:dice_rolled', { playerId: 'uuid-a', dice: [2, 2], total: 4 }),
    committedEvent('game:player_moved', { playerId: 'uuid-a', fromPosition: 0, toPosition: 10 }),
    committedEvent('game:jail_changed', { playerId: 'uuid-a', inJail: true, jailTurns: 0 }),
  ];
  assert.deepEqual(committedMove(before, after, events, presentationLabels), { rolls: true, beats: [{ seat: 1, positions: [10], jail: true }] });
});

test('committed Online rent produces one directional receipt with the actual debit and credit balances', () => {
  const before = snapshot(), after = structuredClone(before);
  after.players[0].money = 1070; after.players[1].money = 1430;
  const events = [
    committedEvent('game:money_changed', { playerId: 'uuid-a', amount: -70, balance: 1430, reason: 'RENT' }),
    committedEvent('game:money_changed', { playerId: 'uuid-b', amount: 70, balance: 1070, reason: 'RENT' }),
    committedEvent('game:rent_paid', { payerPlayerId: 'uuid-a', ownerPlayerId: 'uuid-b', spaceId: 3, amount: 70 }),
  ];
  const effects = committedFeedback(before, after, events, mapMatch(after).players, presentationLabels);
  assert.deepEqual(effects.filter(event => event.cash).map(event => event.cash), [{
    fromId: 1, toId: 3, amount: 70, reason: 'Rent on Baltic Avenue', category: 'rent', spaceId: 3,
    fromName: 'Alice', toName: 'Bob', fromBalance: 1430, toBalance: 1070,
  }]);
  assert.equal(committedFeedback(before, after, events.slice(0, 2), mapMatch(after).players, presentationLabels).length, 0);
});

test('restoring or reapplying Online snapshots does not replay a purchase', () => {
  const before = snapshot(), after = structuredClone(before);
  const presenter = new MatchPresenter(() => {});
  after.stateVersion++; after.properties[0].ownerPlayerId = 'uuid-a'; after.players[1].money = 1440;
  const events = [committedEvent('game:property_purchased', { playerId: 'uuid-a', spaceId: 1, price: 60, balance: 1440 })];
  presenter.apply(before, false);
  presenter.apply(after, true, events);
  assert.equal(presenter.store.getState().committedEffects?.filter(event => event.kind === 'ownership').length, 1);
  presenter.reconcile();
  presenter.apply(after, true, events);
  presenter.apply(before, true, events);
  assert.deepEqual(presenter.store.getState().committedEffects, []);
  assert.equal(presenter.store.getState().properties[1].ownerId, 1);
  presenter.dispose();
});

test('Online island effects follow confirmed seats, including offsetting transfers and receipt gaps', t => {
  const presenter = new MatchPresenter(() => {});
  t.after(() => presenter.dispose());
  const changes: ReturnType<typeof collectIslandTransfers> = [];
  t.after(presenter.store.subscribe((next, before) => changes.push(...collectIslandTransfers([before, next]))));
  const initial = snapshot();
  presenter.apply(initial, false);
  assert.deepEqual(changes, []);

  const rent = structuredClone(initial);
  rent.stateVersion++;
  rent.players[0].money = 1070;
  rent.players[1].money = 1430;
  presenter.apply(rent, true, [
    committedEvent('game:money_changed', { playerId: 'uuid-a', amount: -70, balance: 1430, reason: 'RENT' }),
    committedEvent('game:money_changed', { playerId: 'uuid-b', amount: 70, balance: 1070, reason: 'RENT' }),
    committedEvent('game:rent_paid', { payerPlayerId: 'uuid-a', ownerPlayerId: 'uuid-b', spaceId: 3, amount: 70 }),
  ]);
  assert.deepEqual(changes.splice(0), [{ fromId: 1, toId: 3, amount: 70 }]);

  const compound = { ...rent, stateVersion: rent.stateVersion + 1, players: [...rent.players].reverse() };
  presenter.apply(compound, true, [
    committedEvent('game:money_changed', { playerId: 'uuid-a', amount: 200, balance: 1630, reason: 'GO_SALARY' }),
    committedEvent('game:money_changed', { playerId: 'uuid-a', amount: -200, balance: 1430, reason: 'TAX' }),
  ]);
  assert.deepEqual(changes.splice(0), [{ fromId: null, toId: 1, amount: 200 }, { fromId: 1, toId: null, amount: 200 }]);

  const mortgage = structuredClone(compound);
  mortgage.stateVersion++;
  mortgage.players[0].money += 30;
  presenter.apply(mortgage, true, [
    committedEvent('game:money_changed', { playerId: 'uuid-a', amount: 30, balance: 1460, reason: 'MORTGAGE' }),
  ]);
  assert.deepEqual(changes.splice(0), [{ fromId: null, toId: 1, amount: 30 }]);

  presenter.reconcile();
  presenter.apply(mortgage, true);
  presenter.apply({ ...initial, stateVersion: 8 }, false);
  assert.deepEqual(changes, [], 'replays, resyncs and snapshot installs stay quiet');
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
