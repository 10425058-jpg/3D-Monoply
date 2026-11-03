import React from 'react';
import { X, BarChart3, TrendingUp, Clock3 } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { BOARD_SPACES } from '../../data/boardData';
import { sounds } from '../../utils/audio';

export const StatsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const players = useGameStore((s) => s.players);
  const properties = useGameStore((s) => s.properties);
  const logs = useGameStore((s) => s.logs);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md select-none"
      onClick={() => { sounds.playClick(); onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-gradient-to-b from-purple-900/95 via-purple-950/95 to-slate-950/95 border-2 border-purple-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_rgba(255,255,255,0.2)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-purple-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shadow">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">Empire Statistics</h2>
              <p className="text-xs font-medium text-purple-300">Portfolio values & activity log</p>
            </div>
          </div>
          <button
            onClick={() => { sounds.playClick(); onClose(); }}
            className="w-8 h-8 rounded-full bg-purple-800/60 hover:bg-purple-700 text-purple-200 hover:text-white flex items-center justify-center transition-transform active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 mb-3 flex items-center gap-1.5">
              <TrendingUp size={15} /> Tycoon Standings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {players.map((player) => {
                const owned = Object.values(properties).filter((p) => p.ownerId === player.id);
                const propertyValue = owned.reduce((sum, p) => sum + (BOARD_SPACES[p.spaceId]?.price || 0), 0);
                const netWorth = player.money + propertyValue;

                return (
                  <div
                    key={player.id}
                    className="p-3.5 rounded-2xl bg-purple-900/40 border border-purple-500/20 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: player.color }} />
                        <span className="font-black text-sm text-white">{player.name}</span>
                      </div>
                      <span className="text-xs font-bold text-amber-300">
                        Net: ${netWorth.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-purple-300">
                      <span>Cash: ${player.money.toLocaleString()}</span>
                      <span>{owned.length} properties (${propertyValue.toLocaleString()})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 mb-3 flex items-center gap-1.5">
              <Clock3 size={15} /> Recent Game Events
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {logs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/40 text-xs flex items-center justify-between gap-3 text-purple-200"
                >
                  <span className="leading-snug">{log.message}</span>
                  <span className="text-[10px] font-bold text-purple-400 shrink-0">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
