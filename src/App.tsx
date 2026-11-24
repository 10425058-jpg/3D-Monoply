import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Flag,
  Gift,
  Star,
  PackageOpen,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Wallet,
} from 'lucide-react';

import { Scene3D } from './components/3d/Scene3D';
import { BOARD_SPACES } from './data/boardData';
import { useGameStore } from './store/useGameStore';
import { DAILY_MISSIONS, DAILY_REWARD_CYCLE, STICKER_COLLECTION } from './data/metaGameData';
import type { BoardSpace, SoloRuleset, TokenType, TradeOffer } from './types/game';
import { TopHeader } from './components/ui/TopHeader';
import { PlayerSidebar } from './components/ui/PlayerSidebar';
import { RightActivityNav } from './components/ui/RightActivityNav';
import { BottomActionDock } from './components/ui/BottomActionDock';
import { PropertyCard } from './components/ui/PropertyCard';
import { PropertyEvolution } from './components/ui/PropertyEvolution';
import { ActivityLog, MatchActivityNotices } from './components/ui/ActivityLog';
import { RoyalArt, RoyalButton, RoyalModal, RoyalNotice, RoyalPresence, RoyalTabs } from './components/ui/RoyalUI';
import { CharacterAvatar } from './components/ui/Avatars';
import { BookOpen, ClipboardCheck, Disc3, Handshake, Layers, Settings, TrainFront, Vault } from 'lucide-react';
import { StatsModal } from './components/ui/StatsModal';
import { sounds } from './utils/audio';
import './app-ui.css';
import './fantasy-hud.css';
import './game-effects.css';
import './board-v5.css';
import { GameplayFeedback } from './components/ui/GameplayFeedback';
import { CardReveal } from './components/ui/CardReveal';
import { AudioControls } from './components/ui/AudioControls';
import {SoloDecisions} from './components/ui/SoloDecisions';
import {aiDecisionDelay, runSoloAiAuction, runSoloAiRaid, runSoloAiStep} from './game/soloAi';
import {useSoloAudit} from './game/useSoloAudit';
import {groupHasBuildings} from './game/soloRules';
import {TradeTerms} from './components/ui/TradeTerms';

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

export const App: React.FC<{ onHome?: () => void }> = ({ onHome }) => {
  useSoloAudit();
  const game = useGameStore();
  const [showSetup, setShowSetup] = useState(false);
  const [nextRuleset, setNextRuleset] = useState<SoloRuleset>('arcade');
  const [evolutionSpaceId, setEvolutionSpaceId] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMetaHub, setShowMetaHub] = useState(false);
  const [metaTab, setMetaTab] = useState<'daily' | 'spin' | 'missions' | 'album'>('daily');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeTargetId, setTradeTargetId] = useState<number>(1);
  const [tradePropertyId, setTradePropertyId] = useState<string>('');
  const [tradeRequestPropertyId, setTradeRequestPropertyId] = useState<string>('');
  const [tradeOfferCash, setTradeOfferCash] = useState<string>('0');
  const [tradeRequestCash, setTradeRequestCash] = useState<string>('150');
  const [tradeFeedback, setTradeFeedback] = useState<string>('');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(getInitialGraphicsQuality);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [lastPackReveal, setLastPackReveal] = useState<{ stickers: string[]; duplicateCount: number } | null>(null);

  const activePlayer = game.players[game.currentPlayerIndex];
  const cardDraw = activePlayer && game.activeCard && game.turnPhase === 'CARD_DRAWN'
    ? { id: game.cardDrawId, card: game.activeCard, player: activePlayer } : undefined;
  const decisionCard = cardDraw && !cardDraw.player.isAI ? cardDraw : undefined;
  const finalCard = game.winner ? game.activity.at(-2)?.card : undefined;
  const bankruptcyMessage = game.logs.find(log => log.message.includes(' declared bankruptcy over '))?.message;
  const humanDefeat = !!game.winner?.isAI && game.players.some(player => !player.isAI && player.isBankrupt);
  const debtPlayer = game.players.find(p=>p.id===(game.pendingDebt?.debtorId??activePlayer?.id));
  const tradePlayer = game.turnPhase === 'DEBT_RESOLUTION' ? debtPlayer : activePlayer;
  const tradeProposal = useRef('');
  useEffect(()=>{
    setShowTradeModal(false);setTradeFeedback('');setShowStats(false);setShowRules(false);setShowMetaHub(false);setLastPackReveal(null);setIsWheelSpinning(false);
    setEvolutionSpaceId(null);
  },[game.gameId]);
  const arcade = game.ruleset === 'arcade';
  const matchId = `solo-${game.gameId}`;
  const { selectedSpaceId } = game;
  const evolutionOpen = arcade && evolutionSpaceId !== null && evolutionSpaceId === selectedSpaceId;
  const selectedSpace = selectedSpaceId === null ? null : BOARD_SPACES[selectedSpaceId];
  const selectedState = selectedSpace ? game.properties[selectedSpace.id] : undefined;
  const selectedOwner = selectedState?.ownerId === null || selectedState?.ownerId === undefined
    ? undefined
    : game.players.find((player) => player.id === selectedState.ownerId);
  const openEvolution = (spaceId: number) => {
    game.selectSpace(spaceId);
    setEvolutionSpaceId(spaceId);
  };
  const closeProperty = () => {
    setEvolutionSpaceId(null);
    game.selectSpace(null);
  };

  const rivalPlayers = useMemo(
    () => game.players.filter((player) => !player.isBankrupt && player.id !== tradePlayer?.id),
    [game.players, tradePlayer?.id]
  );
  const rival = rivalPlayers.find(player => player.id === tradeTargetId);
  const tradeRestriction = (space: BoardSpace) => game.properties[space.id]?.isMortgaged ? 'Mortgaged' :
    !arcade && groupHasBuildings(space, game.properties) ? 'Group has buildings' : '';
  const deedsOf = (id?: number) => BOARD_SPACES.filter(space => game.properties[space.id]?.ownerId === id);
  const tradeOptions = (id?: number) => deedsOf(id).map(space => {
    const restriction = tradeRestriction(space);
    return <option key={space.id} value={space.id} disabled={!!restriction}>{space.name} · {restriction || 'Clear deed'}</option>;
  });

  const todayKey = localDateKey();
  const dailyClaimedToday = game.metaProgress.lastDailyClaimDate === todayKey;
  const wheelUsedToday = game.metaProgress.lastWheelSpinDate === todayKey;
  const rewardDay = ((game.metaProgress.dailyStreak) % 7) + 1;
  const nextDailyReward = DAILY_REWARD_CYCLE.find((item) => item.day === rewardDay) || DAILY_REWARD_CYCLE[0];
  const stickerCount = Object.keys(game.metaProgress.stickers).length;
  const albumComplete = stickerCount >= STICKER_COLLECTION.length;

  // AI Turn handler
  useEffect(() => {
    const delay = aiDecisionDelay[game.turnPhase];
    if (!delay || !debtPlayer?.isAI || debtPlayer.isBankrupt || game.winner || game.pendingTrade || game.railroadRaid) return;
    const timer = window.setTimeout(() => runSoloAiStep(game.gameId, debtPlayer.id, game.turnPhase), delay / game.gameSpeed);
    return () => window.clearTimeout(timer);
  }, [game.gameId, debtPlayer, game.turnPhase, game.winner, game.pendingDebt, game.pendingTrade, game.railroadRaid, game.gameSpeed]);

  // AI Auction handler
  useEffect(() => {
    const auction = game.auction;
    if (!auction || !game.players.find(player => player.id === auction.currentBidderId)?.isAI) return;
    const timer = window.setTimeout(() => runSoloAiAuction(game.gameId, auction), 530 / game.gameSpeed);
    return () => window.clearTimeout(timer);
  }, [game.gameId, game.auction, game.players, game.properties, game.gameSpeed]);

  // AI Railroad Raid handler
  useEffect(() => {
    const raid = game.railroadRaid;
    if (!raid) return;
    const attacker = game.players.find((player) => player.id === raid.attackerId);
    if (!attacker?.isAI) return;

    const timer = window.setTimeout(() => runSoloAiRaid(game.gameId, raid), 490 / game.gameSpeed);

    return () => window.clearTimeout(timer);
  }, [game.gameId, game.railroadRaid, game.players, game.gameSpeed]);

  const openTrade = () => {
    if (!tradePlayer || tradePlayer.isAI || tradePlayer.isBankrupt || game.winner || game.pendingTrade || game.railroadRaid || !['PRE_ROLL','LANDED_ACTION','END_TURN','DEBT_RESOLUTION'].includes(game.turnPhase)) return;
    tradeProposal.current=`${game.gameId}-${crypto.randomUUID()}`;
    setTradeTargetId(rivalPlayers[0]?.id ?? 1);
    const deed = deedsOf(tradePlayer.id).find(space => !tradeRestriction(space));
    setTradePropertyId(deed ? String(deed.id) : '');
    setTradeRequestPropertyId('');
    setTradeOfferCash('0');
    setTradeRequestCash('150');
    setTradeFeedback('');
    setShowTradeModal(true);
  };

  const offer: TradeOffer | null = tradePlayer && rival ? {
      proposalId: tradeProposal.current,
      fromPlayerId: tradePlayer.id,
      toPlayerId: tradeTargetId,
      offerCash: Number(tradeOfferCash),
      requestCash: Number(tradeRequestCash),
      offerProperties: tradePropertyId ? [Number(tradePropertyId)] : [],
      requestProperties: tradeRequestPropertyId ? [Number(tradeRequestPropertyId)] : [],
  } : null;
  const validCash = !!offer && Number.isSafeInteger(offer.offerCash) && Number.isSafeInteger(offer.requestCash) &&
    offer.offerCash >= 0 && offer.requestCash >= 0 && offer.offerCash <= tradePlayer!.money && offer.requestCash <= rival!.money;
  const handleTradeSubmit = () => {
    if (useGameStore.getState().gameId !== game.gameId || !offer || !validCash) return;
    const result = game.proposeTrade(offer);
    setTradeFeedback(result.message);
    if (result.accepted || useGameStore.getState().pendingTrade) setShowTradeModal(false);
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
    game.startNewGame(DEFAULT_SETUP, nextRuleset);
    setShowSetup(false);
  };

  return (
    <main className="monopoly-app">
      <GameplayFeedback activityNotices />
      <MatchActivityNotices matchId={matchId} events={game.activity} draw={cardDraw}
        paused={!!(decisionCard || game.pendingTrade || game.pendingDebt || game.auction || game.winner ||
          showStats || showSetup || showRules || showTradeModal || showMetaHub || (game.railroadRaid && !activePlayer?.isAI))} />
      <SoloDecisions onOpenTrade={openTrade} tradeOpen={showTradeModal}
        onOpenEvolution={openEvolution} evolutionOpen={evolutionOpen} />
      {/* 3D Scene Layer */}
      <div className="world-layer">
        <Scene3D quality={graphicsQuality} propertyPanel={evolutionOpen} />
      </div>
      <div className="world-vignette" aria-hidden="true" />

      {/* 1. TOP HUD */}
      <TopHeader onOpenSettings={() => setShowSetup(true)} />

      {/* 2. LEFT PLAYER SIDEBAR */}
      <PlayerSidebar />

      {/* 3. RIGHT ACTIVITY NAVIGATION */}
      <RightActivityNav
        onOpenDaily={() => { setMetaTab('daily'); setShowMetaHub(true); }}
        onOpenSpin={() => { setMetaTab('spin'); setShowMetaHub(true); }}
        onOpenAlbum={() => { setMetaTab('album'); setShowMetaHub(true); }}
        onOpenMissions={() => { setMetaTab('missions'); setShowMetaHub(true); }}
      />

      {/* 4. BOTTOM ACTION DOCK */}
      <BottomActionDock
        onOpenStats={() => setShowStats(true)}
        onOpenRules={() => setShowRules(true)}
        onOpenTrade={openTrade}
        onOpenAuction={game.auctionCurrentProperty}
        onOpenEvolution={openEvolution}
      />

      {/* 5. PROPERTY DEED INSPECTOR CARD */}
      <AnimatePresence mode="wait">
      {selectedSpace && (evolutionOpen && selectedSpace.type === 'property' ? (
        <PropertyEvolution key={`evolution-${selectedSpace.id}`} space={selectedSpace} state={selectedState}
          owner={selectedOwner} onClose={closeProperty} />
      ) : (
        <PropertyCard
          key={selectedSpace.id}
          space={selectedSpace}
          state={selectedState}
          owner={selectedOwner}
          onClose={closeProperty}
          onOpenEvolution={openEvolution}
        />
      ))}
      </AnimatePresence>

      {/* 6. STATS & PORTFOLIO MODAL */}
      <StatsModal isOpen={showStats} onClose={() => setShowStats(false)} />

      {/* ============================================================== */}
      {/* 7. GAME MODALS                                                 */}
      {/* ============================================================== */}
      {/* Trade Modal */}
      <RoyalPresence>{showTradeModal && tradePlayer && !tradePlayer.isAI && (
        <RoyalModal key="trade" title="Propose a trade" titleId="trade-title" icon={Handshake} size="large" className="trade-modal"
          onClose={() => setShowTradeModal(false)} closeLabel="Close trade" footer={<>
            <RoyalButton onClick={() => setShowTradeModal(false)}>Cancel</RoyalButton>
            {!!rivalPlayers.length && <RoyalButton variant="primary" disabled={!validCash ||
              (!tradePropertyId && !tradeRequestPropertyId && Number(tradeOfferCash) <= 0 && Number(tradeRequestCash) <= 0)}
              onClick={handleTradeSubmit}>Send offer <ArrowRight size={14} /></RoyalButton>}
          </>}
          description={arcade ? 'Exchange cash and up to one clear deed per player.' : 'Exchange cash and up to one clear deed per player. Sell buildings in a group before trading its deeds.'}>
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
                <div className="trade-sides">
                  <section className="trade-side">
                    <header className="trade-side-header">
                      <CharacterAvatar character={tradePlayer.name} color={tradePlayer.color} size={40} />
                      <div><h3>{tradePlayer.name === 'You' ? 'You offer' : `${tradePlayer.name} offers`}</h3><strong>{money(tradePlayer.money)}</strong></div>
                    </header>
                    <label className="trade-field">
                      <span>Property to offer</span>
                      <select value={tradePropertyId} onChange={event => setTradePropertyId(event.target.value)}>
                        <option value="">Cash only</option>
                        {tradeOptions(tradePlayer.id)}
                      </select>
                    </label>
                    <label className="trade-field">
                      <span>Cash to offer</span>
                      <input type="number" min="0" step="1" max={tradePlayer.money} value={tradeOfferCash} onChange={event => setTradeOfferCash(event.target.value)} />
                    </label>
                  </section>
                  <section className="trade-side">
                    <header className="trade-side-header">
                      {rival && <CharacterAvatar character={rival.name} color={rival.color} size={40} />}
                      <div><h3>Request from {rival?.name}</h3>{rival && <strong>{money(rival.money)}</strong>}</div>
                    </header>
                    <label className="trade-field">
                      <span>Property to request</span>
                      <select value={tradeRequestPropertyId} onChange={event => setTradeRequestPropertyId(event.target.value)}>
                        <option value="">No property requested</option>
                        {tradeOptions(rival?.id)}
                      </select>
                    </label>
                    <div className="trade-cash-grid"><label className="trade-field">
                      <span>Cash to request</span>
                      <input type="number" min="0" step="1" max={rival?.money} value={tradeRequestCash} onChange={event => setTradeRequestCash(event.target.value)} />
                    </label></div>
                  </section>
                </div>
                {offer && rival && <TradeTerms from={tradePlayer} to={rival} offer={offer} properties={game.properties} ruleset={game.ruleset} />}
                {!validCash && <p className="trade-feedback is-warning">Enter whole-dollar amounts within each player’s available cash.</p>}
                {tradeFeedback && <div role="status" className={`trade-feedback ${tradeFeedback.includes('accepted') ? 'is-success' : 'is-warning'}`}>{tradeFeedback}</div>}
              </>
            )}
        </RoyalModal>
      )}</RoyalPresence>

      {/* Railroad Raid Modal */}
      <RoyalPresence>{game.railroadRaid && activePlayer?.id === game.railroadRaid.attackerId && !activePlayer.isAI && (
        <RoyalModal key="railroad" title={game.railroadRaid.mode === 'choose' ? 'Railroad bonus' : 'Bank Heist'} titleId="raid-title"
          icon={game.railroadRaid.mode === 'choose' ? TrainFront : Vault} priority="decision" size="large" className="raid-modal">
            {game.railroadRaid.mode === 'choose' ? (
              <>

                <p>Use your railroad connection to raid the bank or disrupt a rival city landmark.</p>
                <div className="raid-option-grid">
                  <button className="raid-option raid-heist" onClick={game.startBankHeist}>
                    <RoyalArt prop="vault" />
                    <strong>Bank Heist</strong>
                    <small>Pick one of three vaults. Rewards range from $150 to $550.</small>
                  </button>
                  <div className="raid-shutdown-list">
                    <div className="raid-list-title"><ShieldCheck size={15} /> Shutdown a rival</div>
                    {game.players.filter((player) => !player.isBankrupt && player.id !== activePlayer.id).map((player) => (
                      <button className="raid-target" key={player.id} aria-label={`Attack ${player.name}’s landmark`} onClick={() => game.shutdownLandmark(player.id)}>
                        <CharacterAvatar character={player.name} color={player.color} size={36} />
                        <span className="raid-target-name">{player.name}</span>
                        <span className="raid-target-level">{player.landmarkLevel ? `Level ${player.landmarkLevel} → ${player.landmarkLevel - 1}` : 'Empty site'}</span>
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <RoyalButton variant="secondary" className="raid-skip" onClick={game.skipRailroadRaid}>Skip this event</RoyalButton>
              </>
            ) : (
              <>

                <p>Three vaults are locked. Choose one to reveal your bank heist reward.</p>
                <div className="vault-grid">
                  {[0, 1, 2].map((vaultIndex) => (
                    <button className="vault-choice" key={vaultIndex} onClick={() => game.resolveBankHeist(vaultIndex)}>
                      <RoyalArt prop="vault" />
                      <strong>Vault {vaultIndex + 1}</strong>

                    </button>
                  ))}
                </div>
              </>
            )}
        </RoyalModal>
      )}</RoyalPresence>

      {/* Meta Hub (Daily, Missions, Album) */}
      <RoyalPresence>{showMetaHub && (
        <RoyalModal key="journey" title="Journey" icon={Gift} className="meta-hub" size="large" onClose={() => setShowMetaHub(false)} closeLabel="Close events" dismissOnBackdrop>
          <RoyalTabs label="Journey activities" value={metaTab} onChange={setMetaTab} tabs={[
            { value: 'daily', label: 'Daily', icon: Gift }, { value: 'spin', label: 'Lucky Spin', icon: Disc3 },
            { value: 'missions', label: 'Missions', icon: ClipboardCheck }, { value: 'album', label: 'Album', icon: Layers },
          ]}>
            {metaTab === 'daily' && (
              <div className="meta-content">
                <div className="daily-streak-card">
                  <div>
                    <div className="eyebrow">LOGIN STREAK</div>
                    <strong>{game.metaProgress.dailyStreak} <small>days</small></strong>
                    <span>{dailyClaimedToday ? 'Today’s reward collected' : 'Claim today to keep your streak alive'}</span>
                  </div>
                  <RoyalArt prop="chest" />
                </div>

                <div className="reward-calendar">
                  {DAILY_REWARD_CYCLE.map((reward) => {
                    const isClaimed = dailyClaimedToday
                      ? reward.day <= ((game.metaProgress.dailyStreak - 1) % 7) + 1
                      : reward.day < rewardDay;
                    const isToday = !dailyClaimedToday && reward.day === rewardDay;
                    return (
                      <div key={reward.day} className={`reward-day ${isToday ? 'is-today' : ''} ${isClaimed ? 'is-claimed' : ''}`}>
                        <span>DAY {reward.day}</span>
                        <strong>{reward.cash ? money(reward.cash) : '—'}</strong>
                        {reward.packs > 0 ? <small>+ {reward.packs} pack</small> : <small>Cash</small>}
                        {isClaimed && <i aria-label="Claimed">✓</i>}
                      </div>
                    );
                  })}
                </div>

                <RoyalButton variant="primary" className="meta-primary-button" disabled={dailyClaimedToday} onClick={() => { game.claimDailyReward(); }}>
                  <Gift size={16} /> {dailyClaimedToday ? 'Daily reward claimed' : `Claim day ${rewardDay} · ${money(nextDailyReward.cash)}${nextDailyReward.packs ? ' + Sticker Pack' : ''}`}
                </RoyalButton>

              </div>
            )}
            {metaTab === 'spin' && (<div className="meta-content">
                <div className="meta-section-title"><h3>Lucky Wheel</h3><span className="meta-availability">{wheelUsedToday ? 'Come back tomorrow' : 'Ready to spin'}</span></div>
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
                    <p>Win cash or a Sticker Pack. The wheel resets every day.</p>
                    <RoyalButton variant="primary" className="meta-wheel-button" disabled={wheelUsedToday} onClick={handleWheelSpin}>
                      <Sparkles size={15} /> {wheelUsedToday ? 'Already spun' : 'Spin the wheel'}
                    </RoyalButton>
                    {wheelUsedToday && game.lastWheelReward && <span className="wheel-last-win" role="status">Today’s prize: {game.lastWheelReward.label}</span>}
                  </div>
                </div>
              </div>
            )}

            {metaTab === 'missions' && (
              <div className="meta-content">
                <div className="mission-summary">
                  <h3>Daily missions</h3>
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
                          <div className="mission-progress-track" role="progressbar" aria-label={mission.title} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={mission.target}><i style={{ width: `${(progress / mission.target) * 100}%` }} /></div>
                          <small>{progress}/{mission.target} complete · Reward {money(mission.cashReward)}{mission.packReward ? ' + Sticker Pack' : ''}</small>
                        </div>
                        <RoyalButton variant="primary" className="mission-claim" disabled={!complete || claimed} onClick={() => { game.claimMissionReward(mission.id); }}>
                          {claimed ? 'Claimed' : complete ? 'Claim' : 'In progress'}
                        </RoyalButton>
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
                <div className="album-progress-track" role="progressbar" aria-label="Stickers collected" aria-valuenow={stickerCount} aria-valuemin={0} aria-valuemax={STICKER_COLLECTION.length}><i style={{ width: `${(stickerCount / STICKER_COLLECTION.length) * 100}%` }} /></div>
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
                  <div><span className="eyebrow">DUPLICATE EXCHANGE</span><strong><Star size={14} fill="currentColor" /> {game.metaProgress.stickerStars} {game.metaProgress.stickerStars === 1 ? 'star' : 'stars'}</strong><small>10 stars can be exchanged for 1 Sticker Pack.</small></div>
                  <RoyalButton variant="secondary" className="meta-secondary-button" disabled={game.metaProgress.stickerStars < 10} onClick={() => { game.redeemStickerStars(); }}>Exchange 10 ★</RoyalButton>
                </div>
                <RoyalButton variant="primary" className="meta-primary-button" disabled={game.metaProgress.stickerPacks <= 0} onClick={() => { sounds.playCardDraw(); setLastPackReveal(game.openStickerPack()); }}>
                  <PackageOpen size={16} /> Open Sticker Pack ({game.metaProgress.stickerPacks})
                </RoyalButton>
                {lastPackReveal && (
                  <div className="pack-reveal">
                    <div className="sticker-set-heading"><strong>Pack opened!</strong><span>{lastPackReveal.duplicateCount} {lastPackReveal.duplicateCount === 1 ? 'duplicate' : 'duplicates'}</span></div>
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
                  <RoyalButton variant="primary" className="meta-primary-button album-grand-prize" disabled={game.metaProgress.albumBonusClaimed} onClick={() => { game.claimStickerAlbumReward(); }}>
                    <Trophy size={16} /> {game.metaProgress.albumBonusClaimed ? 'Album prize claimed' : 'Claim grand prize · $2,500'}
                  </RoyalButton>
                )}
              </div>
            )}
          </RoyalTabs>
        </RoyalModal>
      )}</RoyalPresence>

      {/* Setup / New Game Modal */}
      <RoyalPresence>{showSetup && (
        <RoyalModal key="setup" title="Game Settings" titleId="setup-title" icon={Settings} className="setup-modal"
          onClose={() => setShowSetup(false)} closeLabel="Close settings" footer={<RoyalButton variant="primary" className="modal-primary" onClick={handleStart}>Restart The Game <ArrowRight size={17} /></RoyalButton>}>
            <label className="trade-field">Graphics quality
              <select value={graphicsQuality} onChange={event => {
                const quality = event.target.value as GraphicsQuality;
                setGraphicsQuality(quality);
                try { localStorage.setItem('monopoly-graphics-quality', quality); } catch { /* Session preference still applies. */ }
              }}><option value="low">Low</option><option value="balanced">Balanced</option><option value="high">High</option></select>
            </label>
            <AudioControls />
            <div className="setup-facts">
              <div><UserRound size={15} /><strong>1</strong><span>Human player</span></div>
              <div><Bot size={15} /><strong>3</strong><span>AI rivals</span></div>
              <div><Wallet size={15} /><strong>$1,500</strong><span>Starting cash</span></div>
            </div>
            <fieldset className="solo-ruleset">
              <legend>Ruleset for the new match</legend>
              <div className="solo-ruleset-options">
                <label><input type="radio" name="solo-ruleset" value="arcade" checked={nextRuleset === 'arcade'} onChange={() => setNextRuleset('arcade')} />
                  <span><strong>Arcade</strong>Develop each street into a house, apartment, and hotel.</span></label>
                <label><input type="radio" name="solo-ruleset" value="classic" checked={nextRuleset === 'classic'} onChange={() => setNextRuleset('classic')} />
                  <span><strong>Classic</strong>Own a full color group and build houses evenly.</span></label>
              </div>
            </fieldset>
            <RoyalNotice>Restarting begins a new match with the selected ruleset.</RoyalNotice>
        </RoyalModal>
      )}</RoyalPresence>

      {/* Rulebook Modal */}
      <RoyalPresence>{showRules && (
        <RoyalModal key="rules" title="How to play" titleId="rules-title" icon={BookOpen} className="rules-modal" onClose={() => setShowRules(false)} closeLabel="Close rules" dismissOnBackdrop
          description={`Solo · ${arcade ? 'Arcade' : 'Classic'} rules`} footer={<RoyalButton variant="primary" onClick={() => setShowRules(false)}>Back to the board <ArrowRight size={16} /></RoyalButton>}>
            <div className="rule-list">
              <div><span>01</span><p><strong>Roll & move</strong>Roll two dice and travel clockwise around the board.</p></div>
              <div><span>02</span><p><strong>Acquire property</strong>Buy unowned spaces and collect rent when rivals land on your holdings.</p></div>
              <div><span>03</span><p><strong>{arcade ? 'Develop your streets' : 'Build your district'}</strong>{arcade ?
                'Buy a street, then choose one upgrade per landing. Land becomes a house, then an apartment, then a hotel. Each stage has its own cost and rent.' :
                'Own every property in a color group to build houses and hotels evenly.'}</p></div>
              <div><span>04</span><p><strong>Manage your fortune</strong>Pay taxes, resolve cards, and use mortgages carefully to avoid bankruptcy.</p></div>
              <div><span>05</span><p><strong>Watch the dice</strong>Rolling doubles grants another turn. Three consecutive doubles send you to jail.</p></div>
              <div><span>06</span><p><strong>Grow your landmark</strong>Upgrade your city landmark to increase the bonus you collect each time you pass GO.</p></div>
              <div><span>07</span><p><strong>Railroad bonus</strong>Landing on a railroad unlocks a Bank Heist or a chance to shut down a rival landmark.</p></div>
              <div><span>08</span><p><strong>Jail options</strong>Before rolling, pay $50 bail or use a held Jail card. Jail doubles release you without an extra roll; after three failed attempts, raise the bail and move using that roll.</p></div>
              <div><span>09</span><p><strong>Raise funds</strong>{arcade ?
                'Sell one stage for half its upgrade cost, rounded down. A street can be mortgaged at Land. Unmortgaged deeds carry their development in a trade.' :
                'Sell buildings evenly for half cost or mortgage eligible deeds. A mortgaged deed blocks construction in its group.'}
                {' '}Release a mortgage for principal plus 10% interest rounded up to whole dollars.</p></div>
              <div><span>10</span><p><strong>Local variations</strong>Solo has unlimited building stock, counts unmortgaged companion railroads/utilities for rent, and permits optional property auctions. It is not a strict G0009 Classic mode.</p></div>
            </div>
        </RoyalModal>
      )}</RoyalPresence>

      {/* Active Card Modal (Chance & Community Chest) */}
        <RoyalPresence>{decisionCard && (
          <CardReveal key={`${game.gameId}-${decisionCard.id}`} card={decisionCard.card} onResolve={() => {
            const current = useGameStore.getState();
            if (current.gameId === game.gameId) current.applyActiveCard(decisionCard.id);
          }} />
        )}</RoyalPresence>

      {/* Winner / Game Over Modal */}
      <RoyalPresence>{game.winner && !showSetup && (
        <RoyalModal key="result" title={game.winner.name === 'You' ? 'You win!' : `${game.winner.name} wins!`} titleId="solo-winner-title" icon={humanDefeat ? Flag : Trophy} tone={humanDefeat ? "ruby" : "gold"}
          className="winner-modal" priority="result" footer={<>
            {onHome && <RoyalButton onClick={onHome}>Main menu</RoyalButton>}
            <RoyalButton variant="primary" onClick={() => { sounds.playClick(); setShowSetup(true); }}>Start a new game <RotateCcw size={16} /></RoyalButton>
          </>}>
            <p>Last player standing</p>
            {bankruptcyMessage && <RoyalNotice tone="ruby">{bankruptcyMessage}</RoyalNotice>}
            {finalCard && <p><strong>{finalCard.deck === 'chance' ? 'Chance' : 'Community Chest'} · {finalCard.title}</strong><br />{finalCard.instruction}</p>}
            <ul className="solo-results" aria-label="Final portfolios">
              {[game.winner, ...game.players.filter(player => player.id !== game.winner?.id)].map(player => {
                const deeds = Object.values(game.properties).filter(property => property.ownerId === player.id).length;
                return <li key={player.id}><strong><CharacterAvatar character={player.name} color={player.color} size={32} />{player.name}</strong>
                  <span>{money(player.money)} · {deeds} {deeds === 1 ? 'deed' : 'deeds'}{player.isBankrupt ? ' · Eliminated' : ''}</span></li>;
              })}
            </ul>
            <ActivityLog matchId={matchId} events={game.activity} layout="results" />
        </RoyalModal>
      )}</RoyalPresence>
    </main>
  );
};

export default App;
