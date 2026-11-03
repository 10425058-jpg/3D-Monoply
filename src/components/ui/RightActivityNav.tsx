import React from 'react';
import { Gift, Sparkles, BookOpen, ClipboardList } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';

export const RightActivityNav: React.FC<{
  onOpenDaily: () => void;
  onOpenSpin: () => void;
  onOpenAlbum: () => void;
  onOpenMissions: () => void;
}> = ({
  onOpenDaily,
  onOpenSpin,
  onOpenAlbum,
  onOpenMissions,
}) => {
  const metaProgress = useGameStore((s) => s.metaProgress);

  const hasDailyAvailable = React.useMemo(() => {
    if (!metaProgress || !metaProgress.lastDailyClaimDate) return true;
    const today = new Date().toISOString().split('T')[0];
    return metaProgress.lastDailyClaimDate !== today;
  }, [metaProgress]);

  const hasMissionsAvailable = React.useMemo(() => {
    if (!metaProgress) return true;
    const progress = metaProgress.missionProgress || { rolls: 0, purchases: 0, railroadEvents: 0 };
    return progress.rolls >= 1 || progress.purchases >= 1;
  }, [metaProgress]);

  const navItems = [
    {
      id: 'daily',
      label: 'Daily',
      icon: <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-white" />,
      bg: 'from-pink-500 to-rose-600',
      border: 'border-pink-300/40',
      shadow: 'shadow-[0_4px_16px_rgba(244,63,94,0.4)]',
      hasBadge: hasDailyAvailable,
      onClick: onOpenDaily,
    },
    {
      id: 'spin',
      label: 'Spin',
      icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-950" />,
      bg: 'from-amber-300 via-amber-400 to-yellow-500',
      border: 'border-amber-200',
      shadow: 'shadow-[0_4px_16px_rgba(245,158,11,0.4)]',
      hasBadge: false,
      onClick: onOpenSpin,
    },
    {
      id: 'album',
      label: 'Album',
      icon: <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />,
      bg: 'from-indigo-500 to-purple-600',
      border: 'border-indigo-300/40',
      shadow: 'shadow-[0_4px_16px_rgba(99,102,241,0.4)]',
      hasBadge: false,
      onClick: onOpenAlbum,
    },
    {
      id: 'missions',
      label: 'Missions',
      icon: <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-white" />,
      bg: 'from-emerald-500 to-teal-600',
      border: 'border-emerald-300/40',
      shadow: 'shadow-[0_4px_16px_rgba(16,185,129,0.4)]',
      hasBadge: hasMissionsAvailable,
      onClick: onOpenMissions,
    },
  ];

  return (
    <nav className="fixed right-2.5 sm:right-4 top-24 sm:top-24 z-20 flex flex-col gap-2 sm:gap-3 select-none pointer-events-auto">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            sounds.playClick();
            item.onClick();
          }}
          className="relative flex flex-col items-center justify-center w-11 h-13 sm:w-16 sm:h-18 p-1 rounded-2xl bg-purple-950/75 backdrop-blur-md border border-purple-400/30 hover:border-purple-300/60 shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-200 hover:scale-105 active:scale-95 group"
        >
          {item.hasBadge && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 sm:h-3.5 sm:w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-rose-500 border-2 border-white"></span>
            </span>
          )}

          <div
            className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b ${item.bg} border ${item.border} ${item.shadow} flex items-center justify-center transition-transform group-hover:rotate-6`}
          >
            {item.icon}
          </div>

          <span className="mt-0.5 text-[8px] sm:text-[11px] font-black text-purple-200 group-hover:text-white tracking-wide">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
};
