import React from 'react';
import { Gift, Disc3, Layers, ClipboardCheck } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { DAILY_MISSIONS } from '../../data/metaGameData';
import { sounds } from '../../utils/audio';

export const RightActivityNav: React.FC<{
  onOpenDaily: () => void; onOpenSpin: () => void; onOpenAlbum: () => void; onOpenMissions: () => void;
}> = ({ onOpenDaily, onOpenSpin, onOpenAlbum, onOpenMissions }) => {
  const progress = useGameStore(s => s.metaProgress);
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const missionsReady = progress.missionDate === today && DAILY_MISSIONS.some(m =>
    !progress.missionClaimed.includes(m.id) && progress.missionProgress[m.stat] >= m.target);
  const items = [
    { name: 'Daily', Icon: Gift, action: onOpenDaily, badge: progress.lastDailyClaimDate !== today },
    { name: 'Spin', Icon: Disc3, action: onOpenSpin, badge: false },
    { name: 'Album', Icon: Layers, action: onOpenAlbum, badge: false },
    { name: 'Missions', Icon: ClipboardCheck, action: onOpenMissions, badge: missionsReady },
  ];
  return <nav className="fantasy-shortcuts" aria-label="City activities">{items.map(({ name, Icon, action, badge }) =>
    <button className="royal-shortcut" key={name} aria-label={name} aria-describedby={badge ? `reward-${name}` : undefined} onClick={() => { sounds.playClick(); action(); }}>
      <Icon aria-hidden="true" /><span>{name}</span>{badge && <><i className="reward-dot" aria-hidden="true" /><span className="sr-only" id={`reward-${name}`}>Reward available</span></>}
    </button>)}</nav>;
};
