import React from 'react';
import { Crown, Coins, Sparkles } from 'lucide-react';
import { usePresentationEvents } from '../../presentation/PresentationProvider';
import { BOARD_SPACES } from '../../data/boardData';

export function GameplayFeedback() {
  const events = usePresentationEvents();
  const turn = events.filter(e => e.kind === 'turn').slice(-1)[0];
  const landed = events.filter(e => e.kind === 'dice-land').slice(-1)[0];
  const notices = events.filter(e => ['ownership', 'build', 'trade', 'mortgage', 'auction', 'jail', 'bankrupt', 'victory', 'raid'].includes(e.kind)).slice(-2);
  const money = events.filter(e => e.kind === 'money').slice(-3);
  return <div className="gameplay-feedback" aria-live="polite" aria-atomic="false">
    {turn && <div key={turn.id} className="turn-announcement" data-effect-kind="turn"><Crown /><span>{turn.label}</span></div>}
    {landed && <div key={landed.id} className="dice-result" data-effect-kind="dice-land"><span>Dice result</span><strong>{landed.label}</strong></div>}
    <div className="feedback-notices">{notices.map(event => <div key={event.id} className={`effect-notice effect-${event.kind}`} data-effect-kind={event.kind}>
      <Sparkles size={17} /><div><strong>{event.label}</strong>{event.spaceId !== undefined && <span>{BOARD_SPACES[event.spaceId]?.name}</span>}</div>
    </div>)}</div>
    <div className="money-receipts">{money.map(event => <div key={event.id} className={`money-receipt ${(event.amount ?? 0) > 0 ? 'is-positive' : 'is-negative'}`} data-effect-kind="money">
      <Coins size={15} /><span>{event.label}</span><strong>{event.amount! > 0 ? '+' : '−'}${Math.abs(event.amount!).toLocaleString('en-US')}</strong>
    </div>)}</div>
  </div>;
}
