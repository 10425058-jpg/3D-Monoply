import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Building2, Coins, DoorClosed, Hammer, Landmark, Sparkles } from 'lucide-react';
import { usePresentationEvents } from '../../presentation/PresentationProvider';
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

export function GameplayFeedback({ online = false, activityNotices = false }: { online?: boolean; activityNotices?: boolean }) {
  const events = usePresentationEvents();
  const latest = [...events].reverse();
  const landed = latest.find(e => e.kind === 'dice-land');
  const victoryId = latest.find(e => e.kind === 'victory')?.id;
  useEffect(() => {
    if (victoryId === undefined || document.hidden) return;
    try { void confetti({ particleCount: 46, spread: 58, ticks: 100, origin: { y: .58 }, disableForReducedMotion: true }); }
    catch { /* Optional animation never controls the results dialog. */ }
    return () => { confetti.reset(); };
  }, [victoryId]);
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
    {!online && landed && <div key={landed.id} className="dice-result" data-effect-kind="dice-land">
      <span>Dice result</span><strong>{landed.label}</strong>
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
