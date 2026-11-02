import React, { useState } from 'react';
import { GameSettings, TokenId } from './types';

export interface SetupPlayerConfig {
  id: string;
  name: string;
  token: TokenId;
  color: string;
  isAI: boolean;
}

export interface SetupModalProps {
  isOpen: boolean;
  onStartGame: (players: SetupPlayerConfig[], settings: GameSettings) => void;
  onClose?: () => void;
}

const AVAILABLE_TOKENS: { id: TokenId; label: string; emoji: string }[] = [
  { id: 'tophat', label: 'Top Hat', emoji: '🎩' },
  { id: 'roadster', label: 'Roadster', emoji: '🏎️' },
  { id: 'trex', label: 'T-Rex', emoji: '🦖' },
  { id: 'piggy', label: 'Piggy Bank', emoji: '🐷' },
  { id: 'battleship', label: 'Battleship', emoji: '🚢' },
  { id: 'dog', label: 'Scottie', emoji: '🐕' },
];

const PLAYER_COLORS = ['#D4AF37', '#38BDF8', '#F43F5E', '#10B981', '#A855F7', '#F97316'];

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onStartGame, onClose }) => {
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [players, setPlayers] = useState<SetupPlayerConfig[]>([
    { id: 'p1', name: 'Player 1', token: 'tophat', color: '#D4AF37', isAI: false },
    { id: 'p2', name: 'Player 2', token: 'roadster', color: '#38BDF8', isAI: false },
    { id: 'p3', name: 'Magnate Bot', token: 'trex', color: '#F43F5E', isAI: true },
    { id: 'p4', name: 'Tycoon Bot', token: 'piggy', color: '#10B981', isAI: true },
  ]);

  const [settings, setSettings] = useState<GameSettings>({
    startingCash: 1500,
    doubleRentOnFullSet: true,
    freeParkingJackpot: false,
    auctionUnbought: true,
    turnTimerSeconds: null,
  });

  if (!isOpen) return null;

  const activePlayers = players.slice(0, playerCount);

  const updatePlayer = (index: number, patch: Partial<SetupPlayerConfig>) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === index ? { ...p, ...patch } : p)));
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-3xl bg-[#0B0F19] border border-[#D4AF37]/40 rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AF37] block">
              New Match Configuration
            </span>
            <h2 className="font-serif font-bold text-2xl text-[#F9F6F0]">
              Table &amp; Player Setup
            </h2>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Bar: Number of Players & Starting Capital */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
                Number of Players
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPlayerCount(count)}
                    className={`py-2.5 rounded-xl font-serif font-bold text-sm border transition-all ${
                      playerCount === count
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3E5AB]'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {count} Players
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
                Starting Capital
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1000, 1500, 2500].map((cash) => (
                  <button
                    key={cash}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, startingCash: cash }))}
                    className={`py-2.5 rounded-xl font-mono font-bold text-sm border transition-all ${
                      settings.startingCash === cash
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3E5AB]'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    ${cash.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Player Slots */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Player Roster &amp; 3D Tokens
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activePlayers.map((player, idx) => (
                <div
                  key={player.id}
                  className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                      placeholder={`Player ${idx + 1}`}
                      className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-sm font-semibold text-[#F9F6F0] focus:outline-none focus:border-[#D4AF37]"
                    />

                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => updatePlayer(idx, { isAI: !player.isAI })}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase border transition-all ${
                          player.isAI
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {player.isAI ? 'AI Bot' : 'Human'}
                      </button>
                    )}
                  </div>

                  {/* Token Selector */}
                  <div className="flex items-center justify-between gap-1">
                    {AVAILABLE_TOKENS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updatePlayer(idx, { token: t.id })}
                        title={t.label}
                        className={`flex-1 py-1.5 rounded-lg text-base border transition-all ${
                          player.token === t.id
                            ? 'bg-[#D4AF37]/25 border-[#D4AF37] scale-105'
                            : 'bg-white/[0.03] border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        {t.emoji}
                      </button>
                    ))}
                  </div>

                  {/* Color Swatches */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 mr-auto">Color:</span>
                    {PLAYER_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updatePlayer(idx, { color: hex })}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          player.color === hex
                            ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19]'
                            : 'opacity-65 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* House Rules Toggles */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Table Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.doubleRentOnFullSet}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, doubleRentOnFullSet: e.target.checked }))
                  }
                  className="accent-[#D4AF37] w-4 h-4"
                />
                <span className="text-slate-200">2× Rent on Full Color Set</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auctionUnbought}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, auctionUnbought: e.target.checked }))
                  }
                  className="accent-[#D4AF37] w-4 h-4"
                />
                <span className="text-slate-200">Auction Unbought Deeds</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.freeParkingJackpot}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, freeParkingJackpot: e.target.checked }))
                  }
                  className="accent-[#D4AF37] w-4 h-4"
                />
                <span className="text-slate-200">Free Parking Tax Jackpot</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 bg-white/[0.03] border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={() => onStartGame(activePlayers, settings)}
            className="w-full sm:w-auto px-10 py-3.5 rounded-2xl font-serif font-bold uppercase tracking-[0.18em] text-sm bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] text-[#0B0F19] shadow-[0_0_30px_rgba(212,175,55,0.45)] hover:brightness-110 active:scale-[0.99] transition-all"
          >
            Start 3D Match
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupModal;
