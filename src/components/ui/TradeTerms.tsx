import React from 'react';
import { BOARD_SPACES } from '../../data/boardData';
import type { Player, PropertyState, TradeOffer } from '../../types/game';

const cash = (amount: number) => `${amount < 0 ? '−' : ''}$${Math.abs(amount).toLocaleString('en-US')}`;

export function TradeTerms({ from, to, offer, properties }: {
  from: Player; to: Player; offer: TradeOffer; properties: Record<number, PropertyState>;
}) {
  const side = (sender: Player, receiver: Player, amount: number, received: number, deeds: number[], incoming: number[]) =>
    <div>
      <strong>{sender.name}</strong>
      <span>Gives {cash(amount)} cash{deeds.length === 0 ? ' · No deeds' : ''}</span>
      {deeds.map(id => {
        const space = BOARD_SPACES[id];
        const completesGroup = space.type === 'property' && BOARD_SPACES
          .filter(candidate => candidate.colorGroup === space.colorGroup)
          .every(candidate => deeds.includes(candidate.id) ||
            (properties[candidate.id]?.ownerId === receiver.id && !incoming.includes(candidate.id)));
        return <span key={id}>{space.name} · {properties[id]?.isMortgaged ? 'Mortgaged' : 'Clear deed'}
          {completesGroup && <small>Completes {receiver.name}’s {space.colorGroup} group</small>}</span>;
      })}
      <small>Cash after trade <b>{cash(sender.money - amount + received)}</b></small>
    </div>;
  return <section className="trade-comparison" aria-label="Trade terms">
    {side(from, to, offer.offerCash, offer.requestCash, offer.offerProperties, offer.requestProperties)}
    {side(to, from, offer.requestCash, offer.offerCash, offer.requestProperties, offer.offerProperties)}
  </section>;
}
