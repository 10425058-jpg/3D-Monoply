import React, { useState } from 'react';
import { Users, Crown, ChevronDown, Castle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { CharacterAvatar } from './Avatars';
import { sounds } from '../../utils/audio';

export const PlayerSidebar: React.FC = () => {
  const players = useGameStore(s => s.players);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const properties = useGameStore(s => s.properties);
  const [expanded, setExpanded] = useState(false);
  const active = players[currentPlayerIndex] || players[0];
  if (!active) return null;
  return <aside className={`fantasy-players royal-panel ${expanded ? 'is-expanded' : ''}`} aria-label="Players">
    <button className="players-collapse" aria-expanded={expanded} aria-controls="kingdom-players"
      onClick={() => { sounds.playClick(); setExpanded(v => !v); }}>
      <Crown size={17} /><span>{active.name}'s turn</span><strong>${active.money.toLocaleString()}</strong><ChevronDown size={15} />
    </button>
    <div className="players-content" id="kingdom-players">
      <div className="panel-heading"><Users size={18} /><h2>Players</h2><span>{players.filter(p => !p.isBankrupt).length}/{players.length}</span></div>
      <div className="kingdom-player-list">{players.map((player, index) => {
        const activeTurn = index === currentPlayerIndex && !player.isBankrupt;
        const count = Object.values(properties).filter(p => p.ownerId === player.id).length;
        return <article key={player.id} className={`kingdom-player ${activeTurn ? 'is-active' : ''} ${player.isBankrupt ? 'is-bankrupt' : ''}`}
          aria-current={activeTurn ? 'true' : undefined} style={{ '--player-color': player.color } as React.CSSProperties}>
          <div className="player-portrait"><CharacterAvatar character={player.name} size={48} hasCrown={activeTurn} /></div>
          <div className="player-details"><div className="player-name">{player.name}{activeTurn && <Crown size={13} />}</div>
            <strong className="player-money" key={player.money}>${player.money.toLocaleString()}</strong>
            <span className="player-status">{player.isBankrupt ? 'Bankrupt' : player.inJail ? 'In jail' : `${count} ${count === 1 ? 'property' : 'properties'} · ${player.isAI ? 'AI' : 'Player'}`}</span>
          </div>
          {activeTurn && <span className="turn-badge">{player.isAI ? 'AI turn' : 'Your turn'}</span>}
        </article>;
      })}</div>
      <div className="panel-seal" aria-hidden="true"><span /> <Castle size={19} /> <span /></div>
    </div>
  </aside>;
};
