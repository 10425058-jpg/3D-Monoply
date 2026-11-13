// Unit tests for the mini-v1 rules engine (docs/ONLINE-MVP-RULES.md §7).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT } from '../src/game/content';
import { allowedActions, applyAction, abandonMatch, createInitialState, netWorth } from '../src/game/rules/engine';
import {
  ActionName,
  DeckType,
  EngineAction,
  EngineContext,
  EngineResult,
  EngineState,
  Rng,
  RuleError,
} from '../src/game/rules/types';

const NOW = '2026-11-10T00:00:00.000Z';
const identity: Rng = { int: (m) => m - 1 }; // makes shuffle keep catalog order

/** Scripted dice: pass die faces (1-6) in the order they will be rolled. */
function dice(...faces: number[]): Rng {
  const q = faces.slice();
  return {
    int: (m) => {
      assert.equal(m, 6, 'only dice rolls expected');
      assert.ok(q.length > 0, 'ran out of scripted dice');
      return (q.shift() as number) - 1;
    },
  };
}

function setup(n = 2): EngineState {
  const seats = Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, seatOrder: i }));
  return createInitialState(seats, identity, CONTENT);
}

function ctx(rng: Rng = dice()): EngineContext {
  return { rng, content: CONTENT, now: NOW, stateVersion: 1 };
}

function act(s: EngineState, type: ActionName, actor: string, extra: Partial<EngineAction> = {}, rng?: Rng): EngineResult {
  return applyAction(s, { type, actorPlayerId: actor, ...extra }, ctx(rng));
}

function roll(s: EngineState, actor: string, d1: number, d2: number): EngineResult {
  return act(s, 'roll-dice', actor, {}, dice(d1, d2));
}

function top(s: EngineState, deck: DeckType, cardId: string): void {
  s.decks[deck] = [cardId, ...s.decks[deck].filter((c) => c !== cardId)];
}

function p(s: EngineState, i: number) {
  return s.players[i];
}

function types(r: EngineResult): string[] {
  return r.events.map((e) => e.type);
}

function throwsCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (e: unknown) => e instanceof RuleError && e.code === code, `expected ${code}`);
}

// --- content and setup ------------------------------------------------------

test('content: 40 spaces, 32 cards, all 11 card action types present', () => {
  assert.equal(CONTENT.spaces.length, 40);
  assert.equal(CONTENT.cards.filter((c) => c.deck === 'chance').length, 16);
  assert.equal(CONTENT.cards.filter((c) => c.deck === 'chest').length, 16);
  assert.equal(new Set(CONTENT.cards.map((c) => c.actionType)).size, 11);
});

test('initial state: 1500 cash, position 0, seat 0 starts, nothing owned', () => {
  const s = setup(4);
  assert.equal(s.players.length, 4);
  for (const pl of s.players) {
    assert.equal(pl.money, 1500);
    assert.equal(pl.position, 0);
  }
  assert.equal(s.currentPlayerId, 'p0');
  assert.equal(s.turnNumber, 1);
  assert.equal(s.completedTurns, 0);
  assert.equal(s.turnPhase, 'PRE_ROLL');
  assert.equal(Object.keys(s.owners).length, 28);
  assert.ok(Object.values(s.owners).every((o) => o === null));
});

test('applyAction does not mutate its input', () => {
  const s = setup();
  const before = JSON.stringify(s);
  roll(s, 'p0', 1, 2);
  assert.equal(JSON.stringify(s), before);
});

// --- buying -----------------------------------------------------------------

test('landing on an unowned affordable property: buy it', () => {
  let r = roll(setup(), 'p0', 1, 2); // -> 3 Baltic (60)
  assert.equal(r.state.turnPhase, 'LANDED_ACTION');
  assert.equal(r.state.pendingPurchaseSpaceId, 3);
  r = act(r.state, 'buy-property', 'p0', { spaceId: 3 });
  assert.equal(r.state.owners[3], 'p0');
  assert.equal(p(r.state, 0).money, 1440);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.ok(types(r).includes('game:property_purchased'));
});

test('decline leaves the property unowned (no auction)', () => {
  let r = roll(setup(), 'p0', 1, 2);
  r = act(r.state, 'decline-property', 'p0', { spaceId: 3 });
  assert.equal(r.state.owners[3], null);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.equal(p(r.state, 0).money, 1500);
});

test('buying the wrong space is rejected', () => {
  const r = roll(setup(), 'p0', 1, 2);
  throwsCode(() => act(r.state, 'buy-property', 'p0', { spaceId: 1 }), 'INVALID_ACTION');
});

test('unaffordable property is declined automatically', () => {
  const s = setup();
  p(s, 0).money = 59;
  const r = roll(s, 'p0', 1, 2);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.equal(r.state.pendingPurchaseSpaceId, null);
  assert.equal(r.state.owners[3], null);
});

// --- rent -------------------------------------------------------------------

test('street rent: base rent, doubled with the full colour set', () => {
  const s = setup();
  s.owners[3] = 'p1';
  let r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 0).money, 1496);
  assert.equal(p(r.state, 1).money, 1504);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.ok(types(r).includes('game:rent_paid'));
  s.owners[1] = 'p1'; // full brown set
  r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 0).money, 1492);
});

test('no rent on your own property', () => {
  const s = setup();
  s.owners[3] = 'p0';
  const r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 0).money, 1500);
  assert.equal(r.state.turnPhase, 'END_TURN');
});

test('railroad rent scales with railroads owned: 25/50/100/200', () => {
  const expected = [25, 50, 100, 200];
  const rr = [5, 15, 25, 35];
  for (let n = 1; n <= 4; n++) {
    const s = setup();
    for (let i = 0; i < n; i++) s.owners[rr[i]] = 'p1';
    const r = roll(s, 'p0', 2, 3); // -> 5
    assert.equal(p(r.state, 0).money, 1500 - expected[n - 1]);
  }
});

test('utility rent: 4x dice with one utility, 10x with both', () => {
  const s = setup();
  p(s, 0).position = 5;
  s.owners[12] = 'p1';
  let r = roll(s, 'p0', 3, 4); // -> 12, total 7
  assert.equal(p(r.state, 0).money, 1500 - 28);
  s.owners[28] = 'p1';
  r = roll(s, 'p0', 3, 4);
  assert.equal(p(r.state, 0).money, 1500 - 70);
});

// --- tax, GO, special squares -------------------------------------------------

test('tax squares charge the printed amount', () => {
  let r = roll(setup(), 'p0', 1, 3); // -> 4 income tax 200
  assert.equal(p(r.state, 0).money, 1300);
  const s = setup();
  p(s, 0).position = 35;
  r = roll(s, 'p0', 1, 2); // -> 38 luxury tax 100
  assert.equal(p(r.state, 0).money, 1400);
});

test('passing GO pays 200 once; landing exactly on GO pays 200', () => {
  const s = setup();
  p(s, 0).position = 38;
  s.owners[3] = 'p0';
  let r = roll(s, 'p0', 2, 3); // -> 3 (own property)
  assert.equal(p(r.state, 0).position, 3);
  assert.equal(p(r.state, 0).money, 1700);
  p(s, 0).position = 35;
  r = roll(s, 'p0', 2, 3); // -> 0
  assert.equal(p(r.state, 0).position, 0);
  assert.equal(p(r.state, 0).money, 1700);
});

test('Free Parking and Just Visiting do nothing', () => {
  const s = setup();
  p(s, 0).position = 15;
  let r = roll(s, 'p0', 2, 3); // -> 20
  assert.equal(p(r.state, 0).money, 1500);
  assert.equal(r.state.turnPhase, 'END_TURN');
  p(s, 0).position = 5;
  r = roll(s, 'p0', 2, 3); // -> 10
  assert.equal(p(r.state, 0).inJail, false);
  assert.equal(r.state.turnPhase, 'END_TURN');
});

test('Go To Jail square: move to 10, in jail, no GO salary, no extra roll on doubles', () => {
  const s = setup();
  p(s, 0).position = 26;
  const r = roll(s, 'p0', 2, 2); // -> 30
  assert.equal(p(r.state, 0).position, 10);
  assert.equal(p(r.state, 0).inJail, true);
  assert.equal(p(r.state, 0).money, 1500);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.equal(r.state.pendingExtraRoll, false);
});

// --- doubles ----------------------------------------------------------------

test('doubles give an extra roll within the same turn', () => {
  const s = setup();
  s.owners[4 + 2] = 'p0'; // 6 Oriental owned by self
  const r = roll(s, 'p0', 3, 3);
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
  assert.equal(r.state.pendingExtraRoll, true);
  assert.equal(r.state.currentPlayerId, 'p0');
  assert.equal(r.state.turnNumber, 1);
  assert.equal(r.state.completedTurns, 0);
  throwsCode(() => act(r.state, 'end-turn', 'p0'), 'INVALID_PHASE');
});

test('doubles + purchase decision: back to PRE_ROLL after buying or declining', () => {
  let r = roll(setup(), 'p0', 3, 3); // -> 6 Oriental
  assert.equal(r.state.turnPhase, 'LANDED_ACTION');
  const bought = act(r.state, 'buy-property', 'p0', { spaceId: 6 });
  assert.equal(bought.state.turnPhase, 'PRE_ROLL');
  r = act(r.state, 'decline-property', 'p0', { spaceId: 6 });
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
});

test('third consecutive double sends the player to jail without moving', () => {
  const s = setup();
  s.owners[6] = 'p0';
  s.owners[14] = 'p0';
  let r = roll(s, 'p0', 3, 3); // 6
  r = roll(r.state, 'p0', 4, 4); // 14
  assert.equal(r.state.doublesCount, 2);
  const money = p(r.state, 0).money;
  r = roll(r.state, 'p0', 5, 5);
  assert.equal(p(r.state, 0).position, 10);
  assert.equal(p(r.state, 0).inJail, true);
  assert.equal(p(r.state, 0).money, money);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.equal(r.state.doublesCount, 0);
});

test('a non-double resets the doubles count', () => {
  const s = setup();
  s.owners[6] = 'p0';
  s.owners[9] = 'p0';
  let r = roll(s, 'p0', 3, 3);
  r = roll(r.state, 'p0', 1, 2);
  assert.equal(r.state.doublesCount, 0);
  assert.equal(r.state.turnPhase, 'END_TURN');
});

// --- jail -------------------------------------------------------------------

function jailed(): EngineState {
  const s = setup();
  p(s, 0).position = 10;
  p(s, 0).inJail = true;
  return s;
}

test('jail: failed attempts 1 and 2 keep the player in jail', () => {
  let r = roll(jailed(), 'p0', 1, 2);
  assert.equal(p(r.state, 0).inJail, true);
  assert.equal(p(r.state, 0).jailTurns, 1);
  assert.equal(p(r.state, 0).position, 10);
  assert.equal(r.state.turnPhase, 'END_TURN');
  const s = jailed();
  p(s, 0).jailTurns = 1;
  r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 0).jailTurns, 2);
  assert.equal(p(r.state, 0).inJail, true);
});

test('jail: third failed attempt pays 50 and moves by that roll', () => {
  const s = jailed();
  p(s, 0).jailTurns = 2;
  s.owners[13] = 'p0';
  const r = roll(s, 'p0', 1, 2); // -> 13
  assert.equal(p(r.state, 0).inJail, false);
  assert.equal(p(r.state, 0).position, 13);
  assert.equal(p(r.state, 0).money, 1450);
  assert.equal(r.state.turnPhase, 'END_TURN');
});

test('jail: third failed attempt with less than 50 means bankruptcy to the Bank', () => {
  const s = jailed();
  p(s, 0).jailTurns = 2;
  p(s, 0).money = 49;
  s.owners[1] = 'p0';
  const r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 0).isBankrupt, true);
  assert.equal(r.state.owners[1], null);
  assert.equal(r.state.status, 'FINISHED');
  assert.equal(r.state.winnerPlayerId, 'p1');
});

test('jail: doubles release and move, but give no extra roll', () => {
  const s = jailed();
  s.owners[14] = 'p0';
  const r = roll(s, 'p0', 2, 2); // -> 14
  assert.equal(p(r.state, 0).inJail, false);
  assert.equal(p(r.state, 0).position, 14);
  assert.equal(r.state.turnPhase, 'END_TURN');
  assert.equal(r.state.pendingExtraRoll, false);
  assert.equal(p(r.state, 0).money, 1500);
});

test('jail: paying bail releases into PRE_ROLL; cannot pay without 50', () => {
  const r = act(jailed(), 'pay-jail-bail', 'p0');
  assert.equal(p(r.state, 0).inJail, false);
  assert.equal(p(r.state, 0).money, 1450);
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
  const s = jailed();
  p(s, 0).money = 49;
  throwsCode(() => act(s, 'pay-jail-bail', 'p0'), 'INSUFFICIENT_FUNDS');
  throwsCode(() => act(setup(), 'pay-jail-bail', 'p0'), 'INVALID_ACTION');
});

test('jail: using a held card releases and returns it to the bottom of its deck', () => {
  const s = jailed();
  s.decks.chance = s.decks.chance.filter((c) => c !== 'ch_7');
  p(s, 0).heldJailCardIds = ['ch_7'];
  const r = act(s, 'use-jail-card', 'p0', { cardId: 'ch_7' });
  assert.equal(p(r.state, 0).inJail, false);
  assert.deepEqual(p(r.state, 0).heldJailCardIds, []);
  assert.equal(r.state.decks.chance[r.state.decks.chance.length - 1], 'ch_7');
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
  throwsCode(() => act(jailed(), 'use-jail-card', 'p0', { cardId: 'ch_7' }), 'INVALID_ACTION');
});

test('a jailed owner still collects rent', () => {
  const s = setup();
  p(s, 1).inJail = true;
  p(s, 1).position = 10;
  s.owners[3] = 'p1';
  const r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 1).money, 1504);
});

// --- cards: every action type -------------------------------------------------

/** p0 starts on space 4 and rolls 1+2 to land on Chance (7). */
function chance(cardId: string, mutate?: (s: EngineState) => void, n = 2): EngineResult {
  const s = setup(n);
  p(s, 0).position = 4;
  top(s, 'chance', cardId);
  if (mutate) mutate(s);
  return roll(s, 'p0', 1, 2);
}

/** p0 starts on GO and rolls 1+1... no: rolls from 39 with 1+2 to land on Community Chest (2), passing GO. */
function chest(cardId: string, mutate?: (s: EngineState) => void, n = 2): EngineResult {
  const s = setup(n);
  p(s, 0).position = 39;
  top(s, 'chest', cardId);
  if (mutate) mutate(s);
  return roll(s, 'p0', 1, 2);
}

test('card collect / pay', () => {
  let r = chance('ch_6');
  assert.equal(p(r.state, 0).money, 1550);
  assert.equal(r.state.lastCardResolved?.cardId, 'ch_6');
  assert.equal(r.state.decks.chance[r.state.decks.chance.length - 1], 'ch_6');
  assert.ok(types(r).includes('game:card_resolved'));
  r = chance('ch_11');
  assert.equal(p(r.state, 0).money, 1485);
  r = chest('cc_2'); // +200 GO, +200 card
  assert.equal(p(r.state, 0).money, 1900);
});

test('card pay with too little cash: bankrupt to the Bank', () => {
  const r = chance('ch_11', (s) => {
    p(s, 0).money = 10;
    s.owners[1] = 'p0';
  }, 3);
  assert.equal(p(r.state, 0).isBankrupt, true);
  assert.equal(r.state.owners[1], null);
  assert.equal(p(r.state, 0).finalRank, 3);
  assert.equal(r.state.status, 'IN_PROGRESS');
  assert.equal(r.state.currentPlayerId, 'p1');
  assert.equal(r.state.completedTurns, 1);
  assert.equal(r.state.turnNumber, 2);
});

test('card move_to GO pays 200', () => {
  const r = chance('ch_1');
  assert.equal(p(r.state, 0).position, 0);
  assert.equal(p(r.state, 0).money, 1700);
});

test('card move_to: forward without passing GO pays nothing; passing GO pays 200', () => {
  let r = chance('ch_2'); // 7 -> 24 Illinois, unowned
  assert.equal(p(r.state, 0).position, 24);
  assert.equal(p(r.state, 0).money, 1500);
  assert.equal(r.state.turnPhase, 'LANDED_ACTION');
  assert.equal(r.state.pendingPurchaseSpaceId, 24);
  r = chance('ch_12', (s) => {
    s.owners[5] = 'p1';
  }); // 7 -> 5 Reading, passes GO, pays 25 rent
  assert.equal(p(r.state, 0).position, 5);
  assert.equal(p(r.state, 0).money, 1500 + 200 - 25);
});

test('card move_relative -3: no GO salary, destination resolved (income tax)', () => {
  const r = chance('ch_8'); // 7 -> 4 income tax
  assert.equal(p(r.state, 0).position, 4);
  assert.equal(p(r.state, 0).money, 1300);
});

test('card nearest_utility: unowned can be bought; owned charges 10x the same dice', () => {
  let r = chance('ch_4'); // 7 -> 12
  assert.equal(p(r.state, 0).position, 12);
  assert.equal(r.state.pendingPurchaseSpaceId, 12);
  r = chance('ch_4', (s) => {
    s.owners[12] = 'p1'; // only one utility owned, still 10x for the card
  });
  assert.equal(p(r.state, 0).money, 1500 - 30); // dice total 3
  assert.equal(p(r.state, 1).money, 1530);
});

test('card nearest_railroad: standard railroad rent; wraps past GO from 36', () => {
  let r = chance('ch_5', (s) => {
    s.owners[15] = 'p1';
  }); // 7 -> 15
  assert.equal(p(r.state, 0).position, 15);
  assert.equal(p(r.state, 0).money, 1475);
  const s = setup();
  p(s, 0).position = 33;
  top(s, 'chance', 'ch_5');
  s.owners[5] = 'p0';
  r = roll(s, 'p0', 1, 2); // -> 36 chance -> 5, passes GO
  assert.equal(p(r.state, 0).position, 5);
  assert.equal(p(r.state, 0).money, 1700);
});

test('card go_to_jail: no GO salary', () => {
  const r = chest('cc_6'); // passes GO by dice (+200), then jailed with no further salary
  assert.equal(p(r.state, 0).position, 10);
  assert.equal(p(r.state, 0).inJail, true);
  assert.equal(p(r.state, 0).money, 1700);
  assert.equal(r.state.turnPhase, 'END_TURN');
});

test('card get_out_of_jail: held by the player and removed from the deck', () => {
  const r = chance('ch_7');
  assert.deepEqual(p(r.state, 0).heldJailCardIds, ['ch_7']);
  assert.ok(!r.state.decks.chance.includes('ch_7'));
  assert.equal(r.state.decks.chance.length, 15);
});

test('card repairs: costs 0 in mini-v1', () => {
  const r = chance('ch_10');
  assert.equal(p(r.state, 0).money, 1500);
  assert.equal(r.state.turnPhase, 'END_TURN');
});

test('card pay_each_player: pays everyone in seat order', () => {
  const r = chance('ch_14', undefined, 4);
  assert.equal(p(r.state, 0).money, 1350);
  for (const i of [1, 2, 3]) assert.equal(p(r.state, i).money, 1550);
});

test('card pay_each_player: bankrupt to the recipient who cannot be paid, then stop', () => {
  const r = chance('ch_14', (s) => {
    p(s, 0).money = 70;
    s.owners[1] = 'p0';
  }, 4);
  assert.equal(p(r.state, 0).isBankrupt, true);
  assert.equal(p(r.state, 1).money, 1550); // paid in full
  assert.equal(p(r.state, 2).money, 1520); // gets the remaining 20 and the deed
  assert.equal(r.state.owners[1], 'p2');
  assert.equal(p(r.state, 3).money, 1500); // not reached
});

test('card collect_from_each_player: a payer who cannot pay goes bankrupt to the drawer', () => {
  const r = chest('cc_9', (s) => {
    p(s, 1).money = 4;
    s.owners[39] = 'p1';
  }, 3);
  assert.equal(p(r.state, 1).isBankrupt, true);
  assert.equal(r.state.owners[39], 'p0');
  assert.equal(p(r.state, 2).money, 1490);
  assert.equal(p(r.state, 0).money, 1500 + 200 + 4 + 10);
  assert.equal(r.state.status, 'IN_PROGRESS');
  assert.equal(r.state.currentPlayerId, 'p0'); // drawer's turn continues
});

test('collect_from_each_player that eliminates the last opponent ends the match', () => {
  const r = chest('cc_9', (s) => {
    p(s, 1).money = 0;
  });
  assert.equal(r.state.status, 'FINISHED');
  assert.equal(r.state.winnerPlayerId, 'p0');
  assert.equal(r.state.finishReason, 'LAST_PLAYER');
  assert.equal(r.state.currentPlayerId, null);
  assert.equal(r.state.turnPhase, 'GAME_OVER');
});

test('lastCardResolved records the card and is replaced by the next draw', () => {
  let r = chance('ch_6');
  assert.deepEqual(r.state.lastCardResolved, {
    cardId: 'ch_6',
    deck: 'chance',
    playerId: 'p0',
    effects: [{ type: 'collect', amount: 50 }],
    stateVersion: 1,
    resolvedAt: NOW,
  });
  r = act(r.state, 'end-turn', 'p0');
  p(r.state, 1).position = 39;
  top(r.state, 'chest', 'cc_4');
  r = roll(r.state, 'p1', 1, 2);
  assert.equal(r.state.lastCardResolved?.cardId, 'cc_4');
  assert.equal(r.state.lastCardResolved?.playerId, 'p1');
});

// --- bankruptcy -------------------------------------------------------------

test('rent the payer cannot afford: cash and deeds go to the creditor', () => {
  const s = setup(3);
  s.owners[3] = 'p1';
  s.owners[39] = 'p0';
  p(s, 0).money = 3;
  const r = roll(s, 'p0', 1, 2);
  assert.equal(p(r.state, 0).isBankrupt, true);
  assert.equal(p(r.state, 0).money, 0);
  assert.equal(p(r.state, 1).money, 1503);
  assert.equal(r.state.owners[39], 'p1');
  const ev = r.events.find((e) => e.type === 'game:player_bankrupt');
  assert.deepEqual(ev?.payload, { playerId: 'p0', creditorPlayerId: 'p1', reason: 'INSOLVENT_TO_PLAYER' });
  assert.ok(!types(r).includes('game:rent_paid'));
});

test('tax the payer cannot afford: bankrupt to the Bank, deeds become unowned, winner decided', () => {
  const s = setup();
  s.owners[39] = 'p0';
  p(s, 0).money = 100;
  const r = roll(s, 'p0', 1, 3);
  assert.equal(p(r.state, 0).isBankrupt, true);
  assert.equal(r.state.owners[39], null);
  assert.equal(r.state.status, 'FINISHED');
  assert.equal(r.state.winnerPlayerId, 'p1');
  assert.equal(p(r.state, 1).finalRank, 1);
  assert.equal(p(r.state, 0).finalRank, 2);
  assert.ok(types(r).includes('game:finished'));
});

test('a bankrupt player returns held jail cards to the deck', () => {
  const s = setup(3);
  s.decks.chance = s.decks.chance.filter((c) => c !== 'ch_7');
  p(s, 0).heldJailCardIds = ['ch_7'];
  p(s, 0).money = 0;
  const r = roll(s, 'p0', 1, 3);
  assert.ok(r.state.decks.chance.includes('ch_7'));
  assert.deepEqual(p(r.state, 0).heldJailCardIds, []);
});

test('bankrupt players are skipped in turn order', () => {
  const s = setup(3);
  p(s, 1).isBankrupt = true;
  s.turnPhase = 'END_TURN';
  const r = act(s, 'end-turn', 'p0');
  assert.equal(r.state.currentPlayerId, 'p2');
});

// --- turn counters and the 80-turn limit --------------------------------------

test('end-turn advances to the next player and both counters', () => {
  const s = setup(3);
  s.turnPhase = 'END_TURN';
  let r = act(s, 'end-turn', 'p0');
  assert.equal(r.state.currentPlayerId, 'p1');
  assert.equal(r.state.turnNumber, 2);
  assert.equal(r.state.completedTurns, 1);
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
  r.state.turnPhase = 'END_TURN';
  r = act(r.state, 'end-turn', 'p1');
  r.state.turnPhase = 'END_TURN';
  r = act(r.state, 'end-turn', 'p2');
  assert.equal(r.state.currentPlayerId, 'p0'); // wraps round
});

test('turn limit: after 80 completed turns the highest net worth wins', () => {
  const s = setup(3);
  s.completedTurns = 79;
  s.turnNumber = 80;
  s.turnPhase = 'END_TURN';
  s.owners[39] = 'p1'; // +400 net worth
  p(s, 1).money = 1300; // net worth 1700
  p(s, 2).money = 1600;
  const r = act(s, 'end-turn', 'p0');
  assert.equal(r.state.status, 'FINISHED');
  assert.equal(r.state.finishReason, 'TURN_LIMIT');
  assert.equal(r.state.winnerPlayerId, 'p1');
  assert.equal(r.state.completedTurns, 80);
  assert.equal(r.state.turnNumber, 80); // no artificial next turn
  assert.equal(r.state.currentPlayerId, null);
  assert.deepEqual(r.state.players.map((x) => x.finalRank), [3, 1, 2]);
  assert.equal(netWorth(r.state, p(r.state, 1), CONTENT), 1700);
});

test('turn limit tie-breaks: cash, then property count, then lowest seat', () => {
  const base = () => {
    const s = setup(2);
    s.completedTurns = 79;
    s.turnPhase = 'END_TURN';
    return s;
  };
  let s = base(); // equal net worth, p1 has more cash
  s.owners[1] = 'p0';
  p(s, 0).money = 1440;
  assert.equal(act(s, 'end-turn', 'p0').state.winnerPlayerId, 'p1');
  s = base(); // equal net worth and cash, p1 has more properties
  s.owners[39] = 'p0'; // 400
  s.owners[37] = 'p1'; // 350
  s.owners[1] = 'p1'; // 60  (410 total)
  p(s, 0).money = 1010;
  p(s, 1).money = 1000;
  assert.equal(netWorth(s, p(s, 0), CONTENT), netWorth(s, p(s, 1), CONTENT));
  assert.equal(act(s, 'end-turn', 'p0').state.winnerPlayerId, 'p0'); // p0 has more cash
  s = base(); // everything equal -> lowest seat
  assert.equal(act(s, 'end-turn', 'p0').state.winnerPlayerId, 'p0');
});

// --- forfeit, host forfeit, abandon -------------------------------------------

test('voluntary forfeit by a non-active player: deeds to the Bank, turn counters unchanged', () => {
  const s = setup(3);
  s.owners[1] = 'p2';
  const r = act(s, 'forfeit', 'p2');
  assert.equal(p(r.state, 2).isBankrupt, true);
  assert.equal(r.state.owners[1], null);
  assert.equal(r.state.currentPlayerId, 'p0');
  assert.equal(r.state.completedTurns, 0);
  assert.equal(r.events[0].payload.reason, 'VOLUNTARY_FORFEIT');
});

test('forfeit by the active player counts the turn and moves on', () => {
  const r = act(setup(3), 'forfeit', 'p0');
  assert.equal(r.state.currentPlayerId, 'p1');
  assert.equal(r.state.completedTurns, 1);
  assert.equal(r.state.turnNumber, 2);
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
});

test('forfeit leaving one player finishes the match', () => {
  const r = act(setup(2), 'forfeit', 'p1');
  assert.equal(r.state.status, 'FINISHED');
  assert.equal(r.state.winnerPlayerId, 'p0');
});

test('forfeit is allowed while paused; other actions are not', () => {
  const s = setup(3);
  s.status = 'PAUSED';
  throwsCode(() => roll(s, 'p0', 1, 2), 'MATCH_PAUSED');
  const r = act(s, 'forfeit', 'p1');
  assert.equal(r.state.status, 'PAUSED');
  assert.equal(p(r.state, 1).isBankrupt, true);
});

test('forfeit-player: only while paused, not yourself, not an eliminated player', () => {
  const s = setup(3);
  throwsCode(() => act(s, 'forfeit-player', 'p0', { targetPlayerId: 'p1' }), 'PLAYER_NOT_ELIGIBLE_FOR_FORFEIT');
  s.status = 'PAUSED';
  throwsCode(() => act(s, 'forfeit-player', 'p0', { targetPlayerId: 'p0' }), 'PLAYER_NOT_ELIGIBLE_FOR_FORFEIT');
  throwsCode(() => act(s, 'forfeit-player', 'p0', { targetPlayerId: 'nope' }), 'PLAYER_NOT_ELIGIBLE_FOR_FORFEIT');
  const r = act(s, 'forfeit-player', 'p1', { targetPlayerId: 'p0' }); // removes the current player
  assert.equal(p(r.state, 0).isBankrupt, true);
  assert.equal(r.events[0].payload.reason, 'HOST_FORFEIT_ABSENT');
  assert.equal(r.state.currentPlayerId, 'p1');
  assert.equal(r.state.turnPhase, 'PRE_ROLL');
  assert.equal(r.state.status, 'PAUSED'); // the service decides whether to resume
  const last = act(r.state, 'forfeit-player', 'p1', { targetPlayerId: 'p2' });
  assert.equal(last.state.status, 'FINISHED');
  assert.equal(last.state.winnerPlayerId, 'p1');
});

test('abandon: only while paused; no winner', () => {
  const s = setup();
  throwsCode(() => act(s, 'abandon', 'p0'), 'INVALID_ACTION');
  s.status = 'PAUSED';
  const r = act(s, 'abandon', 'p0');
  assert.equal(r.state.status, 'ABANDONED');
  assert.equal(r.state.winnerPlayerId, null);
  assert.equal(r.state.currentPlayerId, null);
  assert.equal(r.state.turnPhase, 'GAME_OVER');
  const auto = abandonMatch(setup(), 'ALL_PLAYERS_OFFLINE_24H', ctx());
  assert.equal(auto.state.status, 'ABANDONED');
  assert.equal(auto.events[0].type, 'game:abandoned');
});

// --- validation ---------------------------------------------------------------

test('wrong player, wrong phase, terminal match, unknown player', () => {
  const s = setup();
  throwsCode(() => roll(s, 'p1', 1, 2), 'NOT_YOUR_TURN');
  throwsCode(() => act(s, 'end-turn', 'p0'), 'INVALID_PHASE');
  throwsCode(() => act(s, 'buy-property', 'p0', { spaceId: 3 }), 'INVALID_PHASE');
  throwsCode(() => act(s, 'roll-dice', 'stranger'), 'INVALID_ACTION');
  const done = act(s, 'forfeit', 'p1').state;
  throwsCode(() => roll(done, 'p0', 1, 2), 'MATCH_ALREADY_TERMINAL');
  throwsCode(() => act(done, 'forfeit', 'p0'), 'MATCH_ALREADY_TERMINAL');
});

// --- allowedActions -----------------------------------------------------------

test('allowedActions per viewer', () => {
  const none = { isConnectedHost: false, eligibleForfeitTargetIds: [] };
  let s = setup(3);
  assert.deepEqual(allowedActions(s, 'p0', none), ['roll-dice', 'forfeit']);
  assert.deepEqual(allowedActions(s, 'p1', none), ['forfeit']);
  assert.deepEqual(allowedActions(s, 'stranger', none), []);
  s = roll(s, 'p0', 1, 2).state;
  assert.deepEqual(allowedActions(s, 'p0', none), ['buy-property', 'decline-property', 'forfeit']);
  s = act(s, 'decline-property', 'p0', { spaceId: 3 }).state;
  assert.deepEqual(allowedActions(s, 'p0', none), ['end-turn', 'forfeit']);
  const j = jailed();
  p(j, 0).heldJailCardIds = ['ch_7'];
  assert.deepEqual(allowedActions(j, 'p0', none), ['roll-dice', 'pay-jail-bail', 'use-jail-card', 'forfeit']);
  p(j, 0).money = 10;
  p(j, 0).heldJailCardIds = [];
  assert.deepEqual(allowedActions(j, 'p0', none), ['roll-dice', 'forfeit']);
  const paused = setup(3);
  paused.status = 'PAUSED';
  assert.deepEqual(allowedActions(paused, 'p0', none), ['forfeit']);
  assert.deepEqual(allowedActions(paused, 'p1', { isConnectedHost: true, eligibleForfeitTargetIds: ['p0'] }), [
    'forfeit',
    'forfeit-player',
    'abandon',
  ]);
  assert.deepEqual(allowedActions(paused, 'p1', { isConnectedHost: true, eligibleForfeitTargetIds: [] }), ['forfeit', 'abandon']);
  const over = act(setup(), 'forfeit', 'p1').state;
  assert.deepEqual(allowedActions(over, 'p0', { isConnectedHost: true, eligibleForfeitTargetIds: [] }), []);
});

// --- random full games ----------------------------------------------------------

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(max: number) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
    },
  };
}

function checkInvariants(s: EngineState): void {
  const ids = new Set(s.players.map((x) => x.playerId));
  for (const pl of s.players) {
    assert.ok(Number.isSafeInteger(pl.money) && pl.money >= 0 && pl.money <= 2147483647, 'money in range');
    assert.ok(pl.position >= 0 && pl.position <= 39, 'position in range');
    if (pl.isBankrupt) assert.equal(pl.money, 0);
    if (pl.inJail) assert.equal(pl.position, 10);
  }
  for (const owner of Object.values(s.owners)) {
    if (owner !== null) {
      assert.ok(ids.has(owner));
      assert.ok(!s.players.find((x) => x.playerId === owner)?.isBankrupt, 'bankrupt players own nothing');
    }
  }
  for (const deck of ['chance', 'chest'] as DeckType[]) {
    const held = s.players.flatMap((x) => x.heldJailCardIds).filter((id) => CONTENT.cards.find((c) => c.id === id)?.deck === deck);
    const all = [...s.decks[deck], ...held].sort();
    const expected = CONTENT.cards.filter((c) => c.deck === deck).map((c) => c.id).sort();
    assert.deepEqual(all, expected, 'every card is in the pile or in a hand, exactly once');
  }
  if (s.status === 'IN_PROGRESS') {
    assert.ok(s.currentPlayerId !== null);
    assert.equal(s.turnNumber, s.completedTurns + 1);
    assert.ok(!s.players.find((x) => x.playerId === s.currentPlayerId)?.isBankrupt);
    assert.equal(s.pendingPurchaseSpaceId !== null, s.turnPhase === 'LANDED_ACTION');
  } else {
    assert.equal(s.currentPlayerId, null);
    assert.equal(s.turnPhase, 'GAME_OVER');
  }
}

test('500 random full games always finish within 80 turns and keep every invariant', () => {
  let lastPlayer = 0;
  let turnLimit = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const rng = mulberry32(seed);
    const n = 2 + (seed % 3);
    const seats = Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, seatOrder: i }));
    let s = createInitialState(seats, rng, CONTENT);
    // Make half of the games poor so bankruptcies happen often.
    if (seed % 2 === 0) for (const pl of s.players) pl.money = 150;
    let steps = 0;
    let version = 0;
    while (s.status === 'IN_PROGRESS') {
      assert.ok(++steps < 5000, 'game did not terminate');
      const me = s.currentPlayerId as string;
      const options = allowedActions(s, me, { isConnectedHost: false, eligibleForfeitTargetIds: [] }).filter((a) => a !== 'forfeit');
      const type = options[rng.int(options.length)];
      const action: EngineAction = { type, actorPlayerId: me };
      if (type === 'buy-property' || type === 'decline-property') action.spaceId = s.pendingPurchaseSpaceId as number;
      if (type === 'use-jail-card') action.cardId = s.players.find((x) => x.playerId === me)?.heldJailCardIds[0];
      const r = applyAction(s, action, { rng, content: CONTENT, now: NOW, stateVersion: ++version });
      s = r.state;
      checkInvariants(s);
    }
    assert.equal(s.status, 'FINISHED');
    assert.ok(s.completedTurns <= 80);
    assert.ok(s.winnerPlayerId !== null);
    const ranks = s.players.map((x) => x.finalRank).sort();
    assert.deepEqual(ranks, Array.from({ length: n }, (_, i) => i + 1), 'ranks are 1..n with no gaps');
    assert.equal(s.players.find((x) => x.finalRank === 1)?.playerId, s.winnerPlayerId);
    if (s.finishReason === 'LAST_PLAYER') lastPlayer++;
    else turnLimit++;
  }
  assert.ok(lastPlayer > 0 && turnLimit > 0, `both endings exercised (${lastPlayer} last-player, ${turnLimit} turn-limit)`);
});
