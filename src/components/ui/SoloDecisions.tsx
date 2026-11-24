import React from 'react';
import { Coins, Flag, Gavel, Handshake, Scale } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { BOARD_SPACES } from '../../data/boardData';
import { unmortgageCost } from '../../game/soloRules';
import { ARCADE_STAGES, arcadeLevel, arcadeNextLevel, arcadeRent, arcadeSellRefund, arcadeUpgradeCost } from '../../game/arcadeRules';
import { sounds } from '../../utils/audio';
import { TradeTerms } from './TradeTerms';
import { RoyalArt, RoyalButton, RoyalModal, RoyalNotice, RoyalPresence } from './RoyalUI';
import { CharacterAvatar } from './Avatars';

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
type Game = ReturnType<typeof useGameStore.getState>;

function tradeConsent(game: Game) {
  const offer = game.pendingTrade!;
  const from = game.players.find(player => player.id === offer.fromPlayerId)!;
  const to = game.players.find(player => player.id === offer.toPlayerId)!;
  return <RoyalModal key="trade-consent" title="Review trade" titleId="trade-consent-title" icon={Handshake} priority="decision"
    description={`${to.name}, accept or reject the offer from ${from.name}.`}
    footer={<>
      <RoyalButton variant="danger" onClick={game.rejectTrade}>Reject trade</RoyalButton>
      <RoyalButton variant="primary" onClick={() => game.acceptTrade(to.id)}>Accept trade</RoyalButton>
    </>}>
    <TradeTerms from={from} to={to} offer={offer} properties={game.properties} ruleset={game.ruleset} />
  </RoyalModal>;
}

function auctionDecision(game: Game) {
  const auction = game.auction!;
  const bidder = game.players.find(player => player.id === auction.currentBidderId);
  const highest = game.players.find(player => player.id === auction.highestBidderId);
  const space = BOARD_SPACES[auction.spaceId];
  const minimumBid = auction.currentBid === 0 ? 10 : auction.currentBid + 1;
  const increments = auction.currentBid === 0 ? [10, 50] : [1, 10, 50];
  const submit = (action: () => void) => {
    if (useGameStore.getState().auction !== auction) return;
    sounds.playClick();
    action();
  };

  return <RoyalModal key="auction" title="Auction" titleId="auction-title" icon={Gavel} size="large" priority="decision" className="auction-modal"
    footer={<>
      <RoyalButton disabled={!bidder || bidder.isAI} onClick={event => {
        if (event.detail <= 1) submit(() => game.passAuction(bidder!.id));
      }}><Flag size={17} aria-hidden="true" />Pass bid</RoyalButton>
      {increments.map((increment, index) => <RoyalButton key={increment} variant={index === 0 ? 'primary' : 'secondary'}
        disabled={!bidder || bidder.isAI || bidder.money < auction.currentBid + increment}
        onClick={event => {
          if (event.detail <= 1) submit(() => game.placeAuctionBid(increment, bidder!.id, auction.currentBid));
        }}>Bid {money(auction.currentBid + increment)}</RoyalButton>)}
    </>}>
      <div className="auction-stage">
        <div className="auction-deed" style={{ '--deed-color': space.colorHex ?? '#9e8050' } as React.CSSProperties}>
          <h3>{space.name}</h3>
          {space.type === 'property' ? <img src={`${import.meta.env.BASE_URL}assets/models/arcade-properties/house.png`} alt="" /> : <Coins aria-hidden="true" size={52} />}
          <small>Original price</small><strong>{money(space.price ?? 0)}</strong>
          <small>{space.rent?.[0] ? `Base rent ${money(space.rent[0])}` : space.type === 'utility' ? 'Rent follows the dice' : 'Railroad'}</small>
        </div>
        <div className="auction-offer"><RoyalArt prop="gavel" />
          <span>Highest bid</span><strong>{highest ? money(auction.currentBid) : 'Opening bid'}</strong>
          <span>{highest ? `Held by ${highest.name}` : 'No bids yet'}</span>
          <p>Minimum next bid <b>{money(minimumBid)}</b></p>
        </div>
      </div>
      <div className="bidder-list">{game.players.filter(player => !player.isBankrupt).map(player =>
        <div key={player.id} className="bidder-seat" data-current={player.id === bidder?.id || undefined}
          style={{ '--seat': player.color } as React.CSSProperties}>
          <CharacterAvatar character={player.name} color={player.color} size={35} />
          <span><b>{player.name}</b><strong>{money(player.money)}</strong></span>
        </div>)}</div>
      <div className="auction-status" role="status">
        {bidder && <strong>{bidder.isAI ? `${bidder.name} is considering a bid` : `${bidder.name} to bid or pass`}</strong>}
        <small>{game.logs[0]?.message}</small>
      </div>
      {!!bidder && bidder.money < minimumBid && <RoyalNotice tone="ruby">Available cash is below the minimum bid.</RoyalNotice>}
    </RoyalModal>;
}

function debtDecision(game: Game, onOpenTrade: () => void) {
  const debt = game.pendingDebt!;
  const payer = game.players.find(player => player.id === (debt.debtorId ?? game.players[game.currentPlayerIndex].id))!;
  const creditor = game.players.find(player => player.id === debt.creditorId);
  const holdings = BOARD_SPACES.filter(space => game.properties[space.id]?.ownerId === payer.id);
  const insolvent = game.liquidationValue(payer.id) < debt.amount;
  return <RoyalModal key="debt" title={`${payer.name} owes ${money(debt.amount)}`} titleId="debt-title" icon={Scale} tone="ruby"
    priority="decision" className="debt-resolution" footer={<>
      <RoyalButton disabled={payer.isAI} onClick={onOpenTrade}>Trade to raise funds</RoyalButton>
      <RoyalButton variant="danger" disabled={payer.isAI || !insolvent}
        title={insolvent ? 'Insufficient liquidation value to pay' : 'Raise funds from your holdings before declaring bankruptcy'}
        onClick={game.declareBankruptcy}>Declare bankruptcy</RoyalButton>
      <RoyalButton variant="primary" disabled={payer.isAI || payer.money < debt.amount}
        onClick={game.settlePendingDebt}>Settle {money(debt.amount)}</RoyalButton>
    </>}>
    <RoyalNotice tone={payer.money < debt.amount ? 'ruby' : 'emerald'}>
      {debt.reason} · Pay {creditor?.name ?? 'the Bank'}. Cash available <strong>{money(payer.money)}</strong>.
    </RoyalNotice>
    <p>{payer.isAI ? 'The AI is raising funds using the same legal actions.' : game.ruleset === 'arcade' ?
      'Trade, sell development stages or mortgage eligible deeds, then settle the payment.' :
      'Trade, sell buildings evenly or mortgage eligible deeds, then settle the payment.'}</p>
    {!!holdings.length && <div className="debt-holdings">{holdings.map(space => {
      const property = game.properties[space.id];
      const arcade = game.ruleset === 'arcade' && space.type === 'property';
      const level = arcadeLevel(property);
      const sale = arcade ? arcadeSellRefund(space, level) : Math.floor((space.houseCost ?? 0) / 2);
      const development = arcade ? ARCADE_STAGES[level].name : property.houses === 5 ? 'Hotel' : `${property.houses} houses`;
      return <div className="debt-holding" key={space.id}><span>{space.name}<small>{development}{property.isMortgaged && ' · Mortgaged'}</small></span>
        <RoyalButton disabled={payer.isAI || !game.canSellHouse(payer.id, space.id)}
          onClick={() => game.sellHouse(space.id, arcade ? level : property.houses)}>Sell {money(sale)}</RoyalButton>
        <RoyalButton disabled={payer.isAI || !game.canToggleMortgage(payer.id, space.id)}
          onClick={event => { if (event.detail <= 1) game.toggleMortgage(space.id, property.isMortgaged); }}>
          {property.isMortgaged ? `Release ${money(unmortgageCost(space.mortgageValue ?? 0))}` : `Mortgage ${money(space.mortgageValue ?? 0)}`}
        </RoyalButton>
      </div>;
    })}</div>}
  </RoyalModal>;
}

interface DecisionProps {
  onOpenTrade: () => void;
  tradeOpen: boolean;
  onOpenEvolution: (spaceId: number) => void;
  evolutionOpen: boolean;
}

export function SoloDecisions({ onOpenTrade, tradeOpen, onOpenEvolution, evolutionOpen }: DecisionProps) {
  const game = useGameStore();
  let decision: React.ReactElement | null = null;
  if (!game.winner && game.players[game.currentPlayerIndex]) {
    if (game.pendingTrade) decision = tradeConsent(game);
    else if (game.turnPhase === 'AUCTION' && game.auction) decision = auctionDecision(game);
    else if (game.turnPhase === 'DEBT_RESOLUTION' && game.pendingDebt && !tradeOpen) decision = debtDecision(game, onOpenTrade);
  }
  return <>
    <RoyalPresence>{decision}</RoyalPresence>
    {!game.winner && !decision && boardDecision(game, onOpenEvolution, evolutionOpen)}
  </>;
}

function boardDecision(game: Game, onOpenEvolution: DecisionProps['onOpenEvolution'], evolutionOpen: boolean) {
  const active = game.players[game.currentPlayerIndex];
  if (!active || active.isAI || active.isBankrupt || game.railroadRaid) return null;
  if (active.inJail && game.turnPhase === 'PRE_ROLL') return <section className="solo-decision-strip" aria-label="Jail options">
    <strong>In Jail · attempt {active.jailTurns + 1} of 3</strong>
    <RoyalButton variant="primary" disabled={active.money < 50} onClick={game.payJailBail}>Pay $50 bail</RoyalButton>
    <RoyalButton disabled={active.getOutOfJailCards < 1} onClick={game.useJailCard}>Use Jail card</RoyalButton>
    <span>{active.money < 50 && 'Bail requires $50 cash. '}{active.getOutOfJailCards === 0 && 'No Jail card held. '}Roll to try doubles.</span>
  </section>;
  if(game.turnPhase==='LANDED_ACTION'){
    if (evolutionOpen && game.selectedSpaceId === active.position) return null;
    const space = BOARD_SPACES[active.position];
    const price = space.price ?? 0;
    const group = space.type === 'property' ? BOARD_SPACES.filter(candidate => candidate.colorGroup === space.colorGroup) : [];
    const completesGroup = game.ruleset !== 'arcade' && group.length > 0 &&
      group.every(candidate => candidate.id === space.id || game.properties[candidate.id]?.ownerId === active.id);
    return <section className="solo-decision-strip" aria-label="Purchase decision">
      <div className="purchase-details"><strong>{space.name} · {money(price)}</strong>
        <small data-short={active.money < price || undefined}>{active.money >= price ? `${money(active.money-price)} after purchase` : `${money(price-active.money)} short to buy`}</small></div>
      <details className="strategy-details"><summary>Property details</summary><div>
        {space.rent?.[0] ? <p>Base rent {money(space.rent[0])}</p> : <p>Utility rent uses the dice total.</p>}
        {completesGroup && <p>Buying completes your {space.colorGroup} group.</p>}
        {group.length > 0 && <ul>{group.map(deed => {
          const property = game.properties[deed.id];
          const owner = game.players.find(player => player.id === property?.ownerId);
          return <li key={deed.id}>{deed.name} · {owner?.name ?? 'Unowned'}{property?.isMortgaged ? ' · Mortgaged' : ''}</li>;
        })}</ul>}
      </div></details>
      <RoyalButton onClick={game.declineProperty}>Decline purchase</RoyalButton>
    </section>;
  }
  const landing = game.arcadeLanding;
  if (!evolutionOpen && landing && game.canUpgradeProperty(active.id, landing.spaceId)) {
    const space = BOARD_SPACES[landing.spaceId];
    const next = arcadeNextLevel(arcadeLevel(game.properties[space.id]));
    if (next !== undefined) return <section className="solo-decision-strip arcade-upgrade-strip" aria-label="Property development decision">
      <div className="purchase-details"><strong>{space.name}</strong><small>{money(arcadeRent(space, next))} rent after upgrade</small></div>
      <RoyalButton variant="primary" onClick={() => onOpenEvolution(space.id)}>
        Upgrade to {ARCADE_STAGES[next].name} · {money(arcadeUpgradeCost(space, next))}
      </RoyalButton>
    </section>;
  }
  return null;
}
