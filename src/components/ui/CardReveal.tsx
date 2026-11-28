import React, { useState } from 'react';
import { RoyalArt, RoyalButton, RoyalModal } from './RoyalUI';
import { ArrowRight, Banknote, CircleHelp, DoorClosed, Hammer, KeyRound, PackageOpen, Signpost, Sparkles, Users } from 'lucide-react';
import type { CardActionType, DeckCard } from '../../types/game';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';

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

function CardFace({ card }: { card: DeckCard }) {
  const { label, Icon } = effects[card.actionType];
  const tone = ['collect', 'collect_from_each_player', 'get_out_of_jail'].includes(card.actionType) ? 'emerald' :
    ['pay', 'pay_each_player', 'repairs', 'go_to_jail'].includes(card.actionType) ? 'ruby' : 'gold';
  return <article className="card-parchment"><h3>{card.title}</h3><p>{card.description}</p>
    <span className="card-effect" data-tone={tone}><Icon size={17} aria-hidden="true" />{label}</span>
  </article>;
}

export function CardReveal({ deck, card, onDraw, onResolve }: {
  deck: DeckCard['deck'];
  card: DeckCard | null;
  onDraw: () => void;
  onResolve: () => void;
}) {
  const { reducedMotion } = useMotionPreferences();
  const [turned, setTurned] = useState(false);
  const revealed = !!card && (turned || reducedMotion);
  const flipping = !!card && !revealed;
  const chance = deck === 'chance';
  const DeckIcon = chance ? CircleHelp : PackageOpen;
  return <RoyalModal title={chance ? 'Chance' : 'Community Chest'} icon={chance ? CircleHelp : PackageOpen}
    priority="decision" tone={chance ? 'gold' : 'teal'} className={`card-reveal card-reveal-backdrop deck-${deck}`}
    description={revealed ? undefined : 'Draw a card to continue your turn.'}
    footer={<RoyalButton key={revealed ? 'confirm' : 'draw'} variant="primary" className="modal-primary"
      disabled={flipping} onClick={event => { if (event.detail <= 1) (revealed ? onResolve : onDraw)(); }}>
      {revealed ? 'Confirm' : flipping ? 'Drawing card…' : 'Draw Card'} <ArrowRight size={16} aria-hidden="true" />
    </RoyalButton>}>
    <div className="card-spread" aria-live="polite" aria-busy={flipping}>
      <RoyalArt prop={deck} />
      {revealed ? <CardFace card={card} /> : <div className="card-back" data-flipping={flipping || undefined}
        onAnimationEnd={event => { if (event.target === event.currentTarget && flipping) setTurned(true); }}
        aria-hidden="true">
        <DeckIcon size={56} strokeWidth={1.4} />
      </div>}
    </div>
  </RoyalModal>;
}
