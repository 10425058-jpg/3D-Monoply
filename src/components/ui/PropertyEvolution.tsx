import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Coins, Crown, Hammer, MapPin, X } from 'lucide-react';
import { ARCADE_STAGES, arcadeLevel, arcadeNextLevel, arcadeRent, arcadeUpgradeCost } from '../../game/arcadeRules';
import { useGameStore } from '../../store/useGameStore';
import type { ArcadeLevel, BoardSpace, Player, PropertyState } from '../../types/game';
import './property-evolution.css';

const stages = [0, 1, 2, 3] as const;
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
const stageLabel = (level: ArcadeLevel) => `Level ${level} · ${ARCADE_STAGES[level].name}`;

export function PropertyEvolution({ space, state, owner, onClose }: {
  space: BoardSpace;
  state?: PropertyState;
  owner?: Player;
  onClose: () => void;
}) {
  const game = useGameStore();
  const player = game.players[game.currentPlayerIndex];
  const human = player && !player.isAI && !player.isBankrupt;
  const level = arcadeLevel(state);
  const next = arcadeNextLevel(level);
  const cost = next === undefined ? 0 : arcadeUpgradeCost(space, next);
  const landing = game.arcadeLanding?.spaceId === space.id ? game.arcadeLanding : null;
  const canUpgrade = !!(human && landing && game.canUpgradeProperty(player.id, space.id));
  const purchasePending = !!(human && state?.ownerId === null && player.position === space.id && game.turnPhase === 'LANDED_ACTION');
  const canBuy = purchasePending && player.money >= space.price!;
  const reduced = useReducedMotion();
  const status = !owner ? purchasePending && !canBuy ? `You need ${money(space.price! - player.money)} more to buy this street.` :
    'Purchase this street to begin development.' :
    next === undefined ? 'This property has reached its highest rent tier.' :
    state?.isMortgaged ? 'Release the mortgage to resume development.' :
    landing?.upgraded ? 'You’ve used this landing’s upgrade. You can upgrade again on a later visit.' :
    owner.id !== player?.id || !human ? `Owned by ${owner.name}.` :
    !landing ? 'Land on this street to upgrade it.' :
    player.money < cost ? `You need ${money(cost - player.money)} more for this upgrade.` : '';
  const resolvePurchase = (action: 'buyCurrentProperty' | 'declineProperty') => {
    const current = useGameStore.getState();
    if (current.gameId === game.gameId && current.players[current.currentPlayerIndex]?.position === space.id) current[action]();
  };

  return <motion.section className="fantasy-deed property-evolution" aria-label={`Property Evolution for ${space.name}`}
    initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 8 }}
    transition={{ duration: reduced ? 0 : .18 }} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <span className="deed-crown" aria-hidden="true"><Crown size={21} /></span>
    <button type="button" className="deed-close royal-icon" aria-label="Close property evolution" onClick={onClose}><X size={20} /></button>
    <header className="deed-header evolution-header">
      <h2>Property Evolution</h2>
      <div><span><MapPin size={17} aria-hidden="true" />{space.name}</span><strong>{owner ? stageLabel(level) : 'Unowned'}</strong></div>
    </header>
    <div className="deed-scroll evolution-scroll">
      <ol className="evolution-stages">
        {stages.map((stage, i) => {
          const entry = ARCADE_STAGES[stage];
          const current = !!owner && stage === level;
          return <li key={stage} aria-current={current ? 'step' : undefined} data-stage={entry.name.toLowerCase()}>
            {i > 0 && <ChevronRight className="evolution-arrow" size={16} aria-hidden="true" />}
            <img src={`${import.meta.env.BASE_URL}assets/models/arcade-properties/${entry.name.toLowerCase()}.png`} alt="" width={320} height={280} />
            <div className="evolution-stage-name"><small>Level {stage}</small><strong>{entry.name}</strong></div>
            <p>{entry.description}</p>
            <span className="evolution-stage-rent">{money(arcadeRent(space, stage))} rent</span>
          </li>;
        })}
      </ol>
      {owner && <dl className="evolution-facts">
        <div><dt>Owner</dt><dd>{owner.name}</dd></div>
        <div><dt>Current rent</dt><dd>{money(game.calculateRent(space.id, 0))}</dd></div>
        {next !== undefined && <div><dt>Next upgrade cost</dt><dd>{money(cost)}</dd></div>}
      </dl>}
    </div>
    <footer className="evolution-footer">
      {status && <p>{status}</p>}
      {purchasePending && <div className="evolution-purchase-actions">
        <button type="button" className="royal-action is-primary" disabled={!canBuy} onClick={() => resolvePurchase('buyCurrentProperty')}>
          <Coins size={17} aria-hidden="true" />Buy land for {money(space.price!)}
        </button>
        <button type="button" className="royal-action" onClick={() => resolvePurchase('declineProperty')}>Decline purchase</button>
      </div>}
      {!!owner && next !== undefined && <button type="button" className="royal-action is-primary" disabled={!canUpgrade} onClick={() => {
        if (landing) game.upgradeProperty(space.id, landing.id);
      }}><Hammer size={19} aria-hidden="true" />Upgrade to {ARCADE_STAGES[next].name} · {money(cost)}</button>}
    </footer>
  </motion.section>;
}
