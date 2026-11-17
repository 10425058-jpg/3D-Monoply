import {useGameStore} from '../store/useGameStore';
import {BOARD_SPACES} from '../data/boardData';
import type {TurnPhase} from '../types/game';

/** Execute one legal AI decision from current state, never a stale render. */
export function runSoloAiStep(gameId:number, playerId:number, phase:TurnPhase) {
  const game=useGameStore.getState();
  const player=game.players.find(p=>p.id===(game.pendingDebt?.debtorId??game.players[game.currentPlayerIndex]?.id));
  if(game.gameId!==gameId||game.turnPhase!==phase||!player?.isAI||player.id!==playerId||player.isBankrupt||game.winner||game.railroadRaid||game.pendingTrade)return;
  switch(phase){
    case 'PRE_ROLL':game.rollDice();break;
    case 'CARD_DRAWN':game.applyActiveCard();break;
    case 'LANDED_ACTION':{
      const space=BOARD_SPACES[player.position];
      if(space.price&&player.money>=space.price){
        if(player.money-space.price>=120||Math.random()<.85)game.buyCurrentProperty();
        else game.auctionCurrentProperty();
      }else game.declineProperty();
      break;
    }
    case 'DEBT_RESOLUTION':{
      if(!game.pendingDebt)return;
      if(player.money>=game.pendingDebt.amount){game.settlePendingDebt();break;}
      const mortgage=BOARD_SPACES.find(s=>!game.properties[s.id]?.isMortgaged&&game.canToggleMortgage(player.id,s.id));
      const sale=BOARD_SPACES.find(s=>game.canSellHouse(player.id,s.id));
      if(mortgage)game.toggleMortgage(mortgage.id);
      else if(sale)game.sellHouse(sale.id);
      else game.declareBankruptcy();
      break;
    }
    case 'END_TURN':game.endTurn();break;
  }
}
