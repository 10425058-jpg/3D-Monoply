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
const { collectEffectChanges: diff, isGameReset, primaryEffect, tilePulseEvents } = await loadTS('../src/presentation/effectEvents.ts');
const snapshot = () => ({
  players: [{ id: 0, name: 'You', money: 1500, position: 0, isAI: false, inJail: false, isBankrupt: false },
    { id: 1, name: 'Rival', money: 1500, position: 0, isAI: true, inJail: false, isBankrupt: false }],
  properties: { 1: { spaceId: 1, ownerId: null, houses: 0, isMortgaged: false } },
  dice: [1, 1], turnPhase: 'PRE_ROLL', currentPlayerIndex: 0, logs: [], activeCard: null, auction: null, railroadRaid: null, winner: null,
});
const copy = value => structuredClone(value);

test('Arcade construction requires a live committed purchase or level change', () => {
  const empty = { ...snapshot(), ruleset: 'arcade', activity: [] };
  const restored = copy(empty);
  Object.assign(restored.properties[1], { ownerId: 0, developmentLevel: 0 });
  assert.equal(diff(empty, restored).some(entry => entry.kind === 'construction'), false);
  const purchase = { id: 'solo-1:2', kind: 'purchase', title: 'Bought land', spaceId: 1, actor: { id: '0' } };
  const bought = { ...restored, activity: [purchase] };
  assert.equal(diff(restored, bought).find(entry => entry.kind === 'construction')?.developmentLevel, 0);
  assert.equal(diff(bought, { ...bought, activity: [purchase] }).some(entry => entry.kind === 'construction'), false);
  const house = copy(bought);
  house.properties[1].developmentLevel = 1;
  const upgrade = { ...purchase, id: 'solo-1:3', kind: 'upgrade', level: 1 };
  house.activity.push({ ...upgrade, silent: true });
  assert.equal(diff(bought, house).some(entry => entry.kind === 'construction'), false);
  house.activity[1] = upgrade;
  assert.equal(diff(bought, house).find(entry => entry.kind === 'construction')?.developmentLevel, 1);
});

test('four to six co-located tokens have distinct stable offsets above the tile surface',()=>{
  for(const count of [4,5,6]){
    const offsets=Array.from({length:count},(_,i)=>math.tokenOffset(i,count));
    assert.equal(new Set(offsets.map(p=>`${p.x},${p.z}`)).size,count);
    assert.ok(offsets.every(p=>Math.abs(p.x)<.6&&Math.abs(p.z)<.6&&p.scale>0&&p.scale<=1));
  }
  assert.ok(math.tileActorHeight(3,null,null)>.32);
  assert.ok(math.tileActorHeight(3,3,null)>.44);
});
test('transaction notices use the exact committed record once and add no duplicate audio',()=>{
  const a=snapshot(),b=copy(a);b.logs=[{id:'rent-1',type:'money',message:'You paid $4 rent to Rival for Baltic Avenue.'}];
  assert.deepEqual(diff(a,b),[{kind:'transaction',label:b.logs[0].message}]);assert.deepEqual(diff(b,b),[]);assert.equal(primaryEffect(diff(a,b)),undefined);
});

test('all six authoritative dice faces settle facing up', () => {
  const normals = { 1: [0, 1, 0], 2: [0, 0, 1], 3: [1, 0, 0], 4: [-1, 0, 0], 5: [0, 0, -1], 6: [0, -1, 0] };
  for (const [value, normal] of Object.entries(normals)) {
    const up = new Vector3(...normal).applyQuaternion(new Quaternion().setFromEuler(new Euler(...math.DIE_REST_ROTATIONS[value])));
    assert.ok(up.distanceTo(new Vector3(0, 1, 0)) < 1e-10, `face ${value}`);
  }
});

test('each throw winds up, bounces, and settles on the authoritative orientation for every ordered pair', () => {
  const normals = [null, [0, 1, 0], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, -1, 0]];
  for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
    [first, second].forEach((die, index) => {
      const moving = math.diceThrow(.39, index);
      const rest = math.diceThrow(1, index);
      assert.ok(moving.height > .4);
      assert.ok(Math.hypot(rest.x, rest.z, rest.height) < 1e-10);
      const rotation = math.DIE_REST_ROTATIONS[die];
      const q = new Quaternion().setFromEuler(new Euler(rotation[0] + rest.pitch, rotation[1] + rest.yaw, rotation[2] + rest.bank));
      assert.ok(new Vector3(...normals[die]).applyQuaternion(q).distanceTo(new Vector3(0, 1, 0)) < 1e-10);
    });
  }
  assert.notEqual(math.diceThrow(.39, 0).yaw, math.diceThrow(.39, 1).yaw);
});

test('dice remain full size throughout tumbling and consecutive rolls, then fade only after landing', () => {
  for (const reduced of [false, true]) {
    assert.equal(math.diceResultScale(true, Infinity, reduced), 1, 'a fresh roll has no landing age');
    assert.equal(math.diceResultScale(true, 10, reduced), 1, 'a consecutive roll clears the previous fade');
    assert.equal(math.diceResultScale(false, 0, reduced), 1);
    assert.equal(math.diceResultScale(false, 1.9, reduced), 1);
    assert.equal(math.diceResultScale(false, Infinity, reduced), 0, 'reset hides old results');
    assert.equal(math.diceResultScale(false, 2.2, reduced), 0);
  }
  assert.ok(Math.abs(math.diceResultScale(false, 2.05, false) - .5) < 1e-10);
  assert.equal(math.diceResultScale(false, 2.05, true), 1, 'reduced motion preserves a stable result');
});

test('four to six shared-space player rings remain separate at the largest corner scale', () => {
  for (const count of [4, 5, 6]) {
    const offsets = Array.from({length: count}, (_, i) => math.tokenOffset(i, count));
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      const gap = Math.hypot(offsets[i].x - offsets[j].x, offsets[i].z - offsets[j].z);
      const diameter = math.TOKEN_RING_OUTER_RADIUS * math.tokenRingScale(count) * 1.2 * (offsets[i].scale + offsets[j].scale);
      assert.ok(gap > diameter, `${count} players: ${i}/${j} rings intersect`);
    }
  }
});

test('tile pulses reuse exact committed GO receipts and coalesce property changes without new rewards', () => {
  const events = [
    {id: 1, kind: 'money', spaceId: 0, amount: 350, playerId: 0},
    {id: 2, kind: 'money', spaceId: 3, amount: 20, playerId: 1},
    {id: 3, kind: 'money', spaceId: 0, amount: -60, playerId: 2},
    {id: 4, kind: 'ownership', spaceId: 1, playerId: 0},
    {id: 5, kind: 'build', spaceId: 1, playerId: 0},
  ];
  assert.deepEqual(tilePulseEvents(events), [events[0], events[4]]);
  assert.equal(tilePulseEvents(events)[0].amount, 350);
  assert.equal(events.length, 5);
  assert.deepEqual(tilePulseEvents([]), []);
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

test('four royal tokens grow 30 percent without exceeding the fitted tile clearance', () => {
  assert.equal(math.PLAYER_TOKEN_SCALE, 1.3);
  const cornerScale = math.tokenRenderScale(4, true, true);
  assert.ok(Math.abs(cornerScale / 1.2 - 1.3) < 1e-10);
  const offsets = Array.from({length:4}, (_,i) => math.tokenOffset(i,4,true));
  // RoyalToken fits its silhouette within radius .35 in local coordinates.
  const radius = .35 * cornerScale;
  for (const p of offsets) {
    assert.ok(Math.abs(p.x) + radius < 2.9 / 2);
    assert.ok(Math.abs(p.z) + radius < 2.9 / 2);
  }
  for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) {
    assert.ok(Math.hypot(offsets[i].x-offsets[j].x,offsets[i].z-offsets[j].z) > radius*2);
  }
  const streetScale = math.tokenRenderScale(4,false,false);
  assert.ok(Math.abs(streetScale / 1.06 - 1.3) < 1e-10);
  for (let i=0;i<4;i++) {
    const p = math.tokenOffset(i,4,false);
    assert.ok(Math.max(Math.abs(p.x),Math.abs(p.z)) + .35*streetScale < 1.8/2);
  }
  assert.equal(math.tokenRenderScale(4,false,true),1.06);
  assert.equal(math.tokenRenderScale(6,true,true),1.2*.78);
  assert.equal(math.tokenRenderScale(6,false,false),1.06*.78);
});
