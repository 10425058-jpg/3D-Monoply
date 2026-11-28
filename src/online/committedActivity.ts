import { appendMatchActivity, isCenterActivityNotice, type ActivityActor, type ActivityTransfer, type MatchActivityEvent } from '../game/matchActivity';
import type { PresentationLabels } from './committedPresentation';
import { committedLedger, type CommittedCash } from './committedLedger';
import type { EventPayloads, Match, PublicActivityEvent } from './types';

const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`;
type ActorLookup = (id: unknown) => ActivityActor | undefined;
type ActivityEntry = Omit<MatchActivityEvent, 'id' | 'matchId' | 'sequence' | 'timestamp' | 'turn'>;

function activityTransfer(cash: CommittedCash, actorFor: ActorLookup): ActivityTransfer | undefined {
  const from = cash.from ? actorFor(cash.from.id) : null;
  const to = cash.to ? actorFor(cash.to.id) : null;
  if (from === undefined || to === undefined) return undefined;
  return { from, to, amount: cash.amount, reason: cash.reason, fromBalance: cash.from?.balance, toBalance: cash.to?.balance };
}

function cardEntry(card: EventPayloads['game:card_resolved'], actor: ActivityActor,
  followups: readonly PublicActivityEvent[], cash: readonly CommittedCash[], actorFor: ActorLookup,
  labels: PresentationLabels): ActivityEntry {
  const content = labels.card(card.cardId);
  const deck = card.deck === 'chest' ? 'Community Chest' : 'Chance';
  const title = content?.title ?? card.cardId;
  const movement = followups.find(event => event.type === 'game:player_moved' && event.payload.playerId === actor.id);
  const destination = movement?.payload.toPosition as number | undefined;
  const effect = card.effects?.[0];
  const details: string[] = [];
  if (effect?.type === 'go_to_jail') details.push(`${actor.name} was sent to Jail.`);
  else if (destination !== undefined) details.push(`${actor.name} moved to ${labels.spaceName(destination)}.`);
  const transfers = cash.filter(item => item.category === 'card').flatMap(item => activityTransfer(item, actorFor) ?? []);
  const participants: ActivityActor[] = [];
  const related = cash.filter(item => ['salary', 'rent', 'tax', 'debt'].includes(item.category));
  for (const item of related) {
    const transfer = activityTransfer(item, actorFor);
    if (!transfer) continue;
    for (const participant of [transfer.from, transfer.to]) if (participant) participants.push(participant);
    const from = transfer.from?.name ?? 'The Bank';
    const to = transfer.to?.name ?? 'the Bank';
    details.push(`${from} paid ${dollars(transfer.amount)} to ${to} · ${transfer.reason}.`);
  }
  for (const event of followups) if (event.type === 'game:player_bankrupt') {
    const player = actorFor(event.payload.playerId);
    if (player) {
      participants.push(player);
      details.push(`${player.name} went bankrupt.`);
    }
  }
  if (effect?.type === 'get_out_of_jail') details.push(`${actor.name} kept a Get Out of Jail Free card.`);
  if (effect?.type === 'repairs' && effect.amount === 0) details.push('Repairs cost $0 in mini-v1.');
  if (!transfers.length && !details.length && ['pay_each_player', 'collect_from_each_player'].includes(effect?.type ?? '')) {
    details.push('No player payments were made.');
  }
  return {
    kind: 'card', title: `${actor.name} drew ${deck} — ${title}`, actor,
    card: { id: card.cardId, deck: card.deck, title, instruction: content?.description ?? '' },
    spaceId: destination, transfers, participants, details,
  };
}

function commitEntries(events: readonly PublicActivityEvent[], actorFor: ActorLookup, labels: PresentationLabels) {
  const ledger = committedLedger(events, labels);
  const extraRolls = new Set(events.filter(event => event.type === 'game:extra_roll').map(event => event.payload.playerId));
  return events.map((event, index): ActivityEntry | undefined => {
    const { type, payload } = event;
    const actor = actorFor(payload.playerId);
    const cash = ledger.get(index);
    const transfer = cash && activityTransfer(cash, actorFor);
    const transfers = transfer ? [transfer] : undefined;
    const amount = cash?.amount;
    const spaceId = cash?.spaceId;
    switch (type) {
      case 'game:dice_rolled': {
        if (!actor) return;
        const { dice, total } = payload as EventPayloads['game:dice_rolled'];
        const details = extraRolls.has(actor.id) ? ['Doubles earned another roll.'] : dice[0] === dice[1] ? ['Doubles.'] : undefined;
        return { kind: 'roll', title: `${actor.name} rolled ${dice.join(' + ')} = ${total}`, actor, details };
      }
      case 'game:player_moved': {
        if (!actor) return;
        const jail = events[index + 1];
        if (jail?.type === 'game:jail_changed' && jail.payload.playerId === actor.id && jail.payload.inJail) return;
        const { fromPosition, toPosition } = payload as EventPayloads['game:player_moved'];
        return { kind: 'land', title: `${actor.name} landed on ${labels.spaceName(toPosition)}`, actor, spaceId: toPosition,
          details: [`From ${labels.spaceName(fromPosition)}.`] };
      }
      case 'game:property_purchased':
        if (actor && cash) return { kind: 'purchase', title: `${actor.name} purchased ${labels.spaceName(spaceId!)} for ${dollars(cash.amount)}`,
          actor, spaceId, amount, transfers };
        return;
      case 'game:property_declined': {
        const property = payload as EventPayloads['game:property_declined'];
        if (actor) return { kind: 'purchase', title: `${actor.name} passed on ${labels.spaceName(property.spaceId)}`,
          actor, spaceId: property.spaceId };
        return;
      }
      case 'game:rent_paid':
        if (cash && transfer?.from && transfer.to) return {
          kind: 'rent', title: `${transfer.from.name} paid ${dollars(cash.amount)} rent to ${transfer.to.name} for ${labels.spaceName(spaceId!)}.`,
          actor: transfer.from, counterparty: transfer.to, spaceId, amount, transfers,
        };
        return;
      case 'game:money_changed':
        if (!actor || !cash) return;
        if (cash.category === 'salary') return { kind: 'go', title: `${actor.name} passed GO and collected ${dollars(cash.amount)}`, actor, spaceId, amount, transfers };
        if (cash.category === 'tax') return { kind: 'tax', title: `${actor.name} paid ${dollars(cash.amount)} in tax`, actor, spaceId, amount, transfers };
        if (cash.category === 'jail') return { kind: 'bail', title: `${actor.name} paid ${dollars(cash.amount)} bail`, actor, spaceId, amount, transfers };
        return;
      case 'game:card_resolved': {
        if (!actor) return;
        const nextCard = events.findIndex((candidate, next) => next > index && candidate.type === 'game:card_resolved');
        const end = nextCard === -1 ? events.length : nextCard;
        const card = payload as EventPayloads['game:card_resolved'];
        const followups = events.slice(index + 1, end);
        const related = [...ledger].filter(([at]) => at > index && at < end).map(([, item]) => item);
        return cardEntry(card, actor, followups, related, actorFor, labels);
      }
      case 'game:jail_changed': {
        if (!actor) return;
        const { inJail, jailTurns, releaseReason } = payload as EventPayloads['game:jail_changed'];
        const released = { DOUBLES: 'Rolled doubles.', BAIL: 'Paid bail.', CARD: 'Used a Get Out of Jail Free card.' };
        return { kind: 'jail', actor, spaceId: 10,
          title: `${actor.name} ${inJail ? jailTurns ? 'stayed in Jail' : 'was sent to Jail' : 'left Jail'}`,
          details: inJail && jailTurns ? [`Attempt ${jailTurns} of 3.`] : releaseReason ? [released[releaseReason]] : undefined,
          emphasis: inJail && jailTurns === 0 ? 'important' : undefined };
      }
      case 'game:turn_changed': {
        const next = actorFor(payload.currentPlayerId);
        if (next) return { kind: 'turn', title: `${next.name}'s turn began`, actor: next };
        return;
      }
      case 'game:player_bankrupt': {
        if (!actor) return;
        const bankruptcy = payload as EventPayloads['game:player_bankrupt'];
        const creditor = actorFor(bankruptcy.creditorPlayerId);
        const deeds = bankruptcy.transferredSpaceIds?.map(labels.spaceName);
        return { kind: 'bankruptcy', actor, counterparty: creditor, amount, transfers,
          title: `${actor.name} ${bankruptcy.reason === 'VOLUNTARY_FORFEIT' ? 'forfeited' :
            bankruptcy.reason === 'HOST_FORFEIT_ABSENT' ? 'was removed from the match' : 'went bankrupt'}`,
          details: deeds?.length ? [`${deeds.join(', ')} transferred to ${creditor?.name ?? 'the Bank'}.`] : undefined };
      }
      case 'game:finished': {
        const winner = actorFor(payload.winnerPlayerId);
        return { kind: winner ? 'victory' : 'match', title: winner ? `${winner.name} won the match` : 'Match finished',
          actor: winner, details: [payload.finishReason === 'TURN_LIMIT' ? 'Highest net worth at the turn limit.' : 'Last player standing.'] };
      }
      case 'game:abandoned':
        return { kind: 'match', title: 'Match abandoned',
          details: [payload.reason === 'ALL_PLAYERS_OFFLINE_24H' ? 'Every player was offline for 24 hours.' : 'The host closed the paused match.'] };
      case 'game:paused':
        return { kind: 'match', title: 'Match paused', details: ['Waiting for a player to reconnect.'] };
      case 'game:resumed':
        return { kind: 'match', title: 'Match resumed' };
      case 'player:connection_changed':
        if (actor) return { kind: 'connection', actor, title: `${actor.name} ${payload.connectionStatus === 'CONNECTED' ? 'connected' : 'disconnected'}` };
        return;
      default:
        return;
    }
  });
}

/** Normalize complete, persisted commits in sequence order. Never compare player balances across snapshots. */
export function committedActivity(match: Match, rows: readonly PublicActivityEvent[], labels: PresentationLabels, silent = false): MatchActivityEvent[] {
  const actors = new Map(match.players.map(player => [player.playerId, { id: player.playerId, name: player.username, color: player.color }]));
  const actorFor: ActorLookup = id => typeof id === 'string' ? actors.get(id) : undefined;
  const turns = new Map<string, number>();
  let turn = match.turnNumber;
  for (const event of [...rows].reverse()) {
    turns.set(event.eventId, turn);
    if (event.type === 'game:turn_changed') turn--;
  }
  const groups = new Map<number, PublicActivityEvent[]>();
  for (const row of rows) {
    const group = groups.get(row.stateVersion);
    if (group) group.push(row);
    else groups.set(row.stateVersion, [row]);
  }
  return [...groups.values()].flatMap(events => commitEntries(events, actorFor, labels).flatMap((entry, index) => {
    if (!entry) return [];
    const row = events[index];
    return { ...entry, id: row.eventId, matchId: match.matchId, sequence: row.sequence, timestamp: row.occurredAt,
      turn: turns.get(row.eventId), silent: silent || !!entry.silent || row.type === 'game:property_declined' ||
        (row.stateVersion < match.stateVersion && !isCenterActivityNotice(entry)) };
  }));
}

export function projectActivity(history: readonly MatchActivityEvent[], match: Match, rows: readonly PublicActivityEvent[],
  labels: PresentationLabels, silent: boolean) {
  return appendMatchActivity(history, committedActivity(match, rows, labels, silent));
}
