import React from 'react';
import { Camera, Settings, Plus } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';

export const TopHeader: React.FC<{
  onOpenSettings: () => void;
}> = ({ onOpenSettings }) => {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const setCameraMode = useGameStore((state) => state.setCameraMode);
  const metaProgress = useGameStore((s) => s.metaProgress);

  const activePlayer = players[currentPlayerIndex] || players[0];
  const cashAmount = activePlayer ? activePlayer.money : 1500;
  const gemCount = metaProgress ? metaProgress.stickerStars || 0 : 0;

  const toggleCamera = () => {
    sounds.playClick();
    setCameraMode(cameraMode === 'top' ? 'isometric' : 'top');
  };

  return (
    <header className="fixed top-2.5 sm:top-3 left-2.5 sm:left-4 right-2.5 sm:right-4 z-30 flex items-center justify-between pointer-events-none select-none">
      {/* 1. LOGO BADGE */}
      <div className="pointer-events-auto flex items-center gap-2 group cursor-pointer transition-transform hover:scale-105 active:scale-95">
        <div className="relative scale-90 sm:scale-100 origin-top-left">
          <div className="relative flex flex-col items-center justify-center px-3 sm:px-4 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2 rounded-2xl bg-gradient-to-b from-red-500 via-red-600 to-rose-700 border-2 border-amber-300 shadow-[0_6px_20px_rgba(220,38,38,0.5),inset_0_2px_rgba(255,255,255,0.4)]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              <svg width="24" height="18" viewBox="0 0 24 20" fill="#fbbf24">
                <path d="M2 5l4 11h12l4-11-5 6-5-9-5 9-5-6z" stroke="#b45309" strokeWidth="1.2" />
                <circle cx="2" cy="4" r="1.5" fill="#ef4444" />
                <circle cx="12" cy="1" r="1.8" fill="#3b82f6" />
                <circle cx="22" cy="4" r="1.5" fill="#10b981" />
              </svg>
            </div>
            <div className="absolute -top-2.5 -right-2.5 text-xs sm:text-sm animate-bounce">
              🎲
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-base sm:text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                3D<span className="text-amber-200">MONOPOLY</span>
              </span>
            </div>
            <div className="mt-0.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 border border-amber-200 shadow-sm">
              <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-wider text-amber-950">
                Miniature City Edition
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STATS CAPSULES */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 pr-1 sm:pr-1.5 py-1 sm:py-1.5 rounded-full bg-purple-950/80 backdrop-blur-md border border-purple-400/40 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.2)]">
          <div className="flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-emerald-500/30 text-emerald-400">
            <span className="text-xs sm:text-base font-black leading-none">💵</span>
          </div>
          <span className="text-xs sm:text-base font-black tracking-wide text-white drop-shadow">
            ${cashAmount.toLocaleString()}
          </span>
          <button
            onClick={() => { sounds.playCash(); }}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-black flex items-center justify-center shadow transition-transform active:scale-90"
            title="Add Cash"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 pr-1 sm:pr-1.5 py-1 sm:py-1.5 rounded-full bg-purple-950/80 backdrop-blur-md border border-purple-400/40 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.2)]">
          <div className="flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-cyan-500/30 text-cyan-300">
            <span className="text-xs sm:text-base leading-none">💎</span>
          </div>
          <span className="text-xs sm:text-base font-black tracking-wide text-white drop-shadow">
            {gemCount}
          </span>
          <button
            onClick={() => { sounds.playPurchase(); }}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-black flex items-center justify-center shadow transition-transform active:scale-90"
            title="Add Gems"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>

        <button
          onClick={toggleCamera}
          className="hidden sm:flex w-9 h-9 rounded-full bg-purple-900/80 hover:bg-purple-800/90 text-purple-200 hover:text-white border border-purple-400/30 items-center justify-center shadow transition-transform active:scale-90"
          title={cameraMode === 'top' ? 'Switch to 3D Isometric View' : 'Switch to Top-Down View'}
        >
          <Camera size={16} />
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            onOpenSettings();
          }}
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-purple-800 to-purple-950 hover:from-purple-700 hover:to-purple-900 text-purple-200 hover:text-white border border-purple-400/40 flex items-center justify-center shadow-lg transition-transform active:scale-90"
          title="Game Settings & New Game"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
};
