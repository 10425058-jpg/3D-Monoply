import React from 'react';
import { Player, PropertyData, GROUP_COLORS } from './types';

export interface PlayerPanelsProps {
  players: Player[];
  activePlayerId: string;
  properties?: PropertyData[];
  onSelectPlayer?: (playerId: string) => void;
  onInspectProperty?: (propertyId: string) => void;
}

const TOKEN_ICONS: Record<string, { label: string; svg: React.ReactNode }> = {
  tophat: {
    label: 'Top Hat',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18h12v2H6v-2zm2-13h8v11H8V5zm-4 11h16v2H4v-2z" />
      </svg>
    ),
  },
  roadster: {
    label: 'Roadster',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    ),
  },
  trex: {
    label: 'T-Rex',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-5c-1.1 0-2 .9-2 2v3H9c-1.66 0-3 1.34-3 3v4H3v2h5v2h2v-4h3v4h2v-6h2v-2h-2V9h4V7h-3V6h5V4z" />
      </svg>
    ),
  },
  piggy: {
    label: 'Piggy Bank',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 10c-.36 0-.7.06-1.03.16C16.84 7.73 14.15 6 11 6c-3.87 0-7 2.69-7 6 0 1.48.63 2.84 1.68 3.89L5 19h2.5l.83-1.25c.85.16 1.74.25 2.67.25s1.82-.09 2.67-.25L14.5 19H17l-.68-3.11c.71-.71 1.24-1.59 1.49-2.57.38.11.78.18 1.19.18 1.1 0 2-.9 2-2s-.9-2-2-2z" />
      </svg>
    ),
  },
  battleship: {
    label: 'Battleship',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
      </svg>
    ),
  },
  dog: {
    label: 'Scottie Dog',
    svg: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 4l-2 3h-3l-2-2-3 3v3H5L3 9v9h3v-3h8v3h3v-6l4-3-3-5z" />
      </svg>
    ),
  },
};

export const PlayerPanels: React.FC<PlayerPanelsProps> = ({
  players,
  activePlayerId,
  properties = [],
  onSelectPlayer,
  onInspectProperty,
}) => {
  return (
    <aside className="pointer-events-auto flex flex-col gap-3 w-72 sm:w-80 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 select-none z-20">
      {players.map((player) => {
        const isCurrentTurn = player.id === activePlayerId && !player.isBankrupt;
        const ownedProps = properties.filter((p) => p.ownerId === player.id);
        const ownedCount = ownedProps.length || player.properties?.length || 0;
        const tokenEntry = TOKEN_ICONS[player.token] || TOKEN_ICONS.tophat;

        return (
          <div
            key={player.id}
            onClick={() => onSelectPlayer?.(player.id)}
            className={`relative rounded-2xl transition-all duration-300 backdrop-blur-md border p-3.5 ${
              player.isBankrupt
                ? 'bg-[#0B0F19]/60 border-white/5 opacity-55 grayscale'
                : isCurrentTurn
                ? 'bg-gradient-to-r from-[#131B2E]/95 to-[#0B0F19]/90 border-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.28)] translate-x-1'
                : 'bg-[#0B0F19]/80 border-white/10 hover:border-white/25 shadow-[0_8px_20px_rgba(0,0,0,0.45)]'
            } ${onSelectPlayer ? 'cursor-pointer' : ''}`}
          >
            {/* Active Player Gold Left Accent Bar */}
            {isCurrentTurn && (
              <div
                className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b from-[#F3E5AB] via-[#D4AF37] to-[#99731C]"
              />
            )}

            {/* Top Row: Avatar, Name, Badges, Cash */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {/* Token Avatar with Player Color Ring */}
                <div
                  className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                  style={{
                    backgroundColor: `${player.color}22`,
                    border: `2px solid ${player.color}`,
                    color: player.color,
                  }}
                >
                  {tokenEntry.svg}
                  {/* Color Dot */}
                  <span
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0B0F19]"
                    style={{ backgroundColor: player.color }}
                  />
                </div>

                {/* Player Name & Status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm text-[#F9F6F0] truncate">
                      {player.name}
                    </h3>
                    {player.isAI && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                        BOT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    {player.isBankrupt ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        Bankrupt
                      </span>
                    ) : isCurrentTurn ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-ping" />
                        Active Turn
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {tokenEntry.label}
                      </span>
                    )}

                    {player.inJail && !player.isBankrupt && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        In Jail
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cash Balance */}
              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-base sm:text-lg tracking-tight text-[#F3E5AB] tabular-nums">
                  ${player.cash.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {ownedCount} {ownedCount === 1 ? 'Deed' : 'Deeds'}
                </div>
              </div>
            </div>

            {/* Bottom Row: Property Color Pips */}
            {!player.isBankrupt && (
              <div className="mt-3 pt-2.5 border-t border-white/[0.07] flex items-center justify-between gap-2">
                {ownedProps.length > 0 ? (
                  <div className="flex items-center flex-wrap gap-1.5">
                    {ownedProps.map((prop) => {
                      const groupStyle = GROUP_COLORS[prop.group] || GROUP_COLORS.brown;
                      return (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectProperty?.(prop.id);
                          }}
                          title={`${prop.name}${prop.houses > 0 ? ` (${prop.houses === 5 ? 'Hotel' : `${prop.houses}H`})` : ''}`}
                          className="group relative w-4 h-5 rounded-[4px] transition-transform hover:scale-125 focus:outline-none"
                          style={{
                            backgroundColor: groupStyle.bg,
                            border: `1px solid ${groupStyle.border}`,
                            opacity: prop.isMortgaged ? 0.4 : 1,
                          }}
                        >
                          {prop.houses > 0 && (
                            <span
                              className={`block w-1.5 h-1.5 rounded-full mx-auto mt-0.5 ${
                                prop.houses === 5 ? 'bg-rose-400' : 'bg-emerald-300'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">
                    {ownedCount > 0 ? `${ownedCount} properties owned` : 'No properties acquired yet'}
                  </span>
                )}

                {player.getOutOfJailCards ? (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0"
                    title="Get Out of Jail Free Cards"
                  >
                    🗝️ ×{player.getOutOfJailCards}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
};

export default PlayerPanels;
