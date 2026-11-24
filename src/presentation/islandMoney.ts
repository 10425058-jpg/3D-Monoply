import { isGameReset } from './effectEvents';
import type { SceneState } from './SceneStore';

export interface IslandMoneyChange {
  playerId: number;
  amount: number;
}

/** Use the scene's real balances, with reconciled receipts for multi-part Online commits. */
export function collectIslandMoneyChanges(previous: SceneState, next: SceneState): IslandMoneyChange[] {
  if (previous.players === next.players || isGameReset(previous, next)) return [];
  const receiptTotals = new Map<number, { incoming: number; outgoing: number }>();
  if (next.committedEffects !== previous.committedEffects) {
    for (const effect of next.committedEffects ?? []) {
      const cash = effect.cash;
      if (!cash || !Number.isFinite(cash.amount) || cash.amount <= 0 || cash.fromId === cash.toId) continue;
      for (const [playerId, side] of [[cash.fromId, 'outgoing'], [cash.toId, 'incoming']] as const) {
        if (playerId === null) continue;
        const totals = receiptTotals.get(playerId) ?? { incoming: 0, outgoing: 0 };
        totals[side] += cash.amount;
        receiptTotals.set(playerId, totals);
      }
    }
  }

  const changes: IslandMoneyChange[] = [];
  for (const player of next.players) {
    const before = previous.players.find(candidate => candidate.id === player.id);
    if (!before) continue;
    const amount = player.money - before.money;
    const receipt = receiptTotals.get(player.id);
    if (receipt && receipt.incoming - receipt.outgoing === amount) {
      if (receipt.incoming) changes.push({ playerId: player.id, amount: receipt.incoming });
      if (receipt.outgoing) changes.push({ playerId: player.id, amount: -receipt.outgoing });
    } else if (amount && Number.isFinite(amount)) {
      changes.push({ playerId: player.id, amount });
    }
  }
  return changes;
}
