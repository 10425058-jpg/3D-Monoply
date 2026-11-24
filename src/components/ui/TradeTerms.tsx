import React from 'react';
import { Castle } from 'lucide-react';
import { BOARD_SPACES } from '../../data/boardData';
import type { Player, PropertyState, SoloRuleset, TradeOffer } from '../../types/game';
import { ARCADE_STAGES, arcadeLevel } from '../../game/arcadeRules';

const cash = (amount: number) => `${amount < 0 ? '−' : ''}$${Math.abs(amount).toLocaleString('en-US')}`;

export function TradeTerms({ from, to, offer, properties, ruleset }: {
  from: Player; to: Player; offer: TradeOffer; properties: Record<number, PropertyState>; ruleset?: SoloRuleset;
}) {
  const side = (sender: Player, receiver: Player, amount: number, received: number, deeds: number[], incoming: number[]) =>
    <div>
      <strong>{sender.name}</strong>
      <span>Gives <b>{cash(amount)}</b>{deeds.length === 0 ? ' · Cash only' : ' and a deed'}</span>
      {deeds.map(id => {
        const space = BOARD_SPACES[id];
        const arcade = ruleset === 'arcade' && space.type === 'property';
        const completesGroup = !arcade && space.type === 'property' && BOARD_SPACES
          .filter(candidate => candidate.colorGroup === space.colorGroup)
          .every(candidate => deeds.includes(candidate.id) ||
            (properties[candidate.id]?.ownerId === receiver.id && !incoming.includes(candidate.id)));
        return <span className="trade-deed" key={id} style={{ '--deed-accent': space.colorHex } as React.CSSProperties}>
          <Castle size={16} aria-hidden="true" /><span>{space.name} · {properties[id]?.isMortgaged ? 'Mortgaged' : arcade ?
          ARCADE_STAGES[arcadeLevel(properties[id])].name : 'Clear deed'}
          {completesGroup && <small>Completes {receiver.name}’s {space.colorGroup} group</small>}</span>
        </span>;
      })}
      <small>Cash after trade <b>{cash(sender.money - amount + received)}</b></small>
    </div>;
  return <section className="trade-comparison" aria-label="Trade terms">
    {side(from, to, offer.offerCash, offer.requestCash, offer.offerProperties, offer.requestProperties)}
    {side(to, from, offer.requestCash, offer.offerCash, offer.requestProperties, offer.offerProperties)}
  </section>;
}
