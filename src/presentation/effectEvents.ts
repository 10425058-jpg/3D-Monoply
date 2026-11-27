import type { SceneState } from './SceneStore';
import type { ArcadeLevel, CashTransfer, Player } from '../types/game';

export type GameSnapshot = SceneState;
export type EffectKind = 'roll' | 'dice-land' | 'move' | 'money' | 'ownership' | 'build' | 'construction' |
  'mortgage' | 'turn' | 'card' | 'auction' | 'trade' | 'jail' | 'bankrupt' | 'victory' | 'raid' | 'transaction' | 'landmark' |
  'heist' | 'shutdown';
export type CashReceipt = CashTransfer & { fromBalance?: number; toBalance?: number; fromName: string; toName: string };
export interface EffectChange {
  kind: EffectKind;
  activityId?: string;
  playerId?: number;
  spaceId?: number;
  amount?: number;
  from?: number;
  to?: number;
  label: string;
  cash?: CashReceipt;
  detail?: string;
  developmentLevel?: ArcadeLevel;
  dice?: readonly [number, number];
  auctionWon?: boolean;
  buildingCount?: number;
  isAI?: boolean;
  quiet?: boolean;
  damaged?: boolean;
}
export interface PresentationEvent extends EffectChange { id: string; createdAt: number; expiresAt: number }

export function effectKey(change: EffectChange, revision: number, index: number) {
  return change.activityId !== undefined
    ? `commit:${change.activityId}:${change.kind}:${change.spaceId ?? ''}:${change.playerId ?? ''}`
    : `scene:${revision}:${index}`;
}

/** Localized feedback reuses receipts; it never invents or duplicates a payment. */
export function tilePulseEvents(events: PresentationEvent[]) {
  const bySpace = new Map<number, PresentationEvent>();
  for (const event of events) {
    if (event.spaceId === undefined) continue;
    const salary = event.cash?.category === 'salary';
    const property = event.kind === 'ownership' && event.playerId !== undefined ||
      event.kind === 'build' && (event.developmentLevel === undefined || (event.amount ?? 0) < 0);
    if (property || event.kind === 'mortgage' || event.kind === 'jail' || event.cash?.category === 'rent' || salary) {
      bySpace.set(event.spaceId, event);
    }
  }
  return [...bySpace.values()].slice(-4);
}

const SOUND_PRIORITY: EffectKind[] = ['victory', 'bankrupt', 'jail', 'dice-land', 'roll', 'heist', 'shutdown', 'landmark',
  'trade', 'ownership', 'construction', 'build', 'card', 'auction', 'raid', 'mortgage', 'transaction', 'turn', 'money', 'move'];
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

export function didEndGame(previous: GameSnapshot, next: GameSnapshot) {
  return (next.turnPhase === 'GAME_OVER' && previous.turnPhase !== 'GAME_OVER') || (!!next.winner && !previous.winner);
}

export function transactionEffect(transfer: CashTransfer, players: Player[], balances?: Pick<CashReceipt, 'fromBalance' | 'toBalance'>,
  activityId?: string): EffectChange {
  const from = players.find(p => p.id === transfer.fromId);
  const to = players.find(p => p.id === transfer.toId);
  return { kind: 'transaction', label: transfer.reason, spaceId: transfer.spaceId, activityId, cash: {
    ...transfer, fromName: from?.name ?? 'Bank', toName: to?.name ?? 'Bank',
    fromBalance: from?.money, toBalance: to?.money, ...balances,
  } };
}

export function turnEffect(player: Player, prior?: Player): EffectChange {
  return { kind: 'turn', playerId: player.id, label: player.name, isAI: player.isAI, quiet: player.isAI && prior?.isAI };
}

/** One adapter for confirmed changes. It never calls an action or adjusts results. */
export function collectEffectChanges(previous: GameSnapshot, next: GameSnapshot): EffectChange[] {
  if (isGameReset(previous, next)) return [];
  const events: EffectChange[] = [];
  if (previous.turnPhase !== 'ROLLING' && next.turnPhase === 'ROLLING') events.push({ kind: 'roll', label: 'Rolling dice' });
  if (previous.turnPhase === 'ROLLING' && next.turnPhase !== 'ROLLING') events.push({
    kind: 'dice-land', dice: next.dice, label: `${next.dice[0]} + ${next.dice[1]} = ${next.dice[0] + next.dice[1]}`,
  });
  const online = next.committedEffects !== undefined;
  if (online && next.committedEffects !== previous.committedEffects) events.push(...next.committedEffects!);
  for (const player of previous.players === next.players ? [] : next.players) {
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
  for (const property of previous.properties === next.properties ? [] : Object.values(next.properties)) {
    const before = previous.properties[property.spaceId];
    if (!before) continue;
    const auctionWon = property.ownerId !== null && previous.auction?.spaceId === property.spaceId;
    if (before.ownerId !== property.ownerId) events.push({
      kind: 'ownership', playerId: property.ownerId ?? undefined, spaceId: property.spaceId,
      label: property.ownerId === null ? 'Deed returned to the Bank' :
        auctionWon ? 'Auction won' : before.ownerId === null ? 'Property purchased' : 'Ownership transferred',
      auctionWon,
    });
    if (property.developmentLevel !== undefined && property.ownerId !== null && before.ownerId === property.ownerId) {
      const from = before.developmentLevel ?? 0;
      const to = property.developmentLevel;
      if (to !== from) events.push({
        kind: 'build', playerId: property.ownerId, spaceId: property.spaceId, amount: to - from, developmentLevel: to,
        label: to > from ? `Property upgraded · Level ${to}` : 'Building sold',
      });
    }
    if (before.houses !== property.houses) events.push({ kind: 'build', playerId: property.ownerId ?? undefined, spaceId: property.spaceId, buildingCount: property.houses,
      amount: property.houses - before.houses, label: property.houses > before.houses ? (property.houses === 5 ? 'Hotel built' : 'House built') : 'Building sold' });
    if (before.isMortgaged !== property.isMortgaged) events.push({ kind: 'mortgage', spaceId: property.spaceId, label: property.isMortgaged ? 'Property mortgaged' : 'Mortgage released' });
  }
  const active = next.players[next.currentPlayerIndex];
  if (active && !active.isBankrupt && previous.players[previous.currentPlayerIndex]?.id !== active.id) {
    events.push(turnEffect(active, previous.players[previous.currentPlayerIndex]));
  }
  if (next.activeCard && next.activeCard !== previous.activeCard) events.push({ kind: 'card', label: next.activeCard.title });
  if (next.auction && !previous.auction) events.push({ kind: 'auction', spaceId: next.auction.spaceId, label: 'Auction started' });
  if (previous.auction && !next.auction && next.properties[previous.auction.spaceId]?.ownerId === null) events.push({ kind: 'auction',
    spaceId: previous.auction.spaceId, label: 'Everyone passed' });
  if (next.railroadRaid && !previous.railroadRaid) events.push({ kind: 'raid', label: 'Railroad bonus unlocked' });
  if (next.winner && next.winner.id !== previous.winner?.id) events.push({ kind: 'victory', playerId: next.winner.id, label: `${next.winner.name} wins!` });
  // Construction is a committed action beat. Installing an owned board snapshot alone does not play it.
  if (next.activity && next.activity !== previous.activity) {
    const known = new Set(previous.activity?.map(event => event.id));
    for (const entry of next.activity) {
      if (known.has(entry.id) || entry.silent) continue;
      if (entry.kind === 'railroad' && entry.transfers?.length) {
        const reason = entry.transfers[0].reason;
        if (reason === 'Bank heist') events.push({ kind: 'heist', activityId: entry.id, label: entry.title });
        if ((reason === 'Landmark shutdown' || reason === 'Landmark raid') && entry.counterparty) {
          events.push({ kind: 'shutdown', activityId: entry.id, label: entry.title, playerId: Number(entry.counterparty.id),
            damaged: entry.level !== undefined && entry.previousLevel !== undefined && entry.level < entry.previousLevel });
        }
      }
      if (next.ruleset !== 'arcade' || entry.spaceId === undefined) continue;
      const purchase = entry.kind === 'purchase' || (entry.kind === 'auction' && !!entry.transfers?.length);
      const property = next.properties[entry.spaceId];
      const level = property?.developmentLevel;
      if (level === undefined || property.ownerId === null || String(property.ownerId) !== entry.actor?.id) continue;
      if (!(purchase && level === 0) && !(entry.kind === 'upgrade' && entry.level === level && level > 0)) continue;
      events.push({ kind: 'construction', playerId: property.ownerId, spaceId: entry.spaceId,
        developmentLevel: level, label: entry.title, activityId: entry.id });
    }
  }
  // Trades have no dedicated result field. Consume only newly confirmed log IDs.
  if (next.logs !== previous.logs) {
    const known = new Set(previous.logs.map(log => log.id));
    for (const log of [...next.logs].reverse()) if (!known.has(log.id)) {
      if(log.message.startsWith('Trade completed between '))events.push({kind:'trade',label:log.message});
      if (log.transfers) events.push(...log.transfers.map((transfer, index) => transactionEffect(transfer, next.players, undefined, `${log.id}:${index}`)));
      else if (log.type === 'money') events.push({kind:'transaction',label:log.message});
      else if (log.message.includes(' passed on buying ')) events.push({ kind: 'auction', label: log.message });
      else if (log.message.includes(' kept a "Get Out of Jail Free" card')) events.push({ kind: 'card', label: log.message });
    }
  }
  return events;
}
