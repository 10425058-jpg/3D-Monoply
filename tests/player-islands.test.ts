import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { coinPieces, coinTier, COIN_VALUES, treasuryStacks } from '../src/components/3d/royalCoinValues';
import { coinFlightPath, islandFlight, liveIslandFlights, MAX_ISLAND_TRANSFERS } from '../src/components/3d/islandMoneyMotion';
import { makeIslandChain, makePlayerIsland } from '../src/components/3d/playerIslandGeometry';
import { ISLAND_BOARD_DOCK, ISLAND_DISTANCE, ISLAND_DOCK, ISLAND_RADIUS, ISLAND_SCALE,
  PLAYER_ISLAND_OVERVIEW_POINTS, PLAYER_ISLANDS, islandPosition } from '../src/components/3d/playerIslandLayout';
import { overviewCamera } from '../src/components/3d/overviewCamera';
import { getSpaceTransform } from '../src/data/boardData';
import { CHANCE_CARDS } from '../src/data/cardsData';
import { useGameStore as store } from '../src/store/useGameStore';
import { collectIslandTransfers, type IslandTransfer } from '../src/presentation/islandMoney';
import type { SceneState } from '../src/presentation/SceneStore';

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

test('the mint decomposes the exact balance while keeping visible stacks bounded', () => {
  const piles = treasuryStacks(1875).filter(stack => stack.count > 0);
  assert.deepEqual(piles.map(pile => [pile.value, pile.count]), [[1000, 1], [500, 1], [100, 3], [50, 1], [20, 1], [5, 1]]);
  for (const balance of [0, 1, 99, 1500, 1875, 576_644, 2_147_483_647]) {
    const stacks = treasuryStacks(balance);
    assert.equal(stacks.reduce((sum, pile) => sum + pile.count * pile.value, 0), balance);
    assert.ok(stacks.every(stack => stack.visible <= 5));
  }
});

test('direct coin routes clear the board and expired or excess flights are removed', () => {
  const point = new Vector3();
  for (let from = 0; from < 4; from++) for (let to = 0; to < 4; to++) {
    if (from === to) continue;
    for (const value of COIN_VALUES) {
      const sample = coinFlightPath(from, to, value, 0);
      for (let i = 0; i <= 100; i++) {
        sample(i / 100, point);
        assert.ok(Math.max(Math.abs(point.x), Math.abs(point.z)) > 13.2, `${from} to ${to}, ${value} at ${i}`);
      }
    }
  }
  const transfer = { fromId: 1, toId: 3, amount: 1500 };
  const assets = Array.from({ length: 24 }, (_, id) => islandFlight(transfer, id, 1000, false, false)!);
  assert.deepEqual(assets[0].pieces, [1000, 500]);
  assert.ok(assets[0].arrivesAt > assets[0].startedAt);
  assert.deepEqual(liveIslandFlights(assets, 1100).map(item => item.id), assets.slice(-MAX_ISLAND_TRANSFERS).map(item => item.id));
  assert.deepEqual(liveIslandFlights(assets, 6000), []);
  assert.equal(islandFlight(transfer, 1, 1000, true, false)?.arrivesAt, 1000);
  assert.deepEqual(islandFlight(transfer, 1, 1000, true, false)?.pieces, []);
});

test('refined islands keep the old shoreline and five links around a deeper slate base', () => {
  for (const { seat } of PLAYER_ISLANDS) {
    const assets = makePlayerIsland(seat);
    assets.painted.computeBoundingBox();
    const box = assets.painted.boundingBox!;
    const size = box.getSize(new Vector3());
    assert.ok(Math.abs(size.x * ISLAND_SCALE - 7.507152929306031) < .008);
    assert.ok(Math.abs(size.z * ISLAND_SCALE - 7.501699275970459) < .008);
    assert.ok(-box.min.y / 2.54 >= 1.4 && -box.min.y / 2.54 <= 1.6);
    Object.values(assets).forEach(mesh => mesh.dispose());
  }
  const chain = makeIslandChain();
  assert.equal(chain.matrices.length, 5);
  assert.ok(chain.link.parameters.tube / .052 >= 1.15 && chain.link.parameters.tube / .052 <= 1.20);
  [chain.link, chain.mounts, chain.jewels].forEach(mesh => mesh.dispose());
});

test('island effects observe real Solo actions without double-counting transfer logs', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const states: SceneState[] = [store.getState()];
  const unsubscribe = store.subscribe(next => states.push(next));
  t.after(unsubscribe);
  store.getState().startNewGame([0, 1, 2, 3].map(id => ({ name: `Player ${id}`, isAI: false,
    token: 'cat', color: '#eab356' })));
  const expect = (...pairs: [IslandTransfer['fromId'], IslandTransfer['toId'], number][]) => {
    assert.deepEqual(collectIslandTransfers(states), pairs.map(([fromId, toId, amount]) => ({ fromId, toId, amount })));
    states.splice(0, states.length - 1);
  };
  expect();
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
  expect([null, 0, 200]);
  store.getState().buyCurrentProperty();
  expect([0, null, 60]);
  store.getState().toggleMortgage(1);
  expect([null, 0, 30]);
  store.getState().toggleMortgage(1);
  expect([0, null, 33]);

  const card = CHANCE_CARDS.find(candidate => candidate.id === 'ch_6')!;
  store.setState({ activeCard: card, turnPhase: 'CARD_DRAWN' });
  store.getState().applyActiveCard();
  expect([null, 0, 50]);

  position(1);
  roll();
  expect([0, null, 200]);

  store.setState({ turnPhase: 'PRE_ROLL' });
  store.getState().proposeTrade({ proposalId: 'island-trade', fromPlayerId: 0, toPlayerId: 1,
    offerCash: 20, requestCash: 5, offerProperties: [], requestProperties: [] });
  expect();
  assert.equal(store.getState().acceptTrade(1).accepted, true);
  expect([0, 1, 20], [1, 0, 5]);

  position(0);
  roll();
  store.getState().auctionCurrentProperty();
  store.getState().placeAuctionBid(10);
  for (let i = 0; i < 4; i++) store.getState().passAuction();
  expect([0, null, 10]);

  position(0);
  store.setState(state => ({ properties: { ...state.properties,
    3: { ...state.properties[3], ownerId: 1 } } }));
  roll();
  expect([0, 1, 4]);

  store.setState({ turnPhase: 'DEBT_RESOLUTION', pendingDebt: { amount: 3000, creditorId: 1, reason: 'Rent' } });
  const cash = store.getState().players[0].money;
  store.getState().declareBankruptcy();
  expect([0, 1, cash]);

  store.getState().startNewGame(store.getState().players);
  expect();
});

test('restoring a saved island wallet and its history does not replay earlier payments', () => {
  const live = store.getState();
  const restored = { ...live, players: live.players.map(player => ({ ...player, money: 25 })),
    logs: [{ id: 'persisted-history', timestamp: '', type: 'info' as const, message: '' }] };
  assert.deepEqual(collectIslandTransfers([live, restored]), []);
  assert.deepEqual(collectIslandTransfers([restored, restored]), []);
});
