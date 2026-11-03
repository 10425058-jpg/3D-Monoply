import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Bot,
  Coins,
  Crown,
  Gift,
  Star,
  PackageOpen,
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
import type { TokenType, TradeOffer } from './types/game';
import { TopHeader } from './components/ui/TopHeader';
import { PlayerSidebar } from './components/ui/PlayerSidebar';
import { RightActivityNav } from './components/ui/RightActivityNav';
import { BottomActionDock } from './components/ui/BottomActionDock';
import { PropertyCard } from './components/ui/PropertyCard';
import { StatsModal } from './components/ui/StatsModal';
import { sounds } from './utils/audio';
import './app-ui.css';

const DEFAULT_SETUP = [
  { name: 'You', isAI: false, token: 'rubber_duck' as TokenType, color: '#f59e0b' },
  { name: 'Victoria', isAI: true, token: 'cat' as TokenType, color: '#ec4899' },
  { name: 'Arthur', isAI: true, token: 'racecar' as TokenType, color: '#3b82f6' },
  { name: 'Elena', isAI: true, token: 'yacht' as TokenType, color: '#10b981' },
];

type GraphicsQuality = 'low' | 'balanced' | 'high';

const getInitialGraphicsQuality = (): GraphicsQuality => {
  if (typeof window === 'undefined') return 'balanced';
  try {
    const saved = window.localStorage.getItem('monopoly-graphics-quality');
    if (saved === 'low' || saved === 'balanced' || saved === 'high') return saved;
  } catch {
    // Storage fallback
  }
  const cores = window.navigator.hardwareConcurrency || 8;
  const memory = (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
  return cores <= 4 || memory <= 4 ? 'low' : 'balanced';
};

const money = (value: number) => `$${value.toLocaleString('en-US')}`;

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const App: React.FC = () => {
  const game = useGameStore();
  const [showSetup, setShowSetup] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMetaHub, setShowMetaHub] = useState(false);
  const [metaTab, setMetaTab] = useState<'daily' | 'missions' | 'album'>('daily');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeTargetId, setTradeTargetId] = useState<number>(1);
  const [tradePropertyId, setTradePropertyId] = useState<string>('');
  const [tradeRequestPropertyId, setTradeRequestPropertyId] = useState<string>('');
  const [tradeOfferCash, setTradeOfferCash] = useState<string>('0');
  const [tradeRequestCash, setTradeRequestCash] = useState<string>('150');
  const [tradeFeedback, setTradeFeedback] = useState<string>('');
  const [autoRoll, setAutoRoll] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(getInitialGraphicsQuality);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [lastPackReveal, setLastPackReveal] = useState<{ stickers: string[]; duplicateCount: number } | null>(null);

  const activePlayer = game.players[game.currentPlayerIndex];
  const inspectorSpaceId = game.hoveredSpaceId ?? game.selectedSpaceId;
  const selectedSpace = inspectorSpaceId === null ? null : BOARD_SPACES[inspectorSpaceId];
  const selectedState = selectedSpace ? game.properties[selectedSpace.id] : undefined;
  const selectedOwner = selectedState?.ownerId === null || selectedState?.ownerId === undefined
    ? undefined
    : game.players.find((player) => player.id === selectedState.ownerId);

  const rivalPlayers = useMemo(
    () => game.players.filter((player) => !player.isBankrupt && player.id !== activePlayer?.id),
    [game.players, activePlayer?.id]
  );

  const myTradableProperties = useMemo(() => {
    if (!activePlayer) return [];
    return BOARD_SPACES.filter((space) => {
      const state = game.properties[space.id];
      return state?.ownerId === activePlayer.id && !state.isMortgaged && (state.houses ?? 0) === 0;
    });
  }, [activePlayer, game.properties]);

  const rivalTradableProperties = useMemo(() => {
    if (!activePlayer) return [];
    return BOARD_SPACES.filter((space) => {
      const state = game.properties[space.id];
      return state?.ownerId === tradeTargetId && !state.isMortgaged && (state.houses ?? 0) === 0;
    });
  }, [activePlayer, tradeTargetId, game.properties]);

  const todayKey = localDateKey();
  const dailyClaimedToday = game.metaProgress.lastDailyClaimDate === todayKey;
  const wheelUsedToday = game.metaProgress.lastWheelSpinDate === todayKey;
  const rewardDay = ((game.metaProgress.dailyStreak) % 7) + 1;
  const nextDailyReward = DAILY_REWARD_CYCLE.find((item) => item.day === rewardDay) || DAILY_REWARD_CYCLE[0];
  const stickerCount = Object.keys(game.metaProgress.stickers).length;
  const albumComplete = stickerCount >= STICKER_COLLECTION.length;

  // AI Turn handler
  useEffect(() => {
    if (!activePlayer || !activePlayer.isAI || activePlayer.isBankrupt || game.winner) return;

    const timer = window.setTimeout(() => {
      switch (game.turnPhase) {
        case 'PRE_ROLL':
          game.rollDice();
          break;
        case 'CARD_DRAWN':
          game.applyActiveCard();
          break;
        case 'LANDED_ACTION': {
          const space = BOARD_SPACES[activePlayer.position];
          const property = game.properties[space.id];
          if (space.price && property?.ownerId === null && activePlayer.money >= space.price) {
            if (activePlayer.money - space.price >= 120 || Math.random() < 0.85) {
              game.buyCurrentProperty();
            } else {
              game.auctionCurrentProperty();
            }
          } else {
            game.declineProperty();
          }
          break;
        }
        case 'DEBT_RESOLUTION': {
          const debt = game.pendingDebt;
          if (!debt) return;
          if (activePlayer.money >= debt.amount) {
            game.settlePendingDebt();
          } else {
            const mortgagable = BOARD_SPACES.filter((space) => {
              const state = game.properties[space.id];
              return state?.ownerId === activePlayer.id && !state.isMortgaged && (state.houses ?? 0) === 0;
            });
            if (mortgagable.length > 0) {
              game.toggleMortgage(mortgagable[0].id);
            } else {
              game.declareBankruptcy();
            }
          }
          break;
        }
        case 'END_TURN':
          game.endTurn();
          break;
        default:
          break;
      }
    }, 850 / game.gameSpeed);

    return () => window.clearTimeout(timer);
  }, [activePlayer, game.turnPhase, game.winner, game.pendingDebt, game.railroadRaid, game.gameSpeed]);

  // AI Auction handler
  useEffect(() => {
    const auction = game.auction;
    const bidder = auction
      ? game.players.find((player) => player.id === auction.currentBidderId)
      : undefined;
    if (!auction || !bidder?.isAI) return;

    const timer = window.setTimeout(() => {
      const space = BOARD_SPACES[auction.spaceId];
      const groupSpaces = BOARD_SPACES.filter((candidate) => candidate.colorGroup === space.colorGroup);
      const ownedInGroup = groupSpaces.filter((candidate) =>
        game.properties[candidate.id]?.ownerId === bidder.id
      ).length;
      const completesSet = groupSpaces.length > 0 && ownedInGroup + 1 === groupSpaces.length;
      const strategicMultiplier = completesSet ? 1.08 : ownedInGroup > 0 ? 0.82 : 0.62;
      const cashReserve = Math.max(100, Math.min(350, Math.round(bidder.money * 0.2)));
      const maxBid = Math.max(0, Math.min(
        bidder.money - cashReserve,
        Math.round((space.price ?? 0) * strategicMultiplier)
      ));
      const nextBid = auction.currentBid + 10;

      if (nextBid <= maxBid && bidder.money >= nextBid) {
        game.placeAuctionBid(10);
      } else {
        game.passAuction();
      }
    }, 720 / game.gameSpeed);

    return () => window.clearTimeout(timer);
  }, [game.auction, game.players, game.properties, game.gameSpeed]);

  // AI Railroad Raid handler
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

  // Auto-roll handler
  useEffect(() => {
    if (!autoRoll || !activePlayer || activePlayer.isAI || activePlayer.isBankrupt || game.winner) return;
    if (game.turnPhase !== 'PRE_ROLL' || game.railroadRaid || showTradeModal || showMetaHub || showRules || showSetup) return;
    const timer = window.setTimeout(() => game.rollDice(), 260 / game.gameSpeed);
    return () => window.clearTimeout(timer);
  }, [autoRoll, activePlayer?.id, activePlayer?.isAI, game.turnPhase, game.railroadRaid, game.gameSpeed, game.winner, showTradeModal, showMetaHub, showRules, showSetup]);

  const openTrade = () => {
    if (!activePlayer || activePlayer.isAI) return;
    setTradeTargetId(rivalPlayers[0]?.id ?? 1);
    setTradePropertyId(myTradableProperties[0] ? String(myTradableProperties[0].id) : '');
    setTradeRequestPropertyId('');
    setTradeOfferCash('0');
    setTradeRequestCash('150');
    setTradeFeedback('');
    setShowTradeModal(true);
  };

  const handleTradeSubmit = () => {
    if (!activePlayer || !rivalPlayers.some((player) => player.id === tradeTargetId)) return;
    const offerCash = Math.max(0, Math.floor(Number(tradeOfferCash) || 0));
    const requestCash = Math.max(0, Math.floor(Number(tradeRequestCash) || 0));
    const offer: TradeOffer = {
      fromPlayerId: activePlayer.id,
      toPlayerId: tradeTargetId,
      offerCash,
      requestCash,
      offerProperties: tradePropertyId ? [Number(tradePropertyId)] : [],
      requestProperties: tradeRequestPropertyId ? [Number(tradeRequestPropertyId)] : [],
    };
    const result = game.proposeTrade(offer);
    setTradeFeedback(result.message);
    if (result.accepted) {
      sounds.playPurchase();
      window.setTimeout(() => setShowTradeModal(false), 1100);
    }
  };

  const handleWheelSpin = () => {
    if (wheelUsedToday || isWheelSpinning) return;
    sounds.playUpgrade();
    setIsWheelSpinning(true);
    game.spinLuckyWheel();
    window.setTimeout(() => setIsWheelSpinning(false), 1350);
  };

  const handleStart = () => {
    sounds.playPurchase();
    game.startNewGame(DEFAULT_SETUP);
    setShowSetup(false);
  };

  return (
    <main className="monopoly-app">
      {/* 3D Scene Layer */}
      <div className="world-layer">
        <Scene3D quality={graphicsQuality} />
      </div>
      <div className="world-vignette" aria-hidden="true" />

      {/* 1. TOP HUD */}
      <TopHeader onOpenSettings={() => setShowSetup(true)} />

      {/* 2. LEFT PLAYER SIDEBAR */}
      <PlayerSidebar />

      {/* 3. RIGHT ACTIVITY NAVIGATION */}
      <RightActivityNav
        onOpenDaily={() => { setMetaTab('daily'); setShowMetaHub(true); }}
        onOpenSpin={() => { setMetaTab('daily'); setShowMetaHub(true); }}
        onOpenAlbum={() => { setMetaTab('album'); setShowMetaHub(true); }}
        onOpenMissions={() => { setMetaTab('missions'); setShowMetaHub(true); }}
      />

      {/* 4. BOTTOM ACTION DOCK */}
      <BottomActionDock
        onOpenStats={() => setShowStats(true)}
        onOpenRules={() => setShowRules(true)}
        onOpenTrade={openTrade}
        onOpenAuction={game.auctionCurrentProperty}
        autoRoll={autoRoll}
        onToggleAutoRoll={() => setAutoRoll((v) => !v)}
      />

      {/* 5. PROPERTY DEED INSPECTOR CARD */}
      {selectedSpace && (
        <PropertyCard
          space={selectedSpace}
          state={selectedState}
          owner={selectedOwner}
          onClose={() => {
            game.selectSpace(null);
            game.setHoveredSpace(null);
          }}
        />
      )}

      {/* 6. STATS & PORTFOLIO MODAL */}
      <StatsModal isOpen={showStats} onClose={() => setShowStats(false)} />

      {/* ============================================================== */}
      {/* 7. GAME MODALS                                                 */}
      {/* ============================================================== */}
      {/* Trade Modal */}
      {showTradeModal && activePlayer && !activePlayer.isAI && (
        <div className="modal-backdrop">
          <section className="game-modal trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-title">
            <button className="modal-close" onClick={() => setShowTradeModal(false)} aria-label="Close trade"><X size={18} /></button>
            <div className="modal-ornament"><Coins size={24} /></div>
            <div className="eyebrow">NEGOTIATION DESK</div>
            <h2 id="trade-title">Propose a trade</h2>
            <p>Exchange cash and one property from each side. The rival evaluates the full offer, including color-set value.</p>
            {rivalPlayers.length === 0 ? (
              <p>No rival is available to trade with.</p>
            ) : (
              <>
                <label className="trade-field">
                  <span>Trade with</span>
                  <select
                    value={tradeTargetId}
                    onChange={(event) => {
                      setTradeTargetId(Number(event.target.value));
                      setTradeRequestPropertyId('');
                    }}
                  >
                    {rivalPlayers.map((player) => <option key={player.id} value={player.id}>{player.name} · {money(player.money)}</option>)}
                  </select>
                </label>
                <label className="trade-field">
                  <span>Property to offer</span>
                  <select value={tradePropertyId} onChange={(event) => setTradePropertyId(event.target.value)}>
                    <option value="">Cash only — no property</option>
                    {myTradableProperties.map((space) => <option key={space.id} value={space.id}>{space.name} · {money(space.price ?? 0)}</option>)}
                  </select>
                </label>
                <label className="trade-field">
                  <span>Property to request</span>
                  <select value={tradeRequestPropertyId} onChange={(event) => setTradeRequestPropertyId(event.target.value)}>
                    <option value="">No property requested</option>
                    {rivalTradableProperties.map((space) => <option key={space.id} value={space.id}>{space.name} · {money(space.price ?? 0)}</option>)}
                  </select>
                </label>
                <div className="trade-cash-grid">
                  <label className="trade-field">
                    <span>Your cash offer</span>
                    <input type="number" min="0" step="10" max={activePlayer.money} value={tradeOfferCash} onChange={(event) => setTradeOfferCash(event.target.value)} />
                  </label>
                  <label className="trade-field">
                    <span>Ask for cash</span>
                    <input type="number" min="0" step="10" value={tradeRequestCash} onChange={(event) => setTradeRequestCash(event.target.value)} />
                  </label>
                </div>
                {tradeFeedback && <div className={`trade-feedback ${tradeFeedback.includes('accepted') ? 'is-success' : 'is-warning'}`}>{tradeFeedback}</div>}
                <div className="trade-modal-actions">
                  <button className="console-button secondary" onClick={() => setShowTradeModal(false)}>Cancel</button>
                  <button className="console-button primary" disabled={
                    Number(tradeOfferCash) > activePlayer.money ||
                    (!tradePropertyId && !tradeRequestPropertyId && Number(tradeOfferCash) <= 0 && Number(tradeRequestCash) <= 0)
                  } onClick={handleTradeSubmit}>
                    Send offer <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Railroad Raid Modal */}
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

      {/* Meta Hub (Daily, Missions, Album) */}
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
              <button className={metaTab === 'album' ? 'is-selected' : ''} onClick={() => setMetaTab('album')}><Star size={14} /> Album <span>{stickerCount}/{STICKER_COLLECTION.length}</span></button>
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

                <button className="meta-primary-button" disabled={dailyClaimedToday} onClick={() => { sounds.playPurchase(); game.claimDailyReward(); }}>
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
                        <button className="mission-claim" disabled={!complete || claimed} onClick={() => { sounds.playPurchase(); game.claimMissionReward(mission.id); }}>
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
                  <button className="meta-secondary-button" disabled={game.metaProgress.stickerStars < 10} onClick={() => { sounds.playPurchase(); game.redeemStickerStars(); }}>Exchange 10 ★</button>
                </div>
                <button className="meta-primary-button" disabled={game.metaProgress.stickerPacks <= 0} onClick={() => { sounds.playCardDraw(); setLastPackReveal(game.openStickerPack()); }}>
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
                  <button className="meta-primary-button album-grand-prize" disabled={game.metaProgress.albumBonusClaimed} onClick={() => { sounds.playUpgrade(); game.claimStickerAlbumReward(); }}>
                    <Trophy size={16} /> {game.metaProgress.albumBonusClaimed ? 'Album prize claimed' : 'Claim grand prize · $2,500'}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Setup / New Game Modal */}
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

      {/* Rulebook Modal */}
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

      {/* Active Card Modal (Chance & Community Chest) */}
      {game.activeCard && game.turnPhase === 'CARD_DRAWN' && !activePlayer?.isAI && (
        <div className="modal-backdrop">
          <div className="game-modal card-modal" role="dialog" aria-modal="true">
            <div className="card-stamp"><ScrollText size={21} /></div>
            <div className="eyebrow">{game.activeCard.deck === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST'}</div>
            <h2>{game.activeCard.title}</h2>
            <p>{game.activeCard.description}</p>
            <button className="modal-primary" onClick={() => { sounds.playCardDraw(); game.applyActiveCard(); }}>
              Resolve this card <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Winner / Game Over Modal */}
      {game.winner && (
        <div className="modal-backdrop winner-backdrop">
          <div className="game-modal winner-modal" role="dialog" aria-modal="true">
            <div className="winner-trophy"><Trophy size={34} /></div>
            <div className="eyebrow">THE CITY HAS A NEW RULER</div>
            <h2>{game.winner.name} wins!</h2>
            <p>The final empire remains standing. A new game is ready whenever you are.</p>
            <button className="modal-primary" onClick={() => { sounds.playUpgrade(); setShowSetup(true); }}>
              Start a new game <RotateCcw size={16} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default App;
