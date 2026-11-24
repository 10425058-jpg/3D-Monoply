import { useEffect, useState } from 'react';
import type { SceneState } from '../../presentation/SceneStore';
import { useSceneStore } from '../../presentation/SceneStore';
import { collectIslandTransfers, isIslandMoneyReset, type IslandTransfer } from '../../presentation/islandMoney';
import { islandFlight, liveIslandFlights, MAX_ISLAND_TRANSFERS, type IslandFlight } from './islandMoneyMotion';
import { PLAYER_ISLANDS } from './playerIslandLayout';

export type TreasuryBalance = { value: number; animate: boolean };
type Snapshot = { flights: IslandFlight[]; balances: ReadonlyMap<number, TreasuryBalance> };
const currentBalances = (scene: SceneState) => new Map(scene.players.map(player => [player.id, { value: player.money, animate: false }]));
const cardCoversBoard = (scene: SceneState) => scene.turnPhase === 'CARD_DRAWN' && !!scene.activeCard &&
  !scene.players[scene.currentPlayerIndex]?.isAI;
const waitForBoard = (scene: SceneState) => scene.turnPhase === 'MOVING' || cardCoversBoard(scene);
const CARD_EXIT_MS = 300;

/** Schedule presentation only. Every target is read from the latest authoritative scene snapshot. */
export function useIslandTreasuryMotion(reduced: boolean, low: boolean) {
  const store = useSceneStore();
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ flights: [], balances: currentBalances(store.getState()) }));
  useEffect(() => {
    let flights: IslandFlight[] = [];
    let balances = currentBalances(store.getState());
    let publishedBalances = new Map(balances);
    let balanceChanged = false;
    const pending = new Map<number, { at: number; value: number }>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let states: SceneState[] = [];
    let deferred: IslandTransfer[] = [];
    let cardExitAt = 0;
    let sequence = 0;
    let disposed = false;

    const publish = () => {
      clearTimeout(timer);
      const now = performance.now();
      flights = liveIslandFlights(flights, now);
      for (const [seat, target] of pending) if (target.at <= now) {
        balances.set(seat, { value: target.value, animate: !reduced });
        balanceChanged = true;
        pending.delete(seat);
      }
      if (balanceChanged) { publishedBalances = new Map(balances); balanceChanged = false; }
      setSnapshot({ flights, balances: publishedBalances });
      const next = Math.min(...flights.map(flight => flight.expiresAt), ...Array.from(pending.values(), target => target.at));
      if (Number.isFinite(next)) timer = setTimeout(publish, Math.max(8, next - now));
    };

    const clear = () => {
      states = []; flights = []; deferred = []; cardExitAt = 0;
      pending.clear(); balances = currentBalances(store.getState()); balanceChanged = true; publish();
    };

    const flush = () => {
      const batch = states;
      states = [];
      if (disposed || document.hidden || batch.length < 2) return;
      const latest = store.getState();
      const transfers = collectIslandTransfers(batch);
      if (!reduced && waitForBoard(latest)) {
        // GO salary is confirmed on the movement step, before an interactive card can cover the island.
        deferred = [...deferred, ...transfers].slice(-MAX_ISLAND_TRANSFERS);
        return;
      }
      const start = Math.max(performance.now(), cardExitAt);
      const additions = [...deferred, ...transfers].flatMap(transfer => {
        const flight = islandFlight(transfer, ++sequence, start, reduced, low);
        return flight ? [flight] : [];
      });
      deferred = [];
      for (const { seat } of PLAYER_ISLANDS) {
        const next = latest.players.find(player => player.id === seat);
        if (!next) { balanceChanged = balances.delete(seat) || balanceChanged; pending.delete(seat); continue; }
        const previous = pending.get(seat)?.value ?? balances.get(seat)?.value;
        if (previous === next.money) continue;
        const due = additions.reduce((when, flight) => flight.toId === seat ? Math.max(when, flight.arrivesAt) : when, start);
        pending.set(seat, { at: due, value: next.money });
      }
      flights = [...flights, ...additions];
      publish();
    };

    const unsubscribe = store.subscribe((next, previous) => {
      if (isIslandMoneyReset(previous, next) || document.hidden) { clear(); return; }
      if (!reduced && cardCoversBoard(previous) && !cardCoversBoard(next)) cardExitAt = performance.now() + CARD_EXIT_MS;
      const releaseDeferred = deferred.length > 0 && waitForBoard(previous) && !waitForBoard(next);
      const balancesChanged = next.players.length !== previous.players.length || next.players.some(player =>
        previous.players.find(before => before.id === player.id)?.money !== player.money);
      const receiptAdded = next.committedEffects !== undefined
        ? next.committedEffects !== previous.committedEffects && next.committedEffects.some(effect => !!effect.cash)
        : next.logs !== previous.logs && !!next.logs[0]?.transfers?.length;
      if (!balancesChanged && !receiptAdded && !releaseDeferred) return;
      if (states.length === 0) { states.push(previous); queueMicrotask(flush); }
      states.push(next);
    });
    const visibility = () => { if (document.hidden) clear(); };
    document.addEventListener('visibilitychange', visibility);
    clear();
    return () => {
      disposed = true; clearTimeout(timer); unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [store, reduced, low]);
  return snapshot;
}
