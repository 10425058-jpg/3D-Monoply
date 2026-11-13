// Smoke test: plays the start of a real match against a RUNNING backend, using only REST.
//
//   1. Start the server in another terminal:   npm run start:dev
//   2. Run this:                               npm run smoke
//
// It registers two throwaway users, creates a room, joins, readies up, starts a match and
// plays 12 actions. Every step prints what it did. If a step fails, the script stops and
// prints the server's error, which tells you which part of the backend to look at.
//
// Needs Node 20+ (built-in fetch). No extra packages.

import { randomUUID } from 'node:crypto';

const BASE = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const CONTENT_VERSION = 'central-castle@1';

async function call(method, path, { token, body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(`Cannot reach ${BASE}. Is the server running (npm run start:dev)? ${error.message}`);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} -> ${res.status}, not JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const e = new Error(`${method} ${path} -> ${res.status} ${json.error?.code}: ${json.error?.message}`);
    e.code = json.error?.code;
    throw e;
  }
  if (!('data' in json) || !('meta' in json)) {
    throw new Error(`${method} ${path} -> response is missing the { data, meta } envelope`);
  }
  return json.data;
}

const step = (text) => console.log(`✓ ${text}`);

async function register(label) {
  const suffix = randomUUID().slice(0, 8);
  const data = await call('POST', '/auth/register', {
    body: { username: `${label}_${suffix}`, email: `${label}_${suffix}@example.com`, password: 'smoke-test-password' },
  });
  if (!data.accessToken || !data.user?.id) throw new Error('register did not return user + accessToken');
  return { token: data.accessToken, userId: data.user.id, name: data.user.username };
}

async function act(player, matchId, action, stateVersion, extra = {}) {
  return call('POST', `/matches/${matchId}/actions/${action}`, {
    token: player.token,
    body: { clientActionId: randomUUID(), expectedStateVersion: stateVersion, contentVersion: CONTENT_VERSION, ...extra },
  });
}

async function main() {
  console.log(`Testing ${BASE}\n`);

  const health = await call('GET', '/health');
  if (health.status !== 'ok') throw new Error('health is not ok');
  step('health check: server and database are up');

  const alice = await register('alice');
  const bob = await register('bob');
  step(`registered ${alice.name} and ${bob.name}`);

  const me = await call('GET', '/users/me', { token: alice.token });
  if (me.id !== alice.userId) throw new Error('/users/me returned the wrong user');
  step('access token works (GET /users/me)');

  const created = await call('POST', '/rooms', {
    token: alice.token,
    body: { mapId: 'central-castle', maxPlayers: 2, isPrivate: false },
  });
  const roomId = created.room.roomId;
  step(`alice created room ${roomId}`);

  const joined = await call('POST', `/rooms/${roomId}/join`, { token: bob.token, body: {} });
  if (joined.members.length !== 2) throw new Error('room should have 2 members after join');
  step('bob joined (seat 1)');

  await call('PATCH', `/rooms/${roomId}/ready`, { token: bob.token, body: { isReady: true } });
  step('bob is ready');

  const started = await call('POST', `/rooms/${roomId}/start`, {
    token: alice.token,
    body: { rulesetId: 'mini-v1', contentVersion: CONTENT_VERSION },
  });
  const matchId = started.matchId;
  step(`match started: ${matchId}`);

  // Leaving a started room must be refused (players forfeit instead).
  try {
    await call('POST', `/rooms/${roomId}/leave`, { token: bob.token });
    throw new Error('leave during a match should have been rejected');
  } catch (error) {
    if (error.code !== 'ROOM_ALREADY_STARTED') throw error;
    step('leaving a started room is rejected with ROOM_ALREADY_STARTED');
  }

  const players = [alice, bob];
  for (let i = 0; i < 12; i++) {
    // Each player has a personal snapshot; whoever has a turn action available moves.
    let moved = false;
    for (const player of players) {
      const snap = await call('GET', `/matches/${matchId}`, { token: player.token });
      if (snap.status !== 'IN_PROGRESS') {
        step(`match is ${snap.status}; stopping`);
        return;
      }
      const allowed = snap.allowedActions;
      let action = ['roll-dice', 'buy-property', 'end-turn'].find((a) => allowed.includes(a));
      if (!action) continue;
      let result;
      if (action === 'buy-property') {
        const extra = { spaceId: snap.pendingPurchaseSpaceId };
        try {
          result = await act(player, matchId, 'buy-property', snap.stateVersion, extra);
        } catch {
          action = 'decline-property'; // cannot afford it
          result = await act(player, matchId, action, snap.stateVersion, extra);
        }
      } else {
        result = await act(player, matchId, action, snap.stateVersion);
      }
      const events = (result.events ?? []).map((e) => e.type).join(', ');
      step(`${player.name.split('_')[0]}: ${action} -> v${result.stateVersion} [${events}]`);
      moved = true;
      break;
    }
    if (!moved) throw new Error('nobody has a turn action available: check allowedActions in the snapshot');
  }

  // A stale version must be refused.
  const snap = await call('GET', `/matches/${matchId}`, { token: alice.token });
  try {
    await act(alice, matchId, 'forfeit', snap.stateVersion - 1);
    throw new Error('a stale expectedStateVersion should have been rejected');
  } catch (error) {
    if (error.code !== 'STATE_VERSION_CONFLICT') throw error;
    step('stale expectedStateVersion is rejected with STATE_VERSION_CONFLICT');
  }

  console.log('\nAll smoke checks passed.');
}

main().catch((error) => {
  console.error(`\n✗ FAILED: ${error.message}`);
  process.exit(1);
});
