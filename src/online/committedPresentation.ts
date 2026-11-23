import { transactionEffect, type EffectChange } from '../presentation/effectEvents';
import type { DeckCard, Player } from '../types/game';
import { committedLedger } from './committedLedger';
import type { ActionReceipt, EventPayloads, Match } from './types';

export type CommittedEvent = ActionReceipt['events'][number] & { eventId?: string };
type CardInfo = Pick<DeckCard, 'title' | 'description' | 'steps'>;
export interface PresentationLabels {
  spaceName: (id: number) => string;
  card: (id: string) => CardInfo | undefined;
}

export type MoveBeat = { seat: number; positions: number[]; jail?: boolean } | { card: EffectChange };

/** The roll's destination can differ from the final snapshot after a card or Jail. */
export function committedMove(before: Match, match: Match, events: readonly CommittedEvent[], labels: PresentationLabels) {
  const dice = match.dice;
  const rolled = events.find(event => event.type === 'game:dice_rolled')?.payload;
  const rolls = !!dice && rolled?.playerId === dice.rolledByPlayerId && rolled.total === dice.total &&
    Array.isArray(rolled.dice) && rolled.dice[0] === dice.values[0] && rolled.dice[1] === dice.values[1];
  const beats: MoveBeat[] = [];
  const positions = new Map(before.players.map(player => [player.playerId, player.position]));
  let redirect: { playerId: string; steps?: number } | undefined;
  for (const [index, event] of events.entries()) {
    if (event.type === 'game:card_resolved') {
      const payload = event.payload as EventPayloads['game:card_resolved'];
      const card = labels.card(payload.cardId);
      const effect = match.lastCardResolved?.cardId === payload.cardId ? match.lastCardResolved.effects[0]?.type :
        (payload.effects[0] as { type?: string } | undefined)?.type;
      redirect = { playerId: payload.playerId, steps: effect === 'move_relative' ? card?.steps : undefined };
      if (effect === 'move_relative' && redirect.steps === undefined) return { rolls, beats: [] };
      if (card) beats.push({ card: { kind: 'card', label: card.title, detail: card.description,
        ...(event.eventId && { activityId: event.eventId }) } });
    }
    if (event.type !== 'game:player_moved') continue;
    const { playerId, fromPosition, toPosition, passedGo } = event.payload as EventPayloads['game:player_moved'];
    const actor = match.players.find(player => player.playerId === playerId);
    if (!actor || positions.get(playerId) !== fromPosition || !Number.isInteger(toPosition) || toPosition < 0 || toPosition >= 40) {
      return { rolls, beats: [] };
    }
    positions.set(playerId, toPosition);
    const next = events[index + 1];
    const jail = next?.type === 'game:jail_changed' && next.payload.playerId === playerId &&
      next.payload.inJail === true && next.payload.jailTurns === 0;
    const clockwise = passedGo && toPosition === fromPosition ? 40 : (toPosition - fromPosition + 40) % 40;
    const steps = redirect?.playerId === playerId && redirect.steps !== undefined ? redirect.steps : clockwise;
    redirect = undefined;
    if ((fromPosition + steps + 40) % 40 !== toPosition || Math.abs(steps) > 40) return { rolls, beats: [] };
    if (jail) beats.push({ seat: actor.seatOrder, positions: [toPosition], jail: true });
    else if (steps) beats.push({ seat: actor.seatOrder,
      positions: Array.from({ length: Math.abs(steps) }, (_, i) => (fromPosition + (i + 1) * Math.sign(steps) + 40) % 40) });
  }
  // An incomplete notification batch cannot invent a path between snapshots.
  const complete = match.players.every(player => player.position === positions.get(player.playerId));
  return { rolls, beats: complete ? beats : [] };
}

/** Socket events and action receipts describe the same commit. Call once for the accepted version. */
export function committedFeedback(before: Match, match: Match, events: readonly CommittedEvent[], players: Player[], labels: PresentationLabels) {
  const effects: EffectChange[] = [];
  const player = (id: unknown) => match.players.find(candidate => candidate.playerId === id);
  const properties = new Map(match.properties.map(property => [property.spaceId, property]));
  const ledger = committedLedger(events, labels);
  for (let index = 0; index < events.length; index++) {
    const { type, payload } = events[index];
    const actor = player(payload.playerId);
    if (type === 'game:property_purchased' && actor && properties.get(Number(payload.spaceId))?.ownerPlayerId === actor.playerId) {
      const spaceId = Number(payload.spaceId);
      const name = labels.spaceName(spaceId);
      effects.push({ kind: 'ownership', spaceId, playerId: actor.seatOrder, label: `${actor.username} purchased ${name}` });
    } else if (type === 'game:jail_changed' && actor) {
      const jail = payload as EventPayloads['game:jail_changed'];
      const old = before.players.find(candidate => candidate.playerId === actor.playerId);
      const release = old && old.heldJailCardIds.length > actor.heldJailCardIds.length ? 'Jail card used' :
        events.some(event => event.type === 'game:money_changed' && event.payload.reason === 'JAIL_BAIL') ? 'Bail paid' : 'Escaped with doubles';
      effects.push({ kind: 'jail', playerId: actor.seatOrder, spaceId: jail.inJail && !jail.jailTurns ? 10 : undefined,
        label: jail.inJail ? `${actor.username} ${jail.jailTurns ? 'stays in Jail' : 'was sent to Jail'}` : `${actor.username} left Jail`,
        detail: jail.inJail ? jail.jailTurns ? `Attempt ${jail.jailTurns} of 3 · Doubles required` : undefined : release });
    } else if (type === 'game:player_bankrupt' && actor) {
      const creditor = player(payload.creditorPlayerId);
      const deeds = before.properties.filter(property => property.ownerPlayerId === actor.playerId);
      const reason = { VOLUNTARY_FORFEIT: 'Forfeit', HOST_FORFEIT_ABSENT: 'Disconnected player removed', INSOLVENT_TO_PLAYER: 'Could not pay another player',
        INSOLVENT_TO_BANK: 'Could not pay the Bank' }[String(payload.reason)] ?? 'Eliminated';
      effects.push({ kind: 'bankrupt', playerId: actor.seatOrder, label: `${actor.username} was eliminated`,
        detail: `${reason} · ${deeds.length} deeds and eligible assets go to ${creditor?.username ?? 'the Bank'}.` });
      for (const deed of deeds) if (properties.get(deed.spaceId)?.ownerPlayerId !== actor.playerId) {
        effects.push({ kind: 'ownership', spaceId: deed.spaceId, playerId: creditor?.seatOrder, label: 'Ownership transferred' });
      }
    }
    const cash = ledger.get(index);
    if (cash) {
      const payer = cash.from && player(cash.from.id);
      const recipient = cash.to && player(cash.to.id);
      if ((cash.from && !payer) || (cash.to && !recipient)) continue;
      effects.push(transactionEffect({
        fromId: payer?.seatOrder ?? null, toId: recipient?.seatOrder ?? null, amount: cash.amount,
        reason: cash.reason, category: cash.category, spaceId: cash.spaceId ?? payer?.position ?? recipient?.position,
      }, players, { fromBalance: cash.from?.balance, toBalance: cash.to?.balance }));
    }
  }
  if (match.currentPlayerId && match.currentPlayerId !== before.currentPlayerId) effects.push({ kind: 'turn', label: 'Turn changed' });
  const winner = player(match.winnerPlayerId);
  if (winner && match.winnerPlayerId !== before.winnerPlayerId) effects.push({ kind: 'victory', label: `${winner.username} wins`, playerId: winner.seatOrder });
  for (const { cash } of [...effects]) if (cash) {
    const payer = players.find(p => p.id === cash.fromId);
    const recipient = players.find(p => p.id === cash.toId);
    if (payer) effects.push({ kind: 'money', playerId: payer.id, spaceId: payer.position, amount: -cash.amount, label: payer.name });
    if (recipient) effects.push({ kind: 'money', playerId: recipient.id, spaceId: cash.category === 'salary' ? 0 : recipient.position, amount: cash.amount, label: recipient.name });
  }
  return effects;
}
