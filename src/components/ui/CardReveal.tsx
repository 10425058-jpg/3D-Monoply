import React, { useEffect, useRef } from 'react';
import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
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
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const resolved = useRef(false);
  const action = useRef<HTMLButtonElement>(null);
  const { label, Icon } = effects[card.actionType];
  useEffect(() => { action.current?.focus({ preventScroll: true }); }, []);
  return <motion.div className="modal-backdrop card-reveal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    aria-hidden={!present} style={{ pointerEvents: present ? undefined : 'none' }} transition={{ duration: reduced ? 0 : .12 }}>
    <motion.section className={`game-modal card-modal card-reveal deck-${card.deck}`} role="dialog" aria-modal={present} aria-label={`${card.deck === 'chance' ? 'Chance' : 'Community Chest'} · ${card.title}`}
      initial={reduced ? false : { opacity: 0, rotateY: -60, rotateZ: -3, y: 22, scale: .94 }}
      animate={{ opacity: 1, rotateY: 0, rotateZ: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduced ? 0 : -8 }} transition={{ duration: reduced ? 0 : .29, ease: [.2, .75, .25, 1] }}
      onKeyDown={event => { if (event.key === 'Tab' && present) { event.preventDefault(); action.current?.focus(); } }}>
      <Sparkles className="card-reveal-spark" aria-hidden="true" /><div className="card-stamp" aria-hidden="true">{card.deck === 'chance' ? <CircleHelp size={29} /> : <PackageOpen size={29} />}</div>
      <div className="eyebrow">{card.deck === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST'}</div>
      <h2>{card.title}</h2><p>{card.description}</p>
      <div className="card-effect"><Icon size={15} aria-hidden="true" />{label}</div>
      <button ref={action} className="modal-primary" disabled={!present} onClick={() => { if (!resolved.current) { resolved.current = true; onResolve(); } }}>
        Resolve this card <ArrowRight size={16} />
      </button>
    </motion.section>
  </motion.div>;
}
