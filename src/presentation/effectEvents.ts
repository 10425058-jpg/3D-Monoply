import type { SceneState } from './SceneStore';
import type { CashTransfer, Player } from '../types/game';

export type GameSnapshot = SceneState;
export type EffectKind = 'roll' | 'dice-land' | 'move' | 'money' | 'ownership' | 'build' |
  'mortgage' | 'turn' | 'card' | 'auction' | 'trade' | 'jail' | 'bankrupt' | 'victory' | 'raid' | 'transaction' | 'landmark';
export type CashReceipt = CashTransfer & { fromBalance?: number; toBalance?: number; fromName: string; toName: string };
export interface EffectChange {
  kind: EffectKind;
  playerId?: number;
  spaceId?: number;
  amount?: number;
  from?: number;
  to?: number;
  label: string;
  cash?: CashReceipt;
  detail?: string;
}
export interface PresentationEvent extends EffectChange { id: number; createdAt: number; expiresAt: number }

/** Localized feedback reuses receipts; it never invents or duplicates a payment. */
export function tilePulseEvents(events: PresentationEvent[]) {
  const bySpace = new Map<number, PresentationEvent>();
  for (const event of events) {
    if (event.spaceId === undefined) continue;
    if (['ownership', 'build', 'mortgage', 'jail'].includes(event.kind) || event.cash?.category === 'rent' ||
      (event.kind === 'money' && event.spaceId === 0 && (event.amount ?? 0) > 0)) {
      bySpace.set(event.spaceId, event);
    }
  }
  return [...bySpace.values()].slice(-4);
}

const SOUND_PRIORITY: EffectKind[] = ['victory', 'bankrupt', 'jail', 'dice-land', 'roll', 'landmark', 'trade', 'ownership', 'build', 'card', 'auction', 'raid', 'mortgage', 'transaction', 'turn', 'money', 'move'];
export function primaryEffect(changes: EffectChange[]) {
  for (const kind of SOUND_PRIORITY) {
    const event = changes.find(change => change.kind === kind && (kind !== 'transaction' || change.cash));
    if (event) return event;
  }
}

export function isGameReset(previous: GameSnapshot, next: GameSnapshot) {
  if (next.gameId !== undefined) return previous.gameId !== next.gameId;
  return next.logs[0] !== previous.logs[0] && next.logs[0]?.id.startsWith('start-') === true;
}

export function transactionEffect(transfer: CashTransfer, players: Player[], balances?: Pick<CashReceipt, 'fromBalance' | 'toBalance'>): EffectChange {
  const from = players.find(p => p.id === transfer.fromId);
  const to = players.find(p => p.id === transfer.toId);
  return { kind: 'transaction', label: transfer.reason, spaceId: transfer.spaceId, cash: {
    ...transfer, fromName: from?.name ?? 'Bank', toName: to?.name ?? 'Bank',
    fromBalance: from?.money, toBalance: to?.money, ...balances,
  } };
}

/** One adapter for confirmed changes. It never calls an action or adjusts results. */
export function collectEffectChanges(previous: GameSnapshot, next: GameSnapshot): EffectChange[] {
  if (isGameReset(previous, next)) return [];
  const events: EffectChange[] = [];
  if (previous.turnPhase !== 'ROLLING' && next.turnPhase === 'ROLLING') events.push({ kind: 'roll', label: 'Rolling dice' });
  if (previous.turnPhase === 'ROLLING' && next.turnPhase !== 'ROLLING') events.push({ kind: 'dice-land', label: `${next.dice[0]} + ${next.dice[1]} = ${next.dice[0] + next.dice[1]}` });
  const online = next.committedEffects !== undefined;
  if (online && next.committedEffects !== previous.committedEffects) events.push(...next.committedEffects!);
  for (const player of next.players) {
    const before = previous.players.find(p => p.id === player.id);
    if (!before) continue;
    if (before.position !== player.position) events.push({ kind: 'move', playerId: player.id, spaceId: player.position, from: before.position, to: player.position, label: player.name });
    if (online) continue;
    if (before.money !== player.money) events.push({ kind: 'money', playerId: player.id, spaceId: player.position, amount: player.money - before.money, label: player.name, detail: `$${player.money.toLocaleString('en-US')} balance` });
    if (!before.inJail && player.inJail) events.push({ kind: 'jail', playerId: player.id, spaceId: player.position, label: `${player.name} · Sent to Jail` });
    if (!before.isBankrupt && player.isBankrupt) {
      const debt = previous.pendingDebt;
      const creditor = next.players.find(p => p.id === debt?.creditorId);
      const deeds = Object.values(previous.properties).filter(p => p.ownerId === player.id).length;
      events.push({ kind: 'bankrupt', playerId: player.id, label: `${player.name} declared bankruptcy`,
        detail: debt ? `${debt.reason} · ${deeds} deeds and eligible assets go to ${creditor?.name ?? 'the Bank'}.` : undefined });
    } else if (before.inJail && !player.inJail) {
      const method = player.getOutOfJailCards < before.getOutOfJailCards ? 'Jail card used' :
        before.money > player.money ? 'Bail paid' : 'Escaped with doubles';
      events.push({ kind: 'jail', playerId: player.id, label: `${player.name} left Jail`, detail: method });
    } else if (player.inJail && player.jailTurns > before.jailTurns) {
      events.push({ kind: 'jail', playerId: player.id, label: `${player.name} · Still in Jail`, detail: `Attempt ${player.jailTurns} of 3 · Doubles required` });
    }
    if (player.landmarkLevel > before.landmarkLevel) events.push({ kind: 'landmark', playerId: player.id,
      label: `${player.name} upgraded their Landmark`, detail: `Level ${player.landmarkLevel} · +$${player.landmarkLevel * 50} when passing GO` });
  }
  if (online) return events;
  for (const property of Object.values(next.properties)) {
    const before = previous.properties[property.spaceId];
    if (!before) continue;
    if (before.ownerId !== property.ownerId) events.push({
      kind: 'ownership', playerId: property.ownerId ?? undefined, spaceId: property.spaceId,
      label: property.ownerId === null ? 'Deed returned to the Bank' :
        previous.auction?.spaceId === property.spaceId ? 'Auction won' : before.ownerId === null ? 'Property purchased' : 'Ownership transferred',
    });
    if (before.houses !== property.houses) events.push({ kind: 'build', playerId: property.ownerId ?? undefined, spaceId: property.spaceId,
      amount: property.houses - before.houses, label: property.houses > before.houses ? (property.houses === 5 ? 'Hotel built' : 'House built') : 'Building sold' });
    if (before.isMortgaged !== property.isMortgaged) events.push({ kind: 'mortgage', spaceId: property.spaceId, label: property.isMortgaged ? 'Property mortgaged' : 'Mortgage released' });
  }
  const active = next.players[next.currentPlayerIndex];
  if (previous.currentPlayerIndex !== next.currentPlayerIndex && active && !active.isBankrupt) events.push({ kind: 'turn', playerId: active.id, label: active.isAI ? `${active.name}'s turn` : `${active.name} · Your turn` });
  if (next.activeCard && next.activeCard !== previous.activeCard) events.push({ kind: 'card', label: next.activeCard.title });
  if (next.auction && !previous.auction) events.push({ kind: 'auction', spaceId: next.auction.spaceId, label: 'Auction started' });
  if (previous.auction && !next.auction && next.properties[previous.auction.spaceId]?.ownerId === null) events.push({ kind: 'auction',
    spaceId: previous.auction.spaceId, label: 'Everyone passed' });
  if (next.railroadRaid && !previous.railroadRaid) events.push({ kind: 'raid', label: 'Railroad bonus unlocked' });
  if (next.winner && next.winner.id !== previous.winner?.id) events.push({ kind: 'victory', playerId: next.winner.id, label: `${next.winner.name} wins!` });
  // Trades have no dedicated result field. Consume only newly confirmed log IDs.
  if (next.logs !== previous.logs) {
    const known = new Set(previous.logs.map(log => log.id));
    for (const log of [...next.logs].reverse()) if (!known.has(log.id)) {
      if(log.message.startsWith('Trade completed between '))events.push({kind:'trade',label:log.message});
      if (log.transfers) events.push(...log.transfers.map(transfer => transactionEffect(transfer, next.players)));
      else if (log.type === 'money') events.push({kind:'transaction',label:log.message});
      else if (log.message.includes(' passed on buying ')) events.push({ kind: 'auction', label: log.message });
      else if (log.message.includes(' kept a "Get Out of Jail Free" card')) events.push({ kind: 'card', label: log.message });
    }
  }
  return events;
}
