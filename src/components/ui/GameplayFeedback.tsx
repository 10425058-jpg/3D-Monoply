import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Building2, Coins, Crown, DoorClosed, Hammer, Landmark, Sparkles } from 'lucide-react';
import { usePresentationEvents } from '../../presentation/PresentationProvider';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import { useSceneState } from '../../presentation/SceneStore';
import { BOARD_SPACES } from '../../data/boardData';
import type { CashReceipt } from '../../presentation/effectEvents';

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
const icons = { bankrupt: Landmark, jail: DoorClosed, landmark: Landmark, ownership: Building2, build: Hammer };

function Receipt({ cash }: { cash: CashReceipt }) {
  return <div className={`effect-notice effect-transaction receipt-${cash.category}`} data-effect-kind="transaction"
    role="group" aria-label={`${cash.fromName} paid ${money(cash.amount)} to ${cash.toName} · ${cash.reason}`}>
    <div className="receipt-heading"><Coins size={16} aria-hidden="true" /><strong>{cash.reason}</strong><b>{money(cash.amount)}</b></div>
    <div className="receipt-path">
      <div><span>{cash.fromName}</span>{cash.fromBalance !== undefined && <small><b className="receipt-debit">−{money(cash.amount)}</b> · {money(cash.fromBalance)} left</small>}</div>
      <ArrowRight size={16} aria-label="paid to" />
      <div><span>{cash.toName}</span>{cash.toBalance !== undefined && <small><b className="receipt-credit">+{money(cash.amount)}</b> · {money(cash.toBalance)} balance</small>}</div>
    </div>
  </div>;
}

export function VictoryCelebration() {
  const victory = usePresentationEvents().find(event => event.kind === 'victory')?.id;
  const { reducedMotion, visible } = useMotionPreferences();
  const canvas = useRef<HTMLCanvasElement>(null);
  const played = useRef<string>();
  useEffect(() => {
    if (!victory || !visible || reducedMotion || !canvas.current || played.current === victory) return;
    played.current = victory;
    try {
      const burst = confetti.create(canvas.current, { resize: true });
      void burst({ particleCount: 42, spread: 72, ticks: 72, startVelocity: 28, gravity: .7, scalar: .78,
        origin: { y: .63 }, colors: ['#ffdd8b', '#ffeeb9', '#eabb53', '#f6ae9b', '#bda9e9'], disableForReducedMotion: true });
      return () => burst.reset();
    } catch { /* The celebration is optional. */ }
  }, [victory, visible, reducedMotion]);
  return victory && visible && !reducedMotion ? <canvas ref={canvas} className="victory-confetti" aria-hidden="true" /> : null;
}

export function GameplayFeedback({ online = false, activityNotices = false, localSeat }: {
  online?: boolean; activityNotices?: boolean; localSeat?: number;
}) {
  const events = usePresentationEvents();
  const latest = [...events].reverse();
  const landed = latest.find(e => e.kind === 'dice-land');
  const dice = landed?.dice;
  const doubles = dice && dice[0] === dice[1];
  const turn = latest.find(e => e.kind === 'turn');
  const color = useSceneState(state => state.players.find(player => player.id === turn?.playerId)?.color);
  const yours = online ? localSeat !== undefined && localSeat === turn?.playerId : turn?.isAI === false;
  const receipts = events.filter(event => event.cash).slice(-2);
  const notice = latest.find(event => event.kind === 'bankrupt') ?? latest.find(event => {
    if (!['ownership', 'build', 'trade', 'mortgage', 'auction', 'jail', 'raid', 'landmark', 'transaction', 'card'].includes(event.kind) || event.cash) return false;
    if (event.kind === 'card' && !online && !event.label.includes('Get Out of Jail Free')) return false;
    if (event.kind === 'trade' && receipts.some(receipt => receipt.cash?.category === 'trade')) return false;
    return !['build', 'ownership', 'mortgage'].includes(event.kind) ||
      !receipts.some(receipt => receipt.spaceId === event.spaceId);
  });
  const NoticeIcon = icons[notice?.kind as keyof typeof icons] ?? Sparkles;
  const change = latest.find(e => e.kind === 'money');
  const standalone = change && !receipts.length && notice?.kind !== 'transaction' && notice?.kind !== 'bankrupt';
  return <div className={`gameplay-feedback${online ? ' gameplay-feedback-online' : ''}`} aria-live="polite" aria-atomic="false">
    {landed && dice && <div key={landed.id} className="dice-result" data-effect-kind="dice-land" data-doubles={doubles || undefined}>
      <span>{doubles ? 'Doubles' : 'Dice result'}</span>
      <strong><i>{dice[0]}</i> + <i>{dice[1]}</i> = <b>{dice[0] + dice[1]}</b></strong>
    </div>}
    {turn && <div key={turn.id} className="turn-announcement" data-effect-kind="turn" data-ai={turn.isAI || undefined}
      style={{ '--turn-color': color } as React.CSSProperties}>
      <Crown size={17} aria-hidden="true" />
      <span>{yours ? 'Your turn' : `${turn.label}’s turn`}</span>
      {turn.isAI && <small>AI</small>}
    </div>}
    {!activityNotices && <div className="feedback-notices">
      {notice && <div key={notice.id} className={`effect-notice effect-${notice.kind}`} data-effect-kind={notice.kind}>
        <NoticeIcon size={17} aria-hidden="true" /><div><strong>{notice.label}</strong>
          <span>{notice.detail ?? (notice.spaceId !== undefined ? BOARD_SPACES[notice.spaceId]?.name : null)}</span></div>
      </div>}
      {receipts.map(event => <Receipt key={event.id} cash={event.cash!} />)}
      {standalone && <div key={change.id} className="effect-notice" data-effect-kind="money">
        <Coins size={16} aria-hidden="true" /><div><strong>{change.label} {change.amount! > 0 ? '+' : '−'}{money(Math.abs(change.amount!))}</strong><span>{change.detail}</span></div>
      </div>}
    </div>}
  </div>;
}
