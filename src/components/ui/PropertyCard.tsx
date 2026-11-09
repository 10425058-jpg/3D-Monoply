import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, Crown, Home, Coins, TrainFront, Zap, Droplets, Castle } from 'lucide-react';
import type { BoardSpace, PropertyState, Player } from '../../types/game';
import { BOARD_SPACES } from '../../data/boardData';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';

const money = (value: number) => `$${value.toLocaleString('en-US')}`;

/** Original vector vignette; the art is decorative and never supplies game values. */
function PropertyArtwork({ space }: { space: BoardSpace }) {
  const id = useId().replace(/:/g, '');
  return <svg className="deed-artwork" viewBox="0 0 320 110" role="img" aria-label={`${space.type === 'railroad' ? 'Royal station' : space.type === 'utility' ? 'City utility' : 'Miniature townhouse'} illustration`}>
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#71609c" /><stop offset="1" stopColor="#d7bdd8" /></linearGradient></defs>
    <rect width="320" height="110" fill={`url(#${id})`} /><circle cx="263" cy="23" r="15" fill="#ffe9b5" />
    <path d="M0 83 Q55 50 110 78 T230 70 T320 80 V110 H0Z" fill="#5d8069" />
    <path d="M70 110L140 75H175L235 110" fill="#d7c6a9" />
    <g fill="#eee0bf" stroke="#a87c45" strokeWidth="1.5"><path d="M117 83V43L157 19L200 43V83Z" /><path d="M100 84V49L117 36L133 49V84Z" /><path d="M189 84V49L206 36L222 49V84Z" /></g>
    <g fill={space.type === 'property' ? space.colorHex : '#365991'} stroke="#e6ba69" strokeWidth="2"><path d="M108 44L157 12L209 44Z" /><path d="M94 49L117 27L140 49Z" /><path d="M183 49L206 27L229 49Z" /></g>
    <g fill="#ffdb82" stroke="#9c714c" strokeWidth="2"><path d="M146 84V65Q157 49 168 65V84Z" /><rect x="124" y="54" width="10" height="15" rx="5" /><rect x="181" y="54" width="10" height="15" rx="5" /></g>
    <g stroke="#76533f" strokeWidth="3"><path d="M49 96V66M270 95V63" /></g>
    <g fill="#eda7ce"><circle cx="49" cy="60" r="19" /><circle cx="35" cy="65" r="13" /><circle cx="272" cy="58" r="20" /><circle cx="289" cy="66" r="12" /></g>
    {space.type === 'railroad' && <g transform="translate(198 66)"><path d="M-24 31H84M-24 37H84" stroke="#dfc8a1" strokeWidth="3" /><path d="M0 21V2H28V21M28 9H56V22H-7V15H0" fill="#253e63" stroke="#eac46f" strokeWidth="2" /><path d="M44 9V-2H51V9" fill="#332c46" /><circle cx="7" cy="25" r="6" fill="#2b223a" /><circle cx="40" cy="25" r="6" fill="#2b223a" /><circle cx="57" cy="13" r="5" fill="#ffdc82" /></g>}
    {space.type === 'utility' && <g transform="translate(242 76)" stroke="#ffe9a8" strokeWidth="2" fill="#3c6c97"><circle r="18" />{space.id === 12 ? <path d="M3-12L-7 2H1L-3 12L9-3H2Z" fill="#ffe193" /> : <path d="M0-12Q-17 6 0 12Q17 6 0-12Z" fill="#90dbea" />}</g>}
  </svg>;
}

export const PropertyCard: React.FC<{
  space: BoardSpace; state?: PropertyState; owner?: Player; onClose: () => void;
}> = ({ space, state, owner, onClose }) => {
  const activePlayer = useGameStore(s => s.players[s.currentPlayerIndex]);
  const phase = useGameStore(s => s.turnPhase);
  const properties = useGameStore(s => s.properties);
  const canBuildHouse = useGameStore(s => s.canBuildHouse);
  const canSellHouse = useGameStore(s => s.canSellHouse);
  const buildHouse = useGameStore(s => s.buildHouse);
  const sellHouse = useGameStore(s => s.sellHouse);
  const toggleMortgage = useGameStore(s => s.toggleMortgage);
  const buyCurrentProperty = useGameStore(s => s.buyCurrentProperty);
  const reduced = useReducedMotion();
  const isOwner = !!activePlayer && state?.ownerId === activePlayer.id;
  const isHuman = activePlayer && !activePlayer.isAI && !activePlayer.isBankrupt;
  const canBuild = isOwner && isHuman && canBuildHouse(activePlayer.id, space.id);
  const canSell = isOwner && isHuman && canSellHouse(activePlayer.id, space.id);
  const groupHasHouses = BOARD_SPACES.some(s => s.colorGroup === space.colorGroup && (properties[s.id]?.houses ?? 0) > 0);
  const releaseCost = space.mortgageValue === undefined ? undefined : Math.ceil(space.mortgageValue * 1.1);
  const canMortgage = isOwner && isHuman && space.mortgageValue !== undefined &&
    (state?.isMortgaged ? activePlayer.money >= (releaseCost ?? 0) : !groupHasHouses);
  const canBuy = isHuman && phase === 'LANDED_ACTION' && activePlayer.position === space.id &&
    state?.ownerId === null && space.price !== undefined && activePlayer.money >= space.price;
  const group = space.colorGroup === 'none' ? space.type.replace(/_/g, ' ') :
    space.colorGroup === 'railroad' ? 'Railroad' : space.colorGroup === 'utility' ? 'Utility' : `${space.colorGroup.replace(/_/g, ' ')} group`;
  const Icon = space.type === 'railroad' ? TrainFront : space.type === 'utility' ? (space.id === 12 ? Zap : Droplets) : Castle;
  const rentLabels = ['Base rent', 'With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With hotel'];
  const rows = space.type === 'property' ? (space.rent ?? []).map((rent, index) => [rentLabels[index], money(rent)]) :
    space.type === 'railroad' ? (space.rent ?? []).map((rent, index) => [`${index + 1} railroad${index ? 's' : ''} owned`, money(rent)]) :
    space.type === 'utility' ? [['1 utility owned', '4 × dice total'], ['2 utilities owned', '10 × dice total']] : [];
  return <motion.section className="fantasy-deed" aria-label={`${space.name} title deed`}
    style={{ '--property-color': space.colorHex } as React.CSSProperties}
    initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 8 }}
    transition={{ duration: reduced ? 0 : 0.18 }} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className="deed-crown" aria-hidden="true"><Crown size={21} /></div>
    <button className="deed-close royal-icon" aria-label="Close property card" onClick={() => { sounds.playClick(); onClose(); }}><X size={20} /></button>
    <header className="deed-header"><span>✦ TITLE DEED ✦</span><h2>{space.name}</h2></header>
    <div className="deed-scroll">
      <div className="deed-group"><i />{group}</div>
      <div className="deed-illustration"><PropertyArtwork space={space} /></div>
      <dl className="deed-facts">
        {state && <div><dt>Owner</dt><dd className={owner ? 'has-owner' : ''}>{owner?.name ?? 'Unowned'}</dd></div>}
        {space.price !== undefined && <div><dt>Purchase price</dt><dd>{money(space.price)}</dd></div>}
        {space.mortgageValue !== undefined && <div><dt>Mortgage value</dt><dd>{money(space.mortgageValue)}</dd></div>}
        {state && <div><dt>Mortgage status</dt><dd>{state.isMortgaged ? 'Mortgaged' : 'Not mortgaged'}</dd></div>}
        {space.type === 'property' && state && <div><dt>Buildings</dt><dd>{state.houses === 5 ? 'Hotel' : `${state.houses} houses`}</dd></div>}
        {space.taxAmount !== undefined && <div><dt>Tax due</dt><dd>{money(space.taxAmount)}</dd></div>}
      </dl>
      {rows.length > 0 && <div className="deed-rents"><h3><Icon size={18} /> Rent schedule</h3>
        <table aria-label={`${space.name} rent schedule`}><tbody>{rows.map(([label, value]) =>
          <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
        {space.type === 'property' && <p>Unimproved rent doubles with a complete color group.</p>}
        {(space.type === 'railroad' || space.type === 'utility') && <p>Based on the owner's unmortgaged {space.type === 'railroad' ? 'railroads' : 'utilities'}. Card instructions may override rent.</p>}
      </div>}
      {state?.isMortgaged && <p className="deed-warning">Mortgaged · No rent collected</p>}
      <div className="deed-actions">
        {canBuy && <button className="royal-action is-primary" onClick={() => { buyCurrentProperty(); }}><Coins size={17} />Buy for {money(space.price!)}</button>}
        {isOwner && isHuman && space.type === 'property' && <>
          <button className="royal-action" disabled={!canBuild} title={canBuild ? 'Build on this property' : 'Requires a full color group, funds and even building'}
            onClick={() => { buildHouse(space.id); }}><Home size={16} />Build {space.houseCost !== undefined && money(space.houseCost)}</button>
          <button className="royal-action" disabled={!canSell} title="Sell a building using the existing even-selling rule"
            onClick={() => { sellHouse(space.id); }}>Sell {space.houseCost !== undefined && money(Math.floor(space.houseCost / 2))}</button>
        </>}
        {isOwner && isHuman && space.mortgageValue !== undefined && <button className="royal-action deed-mortgage" disabled={!canMortgage}
          title={canMortgage ? 'Change mortgage status' : state?.isMortgaged ? 'Insufficient cash to unmortgage' : 'Sell all buildings in this group first'}
          onClick={() => { toggleMortgage(space.id); }}><Coins size={16} />{state?.isMortgaged ? `Unmortgage ${money(releaseCost!)}` : `Mortgage ${money(space.mortgageValue)}`}</button>}
      </div>
    </div><div className="deed-footer" aria-hidden="true">◇ ✦ ◇</div>
  </motion.section>;
};
