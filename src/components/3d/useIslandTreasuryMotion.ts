import { useEffect, useState } from 'react';
import type { SceneState } from '../../presentation/SceneStore';
import { useSceneStore } from '../../presentation/SceneStore';
import { collectIslandTransfers, isIslandMoneyReset } from '../../presentation/islandMoney';
import { islandFlight, liveIslandFlights, type IslandFlight } from './islandMoneyMotion';
import { PLAYER_ISLANDS } from './playerIslandLayout';

export type TreasuryBalance = { value: number; animate: boolean };
type Snapshot = { flights: IslandFlight[]; balances: ReadonlyMap<number, TreasuryBalance> };
const currentBalances = (scene: SceneState) => new Map(scene.players.map(player => [player.id, { value: player.money, animate: false }]));

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
      states = []; flights = []; pending.clear(); balances = currentBalances(store.getState()); balanceChanged = true; publish();
    };

    const flush = () => {
      const batch = states;
      states = [];
      if (disposed || document.hidden || batch.length < 2) return;
      const now = performance.now();
      const additions = collectIslandTransfers(batch).flatMap(transfer => {
        const flight = islandFlight(transfer, ++sequence, now, reduced, low);
        return flight ? [flight] : [];
      });
      const latest = batch[batch.length - 1];
      for (const { seat } of PLAYER_ISLANDS) {
        const next = latest.players.find(player => player.id === seat);
        if (!next) { balanceChanged = balances.delete(seat) || balanceChanged; pending.delete(seat); continue; }
        const previous = pending.get(seat)?.value ?? balances.get(seat)?.value;
        if (previous === next.money) continue;
        const due = additions.reduce((when, flight) => flight.toId === seat ? Math.max(when, flight.arrivesAt) : when, now);
        pending.set(seat, { at: due, value: next.money });
      }
      flights = [...flights, ...additions];
      publish();
    };

    const unsubscribe = store.subscribe((next, previous) => {
      if (isIslandMoneyReset(previous, next) || document.hidden) { clear(); return; }
      const balancesChanged = next.players.length !== previous.players.length || next.players.some(player =>
        previous.players.find(before => before.id === player.id)?.money !== player.money);
      const receiptAdded = next.committedEffects !== undefined
        ? next.committedEffects !== previous.committedEffects && next.committedEffects.some(effect => !!effect.cash)
        : next.logs !== previous.logs && !!next.logs[0]?.transfers?.length;
      if (!balancesChanged && !receiptAdded) return;
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
