import React from 'react';
import { Player, PropertyData } from './types';

export interface ActionDockProps {
  activePlayer: Player;
  dice: [number, number];
  isRolling?: boolean;
  canRoll: boolean;
  canEndTurn: boolean;
  canBuyProperty?: boolean;
  currentSpaceProperty?: PropertyData | null;
  turnStatusText?: string;
  onRollDice: () => void;
  onEndTurn: () => void;
  onBuyProperty?: () => void;
  onOpenBuildOrManage?: () => void;
  onOpenTrade?: () => void;
  onPayJailBail?: () => void;
  onUseJailCard?: () => void;
}

const DIE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DieFace: React.FC<{ value: number; isRolling?: boolean }> = ({ value, isRolling }) => {
  const safeVal = Math.min(6, Math.max(1, value || 1));
  const pips = DIE_PIPS[safeVal];

  return (
    <div
      className={`w-12 h-12 rounded-xl bg-gradient-to-br from-[#F9F6F0] to-[#DCD6C8] p-2 shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.9)] border border-[#D4AF37]/50 grid grid-cols-3 grid-rows-3 gap-0.5 transition-transform duration-300 ${
        isRolling ? 'animate-spin scale-95' : 'hover:scale-105'
      }`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-center">
          {pips.includes(idx) && (
            <span
              className={`w-2 h-2 rounded-full ${
                safeVal === 1 ? 'bg-rose-600 w-2.5 h-2.5' : 'bg-[#0B0F19]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export const ActionDock: React.FC<ActionDockProps> = ({
  activePlayer,
  dice = [1, 1],
  isRolling = false,
  canRoll,
  canEndTurn,
  canBuyProperty = false,
  currentSpaceProperty = null,
  turnStatusText,
  onRollDice,
  onEndTurn,
  onBuyProperty,
  onOpenBuildOrManage,
  onOpenTrade,
  onPayJailBail,
  onUseJailCard,
}) => {
  const diceTotal = (dice[0] || 0) + (dice[1] || 0);
  const isDoubles = dice[0] === dice[1] && dice[0] > 0;

  return (
    <section className="pointer-events-auto flex flex-col items-center gap-2.5 z-20 select-none">
      {/* Contextual Turn Banner */}
      <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#0B0F19]/85 backdrop-blur-md border border-white/10 shadow-lg">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: activePlayer?.color || '#D4AF37' }}
        />
        <span className="text-xs font-semibold text-[#F9F6F0]">
          {activePlayer?.name}&apos;s Turn
        </span>
        <span className="text-white/20">•</span>
        <span className="text-xs text-[#F3E5AB]">
          {turnStatusText ||
            (isRolling
              ? 'Rolling dice...'
              : canRoll
              ? 'Ready to roll the dice'
              : canBuyProperty && currentSpaceProperty
              ? `Landed on ${currentSpaceProperty.name}`
              : 'Manage portfolio or end turn')}
        </span>
      </div>

      {/* Main Dock Panel */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 bg-[#0B0F19]/90 backdrop-blur-xl border border-[#D4AF37]/35 rounded-3xl px-5 py-3.5 shadow-[0_16px_45px_rgba(0,0,0,0.65)]">
        {/* Left: Dice Result Readout */}
        <div className="flex items-center gap-3 pr-2 sm:border-r border-white/10">
          <div className="flex items-center gap-2">
            <DieFace value={dice[0]} isRolling={isRolling} />
            <DieFace value={dice[1]} isRolling={isRolling} />
          </div>

          <div className="flex flex-col min-w-[54px]">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Total
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-xl text-[#F9F6F0] tabular-nums">
                {isRolling ? '••' : diceTotal}
              </span>
              {!isRolling && isDoubles && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#D4AF37]/25 text-[#F3E5AB] border border-[#D4AF37]/50">
                  Doubles!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Primary CTA: ROLL DICE */}
        <button
          type="button"
          onClick={onRollDice}
          disabled={!canRoll || isRolling}
          className={`group relative overflow-hidden rounded-2xl px-7 py-3.5 font-serif font-bold tracking-[0.14em] uppercase text-sm sm:text-base transition-all duration-200 flex items-center gap-2.5 ${
            canRoll && !isRolling
              ? 'bg-gradient-to-b from-[#F5E6AD] via-[#D4AF37] to-[#9E7818] text-[#0B0F19] shadow-[0_0_30px_rgba(212,175,55,0.45),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(212,175,55,0.7)] active:scale-[0.98] cursor-pointer'
              : 'bg-white/[0.06] text-slate-500 border border-white/10 cursor-not-allowed'
          }`}
        >
          <svg
            className={`w-5 h-5 ${canRoll && !isRolling ? 'text-[#0B0F19]' : 'text-slate-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span>{isRolling ? 'Rolling...' : 'Roll Dice'}</span>
        </button>

        {/* Contextual Actions (Buy Property / Jail Actions / Manage / Trade) */}
        <div className="flex items-center gap-2">
          {canBuyProperty && currentSpaceProperty && onBuyProperty && (
            <button
              type="button"
              onClick={onBuyProperty}
              disabled={activePlayer.cash < currentSpaceProperty.price}
              className="px-4 py-3 rounded-2xl font-semibold text-xs sm:text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>Buy {currentSpaceProperty.name}</span>
              <span className="font-mono font-bold text-emerald-300">
                (${currentSpaceProperty.price})
              </span>
            </button>
          )}

          {activePlayer?.inJail && onPayJailBail && (
            <button
              type="button"
              onClick={onPayJailBail}
              disabled={activePlayer.cash < 50}
              className="px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 transition-all disabled:opacity-40"
            >
              Pay Bail ($50)
            </button>
          )}

          {activePlayer?.inJail && (activePlayer.getOutOfJailCards || 0) > 0 && onUseJailCard && (
            <button
              type="button"
              onClick={onUseJailCard}
              className="px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 transition-all"
            >
              Use Jail Card
            </button>
          )}

          {onOpenBuildOrManage && (
            <button
              type="button"
              onClick={onOpenBuildOrManage}
              className="px-3.5 py-3 rounded-2xl text-xs font-semibold text-slate-200 hover:text-[#F3E5AB] bg-white/[0.05] hover:bg-white/10 border border-white/10 transition-all"
              title="Inspect & Build on Properties"
            >
              Deeds
            </button>
          )}

          {onOpenTrade && (
            <button
              type="button"
              onClick={onOpenTrade}
              className="px-3.5 py-3 rounded-2xl text-xs font-semibold text-slate-200 hover:text-[#F3E5AB] bg-white/[0.05] hover:bg-white/10 border border-white/10 transition-all"
              title="Trade with Players"
            >
              Trade
            </button>
          )}

          {/* End Turn Button */}
          <button
            type="button"
            onClick={onEndTurn}
            disabled={!canEndTurn}
            className={`px-5 py-3.5 rounded-2xl font-semibold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              canEndTurn
                ? 'bg-[#1E293B] hover:bg-[#334155] text-[#F9F6F0] border border-[#D4AF37]/50 shadow-md cursor-pointer'
                : 'bg-white/[0.04] text-slate-600 border border-white/5 cursor-not-allowed'
            }`}
          >
            <span>End Turn</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ActionDock;
