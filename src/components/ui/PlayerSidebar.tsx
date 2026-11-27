import React, { useState } from 'react';
import { Users, Crown, ChevronDown, Castle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { CharacterAvatar } from './Avatars';
import { sounds } from '../../utils/audio';
import { BalanceText } from './BalanceText';

export const PlayerSidebar: React.FC = () => {
  const players = useGameStore(s => s.players);
  const gameId = useGameStore(s => s.gameId);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const properties = useGameStore(s => s.properties);
  const phase = useGameStore(s => s.turnPhase);
  const pendingTrade = useGameStore(s => s.pendingTrade);
  const raid = useGameStore(s => s.railroadRaid);
  const winner = useGameStore(s => s.winner);
  const upgradeLandmark = useGameStore(s => s.upgradeLandmark);
  const landmarkUpgradeCost = useGameStore(s => s.landmarkUpgradeCost);
  const [expanded, setExpanded] = useState(false);
  const active = players[currentPlayerIndex] || players[0];
  if (!active) return null;
  const maximumLevel = active.landmarkLevel >= 5;
  const upgradeCost = landmarkUpgradeCost(active.id);
  let upgradeUnavailable = '';
  if (maximumLevel) upgradeUnavailable = 'Maximum landmark level reached.';
  else if (winner || active.isBankrupt) upgradeUnavailable = 'This player cannot upgrade after elimination or match completion.';
  else if (active.isAI) upgradeUnavailable = 'Wait for your own turn to upgrade.';
  else if (pendingTrade || raid || !['PRE_ROLL', 'END_TURN'].includes(phase)) upgradeUnavailable = 'Complete the current action before upgrading.';
  else if (active.money < upgradeCost) upgradeUnavailable = `Requires $${upgradeCost.toLocaleString()} cash.`;
  return <aside className={`fantasy-players royal-panel ${expanded ? 'is-expanded' : ''}`} aria-label="Players">
    <button className="players-collapse" aria-expanded={expanded} aria-controls="kingdom-players"
      onClick={() => { sounds.playClick(); setExpanded(v => !v); }}>
      <Crown size={17} /><span>{active.name}'s turn</span><BalanceText key={active.id} value={active.money} epoch={gameId} /><ChevronDown size={15} />
    </button>
    <div className="players-content" id="kingdom-players">
      <div className="panel-heading"><Users size={18} /><h2>Players</h2><span>{players.filter(p => !p.isBankrupt).length}/{players.length}</span></div>
      <section className="landmark-upgrade" aria-label={`${active.name}'s landmark`}>
        <div className="landmark-heading"><Castle size={16} aria-hidden="true" /><strong>Landmark · Level {active.landmarkLevel}/5</strong></div>
        <p className="landmark-income">GO income <b>${200 + active.landmarkLevel * 50}</b></p>
        {!maximumLevel && <p>Next level earns ${250 + active.landmarkLevel * 50} on GO (+$50).</p>}
        <button className="royal-action" disabled={!!upgradeUnavailable} aria-describedby="landmark-upgrade-status"
          onClick={event => { if (event.detail <= 1) upgradeLandmark(active.landmarkLevel, active.id); }}>
          {maximumLevel ? 'Maximum level' : `Upgrade for $${upgradeCost.toLocaleString()}`}
        </button>
        <p id="landmark-upgrade-status" role="status">{upgradeUnavailable || 'Available before rolling or at the end of your turn.'}</p>
      </section>
      <div className="kingdom-player-list">{players.map((player, index) => {
        const activeTurn = index === currentPlayerIndex && !player.isBankrupt;
        const count = Object.values(properties).filter(p => p.ownerId === player.id).length;
        return <article key={player.id} className={`kingdom-player ${activeTurn ? 'is-active' : ''} ${player.isBankrupt ? 'is-bankrupt' : ''} ${player.inJail ? 'is-jailed' : ''}`}
          aria-current={activeTurn ? 'true' : undefined} style={{ '--player-color': player.color } as React.CSSProperties}>
          <div className="player-portrait"><CharacterAvatar character={player.name} color={player.color} size={48} hasCrown={activeTurn} /></div>
          <div className="player-details"><div className="player-name">{player.name}{activeTurn && <Crown size={13} />}</div>
            <BalanceText value={player.money} epoch={gameId} className="player-money" />
            <span className="player-status">{player.isBankrupt ? 'Bankrupt' : player.inJail ? 'In jail' : `${count} ${count === 1 ? 'property' : 'properties'} · ${player.isAI ? 'AI' : 'Player'}`}</span>
          </div>
          {activeTurn && <span className="turn-badge">{player.isAI ? 'AI turn' : 'Your turn'}</span>}
        </article>;
      })}</div>
      <div className="panel-seal" aria-hidden="true"><span /> <Castle size={19} /> <span /></div>
    </div>
  </aside>;
};
