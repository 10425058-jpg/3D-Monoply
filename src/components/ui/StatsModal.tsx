import React from 'react';
import { RoyalModal, RoyalPanel, RoyalPresence } from './RoyalUI';
import { CharacterAvatar } from './Avatars';
import { BarChart3 } from 'lucide-react';
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

  return <RoyalPresence>{isOpen && <RoyalModal title="Empire Statistics" icon={BarChart3} size="large" dismissOnBackdrop
    onClose={() => { sounds.playClick(); onClose(); }} closeLabel="Close statistics">
    <h3>Player portfolios</h3>
    <div className="portfolio-grid">{players.map(player => {
      const owned = Object.values(properties).filter(property => property.ownerId === player.id);
      const propertyValue = owned.reduce((sum, property) => sum + (BOARD_SPACES[property.spaceId]?.price || 0), 0);
      return <RoyalPanel key={player.id}><h3><CharacterAvatar character={player.name} color={player.color} size={38} />{player.name}</h3>
        <dl className="royal-facts"><div><dt>Net worth</dt><dd>${(player.money + propertyValue).toLocaleString()}</dd></div>
          <div><dt>Cash</dt><dd>${player.money.toLocaleString()}</dd></div>
          <div><dt>{owned.length} properties</dt><dd>${propertyValue.toLocaleString()}</dd></div></dl>
      </RoyalPanel>;
    })}</div>
    <h3>Recent game events</h3>
    <ul className="royal-ledger">{logs.slice(0, 15).map(log =>
      <li key={log.id}><span>{log.message}</span><small>{log.timestamp}</small></li>)}</ul>
  </RoyalModal>}</RoyalPresence>;
};
