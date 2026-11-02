import React, { useState } from 'react';

export interface HeaderBarProps {
  roomId?: string;
  gameStatus?: 'setup' | 'playing' | 'paused' | 'finished';
  currentRound: number;
  activePlayerName?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onOpenTrade?: () => void;
  onOpenSettings?: () => void;
  onExitGame: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  roomId = 'MNP-8492',
  gameStatus = 'playing',
  currentRound = 1,
  activePlayerName,
  soundEnabled,
  onToggleSound,
  onOpenRules,
  onOpenTrade,
  onOpenSettings,
  onExitGame,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRoom = () => {
    if (!roomId) return;
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const statusConfig = {
    setup: { label: 'Lobby Setup', dot: 'bg-amber-400', text: 'text-amber-300' },
    playing: { label: 'Live Match', dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-300' },
    paused: { label: 'Paused', dot: 'bg-amber-400', text: 'text-amber-300' },
    finished: { label: 'Game Over', dot: 'bg-rose-400', text: 'text-rose-300' },
  }[gameStatus];

  return (
    <header className="pointer-events-auto w-full px-4 pt-3 pb-2 flex items-center justify-between gap-4 select-none z-30">
      {/* Left: Brand & Room Info */}
      <div className="flex items-center gap-3 bg-[#0B0F19]/85 backdrop-blur-md border border-[#D4AF37]/30 rounded-2xl px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {/* Monopoly Crown Emblem */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F3E5AB] via-[#D4AF37] to-[#99731C] p-[1px] shadow-[0_0_15px_rgba(212,175,55,0.35)] flex items-center justify-center">
          <div className="w-full h-full bg-[#0B0F19] rounded-[11px] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#D4AF37]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold tracking-[0.16em] text-sm md:text-base text-[#F9F6F0] uppercase">
              Monopoly
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              3D Edition
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={handleCopyRoom}
              title="Click to copy Room ID"
              className="hover:text-[#F9F6F0] transition-colors flex items-center gap-1 font-mono"
            >
              <span>Room: {roomId}</span>
              {copied ? (
                <span className="text-emerald-400 text-[10px] font-sans">(Copied)</span>
              ) : (
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="h-7 w-[1px] bg-white/10 mx-1 hidden sm:block" />

        {/* Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10">
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <span className={`text-xs font-medium ${statusConfig.text}`}>{statusConfig.label}</span>
        </div>
      </div>

      {/* Center: Round & Active Turn Indicator */}
      <div className="hidden md:flex items-center gap-4 bg-[#0B0F19]/85 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">Round</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#F3E5AB] font-mono font-bold text-sm">
            #{currentRound}
          </span>
        </div>

        {activePlayerName && (
          <>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Active Turn:</span>
              <span className="font-semibold text-[#F9F6F0] tracking-wide">{activePlayerName}</span>
            </div>
          </>
        )}
      </div>

      {/* Right: Utility & Navigation Controls */}
      <div className="flex items-center gap-2 bg-[#0B0F19]/85 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {onOpenTrade && (
          <button
            onClick={onOpenTrade}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#F9F6F0] bg-white/[0.04] hover:bg-[#D4AF37]/20 hover:text-[#F3E5AB] border border-transparent hover:border-[#D4AF37]/40 transition-all"
            title="Propose a Trade"
          >
            <svg className="w-4 h-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="hidden sm:inline">Trade</span>
          </button>
        )}

        <button
          onClick={onOpenRules}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-[#F9F6F0] bg-white/[0.04] hover:bg-white/10 transition-all"
          title="Rulebook"
        >
          <svg className="w-4 h-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="hidden sm:inline">Rules</span>
        </button>

        <button
          onClick={onToggleSound}
          className="p-2 rounded-xl text-slate-300 hover:text-[#F9F6F0] bg-white/[0.04] hover:bg-white/10 transition-all"
          title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          aria-label="Toggle Sound"
        >
          {soundEnabled ? (
            <svg className="w-4 h-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-300 hover:text-[#F9F6F0] bg-white/[0.04] hover:bg-white/10 transition-all"
            title="Game Setup & Settings"
            aria-label="Game Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        <button
          onClick={onExitGame}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600/80 border border-rose-500/20 transition-all"
          title="Exit Match"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden lg:inline">Exit</span>
        </button>
      </div>
    </header>
  );
};

export default HeaderBar;
