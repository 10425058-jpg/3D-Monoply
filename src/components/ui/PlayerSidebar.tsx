import React, { useState } from 'react';
import { Users, Crown, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { CharacterAvatar } from './Avatars';
import { sounds } from '../../utils/audio';

export const PlayerSidebar: React.FC = () => {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const properties = useGameStore((s) => s.properties);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const activePlayer = players[currentPlayerIndex] || players[0];

  return (
    <aside className="fixed left-3 sm:left-4 top-16 sm:top-20 z-20 pointer-events-none select-none">
      <div className="sm:hidden pointer-events-auto flex flex-col gap-1">
        <button
          onClick={() => { sounds.playClick(); setMobileExpanded(!mobileExpanded); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-purple-950/85 backdrop-blur-md border border-purple-400/40 shadow-lg text-white"
        >
          <CharacterAvatar character={activePlayer.name} size={24} hasCrown={false} />
          <span className="text-xs font-black truncate max-w-[70px]">{activePlayer.name}</span>
          <span className="text-xs font-black text-emerald-400">${activePlayer.money}</span>
          {mobileExpanded ? <ChevronUp size={14} className="text-purple-300" /> : <ChevronDown size={14} className="text-purple-300" />}
        </button>

        {mobileExpanded && (
          <div className="w-56 p-2 rounded-2xl bg-purple-950/95 backdrop-blur-md border border-purple-400/40 shadow-2xl flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
            {players.map((player, idx) => {
              const isTurn = idx === currentPlayerIndex;
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 p-1.5 rounded-xl ${
                    isTurn ? 'bg-purple-800/80 border border-amber-400' : 'bg-purple-900/40'
                  }`}
                >
                  <CharacterAvatar character={player.name} size={30} hasCrown={false} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{player.name}</span>
                      {isTurn && <Crown size={12} className="text-amber-400 fill-amber-400" />}
                    </div>
                    <span className="text-xs font-black text-emerald-400">${player.money.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden sm:flex pointer-events-auto w-52 sm:w-56 p-2.5 rounded-3xl bg-purple-950/75 backdrop-blur-md border border-purple-400/35 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_rgba(255,255,255,0.15)] flex-col gap-2">
        <div className="flex items-center justify-between px-2 pt-0.5 pb-1">
          <div className="flex items-center gap-1.5 text-purple-200">
            <Users size={16} className="text-purple-300" />
            <span className="text-xs font-bold tracking-wide">Players</span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-purple-800/80 text-purple-200 border border-purple-600/40">
            {players.filter((p) => !p.isBankrupt).length}/{players.length}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {players.map((player, idx) => {
            const isTurn = idx === currentPlayerIndex;
            const ownedPropsCount = Object.values(properties).filter((p) => p.ownerId === player.id).length;

            return (
              <div
                key={player.id}
                className={`relative flex items-center gap-2.5 p-2 rounded-2xl transition-all duration-200 ${
                  player.isBankrupt
                    ? 'opacity-40 grayscale bg-slate-900/40 border border-slate-700/30'
                    : isTurn
                    ? 'bg-gradient-to-r from-purple-800/90 via-purple-700/85 to-indigo-900/90 border-2 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35),inset_0_1px_rgba(255,255,255,0.25)]'
                    : 'bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/20'
                }`}
              >
                <CharacterAvatar
                  character={player.name}
                  size={42}
                  hasCrown={false}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs sm:text-sm font-black text-white truncate drop-shadow-sm">
                      {player.name}
                    </span>
                    {isTurn && (
                      <Crown size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs sm:text-sm font-black tracking-tight text-emerald-400 drop-shadow">
                      ${player.money.toLocaleString()}
                    </span>
                    {player.inJail ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-rose-900/80 text-rose-300 border border-rose-500/40 flex items-center gap-0.5">
                        <ShieldAlert size={10} /> Jail
                      </span>
                    ) : ownedPropsCount > 0 ? (
                      <span className="text-[10px] font-semibold text-purple-300">
                        {ownedPropsCount} {ownedPropsCount === 1 ? 'prop' : 'props'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
