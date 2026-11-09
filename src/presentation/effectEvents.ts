import type { useGameStore } from '../store/useGameStore';

export type GameSnapshot = ReturnType<typeof useGameStore.getState>;
export type EffectKind = 'roll' | 'dice-land' | 'move' | 'money' | 'ownership' | 'build' |
  'mortgage' | 'turn' | 'card' | 'auction' | 'trade' | 'jail' | 'bankrupt' | 'victory' | 'raid';
export interface EffectChange {
  kind: EffectKind;
  playerId?: number;
  spaceId?: number;
  amount?: number;
  from?: number;
  to?: number;
  label: string;
}
export interface PresentationEvent extends EffectChange { id: number; createdAt: number; expiresAt: number }

const SOUND_PRIORITY: EffectKind[] = ['victory', 'roll', 'dice-land', 'ownership', 'build', 'trade', 'card', 'turn', 'jail', 'bankrupt', 'auction', 'raid', 'mortgage', 'money', 'move'];
export function primaryEffect(changes: EffectChange[]) {
  for (const kind of SOUND_PRIORITY) {
    const event = changes.find(change => change.kind === kind);
    if (event) return event;
  }
}

export function isGameReset(previous: GameSnapshot, next: GameSnapshot) {
  return next.logs[0] !== previous.logs[0] && next.logs[0]?.id.startsWith('start-') === true;
}

/** One adapter for confirmed changes. It never calls an action or adjusts results. */
export function collectEffectChanges(previous: GameSnapshot, next: GameSnapshot): EffectChange[] {
  if (isGameReset(previous, next)) return [];
  const events: EffectChange[] = [];
  if (previous.turnPhase !== 'ROLLING' && next.turnPhase === 'ROLLING') events.push({ kind: 'roll', label: 'Rolling dice' });
  if (previous.turnPhase === 'ROLLING' && next.turnPhase !== 'ROLLING') events.push({ kind: 'dice-land', label: `${next.dice[0]} + ${next.dice[1]} = ${next.dice[0] + next.dice[1]}` });
  for (const player of next.players) {
    const before = previous.players.find(p => p.id === player.id);
    if (!before) continue;
    if (before.position !== player.position) events.push({ kind: 'move', playerId: player.id, spaceId: player.position, from: before.position, to: player.position, label: player.name });
    if (before.money !== player.money) events.push({ kind: 'money', playerId: player.id, spaceId: player.position, amount: player.money - before.money, label: player.name });
    if (!before.inJail && player.inJail) events.push({ kind: 'jail', playerId: player.id, spaceId: player.position, label: `${player.name} is in jail` });
    if (!before.isBankrupt && player.isBankrupt) events.push({ kind: 'bankrupt', playerId: player.id, label: `${player.name} declared bankruptcy` });
  }
  for (const property of Object.values(next.properties)) {
    const before = previous.properties[property.spaceId];
    if (!before) continue;
    if (before.ownerId !== property.ownerId && property.ownerId !== null) events.push({
      kind: 'ownership', playerId: property.ownerId, spaceId: property.spaceId,
      label: previous.auction?.spaceId === property.spaceId ? 'Auction won' : before.ownerId === null ? 'Property purchased' : 'Ownership transferred',
    });
    if (before.houses !== property.houses) events.push({ kind: 'build', playerId: property.ownerId ?? undefined, spaceId: property.spaceId,
      amount: property.houses - before.houses, label: property.houses > before.houses ? (property.houses === 5 ? 'Hotel built' : 'House built') : 'Building sold' });
    if (before.isMortgaged !== property.isMortgaged) events.push({ kind: 'mortgage', spaceId: property.spaceId, label: property.isMortgaged ? 'Property mortgaged' : 'Mortgage released' });
  }
  const active = next.players[next.currentPlayerIndex];
  if (previous.currentPlayerIndex !== next.currentPlayerIndex && active && !active.isBankrupt) events.push({ kind: 'turn', playerId: active.id, label: active.isAI ? `${active.name}'s turn` : `${active.name} · Your turn` });
  if (next.activeCard && next.activeCard !== previous.activeCard) events.push({ kind: 'card', label: next.activeCard.title });
  if (next.auction && !previous.auction) events.push({ kind: 'auction', spaceId: next.auction.spaceId, label: 'Auction started' });
  if (next.railroadRaid && !previous.railroadRaid) events.push({ kind: 'raid', label: 'Railroad bonus unlocked' });
  if (next.winner && next.winner.id !== previous.winner?.id) events.push({ kind: 'victory', playerId: next.winner.id, label: `${next.winner.name} wins!` });
  // Trades have no dedicated result field. Consume only newly confirmed log IDs.
  if (next.logs !== previous.logs) {
    const known = new Set(previous.logs.map(log => log.id));
    for (const log of next.logs) if (!known.has(log.id) && log.message.startsWith('Trade completed between ')) events.push({ kind: 'trade', label: log.message });
  }
  return events;
}
