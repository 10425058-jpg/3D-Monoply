// mini-v1 rules engine. Implements docs/ONLINE-MVP-RULES.md.
//
// applyAction(state, action, ctx) never mutates its input. It returns the new state plus
// the list of events that happened, or throws a RuleError if the action is not legal.
// The caller (MatchesService) is responsible for saving the result in one DB transaction.

import {
  ActionName,
  BankruptReason,
  BoardSpace,
  BOARD_SIZE,
  Card,
  Content,
  DeckType,
  EngineAction,
  EngineContext,
  EngineEvent,
  EnginePlayer,
  EngineResult,
  EngineState,
  FinishReason,
  GO_SALARY,
  JAIL_BAIL,
  JAIL_SPACE,
  MAX_JAIL_ATTEMPTS,
  MAX_MONEY,
  Rng,
  RuleError,
  STARTING_CASH,
  TURN_LIMIT,
} from './types';

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

export function isOwnable(space: BoardSpace): boolean {
  return space.type === 'property' || space.type === 'railroad' || space.type === 'utility';
}

/** Throws if the board/card catalog is not a valid mini-v1 catalog. Run once at startup. */
export function validateContent(content: Content): void {
  const fail = (m: string) => {
    throw new Error(`Invalid game content ${content.version}: ${m}`);
  };
  if (content.spaces.length !== BOARD_SIZE) fail(`expected ${BOARD_SIZE} spaces`);
  content.spaces.forEach((s, i) => {
    if (s.id !== i) fail(`space at index ${i} has id ${s.id}`);
    if (isOwnable(s) && !(Number.isInteger(s.price) && (s.price as number) > 0)) fail(`space ${i} has no price`);
    if ((s.type === 'property' || s.type === 'railroad') && !(s.rent && s.rent.length > 0)) fail(`space ${i} has no rent`);
    if (s.type === 'tax' && !Number.isInteger(s.taxAmount)) fail(`space ${i} has no taxAmount`);
  });
  const at = (i: number, t: string) => {
    if (content.spaces[i].type !== t) fail(`space ${i} must be ${t}`);
  };
  at(0, 'go');
  at(JAIL_SPACE, 'jail');
  at(20, 'free_parking');
  at(30, 'go_to_jail');
  if (content.spaces.filter((s) => s.type === 'go').length !== 1) fail('exactly one GO expected');
  if (content.spaces.filter((s) => s.type === 'railroad').length === 0) fail('no railroads');
  if (content.spaces.filter((s) => s.type === 'utility').length === 0) fail('no utilities');
  const ids = new Set<string>();
  for (const c of content.cards) {
    if (ids.has(c.id)) fail(`duplicate card id ${c.id}`);
    ids.add(c.id);
    const needAmount = ['collect', 'pay', 'pay_each_player', 'collect_from_each_player'];
    if (needAmount.includes(c.actionType) && !(Number.isInteger(c.amount) && (c.amount as number) >= 0)) {
      fail(`card ${c.id} needs an integer amount`);
    }
    if (c.actionType === 'move_to') {
      const t = c.targetSpaceId;
      if (!(Number.isInteger(t) && (t as number) >= 0 && (t as number) < BOARD_SIZE)) fail(`card ${c.id} has a bad target`);
    }
    if (c.actionType === 'move_relative' && !Number.isInteger(c.steps)) fail(`card ${c.id} needs steps`);
  }
  for (const deck of ['chance', 'chest'] as DeckType[]) {
    if (!content.cards.some((c) => c.deck === deck)) fail(`deck ${deck} is empty`);
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createInitialState(
  seats: Array<{ playerId: string; seatOrder: number }>,
  rng: Rng,
  content: Content,
): EngineState {
  if (seats.length < 2 || seats.length > 4) throw new Error('mini-v1 needs 2-4 players');
  const players: EnginePlayer[] = seats
    .slice()
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((s) => ({
      playerId: s.playerId,
      seatOrder: s.seatOrder,
      position: 0,
      money: STARTING_CASH,
      inJail: false,
      jailTurns: 0,
      heldJailCardIds: [],
      isBankrupt: false,
      finalRank: null,
    }));
  const owners: Record<number, string | null> = {};
  for (const s of content.spaces) if (isOwnable(s)) owners[s.id] = null;
  const deck = (d: DeckType) =>
    shuffle(
      content.cards.filter((c) => c.deck === d).map((c) => c.id),
      rng,
    );
  return {
    status: 'IN_PROGRESS',
    players,
    owners,
    currentPlayerId: players[0].playerId,
    turnNumber: 1,
    completedTurns: 0,
    turnPhase: 'PRE_ROLL',
    dice: null,
    doublesCount: 0,
    pendingExtraRoll: false,
    pendingPurchaseSpaceId: null,
    lastCardResolved: null,
    winnerPlayerId: null,
    finishReason: null,
    decks: { chance: deck('chance'), chest: deck('chest') },
    drawCounts: { chance: 0, chest: 0 },
  };
}

// ---------------------------------------------------------------------------
// Internal run context
// ---------------------------------------------------------------------------

interface Run {
  s: EngineState;
  events: EngineEvent[];
  ctx: EngineContext;
  actorId: string | null;
}

function emit(run: Run, type: string, payload: Record<string, unknown>): void {
  run.events.push({ type, actorPlayerId: run.actorId, payload });
}

function player(run: Run, id: string | null | undefined): EnginePlayer | undefined {
  return run.s.players.find((p) => p.playerId === id);
}

function solvent(s: EngineState): EnginePlayer[] {
  return s.players.filter((p) => !p.isBankrupt);
}

function space(run: Run, id: number): BoardSpace {
  return run.ctx.content.spaces[id];
}

function card(run: Run, id: string): Card {
  const c = run.ctx.content.cards.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

function ownedSpaceIds(s: EngineState, playerId: string): number[] {
  return Object.keys(s.owners)
    .map(Number)
    .filter((id) => s.owners[id] === playerId);
}

export function netWorth(s: EngineState, p: EnginePlayer, content: Content): number {
  return p.money + ownedSpaceIds(s, p.playerId).reduce((sum, id) => sum + (content.spaces[id].price ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Money, bankruptcy
// ---------------------------------------------------------------------------

function credit(run: Run, p: EnginePlayer, amount: number, reason: string): void {
  if (amount === 0) return;
  if (!Number.isSafeInteger(amount) || amount < 0 || p.money + amount > MAX_MONEY) {
    throw new Error('Money out of range');
  }
  p.money += amount;
  emit(run, 'game:money_changed', { playerId: p.playerId, amount, balance: p.money, reason });
}

function bankrupt(run: Run, p: EnginePlayer, creditor: EnginePlayer | null, reason: BankruptReason): void {
  const { s } = run;
  const cash = p.money;
  p.money = 0;
  if (creditor && cash > 0) {
    if (creditor.money + cash > MAX_MONEY) throw new Error('Money out of range');
    creditor.money += cash;
  }
  for (const id of ownedSpaceIds(s, p.playerId)) s.owners[id] = creditor ? creditor.playerId : null;
  // Held Get Out of Jail cards go back to the bottom of their decks.
  for (const cardId of p.heldJailCardIds) s.decks[card(run, cardId).deck].push(cardId);
  p.heldJailCardIds = [];
  p.isBankrupt = true;
  p.inJail = false;
  p.jailTurns = 0;
  p.finalRank = solvent(s).length + 1;
  emit(run, 'game:player_bankrupt', {
    playerId: p.playerId,
    creditorPlayerId: creditor ? creditor.playerId : null,
    reason,
  });
}

/**
 * Makes `p` pay `amount` to `creditor` (or to the Bank when null).
 * If p cannot pay in full, p goes bankrupt immediately (mini-v1 has no debt phase).
 * Returns true when the payment was made in full.
 */
function charge(run: Run, p: EnginePlayer, amount: number, creditor: EnginePlayer | null, reason: string): boolean {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Money out of range');
  if (amount === 0) return true;
  if (p.money < amount) {
    bankrupt(run, p, creditor, creditor ? 'INSOLVENT_TO_PLAYER' : 'INSOLVENT_TO_BANK');
    return false;
  }
  p.money -= amount;
  emit(run, 'game:money_changed', { playerId: p.playerId, amount: -amount, balance: p.money, reason });
  if (creditor) credit(run, creditor, amount, reason);
  return true;
}

// ---------------------------------------------------------------------------
// Movement, jail
// ---------------------------------------------------------------------------

function moveForward(run: Run, p: EnginePlayer, steps: number): void {
  const from = p.position;
  const to = (from + steps) % BOARD_SIZE;
  const passedGo = from + steps >= BOARD_SIZE;
  p.position = to;
  emit(run, 'game:player_moved', { playerId: p.playerId, fromPosition: from, toPosition: to, passedGo });
  if (passedGo) credit(run, p, GO_SALARY, 'GO_SALARY');
}

function moveBackward(run: Run, p: EnginePlayer, steps: number): void {
  const from = p.position;
  const to = (((from - steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  p.position = to;
  emit(run, 'game:player_moved', { playerId: p.playerId, fromPosition: from, toPosition: to, passedGo: false });
}

function sendToJail(run: Run, p: EnginePlayer): void {
  const from = p.position;
  p.position = JAIL_SPACE;
  p.inJail = true;
  p.jailTurns = 0;
  run.s.doublesCount = 0;
  run.s.pendingExtraRoll = false;
  emit(run, 'game:player_moved', { playerId: p.playerId, fromPosition: from, toPosition: JAIL_SPACE, passedGo: false });
  emit(run, 'game:jail_changed', { playerId: p.playerId, inJail: true, jailTurns: 0 });
}

function releaseFromJail(run: Run, p: EnginePlayer): void {
  p.inJail = false;
  p.jailTurns = 0;
  emit(run, 'game:jail_changed', { playerId: p.playerId, inJail: false, jailTurns: 0 });
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

function rentFor(run: Run, sp: BoardSpace, ownerId: string, cardUtility: boolean): number {
  const { s } = run;
  const spaces = run.ctx.content.spaces;
  if (sp.type === 'property') {
    const base = (sp.rent as number[])[0];
    const group = spaces.filter((x) => x.type === 'property' && x.colorGroup === sp.colorGroup);
    const fullSet = group.every((x) => s.owners[x.id] === ownerId);
    return fullSet ? base * 2 : base;
  }
  if (sp.type === 'railroad') {
    const count = spaces.filter((x) => x.type === 'railroad' && s.owners[x.id] === ownerId).length;
    const table = sp.rent as number[];
    return table[Math.min(count, table.length) - 1];
  }
  // utility
  const total = s.dice ? s.dice.total : 0;
  if (cardUtility) return total * 10;
  const all = spaces.filter((x) => x.type === 'utility');
  const count = all.filter((x) => s.owners[x.id] === ownerId).length;
  return total * (count >= all.length ? 10 : 4);
}

const MAX_CHAIN_DEPTH = 6;

function resolveLanding(run: Run, p: EnginePlayer, depth: number, cardUtility = false): void {
  if (depth > MAX_CHAIN_DEPTH) throw new Error('Card movement chain too long');
  const { s } = run;
  const sp = space(run, p.position);
  switch (sp.type) {
    case 'property':
    case 'railroad':
    case 'utility': {
      const ownerId = s.owners[sp.id];
      if (ownerId === null || ownerId === undefined) {
        // Affordable -> the player decides. Not affordable -> automatic decline, no prompt.
        if (p.money >= (sp.price as number)) s.pendingPurchaseSpaceId = sp.id;
        return;
      }
      if (ownerId === p.playerId) return;
      const owner = player(run, ownerId) as EnginePlayer;
      const amount = rentFor(run, sp, ownerId, cardUtility);
      const paid = charge(run, p, amount, owner, 'RENT');
      if (paid) {
        emit(run, 'game:rent_paid', { payerPlayerId: p.playerId, ownerPlayerId: ownerId, spaceId: sp.id, amount });
      }
      return;
    }
    case 'chance':
    case 'chest':
      drawCard(run, p, sp.type, depth);
      return;
    case 'tax':
      charge(run, p, sp.taxAmount as number, null, 'TAX');
      return;
    case 'go_to_jail':
      sendToJail(run, p);
      return;
    case 'go':
    case 'jail':
    case 'free_parking':
      return;
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function nearestForward(run: Run, from: number, type: 'utility' | 'railroad'): number {
  for (let i = 1; i <= BOARD_SIZE; i++) {
    if (space(run, (from + i) % BOARD_SIZE).type === type) return i;
  }
  throw new Error(`No ${type} on board`);
}

function drawCard(run: Run, p: EnginePlayer, deck: DeckType, depth: number): void {
  const { s } = run;
  const pile = s.decks[deck];
  if (pile.length === 0) return; // only possible if every card of the deck is being held
  const c = card(run, pile.shift() as string);
  s.drawCounts[deck] += 1;
  // Get Out of Jail Free stays in the player's hand; everything else goes to the bottom.
  if (c.actionType !== 'get_out_of_jail') pile.push(c.id);

  const effect: { type: string; amount?: number; targetSpaceId?: number } = { type: c.actionType };
  if (c.amount !== undefined) effect.amount = c.amount;
  let steps = 0;
  if (c.actionType === 'move_to') {
    effect.targetSpaceId = c.targetSpaceId as number;
    steps = ((c.targetSpaceId as number) - p.position + BOARD_SIZE) % BOARD_SIZE;
    if (steps === 0) steps = BOARD_SIZE;
  } else if (c.actionType === 'nearest_utility' || c.actionType === 'nearest_railroad') {
    steps = nearestForward(run, p.position, c.actionType === 'nearest_utility' ? 'utility' : 'railroad');
    effect.targetSpaceId = (p.position + steps) % BOARD_SIZE;
  } else if (c.actionType === 'go_to_jail') {
    effect.targetSpaceId = JAIL_SPACE;
  } else if (c.actionType === 'repairs') {
    effect.amount = 0; // no houses or hotels exist in mini-v1
  }

  s.lastCardResolved = {
    cardId: c.id,
    deck,
    playerId: p.playerId,
    effects: [effect],
    stateVersion: run.ctx.stateVersion,
    resolvedAt: run.ctx.now,
  };
  emit(run, 'game:card_resolved', {
    playerId: p.playerId,
    cardId: c.id,
    deck,
    effects: [effect],
    resolvedAt: run.ctx.now,
  });

  switch (c.actionType) {
    case 'collect':
      credit(run, p, c.amount as number, 'CARD');
      return;
    case 'pay':
      charge(run, p, c.amount as number, null, 'CARD');
      return;
    case 'move_to':
      moveForward(run, p, steps);
      resolveLanding(run, p, depth + 1);
      return;
    case 'move_relative': {
      const n = c.steps as number;
      if (n >= 0) moveForward(run, p, n);
      else moveBackward(run, p, -n);
      resolveLanding(run, p, depth + 1);
      return;
    }
    case 'nearest_utility':
      moveForward(run, p, steps);
      resolveLanding(run, p, depth + 1, true);
      return;
    case 'nearest_railroad':
      moveForward(run, p, steps);
      resolveLanding(run, p, depth + 1);
      return;
    case 'go_to_jail':
      sendToJail(run, p);
      return;
    case 'get_out_of_jail':
      p.heldJailCardIds.push(c.id);
      return;
    case 'repairs':
      return; // perHouse * 0 + perHotel * 0
    case 'pay_each_player':
      for (const other of solvent(s)) {
        if (other.playerId === p.playerId) continue;
        if (!charge(run, p, c.amount as number, other, 'CARD')) break; // bankrupt to that recipient
      }
      return;
    case 'collect_from_each_player':
      for (const other of solvent(s)) {
        if (other.playerId === p.playerId) continue;
        charge(run, other, c.amount as number, p, 'CARD'); // a payer who cannot pay goes bankrupt to the drawer
      }
      return;
  }
}

// ---------------------------------------------------------------------------
// Turn flow, finishing
// ---------------------------------------------------------------------------

function finish(run: Run, reason: FinishReason): void {
  const { s } = run;
  const content = run.ctx.content;
  const alive = solvent(s).sort((a, b) => {
    const nw = netWorth(s, b, content) - netWorth(s, a, content);
    if (nw !== 0) return nw;
    if (b.money !== a.money) return b.money - a.money;
    const props = ownedSpaceIds(s, b.playerId).length - ownedSpaceIds(s, a.playerId).length;
    if (props !== 0) return props;
    return a.seatOrder - b.seatOrder;
  });
  alive.forEach((p, i) => {
    p.finalRank = i + 1;
  });
  s.status = 'FINISHED';
  s.turnPhase = 'GAME_OVER';
  s.currentPlayerId = null;
  s.pendingExtraRoll = false;
  s.pendingPurchaseSpaceId = null;
  s.winnerPlayerId = alive.length > 0 ? alive[0].playerId : null;
  s.finishReason = reason;
  emit(run, 'game:finished', {
    winnerPlayerId: s.winnerPlayerId,
    finishReason: reason,
    standings: s.players
      .slice()
      .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))
      .map((p) => ({
        playerId: p.playerId,
        rank: p.finalRank,
        cash: p.money,
        netWorth: netWorth(s, p, content),
        propertyCount: ownedSpaceIds(s, p.playerId).length,
      })),
  });
}

/** Ends the current player's turn (counts it) and starts the next solvent player's turn. */
function endTurn(run: Run): void {
  const { s } = run;
  const cur = player(run, s.currentPlayerId) as EnginePlayer;
  s.completedTurns += 1;
  s.pendingExtraRoll = false;
  s.pendingPurchaseSpaceId = null;
  s.doublesCount = 0;
  const alive = solvent(s);
  if (alive.length <= 1) return finish(run, 'LAST_PLAYER');
  if (s.completedTurns >= TURN_LIMIT) return finish(run, 'TURN_LIMIT');
  const next = alive.find((p) => p.seatOrder > cur.seatOrder) ?? alive[0];
  s.currentPlayerId = next.playerId;
  s.turnNumber += 1;
  s.turnPhase = 'PRE_ROLL';
  emit(run, 'game:turn_changed', { currentPlayerId: next.playerId, turnPhase: s.turnPhase });
}

/** Run after every action: handles "active player went bankrupt" and "one player left". */
function settle(run: Run): void {
  const { s } = run;
  if (s.status === 'FINISHED' || s.status === 'ABANDONED') return;
  const cur = player(run, s.currentPlayerId);
  if (cur && cur.isBankrupt) return endTurn(run);
  if (solvent(s).length <= 1) finish(run, 'LAST_PLAYER');
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function requireTurn(run: Run, actor: EnginePlayer, phase: 'PRE_ROLL' | 'LANDED_ACTION' | 'END_TURN'): void {
  const { s } = run;
  if (s.status === 'PAUSED') throw new RuleError('MATCH_PAUSED', 'The match is paused.');
  if (actor.isBankrupt) throw new RuleError('INVALID_ACTION', 'You are out of this match.');
  if (s.currentPlayerId !== actor.playerId) throw new RuleError('NOT_YOUR_TURN', 'It is not your turn.');
  if (s.turnPhase !== phase) throw new RuleError('INVALID_PHASE', `This action is not allowed during ${s.turnPhase}.`);
}

function afterRoll(run: Run, p: EnginePlayer, extraRollIfDouble: boolean): void {
  const { s } = run;
  if (p.isBankrupt) return; // settle() moves the turn on
  s.pendingExtraRoll = extraRollIfDouble && !p.inJail;
  if (s.pendingPurchaseSpaceId !== null) s.turnPhase = 'LANDED_ACTION';
  else s.turnPhase = s.pendingExtraRoll ? 'PRE_ROLL' : 'END_TURN';
}

function rollDice(run: Run, p: EnginePlayer): Record<string, unknown> {
  const { s } = run;
  requireTurn(run, p, 'PRE_ROLL');
  const d1 = run.ctx.rng.int(6) + 1;
  const d2 = run.ctx.rng.int(6) + 1;
  const total = d1 + d2;
  const isDouble = d1 === d2;
  const from = p.position;
  s.dice = { values: [d1, d2], total, rolledByPlayerId: p.playerId };
  s.pendingPurchaseSpaceId = null;
  s.pendingExtraRoll = false;

  const rolled = (to: number) =>
    emit(run, 'game:dice_rolled', { playerId: p.playerId, dice: [d1, d2], total, fromPosition: from, toPosition: to });

  if (p.inJail) {
    // Jail attempt.
    if (isDouble) {
      rolled((from + total) % BOARD_SIZE);
      releaseFromJail(run, p);
      moveForward(run, p, total);
      resolveLanding(run, p, 0);
      afterRoll(run, p, false); // no extra roll for doubles that get you out of jail
    } else {
      p.jailTurns += 1;
      if (p.jailTurns < MAX_JAIL_ATTEMPTS) {
        rolled(from);
        emit(run, 'game:jail_changed', { playerId: p.playerId, inJail: true, jailTurns: p.jailTurns });
        s.turnPhase = 'END_TURN';
      } else {
        // Third failed attempt: forced bail, then move by this roll (or bankruptcy to the Bank).
        rolled(p.money >= JAIL_BAIL ? (from + total) % BOARD_SIZE : from);
        if (charge(run, p, JAIL_BAIL, null, 'JAIL_BAIL')) {
          releaseFromJail(run, p);
          moveForward(run, p, total);
          resolveLanding(run, p, 0);
          afterRoll(run, p, false);
        }
      }
    }
  } else {
    if (isDouble) s.doublesCount += 1;
    else s.doublesCount = 0;
    if (s.doublesCount >= 3) {
      // Third consecutive double: straight to jail, no movement, no GO, no extra roll.
      rolled(JAIL_SPACE);
      sendToJail(run, p);
      s.turnPhase = 'END_TURN';
    } else {
      rolled((from + total) % BOARD_SIZE);
      moveForward(run, p, total);
      resolveLanding(run, p, 0);
      afterRoll(run, p, isDouble);
    }
  }
  return { dice: [d1, d2], total, fromPosition: from, toPosition: p.position };
}

function afterPurchaseDecision(run: Run): void {
  const { s } = run;
  s.pendingPurchaseSpaceId = null;
  s.turnPhase = s.pendingExtraRoll ? 'PRE_ROLL' : 'END_TURN';
}

function requirePendingSpace(run: Run, action: EngineAction): BoardSpace {
  const { s } = run;
  if (s.pendingPurchaseSpaceId === null || action.spaceId !== s.pendingPurchaseSpaceId) {
    throw new RuleError('INVALID_ACTION', 'That space is not available to buy right now.');
  }
  return space(run, s.pendingPurchaseSpaceId);
}

export function applyAction(state: EngineState, action: EngineAction, ctx: EngineContext): EngineResult {
  const s: EngineState = structuredClone(state);
  const run: Run = { s, events: [], ctx, actorId: action.actorPlayerId };

  if (s.status === 'FINISHED' || s.status === 'ABANDONED') {
    throw new RuleError('MATCH_ALREADY_TERMINAL', 'This match has already ended.');
  }
  const actor = player(run, action.actorPlayerId);
  if (!actor) throw new RuleError('INVALID_ACTION', 'You are not a player in this match.');

  let result: Record<string, unknown> = {};

  switch (action.type) {
    case 'roll-dice':
      result = rollDice(run, actor);
      break;

    case 'buy-property': {
      requireTurn(run, actor, 'LANDED_ACTION');
      const sp = requirePendingSpace(run, action);
      const price = sp.price as number;
      if (actor.money < price) throw new RuleError('INSUFFICIENT_FUNDS', 'You cannot afford this property.');
      charge(run, actor, price, null, 'PURCHASE');
      s.owners[sp.id] = actor.playerId;
      emit(run, 'game:property_purchased', { playerId: actor.playerId, spaceId: sp.id, price, balance: actor.money });
      afterPurchaseDecision(run);
      result = { spaceId: sp.id, price };
      break;
    }

    case 'decline-property': {
      requireTurn(run, actor, 'LANDED_ACTION');
      const sp = requirePendingSpace(run, action);
      afterPurchaseDecision(run);
      result = { spaceId: sp.id };
      break;
    }

    case 'end-turn':
      requireTurn(run, actor, 'END_TURN');
      endTurn(run);
      break;

    case 'pay-jail-bail':
      requireTurn(run, actor, 'PRE_ROLL');
      if (!actor.inJail) throw new RuleError('INVALID_ACTION', 'You are not in jail.');
      if (actor.money < JAIL_BAIL) throw new RuleError('INSUFFICIENT_FUNDS', 'You cannot afford bail.');
      charge(run, actor, JAIL_BAIL, null, 'JAIL_BAIL');
      releaseFromJail(run, actor);
      break;

    case 'use-jail-card': {
      requireTurn(run, actor, 'PRE_ROLL');
      if (!actor.inJail) throw new RuleError('INVALID_ACTION', 'You are not in jail.');
      const cardId = action.cardId as string;
      if (!actor.heldJailCardIds.includes(cardId)) throw new RuleError('INVALID_ACTION', 'You do not hold that card.');
      actor.heldJailCardIds = actor.heldJailCardIds.filter((id) => id !== cardId);
      s.decks[card(run, cardId).deck].push(cardId); // back to the bottom of its deck
      releaseFromJail(run, actor);
      result = { cardId };
      break;
    }

    case 'forfeit':
      if (actor.isBankrupt) throw new RuleError('INVALID_ACTION', 'You are already out of this match.');
      bankrupt(run, actor, null, 'VOLUNTARY_FORFEIT');
      break;

    case 'forfeit-player': {
      // Host authority, connection and the 120-second absence are checked by MatchesService.
      const target = player(run, action.targetPlayerId);
      if (s.status !== 'PAUSED' || !target || target.isBankrupt || target.playerId === actor.playerId) {
        throw new RuleError('PLAYER_NOT_ELIGIBLE_FOR_FORFEIT', 'That player cannot be removed right now.');
      }
      bankrupt(run, target, null, 'HOST_FORFEIT_ABSENT');
      result = { targetPlayerId: target.playerId };
      break;
    }

    case 'abandon':
      // Host authority and connection are checked by MatchesService.
      if (s.status !== 'PAUSED') throw new RuleError('INVALID_ACTION', 'A match can only be abandoned while paused.');
      abandonInPlace(run, 'HOST_ABANDONED');
      break;

    default:
      throw new RuleError('INVALID_ACTION', 'Unknown action.');
  }

  settle(run);
  return {
    state: s,
    events: run.events,
    result: { playerId: actor.playerId, turnPhase: s.turnPhase, status: s.status, ...result },
  };
}

function abandonInPlace(run: Run, reason: string): void {
  const { s } = run;
  s.status = 'ABANDONED';
  s.turnPhase = 'GAME_OVER';
  s.currentPlayerId = null;
  s.winnerPlayerId = null;
  s.finishReason = null;
  s.pendingExtraRoll = false;
  s.pendingPurchaseSpaceId = null;
  emit(run, 'game:abandoned', { reason });
}

/** Ends a non-terminal match with no winner (used by the 24-hour all-offline rule). */
export function abandonMatch(state: EngineState, reason: string, ctx: EngineContext): EngineResult {
  const s: EngineState = structuredClone(state);
  const run: Run = { s, events: [], ctx, actorId: null };
  if (s.status === 'FINISHED' || s.status === 'ABANDONED') {
    throw new RuleError('MATCH_ALREADY_TERMINAL', 'This match has already ended.');
  }
  abandonInPlace(run, reason);
  return { state: s, events: run.events, result: { status: s.status } };
}

// ---------------------------------------------------------------------------
// allowedActions (UI hint only; every request is validated again)
// ---------------------------------------------------------------------------

export interface ViewerHostInfo {
  /** The viewer is the room's current host AND is connected. */
  isConnectedHost: boolean;
  /** Other players the host may remove right now (offline for 120s or more). */
  eligibleForfeitTargetIds: string[];
}

export function allowedActions(s: EngineState, viewerPlayerId: string | null, host: ViewerHostInfo): ActionName[] {
  if (s.status === 'FINISHED' || s.status === 'ABANDONED') return [];
  const me = s.players.find((p) => p.playerId === viewerPlayerId);
  if (!me) return [];
  const out: ActionName[] = [];
  if (!me.isBankrupt) {
    if (s.status === 'IN_PROGRESS' && s.currentPlayerId === me.playerId) {
      if (s.turnPhase === 'PRE_ROLL') {
        out.push('roll-dice');
        if (me.inJail && me.money >= JAIL_BAIL) out.push('pay-jail-bail');
        if (me.inJail && me.heldJailCardIds.length > 0) out.push('use-jail-card');
      } else if (s.turnPhase === 'LANDED_ACTION') {
        out.push('buy-property', 'decline-property');
      } else if (s.turnPhase === 'END_TURN') {
        out.push('end-turn');
      }
    }
    out.push('forfeit');
  }
  if (s.status === 'PAUSED' && host.isConnectedHost) {
    if (host.eligibleForfeitTargetIds.some((id) => id !== me.playerId)) out.push('forfeit-player');
    out.push('abandon');
  }
  return out;
}
