import {useEffect} from 'react';
import {useGameStore} from '../store/useGameStore';
import {CHANCE_CARDS,COMMUNITY_CHEST_CARDS} from '../data/cardsData';

/** Deterministic browser fixtures are available only in opt-in loopback Solo QA. */
export function useSoloAudit(){
  useEffect(()=>{
    if(!['localhost','127.0.0.1'].includes(location.hostname)||!new URLSearchParams(location.search).has('soloTest'))return;
    const state=()=>{const s=useGameStore.getState();return {gameId:s.gameId,players:s.players,properties:s.properties,dice:s.dice,turnPhase:s.turnPhase,
      currentPlayerIndex:s.currentPlayerIndex,pendingDebt:s.pendingDebt,pendingTrade:s.pendingTrade,activeCard:s.activeCard,heldJailCards:s.heldJailCards,auction:s.auction,railroadRaid:s.railroadRaid,winner:s.winner,logs:s.logs};};
    const fixture=(name:string)=>{
      const names=['opening','rent','building','hotel','jail','go-to-jail','chance','chest','card-chain','debt','bankruptcy','victory','ai','six-players','ownership','debt-trade','birthday-trade','auction-small-bid','utility-unowned','utility-self','utility-opponent'];
      if(!names.includes(name))throw new Error('Unknown Solo QA fixture');
      const count=name==='victory'?2:name==='six-players'?6:3;
      useGameStore.getState().startNewGame(Array.from({length:count},(_,i)=>({name:i===0?'You':`Rival ${i}`,isAI:name==='ai'&&i>0,
        token:(['rubber_duck','cat','racecar','yacht','top_hat','scottie_dog'] as const)[i],color:['#f59e0b','#ec4899','#3b82f6','#10b981','#9c74df','#e56d52'][i]})));
      const s=useGameStore.getState(),players=s.players.map(p=>({...p})),properties={...s.properties};
      const own=(id:number,ownerId:number,houses=0,isMortgaged=false)=>properties[id]={spaceId:id,ownerId,houses,isMortgaged};
      let selectedSpaceId:number|null=null,chanceDeck=[...CHANCE_CARDS],chestDeck=[...COMMUNITY_CHEST_CARDS],heldJailCards=s.heldJailCards;
      if(name==='rent')own(3,1);
      if(name==='go-to-jail')players[0].position=27;
      if(name==='building'||name==='hotel'){own(1,0,name==='hotel'?4:0);own(3,0,name==='hotel'?4:0);selectedSpaceId=1;}
      if(name==='jail'){
        players[0]={...players[0],position:10,inJail:true,getOutOfJailCards:1};
        heldJailCards={0:[CHANCE_CARDS.find(c=>c.id==='ch_7')!]};chanceDeck=chanceDeck.filter(c=>c.id!=='ch_7');
      }
      if(name==='chance'){players[0].position=4;const card=chanceDeck.find(c=>c.id==='ch_6')!;chanceDeck=[card,...chanceDeck.filter(c=>c!==card)];}
      if(name==='chest'){players[0].position=39;const card=chestDeck.find(c=>c.id==='cc_2')!;chestDeck=[card,...chestDeck.filter(c=>c!==card)];}
      if(name==='card-chain'){
        players[0].position=33;const card=chanceDeck.find(c=>c.id==='ch_8')!;chanceDeck=[card,...chanceDeck.filter(c=>c!==card)];
      }
      if(['debt','bankruptcy','victory'].includes(name)){players[0].position=1;players[0].money=name==='debt'?120:10;if(name==='debt')own(5,0);}
      if(name==='ownership'){own(1,0);own(3,1,0,true);own(6,2,2);own(8,2,2);own(9,2,2);}
      if(name==='debt-trade'){players[0].money=0;own(39,0);}
      if(name==='birthday-trade'){players[0].isAI=true;players[1].money=0;own(39,1);}
      useGameStore.setState({players,properties,selectedSpaceId,gameSpeed:2,chanceDeck,chestDeck,heldJailCards});
      if(name==='debt-trade')useGameStore.setState({turnPhase:'DEBT_RESOLUTION',pendingDebt:{amount:270,creditorId:1,reason:'Rent'}});
      if(name==='birthday-trade'){
        useGameStore.setState({turnPhase:'CARD_DRAWN',activeCard:COMMUNITY_CHEST_CARDS.find(card=>card.id==='cc_9')!,doublesCount:1});
        useGameStore.getState().applyActiveCard();
      }
      if(name==='auction-small-bid'){
        players[0].position=3;players[1].money=11;
        useGameStore.setState({players,turnPhase:'LANDED_ACTION'});
        useGameStore.getState().auctionCurrentProperty();
        useGameStore.getState().placeAuctionBid(10,0);
      }
      if(name.startsWith('utility-')){
        players[0].position=7;
        if(name!=='utility-unowned')own(12,name==='utility-self'?0:1);
        useGameStore.setState({players,properties,dice:[3,4],turnPhase:'CARD_DRAWN',activeCard:CHANCE_CARDS.find(card=>card.id==='ch_4')!});
      }
      return state();
    };
    const api={fixture,state};(window as any).__soloTest=api;
    return()=>{if((window as any).__soloTest===api)delete (window as any).__soloTest;};
  },[]);
}
