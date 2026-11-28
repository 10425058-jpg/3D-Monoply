import {useGameStore} from '../store/useGameStore';
import {BOARD_SPACES} from '../data/boardData';
import type {BoardSpace, Player, RailroadRaid, TurnPhase} from '../types/game';
import { arcadeLevel, arcadeNextLevel, arcadeSellRefund, arcadeUpgradeCost } from './arcadeRules';

const reserve = (money: number) => Math.max(120, Math.min(350, Math.round(money * .22)));

function propertyValue(game: ReturnType<typeof useGameStore.getState>, player: Player, space: BoardSpace) {
  if (game.ruleset === 'arcade' && space.type === 'property') {
    return { completesGroup: false, ceiling: Math.round((space.price ?? 0) * .85) };
  }
  const group = BOARD_SPACES.filter(candidate => candidate.colorGroup === space.colorGroup);
  const owned = group.filter(candidate => game.properties[candidate.id]?.ownerId === player.id).length;
  const completesGroup = space.type === 'property' && owned + 1 === group.length;
  return { completesGroup, ceiling: Math.round((space.price ?? 0) * (completesGroup ? 1.05 : owned ? .85 : .70)) };
}

export function runSoloAiAuction(gameId: number, expected: NonNullable<ReturnType<typeof useGameStore.getState>['auction']>) {
  const game = useGameStore.getState();
  const bidder = game.players.find(player => player.id === expected.currentBidderId);
  if (game.gameId !== gameId || game.auction !== expected || !bidder?.isAI || bidder.isBankrupt) return;
  const value = propertyValue(game, bidder, BOARD_SPACES[expected.spaceId]);
  const available = bidder.money - (value.completesGroup ? 80 : reserve(bidder.money));
  const maxBid = Math.min(value.ceiling, available);
  const increment = Math.min(10, maxBid - expected.currentBid);
  if (increment >= (expected.currentBid === 0 ? 10 : 1)) game.placeAuctionBid(increment, bidder.id, expected.currentBid);
  else game.passAuction(bidder.id);
}

export const aiDecisionDelay: Partial<Record<TurnPhase, number>> = {
  PRE_ROLL: 400, LANDED_ACTION: 440, CARD_PENDING: 180, CARD_DRAWN: 690, DEBT_RESOLUTION: 420, END_TURN: 360,
};

export function runSoloAiRaid(gameId: number, raid: RailroadRaid) {
  const game = useGameStore.getState();
  const attacker = game.players.find(player => player.id === raid.attackerId);
  if (game.gameId !== gameId || game.railroadRaid !== raid || !attacker?.isAI || attacker.isBankrupt) return;
  if (raid.mode === 'heist') {
    game.resolveBankHeist(Math.floor(Math.random() * 3));
    return;
  }
  const target = game.players.filter(player => !player.isBankrupt && player.id !== attacker.id)
    .sort((left, right) => right.landmarkLevel - left.landmarkLevel)[0];
  if (target && target.landmarkLevel > 0 && Math.random() < .55) game.shutdownLandmark(target.id);
  else game.startBankHeist();
}

/** Execute one legal AI decision from current state, never a stale render. */
export function runSoloAiStep(gameId:number, playerId:number, phase:TurnPhase) {
  const game=useGameStore.getState();
  const player=game.players.find(p=>p.id===(game.pendingDebt?.debtorId??game.players[game.currentPlayerIndex]?.id));
  if(game.gameId!==gameId||game.turnPhase!==phase||!player?.isAI||player.id!==playerId||player.isBankrupt||game.winner||game.railroadRaid||game.pendingTrade)return;
  switch(phase){
    case 'PRE_ROLL':
      if (player.inJail && player.getOutOfJailCards > 0) game.useJailCard();
      else if (player.inJail && player.jailTurns >= 2 && player.money - 50 >= reserve(player.money)) game.payJailBail();
      else game.rollDice();
      break;
    case 'CARD_PENDING': game.drawPendingCard(game.cardDrawId); break;
    case 'CARD_DRAWN': game.applyActiveCard(game.cardDrawId); break;
    case 'LANDED_ACTION':{
      const space=BOARD_SPACES[player.position];
      const value = propertyValue(game, player, space);
      const price = space.price ?? Infinity;
      const spendingCash = player.money - (value.completesGroup ? 80 : reserve(player.money));
      if (spendingCash >= price) game.buyCurrentProperty();
      else if (Math.min(spendingCash, value.ceiling) >= 10) game.auctionCurrentProperty();
      else game.declineProperty();
      break;
    }
    case 'DEBT_RESOLUTION':{
      if(!game.pendingDebt)return;
      if(player.money>=game.pendingDebt.amount){game.settlePendingDebt(game.pendingDebt);break;}
      const shortfall = game.pendingDebt.amount - player.money;
      const mortgages = BOARD_SPACES.filter(s => !game.properties[s.id]?.isMortgaged && game.canToggleMortgage(player.id, s.id));
      const mortgage = mortgages.filter(s => s.mortgageValue! >= shortfall).sort((a, b) => a.mortgageValue! - b.mortgageValue!)[0] ??
        mortgages.sort((a, b) => b.mortgageValue! - a.mortgageValue!)[0];
      const saleValue = (space: BoardSpace) => game.ruleset === 'arcade'
        ? arcadeSellRefund(space, arcadeLevel(game.properties[space.id])) : (space.houseCost ?? 0) / 2;
      const sale = BOARD_SPACES.filter(s => game.canSellHouse(player.id, s.id)).sort((a, b) => saleValue(b) - saleValue(a))[0];
      if(mortgage)game.toggleMortgage(mortgage.id);
      else if(sale)game.sellHouse(sale.id);
      else game.declareBankruptcy(game.pendingDebt);
      break;
    }
    case 'END_TURN': {
      if (game.ruleset === 'arcade') {
        const landing = game.arcadeLanding;
        if (landing && game.canUpgradeProperty(player.id, landing.spaceId)) {
          const street = BOARD_SPACES[landing.spaceId];
          const next = arcadeNextLevel(arcadeLevel(game.properties[landing.spaceId]));
          if (next !== undefined && player.money - arcadeUpgradeCost(street, next) >= reserve(player.money)) {
            game.upgradeProperty(street.id, landing.id);
          }
        }
        game.endTurn();
        break;
      }
      const project = BOARD_SPACES.filter(space => space.houseCost && player.money - space.houseCost >= reserve(player.money) &&
        game.canBuildHouse(player.id, space.id)).sort((a, b) => {
        const gain = (space: BoardSpace) => {
          const level = game.properties[space.id].houses;
          return ((space.rent?.[level + 1] ?? 0) - (space.rent?.[level] ?? 0)) / space.houseCost!;
        };
        return gain(b) - gain(a);
      })[0];
      if (project) game.buildHouse(project.id);
      game.endTurn();
      break;
    }
  }
}
