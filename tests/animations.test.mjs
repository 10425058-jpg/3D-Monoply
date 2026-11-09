import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Euler, Quaternion, Vector3 } from 'three';

// Exercise the real pure TS adapters with the repository's existing compiler.
async function loadTS(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const math = await loadTS('../src/presentation/animationMath.ts');
const { collectEffectChanges: diff, isGameReset, primaryEffect } = await loadTS('../src/presentation/effectEvents.ts');
const snapshot = () => ({
  players: [{ id: 0, name: 'You', money: 1500, position: 0, isAI: false, inJail: false, isBankrupt: false },
    { id: 1, name: 'Rival', money: 1500, position: 0, isAI: true, inJail: false, isBankrupt: false }],
  properties: { 1: { spaceId: 1, ownerId: null, houses: 0, isMortgaged: false } },
  dice: [1, 1], turnPhase: 'PRE_ROLL', currentPlayerIndex: 0, logs: [], activeCard: null, auction: null, railroadRaid: null, winner: null,
});
const copy = value => structuredClone(value);

test('all six authoritative dice faces settle facing up', () => {
  const normals = { 1: [0, 1, 0], 2: [0, 0, 1], 3: [1, 0, 0], 4: [-1, 0, 0], 5: [0, 0, -1], 6: [0, -1, 0] };
  for (const [value, normal] of Object.entries(normals)) {
    const up = new Vector3(...normal).applyQuaternion(new Quaternion().setFromEuler(new Euler(...math.DIE_REST_ROTATIONS[value])));
    assert.ok(up.distanceTo(new Vector3(0, 1, 0)) < 1e-10, `face ${value}`);
  }
});
test('hop starts and ends on the actual tile, with eased endpoints', () => {
  assert.equal(math.hopPose(0).blend, 0); assert.equal(math.hopPose(1).blend, 1);
  assert.ok(Math.abs(math.hopPose(1).height) < 1e-10);
  assert.equal(math.hopPose(.5).height, .42);
  assert.ok(math.hopPose(.001).blend < .00001);
  assert.equal(math.smoothStep(-1), 0); assert.equal(math.smoothStep(2), 1);
});
test('corner wrapping and backwards steps are adjacent; jail jumps are not', () => {
  for (const [a, b] of [[9, 10], [19, 20], [29, 30], [39, 0], [0, 39], [7, 6]]) assert.equal(math.isAdjacentTile(a, b), true);
  assert.equal(math.isAdjacentTile(30, 10), false);
  for (const speed of [1, 2]) assert.ok(math.movementDuration(speed) < .155 / speed);
});
test('identical snapshots and unrelated UI changes emit nothing', () => {
  const a = snapshot(); assert.deepEqual(diff(a, a), []);
  const b = copy(a); b.selectedSpaceId = 1; assert.deepEqual(diff(a, b), []);
});
test('money effects use only the confirmed delta and never alter balances', () => {
  const a = snapshot(), b = copy(a); b.players[0].money = 1430;
  Object.freeze(b.players[0]);
  assert.equal(diff(a, b).find(e => e.kind === 'money').amount, -70);
  assert.equal(b.players[0].money, 1430); assert.deepEqual(diff(b, b), []);
});
test('purchase effect waits for confirmed ownership', () => {
  const a = snapshot(), b = copy(a); b.turnPhase = 'LANDED_ACTION';
  assert.equal(diff(a, b).some(e => e.kind === 'ownership'), false);
  const c = copy(b); c.properties[1].ownerId = 0;
  assert.equal(diff(b, c).find(e => e.kind === 'ownership').label, 'Property purchased');
  assert.deepEqual(diff(c, c), []);
});
test('hotel upgrades and downgrades preserve actual building counts', () => {
  const a = snapshot(); a.properties[1].ownerId = 0; a.properties[1].houses = 4;
  const b = copy(a); b.properties[1].houses = 5;
  assert.equal(diff(a, b).find(e => e.kind === 'build').label, 'Hotel built');
  assert.equal(diff(b, a).find(e => e.kind === 'build').amount, -1);
  assert.equal(diff(b, a).find(e => e.kind === 'build').label, 'Building sold');
});
test('roll/landing events follow phase changes and exact stored dice', () => {
  const a = snapshot(), b = copy(a); b.turnPhase = 'ROLLING'; b.dice = [6, 4];
  assert.equal(diff(a, b).filter(e => e.kind === 'roll').length, 1);
  const c = copy(b); c.turnPhase = 'MOVING';
  assert.equal(diff(b, c).find(e => e.kind === 'dice-land').label, '6 + 4 = 10');
  assert.deepEqual(diff(c, c), []);
});
test('turn announcements do not replay on money or property updates', () => {
  const a = snapshot(), b = copy(a); b.currentPlayerIndex = 1;
  assert.equal(diff(a, b).filter(e => e.kind === 'turn').length, 1);
  const c = copy(b); c.players[1].money -= 20;
  assert.equal(diff(b, c).some(e => e.kind === 'turn'), false);
});
test('restart cancels effects rather than showing refunds or purchases', () => {
  const a = snapshot(); a.players[0].money = 10; a.properties[1].ownerId = 0;
  const b = snapshot(); b.logs = [{ id: 'start-123', message: 'New game' }];
  assert.equal(isGameReset(a, b), true); assert.deepEqual(diff(a, b), []);
});
test('card, jail, mortgage and bankruptcy events are edge-triggered', () => {
  const a = snapshot(), b = copy(a); b.activeCard = { id: 'test', title: 'Dividend' };
  b.players[0].inJail = true; b.players[0].isBankrupt = true; b.properties[1].isMortgaged = true;
  const events = diff(a, b);
  for (const kind of ['card', 'jail', 'mortgage', 'bankrupt']) assert.equal(events.filter(e => e.kind === kind).length, 1);
  assert.deepEqual(diff(b, b), []);
});
test('two restarts sharing a millisecond still cancel the previous effects', () => {
  const a = snapshot(); a.logs = [{ id: 'start-123', message: 'New game' }];
  const b = copy(a); b.players[0].money = 1400;
  assert.equal(isGameReset(a, b), true); assert.deepEqual(diff(a, b), []);
});
test('confirmed trade log IDs and auction wins are not replayed', () => {
  const a = snapshot(), b = copy(a); b.logs = [{ id: 'trade-1', message: 'Trade completed between You and Rival!' }];
  assert.equal(diff(a, b).filter(e => e.kind === 'trade').length, 1);
  assert.deepEqual(diff(b, { ...b, logs: [...b.logs] }), []);
  a.auction = { spaceId: 1 }; b.properties[1].ownerId = 1;
  assert.equal(diff(a, b).find(e => e.kind === 'ownership').label, 'Auction won');
});
test('audio requires a gesture, obeys mute/volume, caps voices and disconnects', async () => {
  let starts = 0, stops = 0, disconnects = 0, closes = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  class FakeAudioContext {
    state = 'running'; currentTime = 0; destination = {};
    createGain() { return { gain: param(), connect() {}, disconnect() { disconnects++; } }; }
    createOscillator() { return { frequency: param(), connect() {}, disconnect() { disconnects++; }, start() { starts++; }, stop() { stops++; } }; }
    close() { closes++; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.document = { hidden: false };
  try {
    const { SoundSystem } = await loadTS('../src/utils/audio.ts');
    const audio = new SoundSystem(); audio.playDiceRoll(); assert.equal(starts, 0);
    audio.unlock(); audio.playDiceRoll(); audio.playUpgrade(); audio.playPurchase(); audio.playCash();
    assert.equal(starts, 12);
    audio.setVolume(2); assert.equal(audio.getVolume(), 1);
    audio.setVolume(-1); assert.equal(audio.getVolume(), 0);
    audio.setEnabled(false); const before = starts; audio.playAlert(); assert.equal(starts, before);
    assert.ok(stops >= 12); assert.ok(disconnects >= 24);
    audio.dispose(); assert.equal(closes, 1);
  } finally { delete globalThis.window; delete globalThis.document; }
});
test('victory takes sound priority over simultaneous bankruptcy and transfers', () => {
  assert.equal(primaryEffect([{ kind: 'money' }, { kind: 'bankrupt' }, { kind: 'ownership' }, { kind: 'victory' }]).kind, 'victory');
  assert.equal(primaryEffect([{ kind: 'money' }, { kind: 'ownership' }]).kind, 'ownership');
  assert.equal(primaryEffect([]), undefined);
});
