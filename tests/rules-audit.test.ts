import {test} from 'node:test';
import assert from 'node:assert/strict';
import {useGameStore as store} from '../src/store/useGameStore';
import {CHANCE_CARDS, COMMUNITY_CHEST_CARDS} from '../src/data/cardsData';
import type {TradeOffer, TurnPhase} from '../src/types/game';

function setup(t: any) {
  t.mock.timers.enable({apis: ['setTimeout']});
  store.getState().startNewGame(Array.from({length: 3}, (_, id) => ({
    name: `Player ${id}`, isAI: false, token: 'cat' as const, color: '#4484dc',
  })));
}

function setPlayer(id: number, patch: object) {
  store.setState(state => ({players: state.players.map(player => player.id === id ? {...player, ...patch} : player)}));
}

function own(spaceId: number, ownerId: number) {
  store.setState(state => ({properties: {
    ...state.properties, [spaceId]: {spaceId, ownerId, houses: 0, isMortgaged: false},
  }}));
}

function offer(fromPlayerId = 0, toPlayerId = 1): TradeOffer {
  return {proposalId: 'debt-rescue', fromPlayerId, toPlayerId, offerCash: 0,
    requestCash: 270, offerProperties: [39], requestProperties: []};
}

test('debt trade requires consent, transfers once, then settles the original obligation', t => {
  setup(t);
  setPlayer(0, {money: 0});
  own(39, 0);
  store.setState({turnPhase: 'DEBT_RESOLUTION', pendingDebt: {amount: 270, creditorId: 1, reason: 'Rent'}});
  store.getState().proposeTrade(offer());
  assert.equal(store.getState().players[0].money, 0);
  assert.equal(store.getState().properties[39].ownerId, 0);
  assert.equal(store.getState().acceptTrade(2).accepted, false);
  assert.equal(store.getState().acceptTrade(1).accepted, true);
  assert.equal(store.getState().acceptTrade(1).accepted, false);
  assert.equal(store.getState().proposeTrade(offer()).accepted, false);
  assert.equal(store.getState().players[0].money, 270);
  assert.equal(store.getState().players[1].money, 1230);
  assert.equal(store.getState().properties[39].ownerId, 1);
  store.getState().settlePendingDebt();
  store.getState().settlePendingDebt();
  assert.deepEqual(store.getState().players.map(player => player.money), [0, 1500, 1500]);
  assert.equal(store.getState().pendingDebt, null);
  assert.equal(store.getState().turnPhase, 'END_TURN');
  assert.equal(store.getState().players[0].isBankrupt, false);
});

test('rejected and invalid debt trades preserve cash, deeds and pending payment', t => {
  setup(t);
  setPlayer(0, {money: 0});
  own(39, 0);
  store.setState({turnPhase: 'DEBT_RESOLUTION', pendingDebt: {amount: 270, creditorId: 1, reason: 'Rent'}});
  const before = structuredClone({players: store.getState().players, properties: store.getState().properties, debt: store.getState().pendingDebt});
  store.getState().proposeTrade(offer());
  store.getState().rejectTrade();
  assert.equal(store.getState().proposeTrade({...offer(), requestCash: 1501}).accepted, false);
  assert.equal(store.getState().proposeTrade({...offer(), offerProperties: [37]}).accepted, false);
  assert.deepEqual({players: store.getState().players, properties: store.getState().properties, debt: store.getState().pendingDebt}, before);
  store.getState().declareBankruptcy();
  assert.equal(store.getState().players[0].isBankrupt, true);
});

test('non-active birthday debtor trades under its own identity and resumes remaining payments', t => {
  setup(t);
  setPlayer(1, {money: 0});
  own(39, 1);
  store.setState({activeCard: COMMUNITY_CHEST_CARDS.find(card => card.id === 'cc_9')!, turnPhase: 'CARD_DRAWN', doublesCount: 1});
  store.getState().applyActiveCard();
  assert.equal(store.getState().pendingDebt?.debtorId, 1);
  assert.equal(store.getState().proposeTrade({...offer(0, 2), requestCash: 10}).accepted, false);
  store.getState().proposeTrade({...offer(1, 2), requestCash: 10});
  assert.equal(store.getState().acceptTrade(2).accepted, true);
  store.getState().settlePendingDebt();
  assert.deepEqual(store.getState().players.map(player => player.money), [1520, 0, 1480]);
  assert.equal(store.getState().properties[39].ownerId, 2);
  assert.equal(store.getState().pendingDebt, null);
  assert.equal(store.getState().currentPlayerIndex, 0);
  store.getState().endTurn();
  assert.equal(store.getState().currentPlayerIndex, 0);
  assert.equal(store.getState().turnPhase, 'PRE_ROLL');
});

test('trade attempts during unresolved actions and terminal phases cannot mutate the economy', t => {
  setup(t);
  own(39, 0);
  for (const turnPhase of ['SETUP', 'ROLLING', 'MOVING', 'CARD_PENDING', 'CARD_DRAWN', 'AUCTION', 'GAME_OVER'] as TurnPhase[]) {
    store.setState({turnPhase});
    const before = {players: store.getState().players, properties: store.getState().properties};
    assert.equal(store.getState().proposeTrade(offer()).accepted, false);
    assert.deepEqual({players: store.getState().players, properties: store.getState().properties}, before);
  }
});

test('auction accepts a $10 opening and $11 exact-cash raise, rejects stale bids and settles once', t => {
  setup(t);
  setPlayer(0, {position: 3});
  setPlayer(1, {money: 11});
  store.setState({turnPhase: 'LANDED_ACTION'});
  store.getState().auctionCurrentProperty();
  store.getState().placeAuctionBid(1, 0);
  assert.equal(store.getState().auction?.currentBid, 0);
  store.getState().placeAuctionBid(10, 0);
  store.getState().placeAuctionBid(1, 0);
  assert.equal(store.getState().auction?.currentBid, 10);
  store.getState().placeAuctionBid(2, 1);
  assert.equal(store.getState().auction?.currentBid, 10);
  store.getState().placeAuctionBid(1, 1, 9);
  assert.equal(store.getState().auction?.currentBid, 10, 'stale displayed price is rejected');
  store.getState().placeAuctionBid(1, 1, 10);
  assert.equal(store.getState().auction?.currentBid, 11);
  store.getState().placeAuctionBid(1, 1);
  assert.equal(store.getState().auction?.currentBid, 11);
  store.getState().passAuction(2);
  store.getState().passAuction(0);
  const after = {players: store.getState().players, properties: store.getState().properties};
  assert.equal(after.players[1].money, 0);
  assert.equal(after.properties[3].ownerId, 1);
  store.getState().passAuction(0);
  store.getState().placeAuctionBid(1, 1);
  assert.deepEqual({players: store.getState().players, properties: store.getState().properties}, after);
});

test('landmark upgrade charges $400 once for a captured level and raises the next GO payment to $250', t => {
  setup(t);
  store.getState().upgradeLandmark(0, 0);
  store.getState().upgradeLandmark(0, 0);
  assert.equal(store.getState().players[0].landmarkLevel, 1);
  assert.equal(store.getState().players[0].money, 1100);
  setPlayer(0, {position: 38});
  t.mock.method(Math, 'random', () => 0);
  store.getState().rollDice();
  for (let step = 0; step < 10; step++) t.mock.timers.tick(200);
  assert.equal(store.getState().players[0].position, 0);
  assert.equal(store.getState().players[0].money, 1350);
});

test('landmark costs increase to level five and maximum level rejects further purchases', t => {
  setup(t);
  setPlayer(0, {money: 6000});
  for (const [level, cost] of [400, 750, 1100, 1450, 1800].entries()) {
    const before = store.getState().players[0].money;
    assert.equal(store.getState().landmarkUpgradeCost(0), cost);
    store.getState().upgradeLandmark(level, 0);
    assert.equal(store.getState().players[0].landmarkLevel, level + 1);
    assert.equal(store.getState().players[0].money, before - cost);
  }
  store.getState().upgradeLandmark(5, 0);
  assert.equal(store.getState().players[0].landmarkLevel, 5);
  assert.equal(store.getState().players[0].money, 500);
});

test('landmark action rejects insufficient cash, stale actor, pending decisions and invalid phases', t => {
  setup(t);
  setPlayer(0, {money: 399});
  store.getState().upgradeLandmark(0, 0);
  assert.equal(store.getState().players[0].money, 399);
  setPlayer(0, {money: 1500});
  store.getState().upgradeLandmark(0, 1);
  assert.equal(store.getState().players[0].landmarkLevel, 0);
  for (const turnPhase of ['SETUP', 'ROLLING', 'MOVING', 'CARD_PENDING', 'CARD_DRAWN', 'DEBT_RESOLUTION', 'LANDED_ACTION', 'AUCTION', 'GAME_OVER'] as TurnPhase[]) {
    store.setState({turnPhase});
    store.getState().upgradeLandmark(0, 0);
    assert.equal(store.getState().players[0].money, 1500);
  }
  store.setState({turnPhase: 'PRE_ROLL', pendingTrade: offer()});
  store.getState().upgradeLandmark(0, 0);
  assert.equal(store.getState().players[0].landmarkLevel, 0);
  store.setState({pendingTrade: null, railroadRaid: {attackerId: 0, mode: 'choose', vaultRewards: [150, 300, 550]}});
  store.getState().upgradeLandmark(0, 0);
  assert.equal(store.getState().players[0].landmarkLevel, 0);
});

test('Nearest Utility instructions explain the exceptional rent and which dice to use', () => {
  const card = CHANCE_CARDS.find(card => card.id === 'ch_4')!;
  assert.match(card.description, /10 times/i);
  assert.match(card.description, /same two dice.*land on Chance/i);
  assert.match(card.description, /Do not roll again/);
  assert.match(card.description, /unowned.*buy/i);
  assert.match(card.description, /not mortgaged/);
});

for (const [ownerId, isMortgaged] of [[null, false], [0, false], [1, false], [1, true]] as const) {
  test(`Solo Nearest Utility uses existing dice: owner ${ownerId ?? 'Bank'}, mortgaged ${isMortgaged}`, t => {
    setup(t);
    if (ownerId !== null) own(12, ownerId);
    if (isMortgaged) store.setState(state => ({properties: {...state.properties, 12: {...state.properties[12], isMortgaged}}}));
    setPlayer(0, {position: 7});
    store.setState({dice: [3, 4], activeCard: CHANCE_CARDS.find(card => card.id === 'ch_4')!, turnPhase: 'CARD_DRAWN'});
    // If movement incorrectly rerolls, these faces would change both dice and rent.
    t.mock.method(Math, 'random', () => 0.99);
    store.getState().applyActiveCard();
    for (let step = 0; step < 10; step++) t.mock.timers.tick(200);
    assert.equal(store.getState().players[0].position, 12);
    assert.deepEqual(store.getState().dice, [3, 4]);
    const rent = ownerId === 1 && !isMortgaged ? 70 : 0;
    assert.equal(store.getState().turnPhase, rent ? 'DEBT_RESOLUTION' : ownerId === null ? 'LANDED_ACTION' : 'END_TURN');
    assert.deepEqual(store.getState().players.map(player => player.money), [1500, 1500, 1500]);
    store.getState().settlePendingDebt();
    assert.deepEqual(store.getState().players.map(player => player.money), [1500 - rent, 1500 + rent, 1500]);
    store.getState().applyActiveCard();
    assert.equal(store.getState().players[0].money, 1500 - rent);
  });
}
