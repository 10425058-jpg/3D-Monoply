import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { coinPieces, coinTier, COIN_VALUES } from '../src/components/3d/royalCoinValues';
import { ISLAND_BOARD_DOCK, ISLAND_DISTANCE, ISLAND_DOCK, ISLAND_RADIUS, ISLAND_SCALE,
  PLAYER_ISLAND_OVERVIEW_POINTS, PLAYER_ISLANDS, islandPosition } from '../src/components/3d/playerIslandLayout';
import { overviewCamera } from '../src/components/3d/overviewCamera';
import { getSpaceTransform } from '../src/data/boardData';
import { CHANCE_CARDS } from '../src/data/cardsData';
import { useGameStore as store } from '../src/store/useGameStore';
import { collectIslandMoneyChanges } from '../src/presentation/islandMoney';

test('the four board sides use fixed royal statues and do not overlap the board in overview', () => {
  assert.deepEqual(PLAYER_ISLANDS.map(site => [site.seat, site.edge, site.statue]), [
    [0, 'east', 'RoyalGriffin'], [1, 'north', 'RoyalUnicorn'], [2, 'west', 'RoyalCarriage'], [3, 'south', 'RoyalPegasus'],
  ]);
  assert.ok(ISLAND_SCALE >= 1.2 && ISLAND_SCALE <= 1.3);
  assert.ok(2 * ISLAND_RADIUS >= .25 * 25.4 && 2 * ISLAND_RADIUS <= .3 * 25.4);
  assert.ok(ISLAND_DISTANCE - ISLAND_RADIUS > 25.4 / 2);
  assert.ok(ISLAND_DISTANCE - ISLAND_DOCK - ISLAND_BOARD_DOCK < 2);
  assert.ok(PLAYER_ISLANDS.every(site => Math.hypot(islandPosition(site)[0], islandPosition(site)[2]) === ISLAND_DISTANCE));
  for (const [width, height] of [[1440, 900], [1366, 768], [768, 1024], [390, 844], [360, 640]]) {
    for (const top of [false, true]) {
      const fit = overviewCamera(width, height, top, PLAYER_ISLAND_OVERVIEW_POINTS);
      const camera = new PerspectiveCamera(fit.fov, width / height, .5, 400);
      camera.position.fromArray(fit.position);
      camera.lookAt(new Vector3().fromArray(fit.target));
      camera.setViewOffset(width, height, ...fit.offset, width, height);
      camera.updateMatrixWorld();
      const project = (point: [number, number, number]) => {
        const { x, y } = new Vector3().fromArray(point).project(camera);
        return [(x + 1) * width / 2, (1 - y) * height / 2];
      };
      for (const point of PLAYER_ISLAND_OVERVIEW_POINTS) {
        const [x, y] = project(point);
        assert.ok(x >= fit.insets.left && x <= width - fit.insets.right && y >= fit.insets.top && y <= height - fit.insets.bottom);
      }
      for (let i = 0; i < 40; i++) {
        const [x, y] = project(getSpaceTransform(i).position);
        assert.ok(x >= fit.insets.left && x <= width - fit.insets.right && y >= fit.insets.top && y <= height - fit.insets.bottom);
      }
    }
  }
});

test('coins use all eight denominations and cap large transfers', () => {
  assert.deepEqual(COIN_VALUES.map(coinTier), ['copper', 'copper', 'copper', 'silver', 'silver', 'silver', 'gold', 'gold']);
  assert.deepEqual([10, 50, -500, 1500].map(amount => coinPieces(amount)), [[10], [50], [500], [1000, 500]]);
  assert.deepEqual(coinPieces(386), [100, 100, 100, 50, 20, 10, 5]);
  assert.deepEqual(coinPieces(90_000, 4), [1000, 1000, 1000, 1000]);
});

test('island effects observe real Solo actions without double-counting transfer logs', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const changes: ReturnType<typeof collectIslandMoneyChanges> = [];
  const unsubscribe = store.subscribe((next, previous) => changes.push(...collectIslandMoneyChanges(previous, next)));
  t.after(unsubscribe);
  store.getState().startNewGame([0, 1, 2, 3].map(id => ({ name: `Player ${id}`, isAI: false,
    token: 'cat', color: '#eab356' })));
  assert.deepEqual(changes, [], 'starting balances do not animate');

  const expect = (...pairs: [number, number][]) => {
    assert.deepEqual(changes.splice(0), pairs.map(([playerId, amount]) => ({ playerId, amount })));
  };
  const position = (tile: number) => store.setState(state => ({ turnPhase: 'PRE_ROLL',
    players: state.players.map(p => p.id === 0 ? { ...p, position: tile } : p) }));
  const roll = () => {
    const faces = [.03, .2];
    const random = t.mock.method(Math, 'random', () => faces.shift() ?? .4);
    store.getState().rollDice();
    for (let i = 0; i < 60 && ['ROLLING', 'MOVING'].includes(store.getState().turnPhase); i++) t.mock.timers.tick(200);
    random.mock.restore();
  };

  position(38);
  roll();
  expect([0, 200]);
  store.getState().buyCurrentProperty();
  expect([0, -60]);
  store.getState().toggleMortgage(1);
  expect([0, 30]);
  store.getState().toggleMortgage(1);
  expect([0, -33]);

  const card = CHANCE_CARDS.find(candidate => candidate.id === 'ch_6')!;
  store.setState({ activeCard: card, turnPhase: 'CARD_DRAWN' });
  store.getState().applyActiveCard();
  expect([0, 50]);

  position(1);
  roll();
  expect([0, -200]);

  store.setState({ turnPhase: 'PRE_ROLL' });
  store.getState().proposeTrade({ proposalId: 'island-trade', fromPlayerId: 0, toPlayerId: 1,
    offerCash: 20, requestCash: 0, offerProperties: [], requestProperties: [] });
  expect();
  assert.equal(store.getState().acceptTrade(1).accepted, true);
  expect([0, -20], [1, 20]);

  position(0);
  roll();
  store.getState().auctionCurrentProperty();
  store.getState().placeAuctionBid(10);
  for (let i = 0; i < 4; i++) store.getState().passAuction();
  expect([0, -10]);

  position(0);
  store.setState(state => ({ properties: { ...state.properties,
    3: { ...state.properties[3], ownerId: 1 } } }));
  roll();
  expect([0, -4], [1, 4]);

  store.setState({ turnPhase: 'DEBT_RESOLUTION', pendingDebt: { amount: 3000, creditorId: 1, reason: 'Rent' } });
  const cash = store.getState().players[0].money;
  store.getState().declareBankruptcy();
  expect([0, -cash], [1, cash]);

  store.getState().startNewGame(store.getState().players);
  expect();
});
