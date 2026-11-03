import React from 'react';
import {
  BarChart3,
  BookOpen,
  ArrowLeftRight,
  Gavel,
  Home,
  Hammer,
  Landmark,
  Flag,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';
import { BOARD_SPACES } from '../../data/boardData';

export const BottomActionDock: React.FC<{
  onOpenStats: () => void;
  onOpenRules: () => void;
  onOpenTrade: () => void;
  onOpenAuction: () => void;
  autoRoll: boolean;
  onToggleAutoRoll: () => void;
}> = ({
  onOpenStats,
  onOpenRules,
  onOpenTrade,
  onOpenAuction,
  autoRoll,
  onToggleAutoRoll,
}) => {
  const turnPhase = useGameStore((s) => s.turnPhase);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const properties = useGameStore((s) => s.properties);
  const gameSpeed = useGameStore((s) => s.gameSpeed);
  const setGameSpeed = useGameStore((s) => s.setGameSpeed);
  const selectedSpaceId = useGameStore((s) => s.selectedSpaceId);

  const rollDice = useGameStore((s) => s.rollDice);
  const buyCurrentProperty = useGameStore((s) => s.buyCurrentProperty);
  const endTurn = useGameStore((s) => s.endTurn);
  const buildHouse = useGameStore((s) => s.buildHouse);
  const toggleMortgage = useGameStore((s) => s.toggleMortgage);
  const canBuildHouse = useGameStore((s) => s.canBuildHouse);

  const activePlayer = players[currentPlayerIndex];
  const isHumanTurn = activePlayer && !activePlayer.isAI && !activePlayer.isBankrupt;
  const isPreRoll = isHumanTurn && turnPhase === 'PRE_ROLL';
  const isRolling = turnPhase === 'ROLLING' || turnPhase === 'MOVING';
  const isLandedAction = isHumanTurn && turnPhase === 'LANDED_ACTION';
  const isEndTurn = isHumanTurn && turnPhase === 'END_TURN';

  const currentSpace = activePlayer ? BOARD_SPACES[activePlayer.position] : null;
  const currentPropertyState = currentSpace ? properties[currentSpace.id] : null;
  const canBuy = isLandedAction && currentSpace && currentPropertyState?.ownerId === null && activePlayer.money >= (currentSpace.price || 0);
  const canBuildOnSelected = selectedSpaceId !== null && isHumanTurn && canBuildHouse(activePlayer.id, selectedSpaceId);

  const handleRoll = () => {
    if (!isPreRoll) return;
    sounds.playDiceRoll();
    rollDice();
  };

  const handleBuy = () => {
    if (!canBuy) return;
    sounds.playPurchase();
    buyCurrentProperty();
  };

  const handleBuild = () => {
    if (selectedSpaceId !== null && canBuildOnSelected) {
      sounds.playPurchase();
      buildHouse(selectedSpaceId);
    }
  };

  const handleMortgage = () => {
    if (selectedSpaceId !== null) {
      sounds.playCash();
      toggleMortgage(selectedSpaceId);
    }
  };

  const handleEndTurn = () => {
    if (!isEndTurn) return;
    sounds.playClick();
    endTurn();
  };

  return (
    <footer className="fixed bottom-2 sm:bottom-3 left-2 sm:left-4 right-2 sm:right-4 z-20 flex items-end justify-between pointer-events-none select-none gap-2">
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 mb-1">
        <button
          onClick={() => { sounds.playClick(); onOpenStats(); }}
          className="flex flex-col items-center justify-center w-8 h-9 sm:w-11 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-950/80 hover:bg-purple-900 border border-purple-400/30 text-purple-200 hover:text-white shadow-lg transition-transform active:scale-95 group"
          title="Game Statistics & Portfolio"
        >
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline text-[8px] sm:text-[9px] font-bold mt-0.5">Stats</span>
        </button>

        <button
          onClick={() => { sounds.playClick(); onOpenRules(); }}
          className="flex flex-col items-center justify-center w-8 h-9 sm:w-11 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-950/80 hover:bg-purple-900 border border-purple-400/30 text-purple-200 hover:text-white shadow-lg transition-transform active:scale-95 group"
          title="Monopoly Rules & Guide"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline text-[8px] sm:text-[9px] font-bold mt-0.5">Rules</span>
        </button>

        <button
          onClick={() => { sounds.playClick(); onOpenTrade(); }}
          className="flex flex-col items-center justify-center w-8 h-9 sm:w-11 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-950/80 hover:bg-purple-900 border border-purple-400/30 text-purple-200 hover:text-white shadow-lg transition-transform active:scale-95 group"
          title="Trade Properties with Rivals"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline text-[8px] sm:text-[9px] font-bold mt-0.5">Trade</span>
        </button>

        <button
          onClick={() => { sounds.playClick(); onOpenAuction(); }}
          className="flex flex-col items-center justify-center w-8 h-9 sm:w-11 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-950/80 hover:bg-purple-900 border border-purple-400/30 text-purple-200 hover:text-white shadow-lg transition-transform active:scale-95 group"
          title="Auction Unsold Properties"
        >
          <Gavel className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline text-[8px] sm:text-[9px] font-bold mt-0.5">Auction</span>
        </button>
      </div>

      <div className="pointer-events-auto flex items-center p-1 sm:p-1.5 rounded-full bg-purple-950/85 backdrop-blur-lg border border-purple-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.45),inset_0_1px_rgba(255,255,255,0.2)] mb-1 overflow-x-auto">
        <button
          onClick={handleBuy}
          disabled={!canBuy}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-full font-black text-[10px] sm:text-xs transition-all ${
            canBuy
              ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.6)] border border-amber-200 hover:scale-105 active:scale-95 animate-pulse'
              : 'text-purple-300/40 cursor-not-allowed'
          }`}
          title={canBuy ? `Buy ${currentSpace?.name} for $${currentSpace?.price}` : 'Land on an unowned property to buy'}
        >
          <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Buy</span>
        </button>

        <button
          onClick={handleBuild}
          disabled={!canBuildOnSelected}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-[10px] sm:text-xs transition-all ${
            canBuildOnSelected
              ? 'bg-purple-800 text-white hover:bg-purple-700 shadow border border-purple-400/50 active:scale-95'
              : 'text-purple-300/40 cursor-not-allowed'
          }`}
          title={canBuildOnSelected ? 'Build a house on selected property' : 'Select a full color group monopoly to build'}
        >
          <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Build</span>
        </button>

        <button
          onClick={handleMortgage}
          disabled={selectedSpaceId === null}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-[10px] sm:text-xs transition-all ${
            selectedSpaceId !== null
              ? 'bg-purple-800 text-white hover:bg-purple-700 shadow border border-purple-400/50 active:scale-95'
              : 'text-purple-300/40 cursor-not-allowed'
          }`}
          title="Mortgage or unmortgage selected property"
        >
          <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Mortgage</span>
        </button>

        <button
          onClick={handleEndTurn}
          disabled={!isEndTurn}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-[10px] sm:text-xs transition-all ${
            isEndTurn
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-300 animate-bounce active:scale-95'
              : 'text-purple-300/40 cursor-not-allowed'
          }`}
        >
          <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>End Turn</span>
        </button>
      </div>

      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-3">
        <div className="flex flex-col items-end gap-1 p-1 sm:p-2 rounded-xl sm:rounded-2xl bg-purple-950/80 backdrop-blur-md border border-purple-400/35 shadow-lg">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-[8px] sm:text-[10px] font-bold text-purple-200">Auto-roll</span>
            <button
              onClick={onToggleAutoRoll}
              className={`w-7 sm:w-9 h-4 sm:h-5 rounded-full transition-colors relative p-0.5 flex items-center ${
                autoRoll ? 'bg-amber-400' : 'bg-purple-900 border border-purple-600/50'
              }`}
            >
              <div
                className={`w-3 sm:w-4 h-3 sm:h-4 rounded-full bg-white shadow transition-transform ${
                  autoRoll ? 'translate-x-3 sm:translate-x-4 bg-amber-950' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 bg-purple-900/70 p-0.5 rounded-lg border border-purple-500/30">
            <button
              onClick={() => { sounds.playClick(); setGameSpeed(1); }}
              className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-black rounded ${
                gameSpeed === 1 ? 'bg-amber-400 text-amber-950 shadow-sm' : 'text-purple-300 hover:text-white'
              }`}
            >
              1x
            </button>
            <button
              onClick={() => { sounds.playClick(); setGameSpeed(2); }}
              className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-black rounded ${
                gameSpeed === 2 ? 'bg-amber-400 text-amber-950 shadow-sm' : 'text-purple-300 hover:text-white'
              }`}
            >
              2x
            </button>
          </div>
        </div>

        <button
          onClick={handleRoll}
          disabled={!isPreRoll}
          className={`relative group flex flex-col items-center justify-center w-20 h-20 sm:w-32 sm:h-32 rounded-full transition-all duration-300 select-none ${
            isPreRoll
              ? 'cursor-pointer hover:scale-105 active:scale-95 shadow-[0_12px_32px_rgba(245,158,11,0.5),0_0_35px_rgba(251,191,36,0.35)]'
              : 'opacity-50 grayscale cursor-not-allowed'
          }`}
        >
          {isPreRoll && (
            <div className="absolute inset-0 rounded-full border-4 border-amber-300/40 animate-ping pointer-events-none" />
          )}

          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 p-1 sm:p-1.5 shadow-[inset_0_3px_rgba(255,255,255,0.7),inset_0_-4px_rgba(180,83,9,0.8)]">
            <div className="w-full h-full rounded-full bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600 flex flex-col items-center justify-center shadow-[inset_0_4px_12px_rgba(255,255,255,0.5),inset_0_-4px_8px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 transform -rotate-6 group-hover:rotate-0 transition-transform">
                <div className="w-4 h-4 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-0.5 sm:gap-1 p-0.5 sm:p-1">
                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-slate-900" />
                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-slate-900" />
                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-slate-900" />
                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-slate-900" />
                  </div>
                </div>
                <div className="w-4 h-4 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-white border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center transform rotate-12">
                  <div className="flex items-center justify-center">
                    <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-rose-600" />
                  </div>
                </div>
              </div>

              <span className="text-sm sm:text-2xl font-black tracking-wider text-white drop-shadow-[0_2px_4px_rgba(180,83,9,0.9)]">
                {isRolling ? 'ROLL...' : 'ROLL'}
              </span>
            </div>
          </div>
        </button>
      </div>
    </footer>
  );
};
