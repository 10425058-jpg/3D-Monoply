import React, { useEffect, useMemo, useState } from 'react';
import { Scene3D } from './components/3d/Scene3D';
import { BOARD_SPACES } from './data/boardData';
import { useGameStore } from './store/useGameStore';
import type { TokenType } from './types/game';

const DEFAULT_SETUP = [
  { name: 'You', isAI: false, token: 'top_hat' as TokenType, color: '#10b981' },
  { name: 'Victoria', isAI: true, token: 'racecar' as TokenType, color: '#ef4444' },
  { name: 'Arthur', isAI: true, token: 'scottie_dog' as TokenType, color: '#3b82f6' },
  { name: 'Elena', isAI: true, token: 'yacht' as TokenType, color: '#f59e0b' },
];

const money = (value: number) => `$${value.toLocaleString()}`;

export const App: React.FC = () => {
  const game = useGameStore();
  const [showSetup, setShowSetup] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const activePlayer = game.players[game.currentPlayerIndex];
  const selectedSpace = game.selectedSpaceId === null ? null : BOARD_SPACES[game.selectedSpaceId];
  const selectedState = selectedSpace ? game.properties[selectedSpace.id] : undefined;
  const selectedOwner = selectedState?.ownerId === null || selectedState?.ownerId === undefined
    ? undefined
    : game.players.find((player) => player.id === selectedState.ownerId);

  const canBuy = game.turnPhase === 'LANDED_ACTION' && !!activePlayer &&
    !!selectedSpace && activePlayer.position === selectedSpace.id &&
    selectedState?.ownerId === null && !!selectedSpace.price &&
    activePlayer.money >= selectedSpace.price;

  useEffect(() => {
    if (!activePlayer?.isAI || game.winner) return;
    const timer = window.setTimeout(() => {
      switch (game.turnPhase) {
        case 'PRE_ROLL':
          if (activePlayer.inJail && activePlayer.money >= 50 && activePlayer.jailTurns >= 2) {
            game.payJailBail();
          } else if (activePlayer.inJail && activePlayer.getOutOfJailCards > 0) {
            game.useJailCard();
          } else {
            game.rollDice();
          }
          break;
        case 'LANDED_ACTION': {
          const space = BOARD_SPACES[activePlayer.position];
          const property = game.properties[space.id];
          if (space.price && property?.ownerId === null && activePlayer.money >= space.price + 150) {
            game.buyCurrentProperty();
          } else {
            game.declineProperty();
          }
          break;
        }
        case 'CARD_DRAWN':
          game.applyActiveCard();
          break;
        case 'DEBT_RESOLUTION':
          if (game.pendingDebt && activePlayer.money >= game.pendingDebt.amount) game.settlePendingDebt();
          else game.declareBankruptcy();
          break;
        case 'END_TURN':
          game.endTurn();
          break;
        default:
          break;
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [activePlayer, game.turnPhase, game.winner, game.pendingDebt, game]);

  const handleStart = () => {
    game.startNewGame(DEFAULT_SETUP);
    setShowSetup(false);
  };

  const phaseLabel = useMemo(() => ({
    PRE_ROLL: 'Ready to roll',
    ROLLING: 'Rolling dice…',
    MOVING: 'Moving around the board…',
    LANDED_ACTION: 'Choose whether to buy',
    CARD_DRAWN: 'Resolve your card',
    DEBT_RESOLUTION: 'Debt must be settled',
    END_TURN: 'Turn complete',
    GAME_OVER: 'Game over',
  }[game.turnPhase]), [game.turnPhase]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080d18] text-slate-100">
      <div className="absolute inset-0">
        <Scene3D />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-5">
        <div className="pointer-events-auto rounded-2xl border border-amber-400/30 bg-slate-950/85 px-4 py-3 shadow-xl backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[.22em] text-amber-300">3D Monopoly</div>
          <div className="mt-1 text-sm text-slate-300">{phaseLabel}</div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button className="rounded-xl border border-white/15 bg-slate-950/85 px-3 py-2 text-sm hover:bg-slate-800" onClick={() => setShowRules(true)}>Rules</button>
          <button className="rounded-xl border border-white/15 bg-slate-950/85 px-3 py-2 text-sm hover:bg-slate-800" onClick={() => setShowSetup(true)}>New game</button>
          <button className="rounded-xl border border-white/15 bg-slate-950/85 px-3 py-2 text-sm hover:bg-slate-800" onClick={() => game.setCameraMode(game.cameraMode === 'top' ? 'isometric' : 'top')}>Camera</button>
        </div>
      </header>

      <aside className="pointer-events-auto absolute left-3 top-24 z-20 flex max-h-[55vh] w-56 flex-col gap-2 overflow-y-auto sm:left-5 sm:w-64">
        {game.players.map((player, index) => (
          <div key={player.id} className={`rounded-xl border p-3 backdrop-blur-md ${index === game.currentPlayerIndex ? 'border-amber-300/70 bg-slate-950/95' : 'border-white/10 bg-slate-950/75'} ${player.isBankrupt ? 'opacity-40' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold" style={{ color: player.color }}>{player.name}{player.isAI ? ' · AI' : ''}</span>
              {index === game.currentPlayerIndex && <span className="text-[10px] uppercase text-amber-300">Turn</span>}
            </div>
            <div className="mt-1 font-mono text-lg">{money(player.money)}</div>
            <div className="text-xs text-slate-400">Space {player.position} · {player.isBankrupt ? 'Bankrupt' : player.inJail ? 'In jail' : 'Active'}</div>
          </div>
        ))}
      </aside>

      <aside className="pointer-events-auto absolute right-3 top-24 z-20 hidden w-64 rounded-xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur-md sm:block">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Activity</h2>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {game.logs.slice(0, 12).map((entry) => (
            <div key={entry.id} className="border-b border-white/5 pb-2 text-xs text-slate-300">
              <span className="mr-2 text-slate-500">{entry.timestamp}</span>{entry.message}
            </div>
          ))}
        </div>
      </aside>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-center gap-2 p-3 sm:p-5">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-slate-950/90 p-3 shadow-2xl backdrop-blur">
          <div className="px-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Dice</div>
            <div className="font-mono text-xl font-bold">{game.dice[0]} + {game.dice[1]} = {game.dice[0] + game.dice[1]}</div>
          </div>
          {game.turnPhase === 'PRE_ROLL' && <>
            {activePlayer?.inJail && <button className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40" disabled={activePlayer.money < 50} onClick={game.payJailBail}>Pay bail $50</button>}
            {activePlayer?.inJail && activePlayer.getOutOfJailCards > 0 && <button className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950" onClick={game.useJailCard}>Use jail card</button>}
            <button className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-200" onClick={game.rollDice}>Roll dice</button>
          </>}
          {game.turnPhase === 'LANDED_ACTION' && <>
            <button className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40" disabled={!activePlayer || !BOARD_SPACES[activePlayer.position].price || activePlayer.money < (BOARD_SPACES[activePlayer.position].price || 0)} onClick={game.buyCurrentProperty}>Buy property</button>
            <button className="rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold" onClick={game.declineProperty}>Pass</button>
          </>}
          {game.turnPhase === 'CARD_DRAWN' && game.activeCard && <button className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950" onClick={game.applyActiveCard}>Resolve: {game.activeCard.title}</button>}
          {game.turnPhase === 'DEBT_RESOLUTION' && game.pendingDebt && <>
            <span className="px-2 text-sm text-rose-300">Debt: {money(game.pendingDebt.amount)}</span>
            <button className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40" disabled={!activePlayer || activePlayer.money < game.pendingDebt.amount} onClick={game.settlePendingDebt}>Pay debt</button>
            <button className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold" onClick={game.declareBankruptcy}>Declare bankruptcy</button>
          </>}
          {game.turnPhase === 'END_TURN' && <button className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-slate-950" onClick={game.endTurn}>End turn</button>}
          <button className="rounded-xl border border-white/15 px-3 py-3 text-sm hover:bg-white/10" onClick={() => game.selectSpace(activePlayer?.position ?? null)}>My space</button>
        </div>
      </footer>

      {selectedSpace && selectedSpace.price && selectedState && (
        <div className="pointer-events-auto absolute bottom-28 right-3 z-30 w-64 rounded-2xl border border-amber-400/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur sm:bottom-28 sm:right-5">
          <button className="float-right text-slate-400 hover:text-white" onClick={() => game.selectSpace(null)} aria-label="Close property details">×</button>
          <div className="text-[10px] uppercase tracking-widest text-amber-300">{selectedSpace.colorGroup}</div>
          <h3 className="mt-1 font-semibold">{selectedSpace.name}</h3>
          <div className="mt-2 text-lg font-mono">{money(selectedSpace.price)}</div>
          <div className="mt-1 text-xs text-slate-400">{selectedOwner ? `Owned by ${selectedOwner.name}` : 'Unowned · Bank'}</div>
          {selectedState.ownerId === activePlayer?.id && selectedSpace.type === 'property' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={!game.canBuildHouse(activePlayer.id, selectedSpace.id)} onClick={() => game.buildHouse(selectedSpace.id)}>Build house</button>
              <button className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={!game.canSellHouse(activePlayer.id, selectedSpace.id)} onClick={() => game.sellHouse(selectedSpace.id)}>Sell house</button>
              <button className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold" onClick={() => game.toggleMortgage(selectedSpace.id)}>{selectedState.isMortgaged ? 'Unmortgage' : 'Mortgage'}</button>
            </div>
          )}
        </div>
      )}

      {showSetup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-amber-400/30 bg-slate-950 p-7 text-center shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-[.25em] text-amber-300">Miniature City Edition</div>
            <h1 className="mt-3 font-serif text-3xl font-bold">3D Monopoly</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Build your property empire, collect rent, and outlast three AI rivals.</p>
            <button className="mt-6 w-full rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950 hover:bg-amber-200" onClick={handleStart}>Start game</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-slate-950 p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-amber-300">How to play</h2><button onClick={() => setShowRules(false)} aria-label="Close rules">×</button></div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
              <li>Roll two dice and move clockwise around the board.</li>
              <li>Buy unowned properties and collect rent from opponents.</li>
              <li>Own every property in a color group to build houses and hotels.</li>
              <li>Pay taxes, resolve cards, and avoid bankruptcy.</li>
              <li>Rolling doubles grants another turn; three consecutive doubles send you to jail.</li>
            </ul>
          </div>
        </div>
      )}

      {game.activeCard && game.turnPhase === 'CARD_DRAWN' && !activePlayer?.isAI && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-sky-400/30 bg-slate-950 p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-sky-300">{game.activeCard.deck === 'chance' ? 'Chance' : 'Community Chest'}</div>
            <h2 className="mt-3 text-xl font-bold">{game.activeCard.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{game.activeCard.description}</p>
            <button className="mt-5 rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950" onClick={game.applyActiveCard}>Continue</button>
          </div>
        </div>
      )}

      {game.winner && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div className="rounded-3xl border border-amber-300/40 bg-slate-950 p-8 text-center">
            <div className="text-4xl">🏆</div><h2 className="mt-3 text-2xl font-bold">{game.winner.name} wins!</h2>
            <button className="mt-5 rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950" onClick={() => { setShowSetup(true); }}>New game</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
