import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ScrollText, ArrowRight, Sparkles } from 'lucide-react';
import type { DeckCard } from '../../types/game';

export function CardReveal({ card, onResolve }: { card: DeckCard; onResolve: () => void }) {
  const reduced = useReducedMotion();
  const resolved = useRef(false);
  return <motion.div className="modal-backdrop card-reveal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.16 }}>
    <motion.section className="game-modal card-modal card-reveal" role="dialog" aria-modal="true" aria-label={`${card.deck === 'chance' ? 'Chance' : 'Community Chest'}: ${card.title}`}
      initial={reduced ? false : { opacity: 0, rotateY: -35, rotateZ: -3, y: 16 }} animate={{ opacity: 1, rotateY: 0, rotateZ: 0, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -10 }} transition={{ duration: reduced ? 0 : 0.32 }}>
      <Sparkles className="card-reveal-spark" aria-hidden="true" /><div className="card-stamp"><ScrollText size={25} /></div>
      <div className="eyebrow">{card.deck === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST'}</div>
      <h2>{card.title}</h2><p>{card.description}</p>
      <button className="modal-primary" onClick={() => { if (!resolved.current) { resolved.current = true; onResolve(); } }}>
        Resolve this card <ArrowRight size={16} />
      </button>
    </motion.section>
  </motion.div>;
}
