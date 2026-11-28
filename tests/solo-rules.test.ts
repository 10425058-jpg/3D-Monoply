import {test} from 'node:test';
import assert from 'node:assert/strict';
import {useGameStore as store} from '../src/store/useGameStore';
import {BOARD_SPACES,getSpaceTransform} from '../src/data/boardData';
import {CHANCE_CARDS,COMMUNITY_CHEST_CARDS} from '../src/data/cardsData';
import {runSoloAiRaid, runSoloAiStep} from '../src/game/soloAi';
import {unmortgageCost} from '../src/game/soloRules';

const setup=(t:any,n=3)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  store.getState().startNewGame(Array.from({length:n},(_,id)=>({name:`Player ${id+1}`,isAI:id===1,token:'rubber_duck' as const,color:['#d39b32','#e773ac','#4484dc'][id]})));
  return store.getState();
};
const player=(id:number,patch:object)=>store.setState(s=>({players:s.players.map(p=>p.id===id?{...p,...patch}:p)}));
const own=(id:number,ownerId:number,houses=0,isMortgaged=false)=>store.setState(s=>({properties:{...s.properties,[id]:{spaceId:id,ownerId,houses,isMortgaged}}}));
const flush=(t:any)=>{for(let i=0;i<60&&['ROLLING','MOVING'].includes(store.getState().turnPhase);i++)t.mock.timers.tick(200);};
const roll=(t:any,a:number,b:number)=>{
  const faces=[a,b];const random=t.mock.method(Math,'random',()=>faces.length?(faces.shift()!-.5)/6:.4);
  store.getState().rollDice();flush(t);random.mock.restore();
};
const economy=()=>({players:store.getState().players,properties:store.getState().properties,phase:store.getState().turnPhase});
const draw=(id:string)=>{const card=[...CHANCE_CARDS,...COMMUNITY_CHEST_CARDS].find(c=>c.id===id)!;store.setState({activeCard:card,turnPhase:'CARD_DRAWN'});store.getState().applyActiveCard();};

test('catalog has 40 unique clockwise spaces, eight street groups, 28 deeds and fixed transforms',()=>{
  assert.deepEqual(BOARD_SPACES.map(s=>s.id),Array.from({length:40},(_,i)=>i));
  assert.equal(BOARD_SPACES.filter(s=>s.price).length,28);
  for(const [id,type] of [[0,'go'],[10,'jail'],[20,'free_parking'],[30,'go_to_jail']] as const)assert.equal(BOARD_SPACES[id].type,type);
  assert.deepEqual(BOARD_SPACES.filter(s=>s.type==='chance').map(s=>s.id),[7,22,36]);
  assert.deepEqual(BOARD_SPACES.filter(s=>s.type==='chest').map(s=>s.id),[2,17,33]);
  for(const s of BOARD_SPACES){const tf=getSpaceTransform(s.id);assert.ok(tf.position.every(Number.isFinite));assert.equal(tf.isCorner,s.id%10===0);if(s.type==='property')assert.equal(s.rent!.length,6);}
});
test('setup, stored dice, duplicate roll, clockwise movement and duplicate purchase',t=>{
  setup(t);const faces=[1,2];t.mock.method(Math,'random',()=>faces.length?(faces.shift()!-.5)/6:.4);
  store.getState().rollDice();store.getState().rollDice();flush(t);
  assert.deepEqual(store.getState().dice,[1,2]);assert.equal(store.getState().players[0].position,3);
  store.getState().buyCurrentProperty();store.getState().buyCurrentProperty();
  assert.equal(store.getState().players[0].money,1440);assert.equal(store.getState().properties[3].ownerId,0);
});
test('GO pays once with the existing landmark bonus; backwards card pays no salary',t=>{
  setup(t);player(0,{position:38,landmarkLevel:2});roll(t,1,1);assert.equal(store.getState().players[0].money,1800);
  draw('ch_8');flush(t);assert.equal(store.getState().players[0].position,37);assert.equal(store.getState().players[0].money,1800);
});
test('Solo creates a single receipt only after a committed purchase or rent payment', t => {
  setup(t);
  store.getState().buyCurrentProperty();
  assert.ok(!store.getState().logs.some(log => log.transfers?.length));
  roll(t, 1, 2);
  store.getState().buyCurrentProperty();
  store.getState().buyCurrentProperty();
  assert.deepEqual(store.getState().logs.flatMap(log => log.transfers ?? []), [
    { fromId: 0, toId: null, amount: 60, reason: 'Purchased Baltic Avenue', category: 'purchase', spaceId: 3 },
  ]);
  own(3, 1);
  player(0, { position: 0 });
  store.setState({ turnPhase: 'PRE_ROLL' });
  roll(t, 1, 2);
  const pending = store.getState();
  assert.deepEqual(pending.players.map(candidate => candidate.money), [1440, 1500, 1500]);
  assert.equal(pending.pendingDebt?.creditorId, 1);
  assert.equal(pending.activity.filter(event => event.kind === 'rent').length, 0);
  pending.endTurn();
  pending.rollDice();
  assert.equal(store.getState(), pending);
  let commits = 0;
  const unsubscribe = store.subscribe((next, previous) => {
    if (next.players[0].money === previous.players[0].money) return;
    commits++;
    assert.equal(next.pendingDebt, null);
    assert.equal(next.logs[0].transfers?.[0].category, 'rent');
    assert.deepEqual(next.players.map(candidate => candidate.money), [1436, 1504, 1500]);
  });
  pending.settlePendingDebt(pending.pendingDebt!);
  pending.settlePendingDebt(pending.pendingDebt!);
  unsubscribe();
  assert.equal(commits, 1);
  assert.deepEqual(store.getState().logs[0].transfers, [
    { fromId: 0, toId: 1, amount: 4, reason: 'Rent on Baltic Avenue', category: 'rent', spaceId: 3 },
  ]);
  assert.deepEqual(store.getState().players.map(candidate => candidate.money), [1436, 1504, 1500]);
  assert.equal(store.getState().activity.filter(event => event.kind === 'rent').length, 1);
});

test('a human landing keeps the card face down until a single draw, then waits for confirmation', t => {
  setup(t);
  const card = CHANCE_CARDS.find(candidate => candidate.id === 'ch_6')!;
  const deck = [card, ...CHANCE_CARDS.filter(candidate => candidate !== card)];
  store.setState({ chanceDeck: deck });
  own(5, 0);
  player(0, { position: 4 });
  roll(t, 1, 2);

  const pending = store.getState();
  assert.equal(pending.turnPhase, 'CARD_PENDING');
  assert.equal(pending.activeCard, null);
  assert.equal(pending.chanceDeck, deck);
  assert.ok(!pending.logs.some(log => log.message.includes(card.title)));
  pending.applyActiveCard(pending.cardDrawId);
  pending.drawPendingCard(pending.cardDrawId - 1);
  pending.endTurn();
  pending.toggleMortgage(5);
  assert.equal(pending.claimDailyReward(), false);
  assert.equal(store.getState(), pending);

  pending.drawPendingCard(pending.cardDrawId);
  pending.drawPendingCard(pending.cardDrawId);
  const drawn = store.getState();
  assert.equal(drawn.activeCard, card);
  assert.equal(drawn.turnPhase, 'CARD_DRAWN');
  assert.deepEqual(drawn.chanceDeck, [...deck.slice(1), card]);
  assert.equal(drawn.players[0].money, 1500);
  drawn.applyActiveCard(drawn.cardDrawId - 1);
  assert.equal(store.getState(), drawn);
  drawn.applyActiveCard(drawn.cardDrawId);
  drawn.applyActiveCard(drawn.cardDrawId);
  assert.equal(store.getState().players[0].money, 1550);
  assert.equal(store.getState().activity.filter(event => event.kind === 'card').length, 1);
});

test('a chained Chest draw has a fresh decision and restart invalidates both old controls', t => {
  const game = setup(t);
  const backwards = CHANCE_CARDS.find(card => card.id === 'ch_8')!;
  const chest = COMMUNITY_CHEST_CARDS.find(card => card.id === 'cc_2')!;
  store.setState({ chanceDeck: [backwards], chestDeck: [chest] });
  player(0, { position: 33 });
  roll(t, 1, 2);
  const chanceId = store.getState().cardDrawId;
  game.drawPendingCard(chanceId);
  game.applyActiveCard(chanceId);
  flush(t);
  const next = store.getState();
  assert.equal(next.players[0].position, 33);
  assert.equal(next.turnPhase, 'CARD_PENDING');
  assert.equal(next.activeCard, null);
  assert.equal(next.chestDeck[0], chest);
  game.drawPendingCard(chanceId);
  assert.equal(store.getState(), next);
  game.drawPendingCard(next.cardDrawId);
  game.applyActiveCard(chanceId);
  assert.equal(store.getState().activeCard, chest);
  game.applyActiveCard(next.cardDrawId);
  assert.equal(store.getState().players[0].money, 1700);
  assert.deepEqual(store.getState().activity.flatMap(event => event.card ? [event.card.id] : []), [backwards.id, chest.id]);

  game.startNewGame(game.players);
  roll(t, 1, 1);
  game.drawPendingCard(next.cardDrawId);
  assert.equal(store.getState().activeCard, null);
  game.drawPendingCard(store.getState().cardDrawId);
  game.applyActiveCard(next.cardDrawId);
  assert.equal(store.getState().turnPhase, 'CARD_DRAWN');
});

test('the Solo heist AI selects a vault without reading its hidden payout', t => {
  const game = setup(t);
  const raid = { attackerId: 1, mode: 'heist', vaultRewards: [150, 550, 300] } as const;
  store.setState({ currentPlayerIndex: 1, turnPhase: 'END_TURN', railroadRaid: { ...raid, vaultRewards: [...raid.vaultRewards] } });
  const random = t.mock.method(Math, 'random', () => .1);
  runSoloAiRaid(game.gameId, store.getState().railroadRaid!);
  random.mock.restore();
  assert.equal(store.getState().players[1].money, 1650);
  assert.equal(store.getState().railroadRaid, null);
});
test('third doubles sends directly to Jail; Jail doubles do not grant another roll',t=>{
  setup(t);store.setState({doublesCount:2});player(0,{position:39});roll(t,2,2);
  assert.equal(store.getState().players[0].position,10);assert.equal(store.getState().players[0].money,1500);assert.equal(store.getState().doublesCount,0);
  store.setState({turnPhase:'PRE_ROLL'});roll(t,2,2);store.getState().declineProperty();store.getState().endTurn();assert.equal(store.getState().currentPlayerIndex,1);
});
test('Jail third failed attempt can raise bail and then moves the original dice once',t=>{
  setup(t);player(0,{position:10,inJail:true,jailTurns:2,money:20});own(5,0);roll(t,1,2);
  assert.equal(store.getState().turnPhase,'DEBT_RESOLUTION');store.getState().toggleMortgage(5);store.getState().settlePendingDebt();flush(t);
  assert.equal(store.getState().players[0].position,13);assert.equal(store.getState().players[0].money,70);assert.equal(store.getState().players[0].inJail,false);
});
test('AI has the same legal auction entry as a human',t=>{
  setup(t);store.setState({currentPlayerIndex:1,turnPhase:'LANDED_ACTION'});player(1,{position:3});store.getState().auctionCurrentProperty();assert.equal(store.getState().turnPhase,'AUCTION');
});
test('auction opening is at least 10; stale bidder cannot submit twice',t=>{
  setup(t);player(0,{position:3});store.setState({turnPhase:'LANDED_ACTION'});store.getState().auctionCurrentProperty();
  (store.getState().placeAuctionBid as any)(1,0);assert.equal(store.getState().auction?.currentBid,0);
  (store.getState().placeAuctionBid as any)(10,0);const bid=store.getState().auction?.currentBid;
  (store.getState().placeAuctionBid as any)(10,0);assert.equal(store.getState().auction?.currentBid,bid);
});
test('auction completes below catalog price and charges winner exactly once',t=>{
  setup(t);player(0,{position:3});store.setState({turnPhase:'LANDED_ACTION'});store.getState().auctionCurrentProperty();
  store.getState().placeAuctionBid(10);store.getState().passAuction();store.getState().passAuction();store.getState().passAuction();
  assert.equal(store.getState().properties[3].ownerId,0);assert.equal(store.getState().players[0].money,1490);
});
test('building, sale and mortgage actions cannot mutate an ended or moving game',t=>{
  setup(t);own(1,0,1);own(3,0,1);own(5,0);
  for(const turnPhase of ['ROLLING','MOVING','AUCTION','GAME_OVER'] as const){store.setState({turnPhase});const before=economy();store.getState().buildHouse(1);store.getState().sellHouse(1);store.getState().toggleMortgage(5);assert.deepEqual(economy(),before);}
});
test('unmortgaging 100 principal costs exactly 110, not floating-point 111',t=>{
  setup(t);own(5,0,0,true);store.getState().toggleMortgage(5);assert.equal(store.getState().players[0].money,1390);
});
test('even construction, hotel upgrade and even sale preserve costs and rents',t=>{
  setup(t);own(1,0);own(3,0);store.getState().buildHouse(1);assert.equal(store.getState().canBuildHouse(0,1),false);
  for(let i=0;i<7;i++)store.getState().buildHouse(i%2?1:3);
  store.getState().buildHouse(1);assert.equal(store.getState().properties[1].houses,5);assert.equal(store.getState().calculateRent(1,7),250);
  store.getState().sellHouse(1);assert.equal(store.getState().properties[1].houses,4);assert.equal(store.getState().players[0].money,1075);
});
test('held Jail card leaves the deck and returns to its original source once',t=>{
  setup(t);player(0,{position:4});const jail=CHANCE_CARDS.find(c=>c.id==='ch_7')!;store.setState({chanceDeck:[jail,...CHANCE_CARDS.filter(c=>c.id!==jail.id)]});roll(t,1,2);
  store.getState().drawPendingCard(store.getState().cardDrawId);
  store.getState().applyActiveCard();assert.ok(!store.getState().chanceDeck.some(c=>c.id==='ch_7'));
  player(0,{position:10,inJail:true});store.setState({turnPhase:'PRE_ROLL'});store.getState().useJailCard();store.getState().useJailCard();
  assert.equal(store.getState().chanceDeck.at(-1)?.id,'ch_7');assert.equal(store.getState().players[0].getOutOfJailCards,0);
});
test('pay-each card keeps the actual next creditor when funds run out',t=>{
  setup(t);player(0,{money:80});draw('ch_14');assert.equal(store.getState().players[1].money,1550);assert.equal(store.getState().pendingDebt?.creditorId,2);assert.equal(store.getState().pendingDebt?.amount,50);
});
test('birthday obligations allow the actual payer to liquidate and settle in order',t=>{
  setup(t);player(1,{money:5});own(1,1);draw('cc_9');assert.equal((store.getState().pendingDebt as any)?.debtorId,1);
  store.getState().toggleMortgage(1);store.getState().settlePendingDebt();
  assert.equal(store.getState().players[1].money,25);assert.equal(store.getState().players[0].money,1520);assert.equal(store.getState().players[2].money,1490);
});
test('bankruptcy is rejected outside an unresolved debt and after victory',t=>{
  setup(t);for(const turnPhase of ['PRE_ROLL','MOVING','GAME_OVER'] as const){store.setState({turnPhase});const before=economy();store.getState().declareBankruptcy();assert.deepEqual(economy(),before);}
});
test('bankruptcy transfers liquidation value, deeds and advances past eliminated active player',t=>{
  setup(t);player(0,{money:5});own(1,0,1);own(3,0,1);store.setState({turnPhase:'DEBT_RESOLUTION',pendingDebt:{amount:1000,creditorId:1,reason:'Rent'}});store.getState().declareBankruptcy();
  assert.equal(store.getState().players[1].money,1555);assert.equal(store.getState().properties[1].ownerId,1);assert.equal(store.getState().properties[1].houses,0);assert.equal(store.getState().currentPlayerIndex,1);assert.equal(store.getState().turnPhase,'PRE_ROLL');
});
test('last solvent player wins without requiring browser graphics',t=>{
  setup(t,2);store.setState({turnPhase:'DEBT_RESOLUTION',pendingDebt:{amount:2000,creditorId:null,reason:'Tax'}});store.getState().declareBankruptcy();assert.equal(store.getState().winner?.id,1);assert.equal(store.getState().turnPhase,'GAME_OVER');
});
test('railroad decision blocks turn advancement; invalid vault indices never corrupt money',t=>{
  setup(t);store.setState({turnPhase:'END_TURN',railroadRaid:{attackerId:0,mode:'heist',vaultRewards:[150,300,550]}});store.getState().endTurn();assert.equal(store.getState().currentPlayerIndex,0);
  store.getState().resolveBankHeist(.5);store.getState().resolveBankHeist(NaN);assert.equal(store.getState().players[0].money,1500);
  store.getState().resolveBankHeist(1);store.getState().resolveBankHeist(1);assert.equal(store.getState().players[0].money,1800);
});
test('restart invalidates already queued dice and movement callbacks',t=>{
  setup(t);store.getState().rollDice();store.getState().startNewGame([{name:'New A',isAI:false,token:'cat',color:'#aaa'},{name:'New B',isAI:true,token:'yacht',color:'#bbb'}]);t.mock.timers.tick(10000);assert.equal(store.getState().players[0].position,0);assert.equal(store.getState().turnPhase,'PRE_ROLL');
});
test('unmortgage convention is exact for every existing printed principal',()=>{
  for(const s of BOARD_SPACES.filter(s=>s.mortgageValue))assert.equal(unmortgageCost(s.mortgageValue!),s.mortgageValue!+Math.floor((s.mortgageValue!+9)/10));
});
test('Solo rents preserve its documented street, railroad and utility variations',t=>{
  setup(t);own(1,1);assert.equal(store.getState().calculateRent(1,7),2);own(3,1);assert.equal(store.getState().calculateRent(1,7),4);
  own(1,1,2);assert.equal(store.getState().calculateRent(1,7),30);own(1,1,2,true);assert.equal(store.getState().calculateRent(1,7),0);
  for(const [i,id] of [5,15,25,35].entries()){own(id,1);assert.equal(store.getState().calculateRent(5,7),[25,50,100,200][i]);}
  own(35,1,0,true);assert.equal(store.getState().calculateRent(5,7),100);
  own(12,1);assert.equal(store.getState().calculateRent(12,7),28);own(28,1);assert.equal(store.getState().calculateRent(12,7),70);
  own(28,1,0,true);assert.equal(store.getState().calculateRent(12,7),28);
});
test('rent transfers once on a legal landing and own/mortgaged deeds charge none',t=>{
  setup(t);own(3,1);roll(t,1,2);assert.deepEqual(store.getState().players.map(p=>p.money),[1500,1500,1500]);
  const oldRent = store.getState().pendingDebt!;
  store.getState().settlePendingDebt(oldRent);assert.equal(store.getState().players[0].money,1496);
  player(0,{position:0});store.setState({turnPhase:'PRE_ROLL'});roll(t,1,2);
  store.getState().settlePendingDebt(oldRent);assert.ok(store.getState().pendingDebt);assert.equal(store.getState().players[0].money,1496);
  store.getState().settlePendingDebt();assert.equal(store.getState().players[0].money,1492);
  player(0,{position:2});store.setState({turnPhase:'PRE_ROLL'});roll(t,1,2);
  assert.equal(store.getState().pendingDebt,null);assert.equal(store.getState().players[0].money,1492);
  own(3,0);player(0,{position:0});store.setState({turnPhase:'PRE_ROLL'});roll(t,1,2);assert.equal(store.getState().players[0].money,1492);
  own(3,1,0,true);player(0,{position:0});store.setState({turnPhase:'PRE_ROLL'});roll(t,1,2);assert.equal(store.getState().players[0].money,1492);
});
test('tax, Free Parking, Just Visiting and Go To Jail have distinct outcomes',t=>{
  setup(t);roll(t,1,3);assert.equal(store.getState().players[0].money,1300);
  for(const [start,a,b,end,jailed] of [[17,1,2,20,false],[7,1,2,10,false],[27,1,2,10,true]] as const){player(0,{position:start});store.setState({turnPhase:'PRE_ROLL'});roll(t,a,b);assert.equal(store.getState().players[0].position,end);assert.equal(store.getState().players[0].inJail,jailed);assert.equal(store.getState().players[0].money,1300);}
});
test('first and second failed Jail attempts retain confinement and end the turn',t=>{
  setup(t);player(0,{position:10,inJail:true});for(const attempt of [1,2]){store.setState({turnPhase:'PRE_ROLL'});roll(t,1,2);assert.equal(store.getState().players[0].jailTurns,attempt);assert.equal(store.getState().players[0].position,10);assert.equal(store.getState().turnPhase,'END_TURN');}
});
test('ordinary collect/pay and repair cards commit exactly their printed amounts once',t=>{
  setup(t);draw('ch_6');store.getState().applyActiveCard();assert.equal(store.getState().players[0].money,1550);
  draw('cc_3');assert.equal(store.getState().players[0].money,1500);
  own(1,0,2);own(3,0,5);draw('ch_10');assert.equal(store.getState().players[0].money,1350);
});
test('movement cards resolve destinations and use Solo card rent overrides',t=>{
  setup(t);player(0,{position:36});draw('ch_1');flush(t);assert.equal(store.getState().players[0].position,0);assert.equal(store.getState().players[0].money,1700);
  player(0,{position:7});own(12,1);draw('ch_4');flush(t);assert.equal(store.getState().players[0].position,12);store.getState().settlePendingDebt();assert.equal(store.getState().players[0].money,1680);
  player(0,{position:7});own(15,1);draw('ch_5');flush(t);assert.equal(store.getState().players[0].position,15);store.getState().settlePendingDebt();assert.equal(store.getState().players[0].money,1655);
  store.setState({railroadRaid:null});draw('ch_9');assert.equal(store.getState().players[0].position,10);assert.equal(store.getState().players[0].money,1655);
});
test('AI liquidates legal buildings before bankruptcy and ignores a stale game callback',t=>{
  setup(t);player(1,{money:10});own(1,1,1);own(3,1,1);store.setState({currentPlayerIndex:1,turnPhase:'DEBT_RESOLUTION',pendingDebt:{amount:80,creditorId:0,reason:'Rent'}});
  const id=store.getState().gameId;for(let i=0;i<10&&store.getState().pendingDebt;i++)runSoloAiStep(id,1,'DEBT_RESOLUTION');
  assert.equal(store.getState().pendingDebt,null);assert.equal(store.getState().players[1].isBankrupt,false);assert.equal(store.getState().players[0].money,1580);
  store.getState().startNewGame(store.getState().players);const before=economy();runSoloAiStep(id,1,'PRE_ROLL');assert.deepEqual(economy(),before);
});
test('accepted cash-only AI trades are idempotent and invalid ownership is rejected',t=>{
  setup(t);const offer={proposalId:'once',fromPlayerId:0,toPlayerId:1,offerCash:100,requestCash:0,offerProperties:[],requestProperties:[]};
  assert.equal(store.getState().proposeTrade(offer).accepted,true);assert.equal(store.getState().proposeTrade(offer).accepted,false);assert.equal(store.getState().players[0].money,1400);
  assert.equal(store.getState().proposeTrade({...offer,proposalId:'invalid',offerProperties:[3]}).accepted,false);assert.equal(store.getState().properties[3].ownerId,null);
});
test('a human trade transfers nothing until explicit recipient consent',t=>{
  setup(t);const offer={proposalId:'consent',fromPlayerId:0,toPlayerId:2,offerCash:100,requestCash:0,offerProperties:[],requestProperties:[]};
  store.getState().proposeTrade(offer);assert.equal(store.getState().players[0].money,1500);assert.ok(store.getState().pendingTrade);
  assert.equal(store.getState().acceptTrade(1).accepted,false);assert.equal(store.getState().acceptTrade(2).accepted,true);assert.equal(store.getState().players[2].money,1600);
  assert.equal(store.getState().acceptTrade(2).accepted,false);assert.equal(store.getState().players[0].money,1400);
});
test('birthday bankruptcy transfers to drawer, completes remaining obligations, and never advances another turn',t=>{
  setup(t);player(1,{money:4});store.setState({doublesCount:1});draw('cc_9');store.getState().declareBankruptcy();assert.equal(store.getState().players[1].isBankrupt,true);assert.equal(store.getState().players[0].money,1514);assert.equal(store.getState().players[2].money,1490);assert.equal(store.getState().currentPlayerIndex,0);assert.equal(store.getState().turnPhase,'END_TURN');
  assert.equal(store.getState().doublesCount,1,'another payer bankruptcy preserves the drawer doubles bonus');
  store.getState().endTurn();assert.equal(store.getState().currentPlayerIndex,0);assert.equal(store.getState().turnPhase,'PRE_ROLL');
});
test('daily and wheel rewards cannot modify the terminal match',t=>{
  setup(t);store.setState({turnPhase:'GAME_OVER'});const before=economy();store.getState().claimDailyReward();store.getState().spinLuckyWheel();store.getState().claimStickerAlbumReward();assert.deepEqual(economy(),before);
});
test('nearest railroad preserves the committed rent, raid and doubles after confirmation', t => {
  setup(t);
  player(0, { position: 3 });
  own(15, 1);
  store.setState({ chanceDeck: [CHANCE_CARDS.find(card => card.id === 'ch_5')!] });
  roll(t, 2, 2);
  const id = store.getState().cardDrawId;
  store.getState().drawPendingCard(id);
  store.getState().applyActiveCard(id);
  flush(t);
  const landed = store.getState();
  assert.equal(landed.players[0].position, 15);
  assert.equal(landed.players[0].money, 1500);
  assert.equal(landed.pendingDebt?.amount, 25);
  assert.equal(landed.railroadRaid, null);
  assert.equal(landed.activity.filter(event => event.kind === 'card').length, 0);
  landed.settlePendingDebt(landed.pendingDebt!);
  let resolved = store.getState();
  assert.equal(resolved.players[0].money, 1475);
  assert.equal(resolved.railroadRaid?.attackerId, 0);
  assert.equal(resolved.activity.filter(event => event.kind === 'rent').length, 1);
  assert.equal(resolved.activity.find(event => event.kind === 'card')?.spaceId, 15);
  resolved.endTurn();
  assert.equal(store.getState(), resolved);
  resolved.skipRailroadRaid();
  resolved.endTurn();
  resolved = store.getState();
  assert.equal(resolved.turnPhase, 'PRE_ROLL');
  assert.equal(resolved.currentPlayerIndex, 0);
});
test('auctioning a railroad still resolves the lander railroad bonus',t=>{
  setup(t);player(0,{position:5});store.setState({turnPhase:'LANDED_ACTION'});store.getState().auctionCurrentProperty();store.getState().placeAuctionBid(10);store.getState().passAuction();store.getState().passAuction();assert.equal(store.getState().railroadRaid?.attackerId,0);
});
test('seeded legal Solo play keeps cash, deeds, buildings, turn order and held cards consistent',t=>{
  setup(t);let seed=10425058;t.mock.method(Math,'random',()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});
  for(let step=0;step<1600&&!store.getState().winner;step++){
    let s=store.getState(),actor=s.players.find(p=>p.id===(s.pendingDebt?.debtorId??s.players[s.currentPlayerIndex].id))!;
    switch(s.turnPhase){
      case 'PRE_ROLL':s.rollDice();flush(t);break;
      case 'CARD_PENDING':s.drawPendingCard(s.cardDrawId);break;
      case 'CARD_DRAWN':s.applyActiveCard();flush(t);break;
      case 'LANDED_ACTION':{const price=BOARD_SPACES[actor.position].price!;if(actor.money>=price&&Math.random()<.8)s.buyCurrentProperty();else s.auctionCurrentProperty();break;}
      case 'AUCTION':{const a=s.auction!,bidder=s.players.find(p=>p.id===a.currentBidderId)!;if(bidder.money>=a.currentBid+10&&a.currentBid<BOARD_SPACES[a.spaceId].price!*.7)s.placeAuctionBid(10,bidder.id);else s.passAuction(bidder.id);break;}
      case 'DEBT_RESOLUTION':{
        if(actor.money>=s.pendingDebt!.amount){s.settlePendingDebt();flush(t);break;}
        const mortgage=BOARD_SPACES.find(sp=>!s.properties[sp.id]?.isMortgaged&&s.canToggleMortgage(actor.id,sp.id));
        const sale=BOARD_SPACES.find(sp=>s.canSellHouse(actor.id,sp.id));
        if(mortgage)s.toggleMortgage(mortgage.id);else if(sale)s.sellHouse(sale.id);else s.declareBankruptcy();break;
      }
      case 'END_TURN':if(s.railroadRaid){if(s.railroadRaid.mode==='choose')s.startBankHeist();else s.resolveBankHeist(0);}else s.endTurn();break;
      default:assert.fail(`Unresolved phase ${s.turnPhase}`);
    }
    s=store.getState();
    for(const p of s.players){assert.ok(Number.isSafeInteger(p.money)&&p.money>=0);assert.ok(p.position>=0&&p.position<40);assert.equal(p.getOutOfJailCards,(s.heldJailCards[p.id]??[]).length);}
    for(const p of Object.values(s.properties)){assert.ok(p.houses>=0&&p.houses<=5);if(p.ownerId!==null)assert.ok(s.players.some(player=>player.id===p.ownerId&&!player.isBankrupt));if(p.isMortgaged)assert.equal(p.houses,0);}
    for(const deck of ['chance','chest'] as const){const available=deck==='chance'?s.chanceDeck:s.chestDeck;const held=Object.values(s.heldJailCards).flat().filter(c=>c.deck===deck);const pending=s.activeCard?.deck===deck&&s.activeCard.actionType==='get_out_of_jail'?[s.activeCard]:[];
      assert.equal(new Set([...available,...held,...pending].map(c=>c.id)).size,16);
    }
    if(!s.winner)assert.equal(s.players[s.currentPlayerIndex].isBankrupt,false);
  }
});
