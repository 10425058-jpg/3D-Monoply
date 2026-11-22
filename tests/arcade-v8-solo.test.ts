import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { BOARD_SPACES } from '../src/data/boardData';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../src/data/cardsData';
import { arcadeRent, arcadeUpgradeCost, validateArcadeCatalog } from '../src/game/arcadeRules';
import { MATCH_ACTIVITY_LIMIT } from '../src/game/matchActivity';
import { runSoloAiStep } from '../src/game/soloAi';
import { useGameStore as store } from '../src/store/useGameStore';
import type { ArcadeLevel, Player, SoloRuleset } from '../src/types/game';

const configs = Array.from({ length: 4 }, (_, id) => ({
  name: ['You', 'Victoria', 'Arthur', 'Elena'][id],
  isAI: id === 1,
  token: 'cat' as const,
  color: ['#dbab38', '#cd75a5', '#388de4', '#47ad88'][id],
}));

function setup(t: TestContext, ruleset: SoloRuleset = 'arcade') {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  store.getState().startNewGame(configs, ruleset);
}

function player(id: number, patch: Partial<Player>) {
  store.setState(state => ({ players: state.players.map(candidate => candidate.id === id ? { ...candidate, ...patch } : candidate) }));
}

function own(spaceId: number, ownerId: number, developmentLevel?: ArcadeLevel) {
  store.setState(state => ({ properties: { ...state.properties,
    [spaceId]: { spaceId, ownerId, houses: 0, isMortgaged: false, developmentLevel },
  } }));
}

function flush(t: TestContext) {
  for (let tick = 0; tick < 80 && ['ROLLING', 'MOVING'].includes(store.getState().turnPhase); tick++) {
    t.mock.timers.tick(240);
  }
}

function roll(t: TestContext, playerId: number, start: number, first: number, second: number) {
  player(playerId, { position: start });
  store.setState({ currentPlayerIndex: playerId, turnPhase: 'PRE_ROLL', doublesCount: 0 });
  const faces = [first, second];
  const random = t.mock.method(Math, 'random', () => faces.length ? (faces.shift()! - .5) / 6 : .4);
  store.getState().rollDice();
  flush(t);
  random.mock.restore();
}

const events = (kind: string) => store.getState().activity.filter(entry => entry.kind === kind);

test('Arcade buys Land and permits one immediate paid upgrade without a full group', t => {
  setup(t);
  roll(t, 0, 0, 1, 2);
  const game = store.getState();
  assert.equal(game.properties[3].ownerId, null);
  assert.equal(game.canUpgradeProperty(0, 3), false);
  game.buyCurrentProperty();
  game.buyCurrentProperty();
  assert.equal(store.getState().players[0].money, 1440);
  assert.equal(store.getState().properties[3].developmentLevel, 0);
  assert.equal(game.ownsFullGroup(0, 'brown'), false);
  const landing = store.getState().arcadeLanding!;
  assert.equal(game.canBuildHouse(0, 3), false);
  assert.equal(game.canUpgradeProperty(0, 3), true);
  game.upgradeProperty(3, landing.id);
  game.upgradeProperty(3, landing.id);
  assert.equal(store.getState().players[0].money, 1390);
  assert.equal(store.getState().properties[3].developmentLevel, 1);
  assert.equal(store.getState().properties[3].houses, 0);
  assert.equal(events('purchase').length, 1);
  assert.equal(events('upgrade').length, 1);
  assert.equal(events('upgrade')[0].amount, 50);
  assert.equal(events('upgrade')[0].previousLevel, 0);
  assert.equal(events('upgrade')[0].level, 1);
});

test('Arcade revisits use exact stage prices and rent, reject stale windows and stop at Hotel', t => {
  setup(t);
  own(6, 0, 0);
  own(8, 0, 0);
  own(9, 0, 0);
  const game = store.getState();
  assert.equal(game.calculateRent(6, 6), BOARD_SPACES[6].rent![0]);
  roll(t, 0, 3, 1, 2);
  const stale = store.getState().arcadeLanding!.id;
  game.upgradeProperty(6, stale);
  assert.equal(game.calculateRent(6, 6), BOARD_SPACES[6].rent![1]);
  game.endTurn();
  assert.equal(game.canUpgradeProperty(0, 6), false);
  roll(t, 0, 3, 1, 2);
  game.upgradeProperty(6, stale);
  assert.equal(store.getState().properties[6].developmentLevel, 1);
  game.upgradeProperty(6);
  assert.equal(game.calculateRent(6, 6), BOARD_SPACES[6].rent![3]);
  roll(t, 0, 3, 1, 2);
  game.upgradeProperty(6);
  assert.equal(game.calculateRent(6, 6), BOARD_SPACES[6].rent![5]);
  roll(t, 0, 3, 1, 2);
  assert.equal(game.canUpgradeProperty(0, 6), false);
  game.upgradeProperty(6);
  assert.equal(store.getState().players[0].money, 1200);
  assert.deepEqual(events('upgrade').map(event => [event.level, event.amount]), [[1, 50], [2, 100], [3, 150]]);
  assert.equal(events('upgrade').at(-1)!.emphasis, 'milestone');
});

test('every street has all Arcade rent and construction data with deterministic prices', () => {
  const streets = BOARD_SPACES.filter(space => space.type === 'property');
  assert.doesNotThrow(() => validateArcadeCatalog(streets));
  assert.throws(() => validateArcadeCatalog([{ ...streets[0], houseCost: undefined }]), /building cost/);
  assert.throws(() => validateArcadeCatalog([{ ...streets[0], rent: [1, 2, 3] }]), /rent tier/);
  for (const street of streets) {
    const stages = [0, 1, 2, 3] as const;
    assert.deepEqual(stages.map(level => arcadeUpgradeCost(street, level)),
      [street.price, street.houseCost!, street.houseCost! * 2, street.houseCost! * 3]);
    assert.deepEqual(stages.map(level => arcadeRent(street, level)), [0, 1, 3, 5].map(index => street.rent![index]));
  }
});

test('Arcade rejects unaffordable development and a prior match callback', t => {
  setup(t);
  own(3, 0, 0);
  player(0, { money: 49 });
  roll(t, 0, 0, 1, 2);
  const landing = store.getState().arcadeLanding!;
  store.getState().upgradeProperty(3, landing.id);
  assert.equal(store.getState().players[0].money, 49);
  assert.equal(store.getState().properties[3].developmentLevel, 0);
  store.getState().startNewGame(configs, 'arcade');
  assert.equal(store.getState().arcadeLanding, null);
  assert.equal(store.getState().properties[3].ownerId, null);
  assert.equal(events('upgrade').length, 0);
  own(3, 0, 0);
  roll(t, 0, 0, 1, 2);
  store.getState().upgradeProperty(3, landing.id);
  assert.equal(store.getState().players[0].money, 1500);
});

test('Arcade transfers developed deeds and sells levels at half the exact paid fee', t => {
  setup(t);
  own(6, 0, 2);
  own(8, 0, 0);
  const game = store.getState();
  assert.equal(game.canToggleMortgage(0, 6), false);
  assert.equal(game.canToggleMortgage(0, 8), true);
  assert.equal(game.proposeTrade({ fromPlayerId: 0, toPlayerId: 1, offerCash: 0, requestCash: 0,
    offerProperties: [6], requestProperties: [] }).accepted, true);
  assert.equal(store.getState().properties[6].ownerId, 1);
  assert.equal(store.getState().properties[6].developmentLevel, 2);
  assert.equal(game.calculateRent(6, 4), BOARD_SPACES[6].rent![3]);
  store.setState({ currentPlayerIndex: 1 });
  game.sellHouse(6);
  assert.equal(store.getState().players[1].money, 1550);
  assert.equal(store.getState().properties[6].developmentLevel, 1);
  game.sellHouse(6);
  assert.equal(store.getState().players[1].money, 1575);
  assert.equal(store.getState().properties[6].developmentLevel, 0);
  game.toggleMortgage(6, false);
  assert.equal(game.calculateRent(6, 4), 0);
  assert.equal(events('trade').length, 1);
  assert.deepEqual(events('sale').map(event => event.amount), [50, 25]);
  assert.equal(events('mortgage').length, 1);
});

test('Arcade bankruptcy liquidates development and transfers the Land to its creditor', t => {
  setup(t);
  own(6, 0, 2);
  player(0, { money: 10 });
  store.setState({ turnPhase: 'DEBT_RESOLUTION', pendingDebt: { amount: 200, creditorId: 1, reason: 'Rent' } });
  store.getState().declareBankruptcy();
  assert.equal(store.getState().players[0].isBankrupt, true);
  assert.equal(store.getState().players[1].money, 1585);
  assert.equal(store.getState().properties[6].ownerId, 1);
  assert.equal(store.getState().properties[6].developmentLevel, 0);
  assert.equal(events('bankruptcy').length, 1);
});

test('serialized Arcade stages and the consumed landing survive state restoration', t => {
  setup(t);
  own(3, 0, 0);
  roll(t, 0, 0, 1, 2);
  const game = store.getState();
  game.upgradeProperty(3, game.arcadeLanding!.id);
  game.sellHouse(3, 1);
  assert.equal(game.canUpgradeProperty(0, 3), false, 'selling a stage does not reopen the current landing');
  const { ruleset, properties, arcadeLanding, arcadeLandingSequence } = store.getState();
  const restored = JSON.parse(JSON.stringify({ ruleset, properties, arcadeLanding, arcadeLandingSequence }));
  store.setState({ ruleset: 'classic', arcadeLanding: null, arcadeLandingSequence: 0 });
  store.setState(restored);
  assert.equal(store.getState().properties[3].developmentLevel, 0);
  assert.equal(game.canUpgradeProperty(0, 3), false);
  roll(t, 0, 0, 1, 2);
  game.upgradeProperty(3, restored.arcadeLanding.id);
  assert.equal(store.getState().properties[3].developmentLevel, 0);
  assert.equal(game.canUpgradeProperty(0, 3), true);
});

test('an AI can buy and improve its Arcade street during one landing', t => {
  setup(t);
  roll(t, 1, 0, 1, 2);
  const { gameId } = store.getState();
  runSoloAiStep(gameId, 1, 'LANDED_ACTION');
  assert.equal(store.getState().properties[3].developmentLevel, 0);
  runSoloAiStep(gameId, 1, 'END_TURN');
  runSoloAiStep(gameId, 1, 'END_TURN');
  assert.equal(store.getState().properties[3].developmentLevel, 1);
  assert.equal(store.getState().players[1].money, 1390);
  assert.equal(store.getState().currentPlayerIndex, 2);
  assert.equal(events('upgrade').length, 1);
  assert.equal(events('upgrade')[0].actor?.name, 'Victoria');
});

test('Classic and legacy matches keep group building and doubled undeveloped rent', t => {
  setup(t, 'classic');
  own(1, 0, 3);
  const game = store.getState();
  assert.equal(game.calculateRent(1, 4), BOARD_SPACES[1].rent![0]);
  assert.equal(game.canBuildHouse(0, 1), false);
  own(3, 0);
  assert.equal(game.calculateRent(1, 4), BOARD_SPACES[1].rent![0] * 2);
  game.buildHouse(1);
  assert.equal(store.getState().properties[1].houses, 1);
  assert.equal(game.canBuildHouse(0, 1), false);
  assert.equal(game.canUpgradeProperty(0, 1), false);
  store.setState({ ruleset: undefined });
  assert.equal(game.canBuildHouse(0, 3), true);
  assert.equal(game.calculateRent(3, 4), BOARD_SPACES[3].rent![0] * 2);
});

test('Arcade repair cards assess House, Apartment and Hotel by configured repair units', t => {
  setup(t);
  own(1, 0, 0);
  own(3, 0, 1);
  own(6, 0, 2);
  own(8, 0, 3);
  store.setState({ chanceDeck: [CHANCE_CARDS.find(card => card.id === 'ch_10')!] });
  roll(t, 0, 4, 1, 2);
  store.getState().applyActiveCard();
  assert.equal(store.getState().players[0].money, 1300);
  assert.equal(events('card')[0].transfers?.[0].amount, 200);
});

test('four-player activity records AI and human committed card effects and exact rent in order', t => {
  setup(t);
  const bonus = COMMUNITY_CHEST_CARDS.find(card => card.id === 'cc_9')!;
  const dividend = CHANCE_CARDS.find(card => card.id === 'ch_6')!;
  store.setState({ chestDeck: [bonus], chanceDeck: [dividend] });
  roll(t, 0, 39, 1, 2);
  assert.equal(events('go')[0].amount, 200);
  assert.equal(events('card').length, 0);
  store.getState().applyActiveCard();
  const birthday = events('card')[0];
  assert.equal(birthday.card?.id, bonus.id);
  assert.equal(birthday.actor?.name, 'You');
  assert.deepEqual(birthday.transfers?.map(transfer => [transfer.from?.name, transfer.to?.name, transfer.amount]), [
    ['Victoria', 'You', 10], ['Arthur', 'You', 10], ['Elena', 'You', 10],
  ]);
  roll(t, 1, 4, 1, 2);
  runSoloAiStep(store.getState().gameId, 1, 'CARD_DRAWN');
  const aiCard = events('card')[1];
  assert.equal(aiCard.actor?.name, 'Victoria');
  assert.equal(aiCard.card?.id, dividend.id);
  assert.equal(aiCard.transfers?.[0].amount, 50);
  own(6, 1, 2);
  roll(t, 0, 3, 1, 2);
  const rent = events('rent');
  assert.equal(rent.length, 1);
  assert.equal(rent[0].spaceId, 6);
  assert.deepEqual([rent[0].actor?.name, rent[0].counterparty?.name, rent[0].amount], ['You', 'Victoria', BOARD_SPACES[6].rent![3]]);
  assert.ok(store.getState().activity.every((entry, index, all) => !index || entry.sequence > all[index - 1].sequence));
});

test('deferred rent produces one payment record after liquidation and actual settlement', t => {
  setup(t);
  own(6, 1, 1);
  own(3, 0, 0);
  player(0, { money: 4 });
  roll(t, 0, 3, 1, 2);
  const state = store.getState();
  const due = BOARD_SPACES[6].rent![1];
  assert.equal(state.pendingDebt?.amount, due);
  assert.equal(events('rent').length, 0);
  state.toggleMortgage(3, false);
  state.settlePendingDebt();
  state.settlePendingDebt();
  const rents = events('rent');
  assert.equal(rents.length, 1);
  assert.equal(rents[0].spaceId, 6);
  assert.equal(rents[0].amount, due);
  assert.equal(rents[0].transfers?.[0].fromBalance, 34 - due);
  assert.equal(rents[0].transfers?.[0].toBalance, 1500 + due);
});

test('a card with a deferred payer publishes exactly the committed participant transfers', t => {
  setup(t);
  own(3, 2, 0);
  player(2, { money: 3 });
  store.setState({ chestDeck: [COMMUNITY_CHEST_CARDS.find(card => card.id === 'cc_9')!] });
  roll(t, 0, 0, 1, 1);
  const game = store.getState();
  game.applyActiveCard();
  assert.equal(store.getState().pendingDebt?.debtorId, 2);
  assert.equal(events('card').length, 0);
  assert.equal(store.getState().players[0].money, 1510);
  game.toggleMortgage(3, false);
  game.settlePendingDebt();
  assert.equal(store.getState().players[0].money, 1530);
  assert.equal(events('card').length, 1);
  assert.deepEqual(events('card')[0].transfers?.map(transfer => [transfer.from?.name, transfer.amount, transfer.toBalance]),
    [['Victoria', 10, 1510], ['Arthur', 10, 1520], ['Elena', 10, 1530]]);
});

test('card-directed movement records its destination and the actual landmark GO award', t => {
  setup(t);
  player(0, { landmarkLevel: 1 });
  store.setState({ chanceDeck: [CHANCE_CARDS.find(card => card.id === 'ch_1')!] });
  roll(t, 0, 33, 1, 2);
  store.getState().applyActiveCard();
  assert.equal(events('card').length, 0);
  flush(t);
  assert.equal(store.getState().players[0].position, 0);
  assert.equal(store.getState().players[0].money, 1750);
  assert.equal(events('card')[0].spaceId, 0);
  assert.match(events('card')[0].details?.[0] ?? '', /moved to GO/);
  assert.match(events('card')[0].details?.[1] ?? '', /The Bank paid \$250 to You.*GO salary/);
  assert.deepEqual(events('card')[0].transfers, []);
  assert.deepEqual(events('go').map(entry => entry.transfers?.[0].amount), [250]);
  assert.deepEqual(store.getState().activity.flatMap(entry => entry.transfers?.map(payment => payment.amount) ?? []), [250]);
});

test('activity captures auction decisions, the one winning payment, and the awarded Land', t => {
  setup(t);
  roll(t, 0, 0, 1, 2);
  const game = store.getState();
  game.auctionCurrentProperty();
  game.placeAuctionBid(10, 0, 0);
  for (const id of [1, 2, 3]) game.passAuction(id);
  game.passAuction(3);
  assert.equal(store.getState().properties[3].ownerId, 0);
  assert.equal(store.getState().properties[3].developmentLevel, 0);
  assert.equal(store.getState().players[0].money, 1490);
  assert.deepEqual(events('auction').map(event => event.actor?.name), ['You', 'You', 'Victoria', 'Arthur', 'Elena', 'You']);
  assert.equal(events('auction').filter(event => event.transfers?.length).length, 1);
  assert.equal(events('purchase').length, 0);
});

test('activity identifies tax, Jail and the surviving winner', t => {
  setup(t);
  store.getState().startNewGame(configs.slice(0, 2), 'arcade');
  roll(t, 0, 1, 1, 2);
  assert.equal(events('tax')[0].amount, 200);
  roll(t, 0, 27, 1, 2);
  assert.equal(events('jail')[0].spaceId, 10);
  assert.equal(store.getState().players[0].inJail, true);
  store.setState({ turnPhase: 'PRE_ROLL' });
  store.getState().payJailBail();
  assert.equal(events('bail')[0].amount, 50);
  player(0, { money: 3 });
  store.setState({ turnPhase: 'DEBT_RESOLUTION', pendingDebt: { amount: 50, creditorId: 1, reason: 'Rent' } });
  const game = store.getState();
  game.declareBankruptcy();
  game.declareBankruptcy();
  assert.equal(events('bankruptcy').length, 1);
  assert.equal(events('victory').length, 1);
  assert.equal(events('victory')[0].actor?.name, 'Victoria');
});

test('a long Solo match retains the latest bounded activity and resets its identifiers', t => {
  setup(t);
  const initial = store.getState().activity[0];
  for (let turn = 0; turn < 57; turn++) {
    roll(t, turn % 4, 17, 1, 2);
    store.getState().endTurn();
  }
  const { activity, turnNumber } = store.getState();
  assert.equal(activity.length, MATCH_ACTIVITY_LIMIT);
  assert.equal(new Set(activity.map(event => event.id)).size, MATCH_ACTIVITY_LIMIT);
  assert.ok(activity[0].sequence > initial.sequence);
  assert.equal(activity.at(-1)?.turn, turnNumber);
  store.getState().startNewGame(configs, 'arcade');
  assert.equal(store.getState().activity.length, 1);
  assert.notEqual(store.getState().activity[0].matchId, initial.matchId);
});
