export type ActivityKind =
  | 'roll' | 'land' | 'turn' | 'go' | 'rent' | 'purchase' | 'upgrade' | 'sale' | 'tax'
  | 'card' | 'auction' | 'trade' | 'mortgage' | 'bail' | 'jail' | 'bankruptcy' | 'victory'
  | 'landmark' | 'railroad' | 'money' | 'connection' | 'match';

export interface ActivityActor {
  id: string;
  name: string;
  color?: string;
}

export interface ActivityTransfer {
  from: ActivityActor | null;
  to: ActivityActor | null;
  amount: number;
  fromBalance?: number;
  toBalance?: number;
  reason?: string;
}

export interface MatchActivityEvent {
  id: string;
  matchId: string;
  kind: ActivityKind;
  title: string;
  sequence: number;
  turn?: number;
  timestamp?: string;
  actor?: ActivityActor;
  counterparty?: ActivityActor;
  participants?: readonly ActivityActor[];
  spaceId?: number;
  card?: { id: string; deck: 'chance' | 'chest'; title: string; instruction: string };
  amount?: number;
  previousLevel?: number;
  level?: number;
  transfers?: readonly ActivityTransfer[];
  details?: readonly string[];
  emphasis?: 'important' | 'milestone';
  silent?: boolean;
}

export const MATCH_ACTIVITY_LIMIT = 160;
export const ACTIVITY_FILTERS = ['All', 'Money', 'Properties', 'Cards', 'Important'] as const;
export type ActivityFilter = typeof ACTIVITY_FILTERS[number];
export type NoticeFrequency = 'standard' | 'important';

const moneyKinds = new Set<ActivityKind>(['go', 'rent', 'purchase', 'upgrade', 'sale', 'tax', 'mortgage', 'bail', 'money']);
const propertyKinds = new Set<ActivityKind>(['purchase', 'upgrade', 'sale', 'auction', 'trade', 'mortgage']);
const majorKinds = new Set<ActivityKind>(['card', 'rent', 'jail', 'bankruptcy', 'victory', 'match']);
const standardKinds = new Set<ActivityKind>(['go', 'purchase', 'upgrade', 'sale', 'trade', 'mortgage', 'bail', 'landmark', 'railroad', 'tax']);

/** History is ordered oldest first. Replayed entries keep their original identity. */
export function appendMatchActivity(history: readonly MatchActivityEvent[], fresh: readonly MatchActivityEvent[]): MatchActivityEvent[] {
  const byId = new Map(history.map(event => [event.id, event]));
  for (const event of fresh) if (!byId.has(event.id)) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence).slice(-MATCH_ACTIVITY_LIMIT);
}

export function activityActors(event: MatchActivityEvent): ActivityActor[] {
  const actors = [event.actor, event.counterparty, ...(event.participants ?? []),
    ...(event.transfers ?? []).flatMap(transfer => [transfer.from, transfer.to])];
  return [...new Map(actors.filter((actor): actor is ActivityActor => !!actor).map(actor => [actor.id, actor])).values()];
}

export function matchesActivityFilter(event: MatchActivityEvent, filter: ActivityFilter, playerId: string): boolean {
  if (playerId && !activityActors(event).some(actor => actor.id === playerId)) return false;
  switch (filter) {
    case 'Money': return moneyKinds.has(event.kind) || !!event.transfers?.length;
    case 'Properties': return propertyKinds.has(event.kind);
    case 'Cards': return event.kind === 'card';
    case 'Important': return !!event.emphasis || majorKinds.has(event.kind);
    case 'All': return true;
  }
}

export function activityNoticePriority(event: MatchActivityEvent, frequency: NoticeFrequency): number {
  if (event.silent) return 0;
  if (event.emphasis === 'milestone' || event.kind === 'victory' || event.kind === 'bankruptcy') return 3;
  if (majorKinds.has(event.kind)) return 2;
  if (frequency === 'important') return 0;
  return event.emphasis || standardKinds.has(event.kind) || (event.kind === 'auction' && !!event.transfers?.length) ? 1 : 0;
}
