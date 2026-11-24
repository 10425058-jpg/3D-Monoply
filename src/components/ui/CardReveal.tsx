import React, { useRef } from 'react';
import { RoyalArt, RoyalButton, RoyalModal } from './RoyalUI';
import { ArrowRight, Banknote, CircleHelp, DoorClosed, Hammer, KeyRound, PackageOpen, Signpost, Sparkles, Users } from 'lucide-react';
import type { CardActionType, DeckCard } from '../../types/game';

const effects: Record<CardActionType, { label: string; Icon: typeof Banknote }> = {
  collect: { label: 'Bank reward', Icon: Banknote },
  pay: { label: 'Bank payment', Icon: Banknote },
  move_to: { label: 'Move to another space', Icon: Signpost },
  move_relative: { label: 'Change position', Icon: Signpost },
  nearest_utility: { label: 'Nearest utility', Icon: Signpost },
  nearest_railroad: { label: 'Nearest railroad', Icon: Signpost },
  go_to_jail: { label: 'Go directly to Jail', Icon: DoorClosed },
  get_out_of_jail: { label: 'Keep this Jail card', Icon: KeyRound },
  repairs: { label: 'Property repairs', Icon: Hammer },
  pay_each_player: { label: 'Pay the other players', Icon: Users },
  collect_from_each_player: { label: 'Collect from the other players', Icon: Users },
};

export function CardReveal({ card, onResolve }: { card: DeckCard; onResolve: () => void }) {
  const resolved = useRef(false);
  const { label, Icon } = effects[card.actionType];
  const chance = card.deck === 'chance';
  const tone = ['collect', 'collect_from_each_player', 'get_out_of_jail'].includes(card.actionType) ? 'emerald' :
    ['pay', 'pay_each_player', 'repairs', 'go_to_jail'].includes(card.actionType) ? 'ruby' : 'gold';
  return <RoyalModal title={chance ? 'Chance' : 'Community Chest'} icon={chance ? CircleHelp : PackageOpen}
    priority="decision" tone={chance ? 'gold' : 'teal'} className={`card-reveal card-reveal-backdrop deck-${card.deck}`}
    footer={<RoyalButton variant="primary" className="modal-primary" onClick={() => {
      if (resolved.current) return;
      resolved.current = true;
      onResolve();
    }}>Resolve this card <ArrowRight size={16} /></RoyalButton>}>
    <div className="card-spread"><RoyalArt prop={chance ? 'chance' : 'chest'} />
      <article className="card-parchment"><h3>{card.title}</h3><p>{card.description}</p>
        <span className="card-effect" data-tone={tone}><Icon size={17} />{label}</span>
      </article>
    </div>
  </RoyalModal>;
}
