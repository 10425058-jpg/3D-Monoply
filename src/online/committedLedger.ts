import type { CashTransfer } from '../types/game';
import type { CommittedEvent, PresentationLabels } from './committedPresentation';
import type { EventPayloads } from './types';

type Side = { id: string; balance?: number };
export interface CommittedCash {
  from: Side | null;
  to: Side | null;
  amount: number;
  reason: string;
  category: CashTransfer['category'];
  spaceId?: number;
}

export function moneyRecord(event?: CommittedEvent) {
  return event?.type === 'game:money_changed' ? event.payload as EventPayloads['game:money_changed'] : undefined;
}

/** Aggregate only ledger entries with a confirmed counterpart or Bank reason. */
export function committedLedger(events: readonly CommittedEvent[], labels: PresentationLabels) {
  const ledger = new Map<number, CommittedCash>();
  const positions = new Map<string, number>();
  let card: EventPayloads['game:card_resolved'] | undefined;
  for (const [index, event] of events.entries()) {
    const { type, payload } = event;
    if (type === 'game:player_moved') {
      const { playerId, toPosition } = payload as EventPayloads['game:player_moved'];
      positions.set(playerId, toPosition);
    } else if (type === 'game:card_resolved') {
      card = payload as EventPayloads['game:card_resolved'];
    } else if (type === 'game:property_purchased') {
      const purchase = payload as EventPayloads['game:property_purchased'];
      ledger.set(index, {
        from: { id: purchase.playerId, balance: purchase.balance }, to: null, amount: purchase.price,
        reason: `Purchased ${labels.spaceName(purchase.spaceId)}`, category: 'purchase', spaceId: purchase.spaceId,
      });
    } else if (type === 'game:rent_paid') {
      const rent = payload as EventPayloads['game:rent_paid'];
      const debit = moneyRecord(events[index - 2]);
      const credit = moneyRecord(events[index - 1]);
      ledger.set(index, {
        from: { id: rent.payerPlayerId, balance: debit?.reason === 'RENT' && debit.playerId === rent.payerPlayerId && debit.amount === -rent.amount ? debit.balance : undefined },
        to: { id: rent.ownerPlayerId, balance: credit?.reason === 'RENT' && credit.playerId === rent.ownerPlayerId && credit.amount === rent.amount ? credit.balance : undefined },
        amount: rent.amount, reason: `Rent on ${labels.spaceName(rent.spaceId)}`, category: 'rent', spaceId: rent.spaceId,
      });
    } else if (type === 'game:player_bankrupt') {
      const bankrupt = payload as EventPayloads['game:player_bankrupt'];
      if (bankrupt.forfeitedCash) ledger.set(index, {
        from: { id: bankrupt.playerId, balance: 0 },
        to: bankrupt.creditorPlayerId ? { id: bankrupt.creditorPlayerId, balance: bankrupt.creditorBalance ?? undefined } : null,
        amount: bankrupt.forfeitedCash, reason: 'Bankruptcy settlement', category: 'debt',
      });
    } else if (type === 'game:money_changed') {
      const { playerId, amount, balance, reason } = payload as EventPayloads['game:money_changed'];
      const cardLabel = card && labels.card(card.cardId)?.title;
      const effect = card?.effects?.[0]?.type;
      if (reason === 'CARD' && (effect === 'pay_each_player' || effect === 'collect_from_each_player')) {
        const credit = moneyRecord(events[index + 1]);
        if (amount < 0 && credit?.reason === 'CARD' && credit.playerId !== playerId && credit.amount === -amount) {
          ledger.set(index, {
            from: { id: playerId, balance }, to: { id: credit.playerId, balance: credit.balance },
            amount: -amount, reason: cardLabel ?? 'Card payment', category: 'card',
          });
        }
        continue;
      }
      const kinds = {
        GO_SALARY: { category: 'salary', reason: 'GO salary', spaceId: 0 },
        TAX: { category: 'tax', reason: 'Tax', spaceId: positions.get(playerId) },
        JAIL_BAIL: { category: 'jail', reason: 'Jail bail', spaceId: 10 },
        CARD: { category: 'card', reason: cardLabel ?? 'Card payment' },
      } as const;
      const kind = kinds[reason as keyof typeof kinds];
      if (kind && amount && (reason !== 'CARD' || card)) {
        const side = { id: playerId, balance };
        ledger.set(index, { from: amount < 0 ? side : null, to: amount > 0 ? side : null, amount: Math.abs(amount), ...kind });
      }
    }
  }
  return ledger;
}
