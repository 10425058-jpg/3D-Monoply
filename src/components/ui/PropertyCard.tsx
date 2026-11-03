import React from 'react';
import { X, Home, Landmark, Coins } from 'lucide-react';
import { BoardSpace, PropertyState, Player } from '../../types/game';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';

export const PropertyCard: React.FC<{
  space: BoardSpace;
  state?: PropertyState;
  owner?: Player;
  onClose: () => void;
}> = ({ space, state, owner, onClose }) => {
  const activePlayer = useGameStore((s) => s.players[s.currentPlayerIndex]);
  const canBuildHouse = useGameStore((s) => s.canBuildHouse);
  const canSellHouse = useGameStore((s) => s.canSellHouse);
  const buildHouse = useGameStore((s) => s.buildHouse);
  const sellHouse = useGameStore((s) => s.sellHouse);
  const toggleMortgage = useGameStore((s) => s.toggleMortgage);

  const isOwner = activePlayer && state?.ownerId === activePlayer.id;
  const canBuild = isOwner && space.type === 'property' && canBuildHouse(activePlayer.id, space.id);
  const canSell = isOwner && space.type === 'property' && canSellHouse(activePlayer.id, space.id);

  return (
    <div className="fixed left-4 bottom-20 z-30 w-72 sm:w-80 select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="relative rounded-3xl bg-slate-900/95 backdrop-blur-xl border-2 border-purple-400/40 shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_rgba(255,255,255,0.2)] overflow-hidden flex flex-col">
        <button
          onClick={() => { sounds.playClick(); onClose(); }}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-transform active:scale-90"
        >
          <X size={16} />
        </button>

        <div
          className="px-4 py-3 text-center border-b border-black/20 shadow-sm"
          style={{ backgroundColor: space.colorHex }}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-black/70 block">
            TITLE DEED
          </span>
          <h3 className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow">
            {space.name}
          </h3>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/20 text-xs">
            <span className="text-purple-300 font-medium">Status</span>
            {owner ? (
              <span className="font-bold flex items-center gap-1.5 text-white">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: owner.color }} />
                Owned by {owner.name}
              </span>
            ) : (
              <span className="font-bold text-amber-300">
                Unowned · ${space.price || 0}
              </span>
            )}
          </div>

          {space.type === 'property' && space.rent && (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-purple-200 py-0.5 border-b border-purple-800/40">
                <span>Rent alone</span>
                <span className="font-bold text-white">${space.rent[0]}</span>
              </div>
              <div className="flex justify-between text-purple-200 py-0.5 border-b border-purple-800/40">
                <span>With 1 House</span>
                <span className="font-bold text-white">${space.rent[1]}</span>
              </div>
              <div className="flex justify-between text-purple-200 py-0.5 border-b border-purple-800/40">
                <span>With 2 Houses</span>
                <span className="font-bold text-white">${space.rent[2]}</span>
              </div>
              <div className="flex justify-between text-purple-200 py-0.5 border-b border-purple-800/40">
                <span>With 3 Houses</span>
                <span className="font-bold text-white">${space.rent[3]}</span>
              </div>
              <div className="flex justify-between text-purple-200 py-0.5 border-b border-purple-800/40">
                <span>With 4 Houses</span>
                <span className="font-bold text-white">${space.rent[4]}</span>
              </div>
              <div className="flex justify-between text-amber-300 py-0.5 font-bold">
                <span>With HOTEL</span>
                <span className="font-black text-amber-300">${space.rent[5]}</span>
              </div>
            </div>
          )}

          {state?.isMortgaged && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold text-center">
              ⚠️ Property is Mortgaged (no rent collected)
            </div>
          )}

          {isOwner && space.type === 'property' && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-800/50">
              <button
                onClick={() => { sounds.playPurchase(); buildHouse(space.id); }}
                disabled={!canBuild}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow active:scale-95 transition-all"
              >
                <Home size={13} />
                <span>Build (${space.houseCost || 100})</span>
              </button>
              <button
                onClick={() => { sounds.playCash(); sellHouse(space.id); }}
                disabled={!canSell}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-purple-800 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-purple-200 font-bold text-xs shadow active:scale-95 transition-all"
              >
                <span>Sell (${Math.floor((space.houseCost || 100) / 2)})</span>
              </button>
              <button
                onClick={() => { sounds.playCash(); toggleMortgage(space.id); }}
                className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-purple-900/80 hover:bg-purple-800 border border-purple-600/40 text-purple-200 font-bold text-xs shadow active:scale-95 transition-all"
              >
                <Coins size={13} />
                <span>
                  {state?.isMortgaged
                    ? `Unmortgage ($${Math.ceil((space.mortgageValue || 50) * 1.1)})`
                    : `Mortgage ($${space.mortgageValue || 50})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
