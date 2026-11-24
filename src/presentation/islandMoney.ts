import type { CashTransfer } from '../types/game';
import type { SceneState } from './SceneStore';
import { isGameReset } from './effectEvents';

export type IslandTransfer = Pick<CashTransfer, 'fromId' | 'toId' | 'amount'>;
type Flow = { in: number; out: number };
const flow = (amount = 0): Flow => ({ in: Math.max(amount, 0), out: Math.max(-amount, 0) });

/** Match or presentation snapshot installation, including a replaced Solo history. */
export function isIslandMoneyReset(previous: SceneState, next: SceneState) {
  if (isGameReset(previous, next)) return true;
  return next.committedEffects === undefined && previous.logs !== next.logs && previous.logs.length > 0 &&
    !next.logs.some(log => log.id === previous.logs[0].id);
}

/**
 * Balance writes and their Solo receipts can be consecutive store notifications.
 * Reconcile them together and retain the actual counterparties from confirmed receipts.
 */
export function collectIslandTransfers(states: readonly SceneState[]): IslandTransfer[] {
  const observed = new Map<number, Flow>();
  const receipts: IslandTransfer[] = [];
  const known = new Set(states[0]?.players.map(player => player.id));
  const record = (receipt: IslandTransfer) => {
    const { fromId, toId, amount } = receipt;
    if (fromId !== toId && Number.isFinite(amount) && amount > 0 &&
      (fromId === null || known.has(fromId)) && (toId === null || known.has(toId))) receipts.push({ fromId, toId, amount });
  };
  for (let i = 1; i < states.length; i++) {
    const previous = states[i - 1], next = states[i];
    if (isIslandMoneyReset(previous, next)) return [];
    if (previous.players !== next.players) for (const player of next.players) {
      const before = previous.players.find(candidate => candidate.id === player.id);
      const amount = player.money - (before?.money ?? player.money);
      if (!known.has(player.id) || !Number.isFinite(amount) || !amount) continue;
      const total = observed.get(player.id) ?? flow();
      const change = flow(amount);
      total.in += change.in; total.out += change.out;
      observed.set(player.id, total);
    }
    if (next.committedEffects !== undefined) {
      if (next.committedEffects === previous.committedEffects) continue;
      for (const entry of next.committedEffects) if (entry.cash && !previous.committedEffects?.includes(entry)) record(entry.cash);
    } else if (previous.logs !== next.logs) {
      const latest = next.logs.findIndex(log => log.id === previous.logs[0]?.id);
      for (const entry of next.logs.slice(0, latest < 0 ? undefined : latest).reverse()) entry.transfers?.forEach(record);
    }
  }

  const totals = new Map<number, Flow>();
  for (const { fromId, toId, amount } of receipts) {
    for (const [id, side] of [[fromId, 'out'], [toId, 'in']] as const) {
      if (id === null) continue;
      const total = totals.get(id) ?? flow();
      total[side] += amount;
      totals.set(id, total);
    }
  }
  // A single commit can offset gross changes, as with a two-way trade or a GO salary followed by tax.
  for (const [id, total] of totals) {
    const change = observed.get(id) ?? flow();
    if (total.in - total.out !== change.in - change.out) continue;
    observed.set(id, { in: Math.max(change.in, total.in), out: Math.max(change.out, total.out) });
  }

  const transfers: IslandTransfer[] = [];
  for (const { fromId, toId, amount } of receipts) {
    const from = fromId === null ? undefined : observed.get(fromId);
    const to = toId === null ? undefined : observed.get(toId);
    // A bankruptcy receipt can include liquidation proceeds on top of the debtor's actual cash.
    const settled = Math.min(amount, fromId === null ? amount : from?.out ?? 0, toId === null ? amount : to?.in ?? 0);
    if (!settled) continue;
    transfers.push({ fromId, toId, amount: settled });
    if (from) from.out -= settled;
    if (to) to.in -= settled;
  }
  // Fall back to actual balance changes when the presenter has no matching receipt.
  for (const [id, change] of observed) {
    if (change.out) transfers.push({ fromId: id, toId: null, amount: change.out });
    if (change.in) transfers.push({ fromId: null, toId: id, amount: change.in });
  }
  return transfers;
}
