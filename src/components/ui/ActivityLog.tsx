import React, { useEffect, useRef, useState } from 'react';
import { ActivityEvent, ActivityType } from './types';

export interface ActivityLogProps {
  events: ActivityEvent[];
  maxHeight?: string;
}

const EVENT_META: Record<ActivityType, { icon: string; badgeClass: string }> = {
  roll:     { icon: '🎲', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  move:     { icon: '♟️', badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  buy:      { icon: '🏠', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  rent:     { icon: '💸', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  card:     { icon: '🃏', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  trade:    { icon: '🤝', badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  build:    { icon: '🏗️', badgeClass: 'bg-lime-500/20 text-lime-300 border-lime-500/30' },
  jail:     { icon: '⛓️', badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  bankrupt: { icon: '💀', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  system:   { icon: '✨', badgeClass: 'bg-[#D4AF37]/20 text-[#F3E5AB] border-[#D4AF37]/30' },
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ events }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, isCollapsed]);

  return (
    <aside className="pointer-events-auto w-72 sm:w-80 bg-[#0B0F19]/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.55)] overflow-hidden select-none z-20 transition-all">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border-b border-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          <span className="text-xs font-serif font-bold uppercase tracking-[0.15em] text-[#F9F6F0]">
            Activity Log
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
            {events.length}
          </span>
        </div>

        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isCollapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Scrollable Feed */}
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="max-h-56 overflow-y-auto p-3 space-y-2 scroll-smooth"
        >
          {events.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 italic">
              Roll the dice to begin the game log...
            </div>
          ) : (
            events.map((ev) => {
              const meta = EVENT_META[ev.type] || EVENT_META.system;
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-colors text-xs"
                >
                  <span
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 text-xs ${meta.badgeClass}`}
                  >
                    {meta.icon}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      {ev.playerName ? (
                        <span
                          className="font-semibold truncate"
                          style={{ color: ev.playerColor || '#F3E5AB' }}
                        >
                          {ev.playerName}
                        </span>
                      ) : (
                        <span className="font-semibold text-[#D4AF37]">Bank</span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {ev.timestamp}
                      </span>
                    </div>

                    <p className="text-slate-300 leading-snug mt-0.5 break-words">
                      {ev.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
};

export default ActivityLog;
