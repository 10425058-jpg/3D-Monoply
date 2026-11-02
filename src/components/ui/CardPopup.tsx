import React from 'react';
import { CardData } from './types';

export interface CardPopupProps {
  card: CardData | null;
  isOpen: boolean;
  onConfirm: () => void;
}

export const CardPopup: React.FC<CardPopupProps> = ({ card, isOpen, onConfirm }) => {
  if (!isOpen || !card) return null;

  const isChance = card.deck === 'chance';

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none">
      <div
        className={`relative w-full max-w-md rounded-3xl p-1 shadow-[0_25px_70px_rgba(0,0,0,0.85)] transition-transform duration-300 scale-100 ${
          isChance
            ? 'bg-gradient-to-br from-[#F59E0B] via-[#D4AF37] to-[#9A3412]'
            : 'bg-gradient-to-br from-[#38BDF8] via-[#D4AF37] to-[#1E3A8A]'
        }`}
      >
        {/* Inner Card Surface */}
        <div className="bg-[#0B0F19] rounded-[22px] p-6 sm:p-8 border border-white/10 flex flex-col items-center text-center relative overflow-hidden">
          {/* Decorative Vintage Corner Frame */}
          <div className="absolute inset-3 rounded-2xl border border-[#D4AF37]/25 pointer-events-none" />

          {/* Deck Header Badge */}
          <span
            className={`px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] border mb-5 ${
              isChance
                ? 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                : 'bg-sky-500/15 text-sky-300 border-sky-400/40'
            }`}
          >
            {isChance ? 'Chance Card' : 'Community Chest'}
          </span>

          {/* Center Emblem Illustration */}
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-inner border ${
              isChance
                ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/10 border-amber-400/40 text-amber-300'
                : 'bg-gradient-to-br from-sky-500/20 to-blue-600/10 border-sky-400/40 text-sky-300'
            }`}
          >
            {isChance ? (
              <span className="font-serif font-extrabold text-5xl text-[#D4AF37] drop-shadow">
                ?
              </span>
            ) : (
              <svg className="w-11 h-11 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            )}
          </div>

          {/* Card Title & Description */}
          <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#F9F6F0] tracking-wide mb-2">
            {card.title}
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xs mb-6">
            {card.description}
          </p>

          {/* Financial Effect Pill (if applicable) */}
          {typeof card.amount === 'number' && card.amount !== 0 && (
            <div
              className={`mb-6 px-4 py-1.5 rounded-xl font-mono font-bold text-base border ${
                card.amount > 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              {card.amount > 0 ? `Collect +$${card.amount}` : `Pay -$${Math.abs(card.amount)}`}
            </div>
          )}

          {/* Confirm CTA */}
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 rounded-xl font-serif font-bold uppercase tracking-[0.15em] text-sm bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] text-[#0B0F19] shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-[0.99] transition-all"
          >
            {card.actionLabel || 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardPopup;
