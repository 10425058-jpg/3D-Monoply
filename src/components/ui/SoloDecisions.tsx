import React from 'react';
import {useGameStore} from '../../store/useGameStore';
import {BOARD_SPACES} from '../../data/boardData';
import {unmortgageCost} from '../../game/soloRules';
import {TradeTerms} from './TradeTerms';
import {sounds} from '../../utils/audio';

const money=(n:number)=>`$${n.toLocaleString('en-US')}`;

/** Live Solo decision controls. Online keeps its server allowedActions UI. */
export function SoloDecisions({onOpenTrade, tradeOpen}: {onOpenTrade: () => void; tradeOpen: boolean}){
  const game=useGameStore(),active=game.players[game.currentPlayerIndex];
  if(game.winner||!active)return null;
  if(game.pendingTrade){
    const offer=game.pendingTrade,from=game.players.find(p=>p.id===offer.fromPlayerId)!,to=game.players.find(p=>p.id===offer.toPlayerId)!;
    return <div className="modal-backdrop"><section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="trade-consent-title">
      <div className="eyebrow">LOCAL PLAYER DECISION</div><h2 id="trade-consent-title">{to.name}, review this trade</h2>
      <TradeTerms from={from} to={to} offer={offer} properties={game.properties} />
      <div className="trade-modal-actions"><button className="console-button secondary" onClick={game.rejectTrade}>Reject trade</button>
        <button className="console-button primary" onClick={()=>game.acceptTrade(to.id)}>Accept trade</button></div>
    </section></div>;
  }
  if(game.turnPhase==='AUCTION'&&game.auction){
    const auction=game.auction,bidder=game.players.find(p=>p.id===auction.currentBidderId),highest=game.players.find(p=>p.id===auction.highestBidderId);
    const space=BOARD_SPACES[auction.spaceId];
    const minimumBid=auction.currentBid===0?10:auction.currentBid+1;
    const increments=auction.currentBid===0?[10,50]:[1,10,50];
    const lastAction=game.logs[0]?.message;
    const submit=(action:()=>void)=>{if(useGameStore.getState().auction===auction){sounds.playClick();action();}};
    return <div className="modal-backdrop"><section className="game-modal auction-modal" role="dialog" aria-modal="true" aria-labelledby="auction-title"
      style={{ '--auction-color': space.colorHex } as React.CSSProperties}>
      <div className="eyebrow">BANK AUCTION</div><h2 id="auction-title">{space.name}</h2>
      <p>Listed at {money(space.price ?? 0)}{space.rent?.[0] ? ` · Base rent ${money(space.rent[0])}` : ' · Utility rent follows the dice'}</p>
      <dl className="auction-bids">
        <div><dt>Highest bid</dt><dd>{highest ? money(auction.currentBid) : '—'}</dd><small>{highest?.name ?? 'Opening bid'}</small></div>
        <div><dt>Minimum next bid</dt><dd>{money(minimumBid)}</dd></div>
        <div><dt>{bidder?.name ?? 'Bidder'}’s cash</dt><dd>{money(bidder?.money ?? 0)}</dd></div>
      </dl>
      <p role="status">{lastAction} {bidder?.isAI ? `${bidder.name} is considering a bid.` : `${bidder?.name}, bid or pass.`}</p>
      {!!bidder && bidder.money < minimumBid && <p className="trade-feedback is-warning">Available cash is below the minimum bid.</p>}
      <div className="trade-modal-actions">
        <button className="console-button secondary" disabled={!bidder||bidder.isAI} onClick={event=>{if(event.detail<=1)submit(()=>game.passAuction(bidder!.id));}}>Pass bid</button>
        {increments.map(increment=><button key={increment} className="console-button primary" disabled={!bidder||bidder.isAI||bidder.money<auction.currentBid+increment}
          onClick={event=>{if(event.detail<=1)submit(()=>game.placeAuctionBid(increment,bidder!.id,auction.currentBid));}}>Bid {money(auction.currentBid+increment)}</button>)}
      </div>
    </section></div>;
  }
  if(game.turnPhase==='DEBT_RESOLUTION'&&game.pendingDebt){
    if(tradeOpen)return null;
    const debt=game.pendingDebt,payer=game.players.find(p=>p.id===(debt.debtorId??active.id))!;
    const creditor=game.players.find(p=>p.id===debt.creditorId);
    const holdings=BOARD_SPACES.filter(s=>game.properties[s.id]?.ownerId===payer.id);
    const insolvent=game.liquidationValue(payer.id)<debt.amount;
    return <div className="modal-backdrop"><section className="game-modal debt-resolution" role="dialog" aria-modal="true" aria-labelledby="debt-title">
      <div className="eyebrow">RESOLVE PAYMENT</div><h2 id="debt-title">{payer.name} owes {money(debt.amount)}</h2>
      <p>{debt.reason} · Pay {creditor?.name??'the Bank'}. Cash available: <strong>{money(payer.money)}</strong>.</p>
      <p>{payer.isAI?'The AI is raising funds using the same legal actions.':'Trade, sell buildings evenly or mortgage eligible deeds, then settle the payment.'}</p>
      <div className="debt-holdings">{holdings.map(s=>{
        const property=game.properties[s.id];
        return <div className="debt-holding" key={s.id}><span>{s.name}<small>{property.houses===5?'Hotel':`${property.houses} houses`}{property.isMortgaged?' · Mortgaged':''}</small></span>
          <button className="console-button secondary" disabled={payer.isAI||!game.canSellHouse(payer.id,s.id)} onClick={()=>game.sellHouse(s.id)}>Sell {money(Math.floor((s.houseCost??0)/2))}</button>
          <button className="console-button secondary" disabled={payer.isAI||!game.canToggleMortgage(payer.id,s.id)} onClick={event=>{if(event.detail<=1)game.toggleMortgage(s.id,property.isMortgaged);}}>
            {property.isMortgaged?`Release ${money(unmortgageCost(s.mortgageValue??0))}`:`Mortgage ${money(s.mortgageValue??0)}`}</button>
        </div>;
      })}</div>
      <div className="trade-modal-actions"><button className="console-button secondary" disabled={payer.isAI} onClick={onOpenTrade}>Trade to raise funds</button>
        <button className="console-button secondary" disabled={payer.isAI||!insolvent} title={insolvent?'Insufficient liquidation value to pay':'Raise funds from your holdings before declaring bankruptcy'} onClick={game.declareBankruptcy}>Declare bankruptcy</button>
        <button className="console-button primary" disabled={payer.isAI||payer.money<debt.amount} onClick={game.settlePendingDebt}>Settle {money(debt.amount)}</button></div>
    </section></div>;
  }
  if(active.isAI||active.isBankrupt||game.railroadRaid)return null;
  if(active.inJail&&game.turnPhase==='PRE_ROLL')return <section className="solo-decision-strip" aria-label="Jail options">
    <span>In Jail · attempt {active.jailTurns+1} of 3</span>
    <button className="royal-action" disabled={active.money<50} onClick={game.payJailBail}>Pay $50 bail</button>
    <button className="royal-action" disabled={active.getOutOfJailCards<1} onClick={game.useJailCard}>Use Jail card</button>
    <span>{active.money < 50 && 'Bail requires $50 cash. '}{active.getOutOfJailCards === 0 && 'No Jail card held. '}Roll to try doubles.</span>
  </section>;
  if(game.turnPhase==='LANDED_ACTION'){
    const space = BOARD_SPACES[active.position];
    const price = space.price ?? 0;
    const group = space.type === 'property' ? BOARD_SPACES.filter(candidate => candidate.colorGroup === space.colorGroup) : [];
    const completesGroup = group.length > 0 && group.every(candidate => candidate.id === space.id || game.properties[candidate.id]?.ownerId === active.id);
    return <section className="solo-decision-strip" aria-label="Purchase decision">
      <div className="purchase-details"><strong>{space.name} · {money(price)}</strong>
        <small>{active.money >= price ? `${money(active.money-price)} after purchase` : `${money(price-active.money)} short to buy`}</small></div>
      <details className="strategy-details"><summary>Property details</summary><div>
        {space.rent?.[0] ? <p>Base rent {money(space.rent[0])}</p> : <p>Utility rent uses the dice total.</p>}
        {completesGroup && <p>Buying completes your {space.colorGroup} group.</p>}
        {group.length > 0 && <ul>{group.map(deed => {
          const property = game.properties[deed.id];
          const owner = game.players.find(player => player.id === property?.ownerId);
          return <li key={deed.id}>{deed.name} · {owner?.name ?? 'Unowned'}{property?.isMortgaged ? ' · Mortgaged' : ''}</li>;
        })}</ul>}
      </div></details>
      <button className="royal-action" onClick={game.declineProperty}>Decline purchase</button>
    </section>;
  }
  return null;
}
