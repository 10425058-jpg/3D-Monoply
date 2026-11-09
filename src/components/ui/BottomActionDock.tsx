import React from 'react';
import { BarChart3, BookOpen, ArrowLeftRight, Gavel, Home, Hammer, Landmark, Flag, Dice5, Dice3, Crown } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';
import { BOARD_SPACES } from '../../data/boardData';

export const BottomActionDock: React.FC<{
  onOpenStats: () => void; onOpenRules: () => void; onOpenTrade: () => void; onOpenAuction: () => void;
  autoRoll: boolean; onToggleAutoRoll: () => void;
}> = ({ onOpenStats, onOpenRules, onOpenTrade, onOpenAuction, autoRoll, onToggleAutoRoll }) => {
  const phase = useGameStore(s => s.turnPhase);
  const players = useGameStore(s => s.players);
  const currentIndex = useGameStore(s => s.currentPlayerIndex);
  const properties = useGameStore(s => s.properties);
  const speed = useGameStore(s => s.gameSpeed);
  const setGameSpeed = useGameStore(s => s.setGameSpeed);
  const selectedId = useGameStore(s => s.selectedSpaceId);
  const rollDice = useGameStore(s => s.rollDice);
  const buyCurrentProperty = useGameStore(s => s.buyCurrentProperty);
  const endTurn = useGameStore(s => s.endTurn);
  const buildHouse = useGameStore(s => s.buildHouse);
  const toggleMortgage = useGameStore(s => s.toggleMortgage);
  const canBuildHouse = useGameStore(s => s.canBuildHouse);
  const active = players[currentIndex];
  const human = !!active && !active.isAI && !active.isBankrupt;
  const canRoll = human && phase === 'PRE_ROLL';
  const rolling = phase === 'ROLLING' || phase === 'MOVING';
  const landed = active ? BOARD_SPACES[active.position] : undefined;
  const canBuy = human && phase === 'LANDED_ACTION' && landed?.price !== undefined &&
    properties[landed.id]?.ownerId === null && active.money >= landed.price;
  const canAuction = human && phase === 'LANDED_ACTION' && !!landed?.price && properties[landed.id]?.ownerId === null;
  const canBuild = selectedId !== null && human && canBuildHouse(active.id, selectedId);
  const selected = selectedId === null ? undefined : BOARD_SPACES[selectedId];
  const selectedState = selectedId === null ? undefined : properties[selectedId];
  const groupHasBuildings = selected && BOARD_SPACES.some(s => s.colorGroup === selected.colorGroup && (properties[s.id]?.houses ?? 0) > 0);
  const canMortgage = human && selected?.mortgageValue !== undefined && selectedState?.ownerId === active.id &&
    (selectedState?.isMortgaged ? active.money >= Math.ceil(selected.mortgageValue * 1.1) : !groupHasBuildings);
  const canEnd = human && phase === 'END_TURN';
  const actions = [
    { name: 'Buy', Icon: Home, enabled: canBuy, primary: canBuy,
      hint: canBuy ? `Buy ${landed?.name} for $${landed?.price}` : 'Land on an unowned property with enough cash to buy',
      run: () => { if (canBuy) { buyCurrentProperty(); } } },
    { name: 'Build', Icon: Hammer, enabled: canBuild, primary: false, hint: canBuild ? 'Build on selected property' : 'Select a property in a complete color group with enough cash',
      run: () => { if (canBuild && selectedId !== null) { buildHouse(selectedId); } } },
    { name: 'Mortgage', Icon: Landmark, enabled: canMortgage, primary: false,
      hint: canMortgage ? 'Mortgage or unmortgage selected property' : 'Select your property; sell group buildings or raise unmortgage funds first',
      run: () => { if (canMortgage && selectedId !== null) { toggleMortgage(selectedId); } } },
    { name: 'Trade', Icon: ArrowLeftRight, enabled: human, primary: false, hint: 'Trade properties and cash with a rival',
      run: () => { sounds.playClick(); onOpenTrade(); } },
    { name: 'Auction', Icon: Gavel, enabled: canAuction, primary: false, hint: canAuction ? 'Auction this unowned property' : 'Land on an unowned property to start an auction',
      run: () => { sounds.playClick(); onOpenAuction(); } },
    { name: 'End Turn', Icon: Flag, enabled: canEnd, primary: canEnd, hint: canEnd ? 'Finish your turn' : 'Complete your current action first',
      run: () => { if (canEnd) { sounds.playClick(); endTurn(); } } },
  ];
  return <footer className="fantasy-dock">
    <nav className="dock-utilities" aria-label="Game information">
      <button className="royal-utility" title="Game Statistics & Portfolio" onClick={() => { sounds.playClick(); onOpenStats(); }}><BarChart3 /><span>Stats</span></button>
      <button className="royal-utility" title="Monopoly Rules & Guide" onClick={() => { sounds.playClick(); onOpenRules(); }}><BookOpen /><span>Rules</span></button>
    </nav>
    <nav className="action-tray" aria-label="Game actions">
      <span className="dock-crest" aria-hidden="true"><Crown size={20} /></span>
      {actions.map(({ name, Icon, enabled, primary, hint, run }) =>
        <button key={name} className={`royal-action dock-action ${primary ? 'is-primary' : ''}`} disabled={!enabled} title={hint} onClick={run}>
          <Icon aria-hidden="true" /><span>{name}</span>
        </button>)}
    </nav>
    <div className="dice-controls">
      <div className="roll-options royal-panel">
        <label className="auto-roll-label"><span>Auto-roll</span><button type="button" role="switch" aria-checked={autoRoll} aria-label="Auto-roll" onClick={onToggleAutoRoll}><i /></button></label>
        <div className="speed-options" role="group" aria-label="Roll speed">
          {([1, 2] as const).map(value => <button key={value} aria-pressed={speed === value} onClick={() => { sounds.playClick(); setGameSpeed(value); }}>{value}x</button>)}
        </div>
      </div>
      <button className={`fantasy-roll ${rolling ? 'is-rolling' : ''}`} disabled={!canRoll}
        onClick={() => { if (canRoll) { rollDice(); } }}
        aria-label={rolling ? 'Dice rolling' : 'Roll dice'} title={canRoll ? 'Roll dice' : rolling ? 'Your token is moving' : 'Wait for your pre-roll phase'}>
        <Crown className="roll-crown" size={23} aria-hidden="true" />
        <span className="roll-dice-icons" aria-hidden="true"><Dice5 /><Dice3 /></span><strong>{rolling ? 'ROLLING' : 'ROLL'}</strong>
      </button>
    </div>
  </footer>;
};

export default BottomActionDock;
