import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Bot,
  Camera,
  Clock3,
  Coins,
  Crown,
  Home,
  Landmark,
  Gift,
  Star,
  PackageOpen,
  BookOpen,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

import { Scene3D } from './components/3d/Scene3D';
import { BOARD_SPACES } from './data/boardData';
import { useGameStore } from './store/useGameStore';
import { DAILY_MISSIONS, DAILY_REWARD_CYCLE, LUCKY_WHEEL_REWARDS, STICKER_COLLECTION } from './data/metaGameData';
import type { LogEntry, TokenType, TradeOffer, TurnPhase } from './types/game';
import './app-ui.css';

const DEFAULT_SETUP = [
  { name: 'You', isAI: false, token: 'top_hat' as TokenType, color: '#d8b45a' },
  { name: 'Victoria', isAI: true, token: 'racecar' as TokenType, color: '#e87979' },
  { name: 'Arthur', isAI: true, token: 'scottie_dog' as TokenType, color: '#78a8ef' },
  { name: 'Elena', isAI: true, token: 'yacht' as TokenType, color: '#e7ad54' },
];

const money = (value: number) => `${value.toLocaleString('en-US')}`;

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PHASE_LABELS: Record<TurnPhase, string> = {
  SETUP: 'Set up your table',
  PRE_ROLL: 'Ready for your move',
  ROLLING: 'The dice are rolling',
  MOVING: 'Moving around the board',
  LANDED_ACTION: 'A new opportunity',
  CARD_DRAWN: 'A card has been drawn',
  DEBT_RESOLUTION: 'A debt needs attention',
  END_TURN: 'Turn complete',
  GAME_OVER: 'Game over',
};

const TOKEN_MARKS: Record<TokenType, string> = {
  top_hat: '♟',
  racecar: '◈',
  scottie_dog: '◆',
  yacht: '⌁',
};

const logTone: Record<LogEntry['type'], string> = {
  info: 'neutral',
  money: 'gold',
  property: 'green',
  alert: 'red',
  card: 'blue',
};

function LogMark({ type }: { type: LogEntry['type'] }) {
  if (type === 'money') return <Coins size={14} />;
  if (type === 'property') return <Landmark size={14} />;
  if (type === 'alert') return <ShieldCheck size={14} />;
  if (type === 'card') return <ScrollText size={14} />;
  return <Sparkles size={14} />;
}

export const App: React.FC = () => {
  const game = useGameStore();
  const [showSetup, setShowSetup] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showMetaHub, setShowMetaHub] = useState(false);
  const [metaTab, setMetaTab] = useState<'daily' | 'missions' | 'album'>('daily');
  const [lastPackReveal, setLastPackReveal] = useState<{ stickers: string[]; duplicateCount: number } | null>(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [autoRoll, setAutoRoll] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeTargetId, setTradeTargetId] = useState<number>(1);
  const [tradePropertyId, setTradePropertyId] = useState('');
  const [tradeOfferCash, setTradeOfferCash] = useState('0');
  const [tradeRequestCash, setTradeRequestCash] = useState('150');
  const [tradeFeedback, setTradeFeedback] = useState('');

  const activePlayer = game.players[game.currentPlayerIndex];
  const inspectorSpaceId = game.hoveredSpaceId ?? game.selectedSpaceId;
  const selectedSpace = inspectorSpaceId === null ? null : BOARD_SPACES[inspectorSpaceId];
  const selectedState = selectedSpace ? game.properties[selectedSpace.id] : undefined;
  const selectedOwner = selectedState?.ownerId === null || selectedState?.ownerId === undefined
    ? undefined
    : game.players.find((player) => player.id === selectedState.ownerId);
  const myTradableProperties = useMemo(
    () => BOARD_SPACES.filter((space) => space.type === 'property' && game.properties[space.id]?.ownerId === activePlayer?.id && !game.properties[space.id]?.isMortgaged),
    [game.properties, activePlayer?.id]
  );
  const rivalPlayers = game.players.filter((player) => player.id !== activePlayer?.id && player.isAI && !player.isBankrupt);

  const phaseLabel = useMemo(() => PHASE_LABELS[game.turnPhase], [game.turnPhase]);
  const todayKey = localDateKey();
  const dailyClaimedToday = game.metaProgress.lastDailyClaimDate === todayKey;
  const wheelUsedToday = game.metaProgress.lastWheelSpinDate === todayKey;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const expectedStreak = game.metaProgress.lastDailyClaimDate === localDateKey(yesterday)
    ? game.metaProgress.dailyStreak + 1
    : dailyClaimedToday ? game.metaProgress.dailyStreak : 1;
  const rewardDay = dailyClaimedToday
    ? ((game.metaProgress.dailyStreak - 1) % DAILY_REWARD_CYCLE.length) + 1
    : ((expectedStreak - 1) % DAILY_REWARD_CYCLE.length) + 1;
  const nextDailyReward = DAILY_REWARD_CYCLE[rewardDay - 1];
  const stickerCount = STICKER_COLLECTION.filter((sticker) => (game.metaProgress.stickers[sticker.id] ?? 0) > 0).length;
  const albumComplete = stickerCount === STICKER_COLLECTION.length;
  const landmarkCost = activePlayer ? game.landmarkUpgradeCost(activePlayer.id) : Infinity;
  const ownedCount = useMemo(
    () => Object.values(game.properties).filter((property) => property.ownerId !== null).length,
    [game.properties]
  );

  useEffect(() => {
    if (!activePlayer?.isAI || game.winner) return;
    if (game.railroadRaid?.attackerId === activePlayer.id) return;

    const timer = window.setTimeout(() => {
      switch (game.turnPhase) {
        case 'PRE_ROLL':
          if (!activePlayer.inJail && activePlayer.landmarkLevel < 5 &&
              activePlayer.money >= game.landmarkUpgradeCost(activePlayer.id) + 350 &&
              Math.random() < 0.3) {
            game.upgradeLandmark();
          }
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
    }, 850 / game.gameSpeed);

    return () => window.clearTimeout(timer);
  }, [activePlayer, game.turnPhase, game.winner, game.pendingDebt, game.railroadRaid, game.gameSpeed]);

  useEffect(() => {
    const raid = game.railroadRaid;
    if (!raid) return;
    const attacker = game.players.find((player) => player.id === raid.attackerId);
    if (!attacker?.isAI) return;

    const timer = window.setTimeout(() => {
      if (raid.mode === 'choose') {
        const target = game.players
          .filter((player) => !player.isBankrupt && player.id !== attacker.id)
          .sort((left, right) => right.landmarkLevel - left.landmarkLevel)[0];

        if (target && target.landmarkLevel > 0 && Math.random() < 0.55) {
          game.shutdownLandmark(target.id);
        } else {
          game.startBankHeist();
        }
      } else {
        const bestVault = raid.vaultRewards.indexOf(Math.max(...raid.vaultRewards));
        game.resolveBankHeist(bestVault);
      }
    }, 700 / game.gameSpeed);

    return () => window.clearTimeout(timer);
  }, [game.railroadRaid, game.players, game.gameSpeed]);

  const handleWheelSpin = () => {
    if (wheelUsedToday || isWheelSpinning) return;
    setIsWheelSpinning(true);
    game.spinLuckyWheel();
    window.setTimeout(() => setIsWheelSpinning(false), 1350);
  };

  const handleStart = () => {
    game.startNewGame(DEFAULT_SETUP);
    setShowSetup(false);
  };

  const switchCamera = () => {
    game.setCameraMode(game.cameraMode === 'top' ? 'isometric' : 'top');
  };

  const playerStatus = (player: (typeof game.players)[number]) => {
    if (player.isBankrupt) return 'Eliminated';
    if (player.inJail) return 'In jail';
    return BOARD_SPACES[player.position]?.shortName ?? `Space ${player.position}`;
  };

  return (
    <main className="monopoly-app">
      <div className="world-layer">
        <Scene3D />
      </div>
      <div className="world-vignette" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-crest"><Crown size={21} strokeWidth={1.8} /></div>
          <div className="brand-copy">
            <div className="brand-title">MONOPOLY <span>3D</span></div>
            <div className="brand-subtitle">Miniature City Edition</div>
          </div>
          <div className="brand-divider" />
          <div className="phase-indicator">
            <span className="phase-pulse" />
            <span>{phaseLabel}</span>
          </div>
        </div>

        <nav className="top-actions" aria-label="Game controls">
          <button className="top-action event-hub-button" onClick={() => setShowMetaHub(true)}>
            <Gift size={15} /><span>Events</span>
            {(!dailyClaimedToday || !wheelUsedToday || game.metaProgress.stickerPacks > 0) && <i className="event-notification-dot" />}
          </button>
          <button className="top-action" onClick={() => setShowRules(true)}>
            <ScrollText size={15} /><span>Rules</span>
          </button>
          <button className="top-action" onClick={() => setShowSetup(true)}>
            <RotateCcw size={15} /><span>New game</span>
          </button>
          <button className="top-action" onClick={switchCamera}>
            <Camera size={15} /><span>{game.cameraMode === 'top' ? 'Isometric' : 'Top view'}</span>
          </button>
        </nav>
      </header>

      <div className="hud-columns">
        <aside className="glass-panel players-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">THE TABLE</div>
              <h2>Players</h2>
            </div>
            <span className="count-chip">{game.players.length} seats</span>
          </div>

          <div className="active-player-note">
            <span className="note-icon"><Sparkles size={13} /></span>
            <span><strong>{activePlayer?.name ?? 'Waiting'}</strong> is in control</span>
          </div>

          <div className="player-list">
            {game.players.map((player, index) => {
              const isTurn = index === game.currentPlayerIndex;
              const propertyCount = Object.values(game.properties).filter(
                (property) => property.ownerId === player.id
              ).length;

              return (
                <article
                  key={player.id}
                  className={`player-card ${isTurn ? 'is-active' : ''} ${player.isBankrupt ? 'is-bankrupt' : ''}`}
                  style={{ '--player-accent': player.color } as React.CSSProperties}
                >
                  <div className="player-card-main">
                    <div className="player-avatar">
                      {player.isAI ? <Bot size={17} /> : <UserRound size={17} />}
                    </div>
                    <div className="player-identity">
                      <div className="player-name">{player.name}</div>
                      <div className="player-role">{player.isAI ? 'Computer rival' : 'You · Human player'}</div>
                    </div>
                    {isTurn ? <span className="turn-tag">TURN</span> : <span className="player-token">{TOKEN_MARKS[player.token]}</span>}
                  </div>

                  <div className="player-card-bottom">
                    <div className="player-money"><Wallet size={14} /><strong>{money(player.money)}</strong></div>
                    <div className="player-detail">
                      <span>{player.isBankrupt ? 'Bankrupt' : player.inJail ? 'In jail' : `At ${playerStatus(player)}`}</span>
                      <span className="property-count"><Landmark size={11} /> {propertyCount} properties</span>
                      <span className="landmark-level">CITY LV {player.landmarkLevel}/5</span>
                    </div>
                  </div>
                  {isTurn && <div className="active-card-glow" />}
                </article>
              );
            })}
          </div>

          <div className="panel-footnote">
            <span className="footnote-dot" />
            <span>{ownedCount} properties claimed across the board</span>
          </div>
        </aside>

        <div className="board-clear-space" aria-hidden="true" />

        <aside className="glass-panel activity-panel">
          <div className="panel-heading activity-heading">
            <div>
              <div className="eyebrow">LIVE TABLE FEED</div>
              <h2>Activity</h2>
            </div>
            <span className="live-chip"><span /> LIVE</span>
          </div>

          <div className="activity-feed">
            {game.logs.slice(0, 9).map((entry, index) => (
              <div className={`activity-item tone-${logTone[entry.type]}`} key={entry.id}>
                <div className="activity-mark"><LogMark type={entry.type} /></div>
                <div className="activity-content">
                  <p>{entry.message}</p>
                  <time><Clock3 size={10} /> {entry.timestamp}</time>
                </div>
                {index === 0 && <span className="new-event-dot" />}
              </div>
            ))}
          </div>
          <div className="activity-footer">Latest moves appear here automatically</div>
        </aside>
      </div>

      {selectedSpace && (
        <section className="property-inspector glass-panel">
          <button className="inspector-close" onClick={() => game.selectSpace(null)} aria-label="Close property details">
            <X size={15} />
          </button>
          <div className="inspector-colorbar" style={{ background: selectedSpace.colorHex }} />
          <div className="eyebrow">{selectedSpace.colorGroup.replace('_', ' ')} · SPACE {selectedSpace.id + 1}</div>
          <h3>{selectedSpace.name}</h3>
          {selectedSpace.price ? (
            <div className="inspector-price">{money(selectedSpace.price)} <span>purchase price</span></div>
          ) : (
            <div className="inspector-price inspector-special">Special board space</div>
          )}
          <div className="inspector-owner">
            <span className="owner-indicator" style={{ background: selectedOwner?.color ?? '#9ca3af' }} />
            {selectedOwner ? `Owned by ${selectedOwner.name}` : selectedState ? 'Available from the bank' : 'Board location'}
          </div>

          {selectedState?.ownerId === activePlayer?.id && selectedSpace.type === 'property' && (
            <div className="inspector-actions">
              <button
                className="mini-action mini-action-gold"
                disabled={!game.canBuildHouse(activePlayer.id, selectedSpace.id)}
                onClick={() => game.buildHouse(selectedSpace.id)}
              ><Home size={13} /> Build</button>
              <button
                className="mini-action"
                disabled={!game.canSellHouse(activePlayer.id, selectedSpace.id)}
                onClick={() => game.sellHouse(selectedSpace.id)}
              >Sell house</button>
              <button className="mini-action" onClick={() => game.toggleMortgage(selectedSpace.id)}>
                {selectedState.isMortgaged ? 'Unmortgage' : 'Mortgage'}
              </button>
            </div>
          )}
        </section>
      )}

      <footer className="bottom-console">
        <div className="console-player">
          <div className="console-avatar" style={{ '--player-accent': activePlayer?.color ?? '#d8b45a' } as React.CSSProperties}>
            {activePlayer?.isAI ? <Bot size={18} /> : <UserRound size={18} />}
          </div>
          <div className="console-player-copy">
            <span>NOW PLAYING</span>
            <strong>{activePlayer?.name ?? 'Waiting for player'}</strong>
          </div>
        </div>

        <div className="console-divider" />

        <div className="dice-summary">
          <span className="dice-label">LAST ROLL</span>
          <div className="dice-row">
            <span className="die">{game.dice[0]}</span>
            <span className="dice-plus">+</span>
            <span className="die">{game.dice[1]}</span>
            <span className="dice-equals">=</span>
            <strong className="dice-total">{game.dice[0] + game.dice[1]}</strong>
          </div>
        </div>

        <div className="console-actions">
          {game.turnPhase === 'PRE_ROLL' && (
            <>
              {activePlayer?.inJail && (
                <button className="console-button secondary" disabled={activePlayer.money < 50 || activePlayer.isAI} onClick={game.payJailBail}>
                  Pay bail $50
                </button>
              )}
              {activePlayer?.inJail && activePlayer.getOutOfJailCards > 0 && (
                <button className="console-button secondary" disabled={activePlayer.isAI} onClick={game.useJailCard}>
                  Use jail card
                </button>
              )}
              <button className="console-button primary" disabled={activePlayer?.isAI} onClick={game.rollDice}>
                <Sparkles size={16} /> Roll the dice <ArrowRight size={15} />
              </button>
            </>
          )}

          {game.turnPhase === 'LANDED_ACTION' && (
            <>
              <button
                className="console-button primary"
                disabled={!activePlayer || activePlayer.isAI || !BOARD_SPACES[activePlayer.position].price || activePlayer.money < (BOARD_SPACES[activePlayer.position].price || 0)}
                onClick={game.buyCurrentProperty}
              ><Landmark size={15} /> Buy property</button>
              <button className="console-button secondary" disabled={activePlayer?.isAI} onClick={game.declineProperty}>Pass</button>
            </>
          )}

          {game.turnPhase === 'CARD_DRAWN' && game.activeCard && (
            <button className="console-button primary" disabled={activePlayer?.isAI} onClick={game.applyActiveCard}>
              <ScrollText size={15} /> Resolve card
            </button>
          )}

          {game.turnPhase === 'DEBT_RESOLUTION' && game.pendingDebt && (
            <>
              <div className="debt-readout">Debt <strong>{money(game.pendingDebt.amount)}</strong></div>
              <button className="console-button primary" disabled={!activePlayer || activePlayer.isAI || activePlayer.money < game.pendingDebt.amount} onClick={game.settlePendingDebt}>Pay debt</button>
              <button className="console-button danger" disabled={activePlayer?.isAI} onClick={game.declareBankruptcy}>Bankruptcy</button>
            </>
          )}

          {game.turnPhase === 'END_TURN' && (
            <button className="console-button primary" disabled={activePlayer?.isAI} onClick={game.endTurn}>
              End turn <ArrowRight size={15} />
            </button>
          )}

          {(game.turnPhase === 'ROLLING' || game.turnPhase === 'MOVING') && (
            <div className="console-wait"><span className="loading-orbit" /> {game.turnPhase === 'ROLLING' ? 'Rolling…' : 'Moving…'}</div>
          )}

          {activePlayer && !activePlayer.isAI && (
            <button
              className="console-button landmark-upgrade-button"
              disabled={activePlayer.landmarkLevel >= 5 || activePlayer.money < landmarkCost || (game.turnPhase !== 'PRE_ROLL' && game.turnPhase !== 'END_TURN')}
              onClick={game.upgradeLandmark}
            >
              <Landmark size={14} />
              {activePlayer.landmarkLevel >= 5 ? 'Landmark max' : `Upgrade Lv.${activePlayer.landmarkLevel + 1} · ${money(landmarkCost)}`}
            </button>
          )}
          <button className="console-button location-button" onClick={() => game.selectSpace(activePlayer?.position ?? null)}>
            <Landmark size={14} /> My space
          </button>
        </div>
      </footer>

      {game.railroadRaid && activePlayer?.id === game.railroadRaid.attackerId && !activePlayer.isAI && (
        <div className="modal-backdrop">
          <div className="game-modal raid-modal" role="dialog" aria-modal="true" aria-labelledby="raid-title">
            <div className="modal-ornament"><Coins size={25} /></div>
            <div className="eyebrow">RAILROAD BONUS EVENT</div>
            {game.railroadRaid.mode === 'choose' ? (
              <>
                <h2 id="raid-title">Choose your next move</h2>
                <p>Use your railroad connection to raid the bank or disrupt a rival city landmark.</p>
                <div className="raid-option-grid">
                  <button className="raid-option raid-heist" onClick={game.startBankHeist}>
                    <span className="raid-option-icon"><Coins size={25} /></span>
                    <strong>Bank Heist</strong>
                    <small>Pick one of three vaults. Rewards range from $150 to $550.</small>
                  </button>
                  <div className="raid-shutdown-list">
                    <div className="raid-list-title"><ShieldCheck size={15} /> Shutdown a rival</div>
                    {game.players.filter((player) => !player.isBankrupt && player.id !== activePlayer.id).map((player) => (
                      <button className="raid-target" key={player.id} onClick={() => game.shutdownLandmark(player.id)}>
                        <span className="raid-target-dot" style={{ background: player.color }} />
                        <span className="raid-target-name">{player.name}</span>
                        <span className="raid-target-level">LV {player.landmarkLevel}</span>
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <button className="raid-skip" onClick={game.skipRailroadRaid}>Skip this event</button>
              </>
            ) : (
              <>
                <h2 id="raid-title">Choose a vault</h2>
                <p>Three vaults are locked. Choose one to reveal your bank heist reward.</p>
                <div className="vault-grid">
                  {[0, 1, 2].map((vaultIndex) => (
                    <button className="vault-choice" key={vaultIndex} onClick={() => game.resolveBankHeist(vaultIndex)}>
                      <span className="vault-door"><span /></span>
                      <strong>VAULT {vaultIndex + 1}</strong>
                      <small>Open vault</small>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showMetaHub && (
        <div className="modal-backdrop meta-backdrop" role="presentation" onClick={() => setShowMetaHub(false)}>
          <section className="meta-hub game-modal" role="dialog" aria-modal="true" aria-labelledby="meta-hub-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowMetaHub(false)} aria-label="Close events"><X size={18} /></button>
            <div className="meta-hub-heading">
              <div className="modal-ornament"><Gift size={24} /></div>
              <div className="eyebrow">TYCOON REWARDS CLUB</div>
              <h2 id="meta-hub-title">Daily Events</h2>
              <p>Collect rewards, complete missions and build your sticker collection.</p>
            </div>

            <div className="meta-tabs">
              <button className={metaTab === 'daily' ? 'is-selected' : ''} onClick={() => setMetaTab('daily')}><Gift size={14} /> Daily</button>
              <button className={metaTab === 'missions' ? 'is-selected' : ''} onClick={() => setMetaTab('missions')}><Star size={14} /> Missions</button>
              <button className={metaTab === 'album' ? 'is-selected' : ''} onClick={() => setMetaTab('album')}><BookOpen size={14} /> Album <span>{stickerCount}/{STICKER_COLLECTION.length}</span></button>
            </div>

            {metaTab === 'daily' && (
              <div className="meta-content">
                <div className="daily-streak-card">
                  <div>
                    <div className="eyebrow">LOGIN STREAK</div>
                    <strong>{game.metaProgress.dailyStreak} <small>days</small></strong>
                    <span>{dailyClaimedToday ? 'Today’s reward collected' : 'Claim today to keep your streak alive'}</span>
                  </div>
                  <div className="streak-flame">🔥</div>
                </div>

                <div className="reward-calendar">
                  {DAILY_REWARD_CYCLE.map((reward) => {
                    const isClaimed = dailyClaimedToday
                      ? reward.day <= ((game.metaProgress.dailyStreak - 1) % 7) + 1
                      : reward.day < rewardDay;
                    const isToday = reward.day === rewardDay;
                    return (
                      <div key={reward.day} className={`reward-day ${isToday ? 'is-today' : ''} ${isClaimed ? 'is-claimed' : ''}`}>
                        <span>DAY {reward.day}</span>
                        <strong>{reward.cash ? money(reward.cash) : '—'}</strong>
                        {reward.packs > 0 ? <small>+ {reward.packs} pack</small> : <small>Cash</small>}
                        {isClaimed && <i>✓</i>}
                      </div>
                    );
                  })}
                </div>

                <button className="meta-primary-button" disabled={dailyClaimedToday} onClick={game.claimDailyReward}>
                  <Gift size={16} /> {dailyClaimedToday ? 'Daily reward claimed' : `Claim day ${rewardDay} · ${money(nextDailyReward.cash)}${nextDailyReward.packs ? ' + Sticker Pack' : ''}`}
                </button>

                <div className="meta-section-title"><div><span className="eyebrow">ONE FREE SPIN EVERY DAY</span><h3>Lucky Wheel</h3></div><span className="meta-availability">{wheelUsedToday ? 'Come back tomorrow' : 'Ready to spin'}</span></div>
                <div className="wheel-layout">
                  <div className={`lucky-wheel ${isWheelSpinning ? "is-spinning" : ""}`}>
                    <div className="wheel-center"><Star size={25} fill="currentColor" /></div>
                    <span className="wheel-label wheel-label-1">$100</span>
                    <span className="wheel-label wheel-label-2">$200</span>
                    <span className="wheel-label wheel-label-3">$350</span>
                    <span className="wheel-label wheel-label-4">$500</span>
                    <span className="wheel-label wheel-label-5">$750</span>
                    <span className="wheel-label wheel-label-6">PACK</span>
                  </div>
                  <div className="wheel-copy">
                    <strong>Try your luck.</strong>
                    <p>Win cash or a Sticker Pack. The wheel resets every day.</p>
                    <button className="meta-secondary-button" disabled={wheelUsedToday} onClick={handleWheelSpin}>
                      <Sparkles size={15} /> {wheelUsedToday ? 'Already spun' : 'Spin the wheel'}
                    </button>
                    {wheelUsedToday && game.lastWheelReward && <span className="wheel-last-win">Today’s prize: {game.lastWheelReward.label}</span>}
                  </div>
                </div>
              </div>
            )}

            {metaTab === 'missions' && (
              <div className="meta-content">
                <div className="mission-summary">
                  <div><span className="eyebrow">DAILY CHALLENGES</span><h3>Make your moves count.</h3></div>
                  <span>{game.metaProgress.missionClaimed.length}/{DAILY_MISSIONS.length} claimed</span>
                </div>
                <div className="mission-list">
                  {DAILY_MISSIONS.map((mission) => {
                    const progress = Math.min(game.metaProgress.missionProgress[mission.stat], mission.target);
                    const complete = progress >= mission.target;
                    const claimed = game.metaProgress.missionClaimed.includes(mission.id);
                    return (
                      <article key={mission.id} className={`mission-card ${claimed ? 'is-claimed' : ''}`}>
                        <div className="mission-icon">{mission.id === 'roll-dice' ? '🎲' : mission.id === 'buy-property' ? '🏠' : '🚂'}</div>
                        <div className="mission-main">
                          <strong>{mission.title}</strong>
                          <span>{mission.description}</span>
                          <div className="mission-progress-track"><i style={{ width: `${(progress / mission.target) * 100}%` }} /></div>
                          <small>{progress}/{mission.target} complete · Reward {money(mission.cashReward)}{mission.packReward ? ' + Sticker Pack' : ''}</small>
                        </div>
                        <button className="mission-claim" disabled={!complete || claimed} onClick={() => game.claimMissionReward(mission.id)}>
                          {claimed ? 'Claimed' : complete ? 'Claim' : 'In progress'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {metaTab === 'album' && (
              <div className="meta-content album-content">
                <div className="album-summary">
                  <div><span className="eyebrow">COLLECTION PROGRESS</span><h3>Miniature City Album</h3><p>Collect all 18 stickers across three themed sets.</p></div>
                  <strong>{stickerCount}<small> / {STICKER_COLLECTION.length}</small></strong>
                </div>
                <div className="album-progress-track"><i style={{ width: `${(stickerCount / STICKER_COLLECTION.length) * 100}%` }} /></div>
                {['City Lights', 'Wonder Park', 'Royal Fortune'].map((setName) => {
                  const setStickers = STICKER_COLLECTION.filter((sticker) => sticker.set === setName);
                  const ownedInSet = setStickers.filter((sticker) => (game.metaProgress.stickers[sticker.id] ?? 0) > 0).length;
                  return (
                    <section className="sticker-set" key={setName}>
                      <div className="sticker-set-heading"><strong>{setName}</strong><span>{ownedInSet}/{setStickers.length}</span></div>
                      <div className="sticker-grid">
                        {setStickers.map((sticker) => {
                          const owned = (game.metaProgress.stickers[sticker.id] ?? 0) > 0;
                          return (
                            <div className={`sticker-card ${owned ? 'is-owned' : 'is-locked'} rarity-${sticker.rarity.toLowerCase()}`} key={sticker.id}>
                              <span className="sticker-emoji">{owned ? sticker.emoji : '？'}</span>
                              <strong>{owned ? sticker.name : 'Mystery sticker'}</strong>
                              <small>{owned ? sticker.rarity : 'Not found yet'}</small>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
                <div className="album-footer">
                  <div><span className="eyebrow">DUPLICATE EXCHANGE</span><strong><Star size={14} fill="currentColor" /> {game.metaProgress.stickerStars} stars</strong><small>10 stars can be exchanged for 1 Sticker Pack.</small></div>
                  <button className="meta-secondary-button" disabled={game.metaProgress.stickerStars < 10} onClick={game.redeemStickerStars}>Exchange 10 ★</button>
                </div>
                <button className="meta-primary-button" disabled={game.metaProgress.stickerPacks <= 0} onClick={() => setLastPackReveal(game.openStickerPack())}>
                  <PackageOpen size={16} /> Open Sticker Pack ({game.metaProgress.stickerPacks})
                </button>
                {lastPackReveal && (
                  <div className="pack-reveal">
                    <div className="sticker-set-heading"><strong>Pack opened!</strong><span>{lastPackReveal.duplicateCount} duplicates</span></div>
                    <div className="pack-reveal-cards">
                      {lastPackReveal.stickers.map((id, index) => {
                        const sticker = STICKER_COLLECTION.find((item) => item.id === id);
                        return sticker ? <div key={id + index}><span>{sticker.emoji}</span><strong>{sticker.name}</strong><small>{sticker.rarity}</small></div> : null;
                      })}
                    </div>
                    <span className="pack-reveal-note">Duplicates convert into sticker stars automatically.</span>
                  </div>
                )}
                {albumComplete && (
                  <button className="meta-primary-button album-grand-prize" disabled={game.metaProgress.albumBonusClaimed} onClick={game.claimStickerAlbumReward}>
                    <Trophy size={16} /> {game.metaProgress.albumBonusClaimed ? 'Album prize claimed' : 'Claim grand prize · $2,500'}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {showSetup && (
        <div className="modal-backdrop">
          <div className="game-modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
            <div className="modal-ornament"><Crown size={25} /></div>
            <div className="eyebrow">A CITY OF OPPORTUNITY</div>
            <h1 id="setup-title">Your empire begins here.</h1>
            <p>Build your property portfolio, collect rent, and outlast three rival tycoons in a living miniature city.</p>
            <div className="setup-facts">
              <div><UserRound size={15} /><strong>1</strong><span>Human player</span></div>
              <div><Bot size={15} /><strong>3</strong><span>AI rivals</span></div>
              <div><Wallet size={15} /><strong>$1,500</strong><span>Starting cash</span></div>
            </div>
            <button className="modal-primary" onClick={handleStart}>Enter the city <ArrowRight size={17} /></button>
            <span className="modal-caption">The board is set. Fortune favors the bold.</span>
          </div>
        </div>
      )}

      {showRules && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowRules(false)}>
          <div className="game-modal rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRules(false)} aria-label="Close rules"><X size={18} /></button>
            <div className="eyebrow">THE TYCOON'S HANDBOOK</div>
            <h2 id="rules-title">How to play</h2>
            <p className="modal-intro">A few principles to keep your empire standing.</p>
            <div className="rule-list">
              <div><span>01</span><p><strong>Roll & move</strong>Roll two dice and travel clockwise around the board.</p></div>
              <div><span>02</span><p><strong>Acquire property</strong>Buy unowned spaces and collect rent when rivals land on your holdings.</p></div>
              <div><span>03</span><p><strong>Build your district</strong>Own every property in a color group to build houses and hotels.</p></div>
              <div><span>04</span><p><strong>Manage your fortune</strong>Pay taxes, resolve cards, and use mortgages carefully to avoid bankruptcy.</p></div>
              <div><span>05</span><p><strong>Watch the dice</strong>Rolling doubles grants another turn. Three consecutive doubles send you to jail.</p></div>
              <div><span>06</span><p><strong>Grow your landmark</strong>Upgrade your city landmark to increase the bonus you collect each time you pass GO.</p></div>
              <div><span>07</span><p><strong>Railroad bonus</strong>Landing on a railroad unlocks a Bank Heist or a chance to shut down a rival landmark.</p></div>
            </div>
            <button className="modal-primary" onClick={() => setShowRules(false)}>Back to the board <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {game.activeCard && game.turnPhase === 'CARD_DRAWN' && !activePlayer?.isAI && (
        <div className="modal-backdrop">
          <div className="game-modal card-modal" role="dialog" aria-modal="true">
            <div className="card-stamp"><ScrollText size={21} /></div>
            <div className="eyebrow">{game.activeCard.deck === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST'}</div>
            <h2>{game.activeCard.title}</h2>
            <p>{game.activeCard.description}</p>
            <button className="modal-primary" onClick={game.applyActiveCard}>Resolve this card <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {game.winner && (
        <div className="modal-backdrop winner-backdrop">
          <div className="game-modal winner-modal" role="dialog" aria-modal="true">
            <div className="winner-trophy"><Trophy size={34} /></div>
            <div className="eyebrow">THE CITY HAS A NEW RULER</div>
            <h2>{game.winner.name} wins!</h2>
            <p>The final empire remains standing. A new game is ready whenever you are.</p>
            <button className="modal-primary" onClick={() => setShowSetup(true)}>Start a new game <RotateCcw size={16} /></button>
          </div>
        </div>
      )}
    </main>
  );
};

export default App;
