import React, { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownUp, ArrowRight, Banknote, Building2, ChevronDown, Coins, Crown, Dice5, DoorClosed,
  Flag, Gavel, Hammer, Handshake, Landmark, List, MapPin, ScrollText, TrainFront, Trophy, Wifi, X,
} from 'lucide-react';
import {
  ACTIVITY_FILTERS, activityActors, activityNoticePriority, matchesActivityFilter,
  type ActivityActor, type ActivityFilter, type ActivityKind, type ActivityTransfer, type MatchActivityEvent, type NoticeFrequency,
} from '../../game/matchActivity';
import './match-activity.css';

const icons: Record<ActivityKind, typeof Coins> = {
  roll: Dice5, land: MapPin, turn: Flag, go: Flag, rent: Coins, purchase: Handshake, upgrade: Hammer,
  sale: Building2, tax: Banknote, card: ScrollText, auction: Gavel, trade: ArrowDownUp, mortgage: Landmark,
  bail: Coins, jail: DoorClosed, bankruptcy: Landmark, victory: Trophy, landmark: Crown, railroad: TrainFront,
  money: Coins, connection: Wifi, match: Flag,
};

interface ActivityProps {
  events: readonly MatchActivityEvent[];
  matchId: string;
  layout?: 'solo' | 'online' | 'results';
}

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const noticePreferenceKey = 'monopoly-activity-notices';
const noticeListeners = new Set<() => void>();
let noticePreference: NoticeFrequency = 'standard';

function getFrequency(): NoticeFrequency {
  try {
    const value = window.localStorage.getItem(noticePreferenceKey);
    if (value === 'important' || value === 'standard') return value;
  } catch { /* The setting can still be used for this session. */ }
  return noticePreference;
}

function subscribeFrequency(listener: () => void) {
  noticeListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    noticeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function setFrequency(value: NoticeFrequency) {
  noticePreference = value;
  try { window.localStorage.setItem(noticePreferenceKey, value); } catch { /* Session setting remains active. */ }
  noticeListeners.forEach(listener => listener());
}

function useFrequency() {
  return useSyncExternalStore(subscribeFrequency, getFrequency, () => 'standard' as NoticeFrequency);
}

function ActorSeal({ actor, kind }: { actor?: ActivityActor; kind: ActivityKind }) {
  const Icon = icons[kind];
  if (!actor) return <span className="activity-seal" aria-hidden="true"><Icon size={17} /></span>;
  return <span className="activity-seal has-actor" style={{ '--actor-color': actor.color } as React.CSSProperties} aria-hidden="true">
    {Array.from(actor.name)[0]?.toLocaleUpperCase()}
  </span>;
}

function ActivityTitle({ title }: { title: string }) {
  return <>{title.split(/(\$[\d,]+)/g).map((part, index) => index % 2 ? <b key={index}>{part}</b> : part)}</>;
}

function TransferLine({ transfer }: { transfer: ActivityTransfer }) {
  return <div className="activity-transfer">
    <span><strong>{transfer.from?.name ?? 'Bank'}</strong><small>−{money(transfer.amount)}{transfer.fromBalance !== undefined && ` · ${money(transfer.fromBalance)} left`}</small></span>
    <ArrowRight size={13} aria-label="paid to" />
    <span><strong>{transfer.to?.name ?? 'Bank'}</strong><small>+{money(transfer.amount)}{transfer.toBalance !== undefined && ` · ${money(transfer.toBalance)} balance`}</small></span>
  </div>;
}

function ActivityRow({ event, newest }: { event: MatchActivityEvent; newest: boolean }) {
  const Icon = icons[event.kind];
  const time = event.timestamp ? new Date(event.timestamp) : undefined;
  const hasDetails = !!(event.card || event.details?.length || event.transfers?.length);
  return <li className="match-activity-row" data-activity-kind={event.kind} data-newest={newest || undefined} data-emphasis={event.emphasis}>
    <ActorSeal actor={event.actor} kind={event.kind} />
    <div className="activity-row-copy">
      <span className="activity-row-title">{event.actor && <Icon size={15} aria-hidden="true" />}<strong><ActivityTitle title={event.title} /></strong></span>
      <div className="activity-row-meta">
        {event.turn !== undefined && <span>Turn {event.turn}</span>}
        {time && Number.isFinite(time.valueOf()) && <time dateTime={event.timestamp}>{clock.format(time)}</time>}
        {newest && <span className="activity-latest">Latest</span>}
      </div>
      {hasDetails && <details className="activity-event-details">
        <summary aria-label={`Details for ${event.title}`}>Details</summary>
        {event.card && <p><strong>{event.card.title}</strong><br />{event.card.instruction}</p>}
        {event.details?.map((detail, index) => <p key={index}>{detail}</p>)}
        {event.transfers?.map((transfer, index) => <TransferLine key={index} transfer={transfer} />)}
      </details>}
    </div>
  </li>;
}

function ActivityPanel({ events, layout = 'solo' }: ActivityProps) {
  const [open, setOpen] = useState(() => layout === 'solo' && window.matchMedia('(min-width: 1200px) and (min-height: 640px)').matches);
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const [playerId, setPlayerId] = useState('');
  const [following, setFollowing] = useState(true);
  const frequency = useFrequency();
  const list = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const panelId = useId();

  const players = useMemo(() => {
    const byId = new Map(events.flatMap(activityActors).map(actor => [actor.id, actor]));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);
  const selectedPlayer = players.some(player => player.id === playerId) ? playerId : '';
  const shown = useMemo(() => events.filter(event => matchesActivityFilter(event, filter, selectedPlayer)).reverse(), [events, filter, selectedPlayer]);

  useLayoutEffect(() => {
    if (open && following && list.current) list.current.scrollTop = 0;
  }, [open, following, shown]);

  return <aside className={`match-activity match-activity--${layout}`} aria-labelledby={labelId} onKeyDown={event => {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    setOpen(false);
    toggle.current?.focus();
  }}>
    <h2 id={labelId}>
      <button ref={toggle} type="button" className="match-activity-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
        <List size={19} aria-hidden="true" /><span>Match Activity</span><ChevronDown size={17} aria-hidden="true" />
      </button>
    </h2>
    <div className="match-activity-body" id={panelId} hidden={!open}>
      <div className="activity-controls">
        <div className="activity-filters" role="group" aria-label="Event category">
          {ACTIVITY_FILTERS.map(value => <button type="button" key={value} aria-pressed={value === filter} onClick={() => {
            setFilter(value);
            setFollowing(true);
          }}>{value}</button>)}
        </div>
        <div className="activity-selects">
          <label><span className="sr-only">Filter by player</span><select value={selectedPlayer} onChange={event => {
            setPlayerId(event.target.value);
            setFollowing(true);
          }}>
            <option value="">All players</option>
            {players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select></label>
          <label><span className="sr-only">Live notice frequency</span><select value={frequency} onChange={event => setFrequency(event.target.value as NoticeFrequency)}>
            <option value="standard">Standard notices</option>
            <option value="important">Important only</option>
          </select></label>
        </div>
      </div>
      <div className="activity-scroll" ref={list} tabIndex={0} role="region" aria-label="Match history, latest events first"
        onScroll={event => setFollowing(event.currentTarget.scrollTop < 8)}>
        {shown.length ? <ol>
          {shown.map((event, index) => <ActivityRow key={event.id} event={event} newest={index === 0} />)}
        </ol> : <p className="activity-empty">{events.length ? 'No events match these filters.' : 'Confirmed moves will appear here.'}</p>}
      </div>
      {!following && <button type="button" className="activity-jump" onClick={() => setFollowing(true)}>Jump to latest</button>}
    </div>
  </aside>;
}

export const ActivityLog = memo(function ActivityLog(props: ActivityProps) {
  return <ActivityPanel key={props.matchId} {...props} />;
});

function ActivityNotice({ event, close, reduced }: { event: MatchActivityEvent; close: () => void; reduced: boolean | null }) {
  const Icon = icons[event.kind];
  const receipt = event.transfers?.length === 1 && (event.kind === 'purchase' || event.kind === 'rent') ? event.transfers[0] : undefined;
  const reason = receipt?.reason;
  const transferLabel = receipt && `${receipt.from?.name ?? 'Bank'} paid ${money(receipt.amount)} to ${receipt.to?.name ?? 'Bank'}${reason ? ` · ${reason}` : ''}`;
  return <motion.article className={`match-notice${receipt ? ` effect-transaction receipt-${event.kind}` : ''}`} data-activity-notice={event.kind}
    initial={{ opacity: 0, y: reduced ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }}
    transition={{ duration: reduced ? 0 : .17 }}
    data-emphasis={event.emphasis} data-effect-kind={receipt ? 'transaction' : event.kind} aria-label={transferLabel}>
    <div className="match-notice-heading">
      <ActorSeal actor={event.actor} kind={event.kind} />
      <strong><ActivityTitle title={event.title} /></strong>
      <Icon className="match-notice-icon" size={20} aria-hidden="true" />
      <button type="button" className="match-notice-close" aria-label="Dismiss live notice" onClick={close}><X size={16} /></button>
    </div>
    {receipt && <div className="match-notice-detail">
      {reason && <p>{reason} <b>{money(receipt.amount)}</b></p>}
      <TransferLine transfer={receipt} />
    </div>}
    {!receipt && (event.card || event.details?.length || event.kind === 'upgrade') && <div className="match-notice-detail">
      {event.card && <p>{event.card.instruction}</p>}
      {(event.card || event.kind === 'upgrade' ? event.details : event.details?.slice(0, 1))?.map((detail, index) => <p key={index}>{detail}</p>)}
      {event.kind === 'upgrade' && event.amount !== undefined && <p>Paid <b>{money(event.amount)}</b> for construction.</p>}
      {event.card && !!event.transfers?.length && <p>{event.transfers.map(transfer =>
        `${transfer.from?.name ?? 'Bank'} → ${transfer.to?.name ?? 'Bank'} ${money(transfer.amount)}`).join(' · ')}</p>}
    </div>}
  </motion.article>;
}

function NoticeQueue({ events, layout = 'solo' }: ActivityProps) {
  const frequency = useFrequency();
  const reduced = useReducedMotion();
  const seen = useRef(new Set(events.map(event => event.id)));
  const [queue, setQueue] = useState<MatchActivityEvent[]>([]);
  useEffect(() => {
    const added = events.filter(event => {
      if (seen.current.has(event.id)) return false;
      seen.current.add(event.id);
      return activityNoticePriority(event, frequency) > 0;
    });
    if (document.hidden || !added.length) return;
    setQueue(current => {
      const waiting = [...current.slice(1), ...added].sort((a, b) =>
        activityNoticePriority(b, frequency) - activityNoticePriority(a, frequency));
      const active = current[0];
      const top = waiting[0];
      if (active && activityNoticePriority(active, frequency) >= activityNoticePriority(top, frequency)) waiting.unshift(active);
      return waiting.slice(0, 6);
    });
  }, [events, frequency]);

  useEffect(() => {
    const clearInBackground = () => { if (document.hidden) setQueue([]); };
    document.addEventListener('visibilitychange', clearInBackground);
    return () => document.removeEventListener('visibilitychange', clearInBackground);
  }, []);

  useEffect(() => {
    setQueue(current => current.filter(event => activityNoticePriority(event, frequency) > 0));
  }, [frequency]);

  const notice = queue[0];
  useEffect(() => {
    if (!notice) return;
    const ttl = notice.kind === 'card' || notice.emphasis === 'milestone' ? 5200 : 3600;
    const timer = window.setTimeout(() => setQueue(current => current.filter(entry => entry.id !== notice.id)), ttl);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <div className={`match-notices match-notices--${layout}`} aria-live="polite" aria-atomic="true">
    <AnimatePresence mode="wait">
      {notice && <ActivityNotice key={notice.id} event={notice} reduced={reduced}
        close={() => setQueue(current => current.filter(entry => entry.id !== notice.id))} />}
    </AnimatePresence>
  </div>;
}

export const MatchActivityNotices = memo(function MatchActivityNotices(props: ActivityProps) {
  return <NoticeQueue key={props.matchId} {...props} />;
});

export default ActivityLog;
