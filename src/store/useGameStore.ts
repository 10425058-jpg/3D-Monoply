import { create } from 'zustand';
import {
  ArcadeLevel,
  BoardSpace,
  CameraMode,
  CashTransfer,
  ColorGroup,
  DeckCard,
  LogEntry,
  MetaProgress,
  Player,
  PropertyAuction,
  PropertyState,
  RailroadRaid,
  SoloRuleset,
  TokenType,
  TradeOffer,
  TurnPhase,
} from '../types/game';
import { BOARD_SPACES, COLOR_GROUP_TOTALS } from '../data/boardData';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../data/cardsData';
import { DAILY_MISSIONS, DAILY_REWARD_CYCLE, LUCKY_WHEEL_REWARDS, STICKER_COLLECTION, type MissionId, type MissionStat, type WheelReward } from '../data/metaGameData';
import { groupHasBuildings, unmortgageCost } from '../game/soloRules';
import { ARCADE_STAGES, arcadeDevelopmentValue, arcadeLevel, arcadeNextLevel, arcadePreviousLevel, arcadeRent, arcadeRepairCharge, arcadeSellRefund, arcadeUpgradeCost } from '../game/arcadeRules';
import { appendMatchActivity, type ActivityActor, type ActivityKind, type ActivityTransfer, type MatchActivityEvent } from '../game/matchActivity';
import { DICE_ROLL_MS, TOKEN_STEP_MS } from '../presentation/animationMath';

interface SoloPayment {
  debtorId: number;
  creditorId: number | null;
  amount: number;
  reason: string;
}

interface PendingDebt {
  amount: number;
  creditorId: number | null;
  reason: string;
  debtorId?: number;
  remainingPayments?: SoloPayment[];
  distribution?: { recipientIds: number[]; amountPerPlayer: number };
  category?: CashTransfer['category'];
  spaceId?: number;
  developmentLevel?: number;
}

interface ArcadeLanding {
  id: string;
  playerId: number;
  spaceId: number;
  upgraded: boolean;
}

interface SoloCardOutcome {
  card: DeckCard;
  drawId: number;
  playerId: number;
  spaceId: number;
  transfers: readonly ActivityTransfer[];
  participants?: readonly ActivityActor[];
  destinationId?: number;
  notes?: readonly string[];
}

type ActivityData = Omit<MatchActivityEvent, 'id' | 'matchId' | 'sequence' | 'timestamp' | 'turn' | 'actor' | 'counterparty' | 'title'> & {
  title?: string;
  actorId?: number;
  counterpartyId?: number;
};

const transferKinds: Record<CashTransfer['category'], ActivityKind> = {
  purchase: 'purchase', auction: 'auction', rent: 'rent', salary: 'go', tax: 'tax', card: 'card',
  mortgage: 'mortgage', construction: 'upgrade', trade: 'trade', jail: 'bail', landmark: 'landmark', bonus: 'money', debt: 'money',
};

interface PlayerSetupConfig {
  name: string;
  isAI: boolean;
  token: TokenType;
  color: string;
}

interface GameStore {
  gameId: number;
  ruleset?: SoloRuleset;
  arcadeLanding: ArcadeLanding | null;
  arcadeLandingSequence: number;
  players: Player[];
  properties: Record<number, PropertyState>;
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  dice: [number, number];
  doublesCount: number;
  chanceDeck: DeckCard[];
  chestDeck: DeckCard[];
  activeCard: DeckCard | null;
  cardDrawId: number;
  resolvingCard: SoloCardOutcome | null;
  selectedSpaceId: number | null;
  hoveredSpaceId: number | null;
  gameSpeed: 1 | 2;
  cameraMode: CameraMode;
  logs: LogEntry[];
  activity: MatchActivityEvent[];
  turnNumber: number;
  pendingDebt: PendingDebt | null;
  auction: PropertyAuction | null;
  heldJailCards: Record<number, DeckCard[]>;
  pendingTrade: TradeOffer | null;
  railroadRaid: RailroadRaid | null;
  metaProgress: MetaProgress;
  lastWheelReward: WheelReward | null;
  winner: Player | null;
  isRulebookOpen: boolean;
  isTradeModalOpen: boolean;
  isSetupModalOpen: boolean;

  // Actions
  startNewGame: (configs: PlayerSetupConfig[], ruleset?: SoloRuleset) => void;
  setCameraMode: (mode: CameraMode) => void;
  selectSpace: (spaceId: number | null) => void;
  setHoveredSpace: (spaceId: number | null) => void;
  setGameSpeed: (speed: 1 | 2) => void;
  setRulebookOpen: (open: boolean) => void;
  setTradeModalOpen: (open: boolean) => void;
  setSetupModalOpen: (open: boolean) => void;

  // Core Gameplay Actions
  rollDice: () => void;
  upgradeLandmark: (expectedLevel?: number, expectedPlayerId?: number) => void;
  startBankHeist: () => void;
  resolveBankHeist: (vaultIndex: number) => void;
  shutdownLandmark: (targetPlayerId: number) => void;
  skipRailroadRaid: () => void;
  claimDailyReward: () => boolean;
  spinLuckyWheel: () => void;
  claimMissionReward: (missionId: MissionId) => void;
  openStickerPack: () => { stickers: string[]; duplicateCount: number } | null;
  redeemStickerStars: () => void;
  claimStickerAlbumReward: () => void;
  payJailBail: () => void;
  useJailCard: () => void;
  buyCurrentProperty: () => void;
  auctionCurrentProperty: () => void;
  placeAuctionBid: (increment?: number, bidderId?: number, expectedCurrentBid?: number) => void;
  passAuction: (bidderId?: number) => void;
  declineProperty: () => void;
  drawPendingCard: (expectedDrawId: number) => void;
  applyActiveCard: (expectedDrawId?: number) => void;
  buildHouse: (spaceId: number) => void;
  upgradeProperty: (spaceId: number, expectedLandingId?: string) => void;
  sellHouse: (spaceId: number, expectedLevel?: number) => void;
  toggleMortgage: (spaceId: number, expectedIsMortgaged?: boolean) => void;
  proposeTrade: (offer: TradeOffer) => { accepted: boolean; message: string };
  acceptTrade: (playerId: number) => { accepted: boolean; message: string };
  rejectTrade: () => void;
  settlePendingDebt: (expectedDebt?: PendingDebt) => void;
  declareBankruptcy: (expectedDebt?: PendingDebt) => void;
  endTurn: () => void;

  // Helpers
  canBuildHouse: (playerId: number, spaceId: number) => boolean;
  canUpgradeProperty: (playerId: number, spaceId: number) => boolean;
  canSellHouse: (playerId: number, spaceId: number) => boolean;
  canToggleMortgage: (playerId: number, spaceId: number) => boolean;
  liquidationValue: (playerId: number) => number;
  calculateRent: (spaceId: number, diceTotal: number) => number;
  landmarkUpgradeCost: (playerId: number) => number;
  ownsFullGroup: (playerId: number, group: ColorGroup) => boolean;
}

const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayKey = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateKey(yesterday);
};

const createDefaultMetaProgress = (): MetaProgress => ({
  lastDailyClaimDate: null,
  dailyStreak: 0,
  lastWheelSpinDate: null,
  stickers: {},
  stickerStars: 0,
  stickerPacks: 0,
  missionDate: getLocalDateKey(),
  missionProgress: { rolls: 0, purchases: 0, railroadEvents: 0 },
  missionClaimed: [],
  albumBonusClaimed: false,
});

const loadMetaProgress = (): MetaProgress => {
  const fallback = createDefaultMetaProgress();
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem('monopoly3d-meta-progress-v1');
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<MetaProgress>;
    const today = getLocalDateKey();
    const missionIsToday = parsed.missionDate === today;
    return {
      ...fallback,
      ...parsed,
      stickers: parsed.stickers ?? {},
      missionDate: today,
      missionProgress: missionIsToday && parsed.missionProgress
        ? parsed.missionProgress
        : { rolls: 0, purchases: 0, railroadEvents: 0 },
      missionClaimed: missionIsToday && Array.isArray(parsed.missionClaimed)
        ? parsed.missionClaimed
        : [],
    };
  } catch {
    return fallback;
  }
};

const saveMetaProgress = (progress: MetaProgress) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('monopoly3d-meta-progress-v1', JSON.stringify(progress));
  } catch {
    // The game remains playable when browser storage is unavailable or full.
  }
};

function shuffleDeck<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createInitialProperties(ruleset: SoloRuleset): Record<number, PropertyState> {
  const props: Record<number, PropertyState> = {};
  BOARD_SPACES.forEach((space) => {
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      props[space.id] = {
        spaceId: space.id,
        ownerId: null,
        houses: 0,
        isMortgaged: false,
        ...(ruleset === 'arcade' && space.type === 'property' ? { developmentLevel: 0 as const } : {}),
      };
    }
  });
  return props;
}

function getDevelopmentLiquidation(property: PropertyState, ruleset?: SoloRuleset) {
  const space = BOARD_SPACES[property.spaceId];
  return ruleset === 'arcade'
    ? (space.type === 'property' ? arcadeDevelopmentValue(space, arcadeLevel(property)) : 0)
    : property.houses * Math.floor((space.houseCost ?? 0) / 2);
}

function claimNewDeed(property: PropertyState, ownerId: number, ruleset?: SoloRuleset): PropertyState {
  return ruleset === 'arcade' && BOARD_SPACES[property.spaceId].type === 'property'
    ? { ...property, ownerId, developmentLevel: 0 }
    : { ...property, ownerId };
}

const activityActor = (player?: Player): ActivityActor | undefined => player && {
  id: String(player.id), name: player.name, color: player.color,
};

function activityTransfer(transfer: CashTransfer, players: Player[]): ActivityTransfer {
  const from = players.find(player => player.id === transfer.fromId);
  const to = players.find(player => player.id === transfer.toId);
  return {
    from: activityActor(from) ?? null, to: activityActor(to) ?? null,
    amount: transfer.amount, fromBalance: from?.money, toBalance: to?.money, reason: transfer.reason,
  };
}

const DEFAULT_PLAYERS: PlayerSetupConfig[] = [
  { name: 'You', isAI: false, token: 'rubber_duck', color: '#f59e0b' },
  { name: 'Victoria', isAI: true, token: 'cat', color: '#ec4899' },
  { name: 'Arthur', isAI: true, token: 'racecar', color: '#3b82f6' },
  { name: 'Elena', isAI: true, token: 'yacht', color: '#10b981' },
];

const humanCardDecision = (state: GameStore) =>
  (state.turnPhase === 'CARD_PENDING' || state.turnPhase === 'CARD_DRAWN') && !state.players[state.currentPlayerIndex]?.isAI;

export const useGameStore = create<GameStore>((set, get) => {
  // Invalidate in-flight movement and dice callbacks whenever a new game starts.
  let gameGeneration = 0;
  let logSequence = 0;
  let animationTimer: ReturnType<typeof setTimeout> | undefined;
  const processedTrades = new Set<string>();
  let approvedTrade: TradeOffer | null = null;
  const managementPlayer = () => {
    const state = get();
    return state.players.find(p => p.id === (state.pendingDebt?.debtorId ?? state.players[state.currentPlayerIndex]?.id));
  };
  const canManage = (playerId: number, building = false) => {
    const state = get(), player = managementPlayer();
    return !!player && player.id === playerId && !player.isBankrupt && !state.winner &&
      !state.railroadRaid && !state.pendingTrade &&
      (building ? ['PRE_ROLL', 'LANDED_ACTION', 'END_TURN'] : ['PRE_ROLL', 'LANDED_ACTION', 'END_TURN', 'DEBT_RESOLUTION']).includes(state.turnPhase);
  };

  // Each card obligation keeps its real debtor/creditor. Pausing for liquidity
  // never changes whose dice turn it is or forgives an unpaid remainder.
  const resolvePayments = (payments: SoloPayment[]) => {
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i], state = get();
      const debtor = state.players.find(p => p.id === payment.debtorId);
      const creditor = state.players.find(p => p.id === payment.creditorId);
      if (!debtor || debtor.isBankrupt || (payment.creditorId !== null && (!creditor || creditor.isBankrupt))) continue;
      if (debtor.money < payment.amount) {
        set({pendingDebt: {...payment, remainingPayments: payments.slice(i + 1), category: 'card'}, turnPhase: 'DEBT_RESOLUTION'});
        return;
      }
      set(s => ({players: s.players.map(p => p.id === debtor.id ? {...p, money: p.money - payment.amount} :
        p.id === creditor?.id ? {...p, money: p.money + payment.amount} : p)}));
      addLog(`${debtor.name} paid $${payment.amount} to ${creditor?.name ?? 'the Bank'} (${payment.reason}).`, 'money',
        { fromId: debtor.id, toId: payment.creditorId, amount: payment.amount, reason: payment.reason, category: 'card' });
    }
    set({pendingDebt: null, turnPhase: 'END_TURN'});
    finishCard();
  };

  const activityPatch = (state: GameStore, title: string, data: ActivityData) => {
    const history = state.activity ?? [];
    const sequence = (history[history.length - 1]?.sequence ?? 0) + 1;
    const matchId = `solo-${state.gameId}`;
    const { actorId, counterpartyId, title: noticeTitle, ...details } = data;
    return { activity: appendMatchActivity(history, [{
      ...details, id: `${matchId}:${sequence}`, matchId, title: noticeTitle ?? title, sequence,
      actor: activityActor(state.players.find(player => player.id === actorId)),
      counterparty: activityActor(state.players.find(player => player.id === counterpartyId)),
      timestamp: new Date().toISOString(), turn: state.turnNumber ?? 1,
    }]) };
  };

  const logPatch = (state: GameStore, message: string, type: LogEntry['type'], transfer?: CashTransfer | CashTransfer[], data?: ActivityData | false): Partial<GameStore> => {
    const transfers = (Array.isArray(transfer) ? transfer : transfer ? [transfer] : []).filter(item => item.amount > 0);
    const receipts = transfers.map(item => activityTransfer(item, state.players));
    const entry: LogEntry = {
      id: `log-${state.gameId}-${++logSequence}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      type,
      ...(transfer && { transfers }),
    };
    const patch: Partial<GameStore> = { logs: [entry, ...state.logs.slice(0, 79)] };
    const resolvingCard = state.resolvingCard;
    if (resolvingCard && transfers.length) {
      const cardReceipts = receipts.filter((_, index) => transfers[index].category === 'card');
      const linked = receipts.filter((_, index) => ['rent', 'salary', 'tax'].includes(transfers[index].category));
      patch.resolvingCard = {
        ...resolvingCard,
        transfers: [...resolvingCard.transfers, ...cardReceipts],
        participants: [...(resolvingCard.participants ?? []), ...linked.flatMap(receipt =>
          [receipt.from, receipt.to].filter((actor): actor is ActivityActor => !!actor))],
        notes: [...(resolvingCard.notes ?? []), ...linked.map(receipt =>
          `${receipt.from?.name ?? 'The Bank'} paid $${receipt.amount.toLocaleString('en-US')} to ${receipt.to?.name ?? 'the Bank'} · ${receipt.reason}.`)],
      };
    }
    const primary = transfers[0];
    if (data === false || (!data && (!primary || (resolvingCard && primary.category === 'card')))) return patch;
    const actorId = primary?.fromId ?? primary?.toId ?? undefined;
    return { ...patch, ...activityPatch(state, message, {
      kind: data?.kind ?? (primary ? transferKinds[primary.category] : 'money'),
      actorId, counterpartyId: primary?.fromId === actorId ? primary?.toId ?? undefined : undefined,
      spaceId: primary?.spaceId, amount: primary?.amount, transfers: receipts.length ? receipts : undefined,
      ...data,
    }) };
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info', transfer?: CashTransfer | CashTransfer[], data?: ActivityData | false) => {
    set(state => logPatch(state, message, type, transfer, data));
  };

  const finishCard = (...details: string[]) => {
    const state = get(), result = state.resolvingCard;
    if (!result) return;
    const { card, drawId, playerId, spaceId, transfers, destinationId } = result;
    const player = state.players.find(candidate => candidate.id === playerId)!;
    const deckName = card.deck === 'chance' ? 'Chance' : 'Community Chest';
    const participants = new Map((result.participants ?? []).map(actor => [actor.id, actor]));
    for (const transfer of transfers) {
      for (const actor of [transfer.from, transfer.to]) if (actor) participants.set(actor.id, actor);
    }
    set({ resolvingCard: null, ...activityPatch(state, `${player.name} drew ${deckName} — ${card.title}`, {
      kind: 'card', actorId: playerId, spaceId: destinationId ?? spaceId,
      card: { id: card.id, deck: card.deck, title: card.title, instruction: card.description, drawId },
      details: [...(destinationId === undefined ? [] : [`${player.name} moved to ${BOARD_SPACES[destinationId].name}.`]),
        ...(result.notes ?? []), ...details], participants: [...participants.values()], transfers,
      amount: transfers.length === 1 ? transfers[0].amount : undefined,
    }) });
  };

  const progressMission = (stat: MissionStat, amount = 1) => {
    const state = get();
    const today = getLocalDateKey();
    const baseProgress = state.metaProgress.missionDate === today
      ? state.metaProgress.missionProgress
      : { rolls: 0, purchases: 0, railroadEvents: 0 };
    const metaProgress: MetaProgress = {
      ...state.metaProgress,
      missionDate: today,
      missionProgress: { ...baseProgress, [stat]: baseProgress[stat] + amount },
      missionClaimed: state.metaProgress.missionDate === today ? state.metaProgress.missionClaimed : [],
    };
    saveMetaProgress(metaProgress);
    set({ metaProgress });
  };

  const rewardStickerPack = (progress: MetaProgress): { metaProgress: MetaProgress; stickers: string[]; duplicateCount: number } => {
    const stickers: string[] = [];
    let duplicateCount = 0;
    let stickerStars = progress.stickerStars;
    const owned = { ...progress.stickers };
    for (let index = 0; index < 3; index += 1) {
      const roll = Math.random();
      const rarity = roll < 0.62 ? 'Common' : roll < 0.9 ? 'Rare' : 'Epic';
      const pool = STICKER_COLLECTION.filter((sticker) => sticker.rarity === rarity);
      const sticker = pool[Math.floor(Math.random() * pool.length)];
      stickers.push(sticker.id);
      if ((owned[sticker.id] ?? 0) > 0) {
        duplicateCount += 1;
        stickerStars += sticker.rarity === 'Epic' ? 5 : sticker.rarity === 'Rare' ? 2 : 1;
      } else {
        owned[sticker.id] = 1;
      }
    }
    return { metaProgress: { ...progress, stickers: owned, stickerStars }, stickers, duplicateCount };
  };

  const createRailroadRaid = (attackerId: number): RailroadRaid => {
    const shuffledRewards = shuffleDeck([150, 300, 550]);
    const vaultRewards: [number, number, number] = [shuffledRewards[0], shuffledRewards[1], shuffledRewards[2]];
    return { attackerId, mode: 'choose', vaultRewards };
  };

  const announceRailroadRaid = (attackerId: number) => {
    addLog('Railroad bonus unlocked: choose a Bank Heist or shut down a rival landmark.', 'card', undefined,
      { kind: 'railroad', actorId: attackerId, silent: true });
  };

  const openRailroadRaid = (attackerId: number) => {
    set({ railroadRaid: createRailroadRaid(attackerId) });
    announceRailroadRaid(attackerId);
  };

  const stepMovePlayer = (playerIndex: number, totalSteps: number, onComplete: () => void) => {
    const generation = gameGeneration;
    let remaining = Math.abs(totalSteps);
    const direction = totalSteps >= 0 ? 1 : -1;

    const tick = () => {
      if (generation !== gameGeneration) return;
      if (remaining <= 0) {
        onComplete();
        return;
      }
      const players = [...get().players];
      const player = players[playerIndex];
      const nextPos = (player.position + direction + 40) % 40;
      const goReward = direction > 0 && nextPos === 0 ? 200 + player.landmarkLevel * 50 : 0;
      players[playerIndex] = { ...player, position: nextPos, money: player.money + goReward };
      set({ players });
      if (goReward) addLog(`${player.name} passed GO and collected $${goReward} (including landmark income)!`, 'money',
        { fromId: null, toId: player.id, amount: goReward, reason: 'GO salary', category: 'salary', spaceId: 0 });
      remaining -= 1;
      animationTimer = setTimeout(tick, TOKEN_STEP_MS / get().gameSpeed);
    };

    tick();
  };

  const evaluateLandedSpace = (rentMultiplier = 1, rentOverride?: number) => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    const space: BoardSpace = BOARD_SPACES[player.position];
    const propState = state.properties[space.id];
    const upgradeLanding = state.ruleset === 'arcade' && space.type === 'property' && propState &&
      (propState.ownerId === null || propState.ownerId === player.id);
    if (upgradeLanding) {
      const sequence = (state.arcadeLandingSequence ?? 0) + 1;
      set({ arcadeLandingSequence: sequence, arcadeLanding: {
        id: `${state.gameId}:${sequence}`, spaceId: space.id, playerId: player.id, upgraded: false,
      } });
    } else if (state.arcadeLanding) set({ arcadeLanding: null });

    addLog(`${player.name} landed on ${space.name}.`, 'info', undefined,
      { kind: 'land', actorId: player.id, spaceId: space.id, silent: true });

    if (space.type === 'go' || space.type === 'jail' || space.type === 'free_parking') {
      set({ turnPhase: 'END_TURN' });
      return;
    }

    if (space.type === 'go_to_jail') {
      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          position: 10,
          inJail: true,
          jailTurns: 0,
        };
        return { players, doublesCount: 0, turnPhase: 'END_TURN' };
      });
      addLog(`${player.name} went directly to Jail!`, 'alert', undefined,
        { kind: 'jail', actorId: player.id, spaceId: 10, emphasis: 'important' });
      return;
    }

    if (space.type === 'tax') {
      const tax = space.taxAmount || 100;
      if (player.money >= tax) {
        set((s) => {
          const players = [...s.players];
          players[s.currentPlayerIndex] = {
            ...players[s.currentPlayerIndex],
            money: players[s.currentPlayerIndex].money - tax,
          };
          return { players, turnPhase: 'END_TURN' };
        });
        addLog(`${player.name} paid $${tax} for ${space.name}.`, 'money',
          { fromId: player.id, toId: null, amount: tax, reason: space.name, category: 'tax', spaceId: space.id });
      } else {
        set({
          pendingDebt: { amount: tax, creditorId: null, reason: space.name, category: 'tax', spaceId: space.id },
          turnPhase: 'DEBT_RESOLUTION',
        });
      }
      return;
    }

    if (space.type === 'chance' || space.type === 'chest') {
      set({ cardDrawId: state.cardDrawId + 1, turnPhase: 'CARD_PENDING' });
      return;
    }

    // Property, Railroad, or Utility
    if (!propState) {
      set({ turnPhase: 'END_TURN' });
      return;
    }

    if (propState.ownerId === null) {
      set({ turnPhase: 'LANDED_ACTION' });
      return;
    }

    if (propState.ownerId === player.id) {
      set({ turnPhase: 'END_TURN' });
      if (space.type === 'railroad') openRailroadRaid(player.id);
      return;
    }

    if (propState.isMortgaged) {
      addLog(`${space.name} is mortgaged—no rent due.`, 'info');
      set({ turnPhase: 'END_TURN' });
      if (space.type === 'railroad') openRailroadRaid(player.id);
      return;
    }

    const diceTotal = state.dice[0] + state.dice[1];
    const rent = rentOverride ?? get().calculateRent(space.id, diceTotal) * rentMultiplier;
    const owner = state.players.find((p) => p.id === propState.ownerId)!;

    if (player.money < rent) {
      addLog(`${player.name} owes $${rent} rent to ${owner.name} and must raise funds!`, 'alert');
    }
    set({
      pendingDebt: {
        amount: rent, debtorId: player.id, creditorId: owner.id,
        reason: `Rent on ${space.name}`, category: 'rent', spaceId: space.id,
        developmentLevel: state.ruleset === 'arcade' ? arcadeLevel(propState) : propState.houses,
      },
      turnPhase: 'DEBT_RESOLUTION',
    });
  };

  return {
    gameId: 0,
    ruleset: 'arcade',
    arcadeLanding: null,
    arcadeLandingSequence: 0,
    players: DEFAULT_PLAYERS.map((cfg, idx) => ({
      id: idx,
      name: cfg.name,
      isAI: cfg.isAI,
      token: cfg.token,
      color: cfg.color,
      money: 1500,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
      landmarkLevel: 0,
    })),
    properties: createInitialProperties('arcade'),
    currentPlayerIndex: 0,
    turnPhase: 'PRE_ROLL',
    dice: [3, 4],
    doublesCount: 0,
    chanceDeck: shuffleDeck(CHANCE_CARDS),
    chestDeck: shuffleDeck(COMMUNITY_CHEST_CARDS),
    activeCard: null,
    cardDrawId: 0,
    resolvingCard: null,
    selectedSpaceId: null,
    hoveredSpaceId: null,
    gameSpeed: 1,
    cameraMode: 'isometric',
    logs: [
      {
        id: 'init-1',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        message: 'Welcome to Monopoly 3D: Miniature City Edition! Roll the dice to begin.',
        type: 'info',
      },
    ],
    activity: [],
    turnNumber: 1,
    pendingDebt: null,
    auction: null,
    heldJailCards: {},
    pendingTrade: null,
    railroadRaid: null,
    metaProgress: loadMetaProgress(),
    lastWheelReward: null,
    winner: null,
    isRulebookOpen: false,
    isTradeModalOpen: false,
    isSetupModalOpen: false,

    startNewGame: (configs, ruleset = 'classic') => {
      if (configs.length < 2 || configs.length > 6) return;
      gameGeneration = Math.max(gameGeneration, get().gameId) + 1;
      clearTimeout(animationTimer);
      processedTrades.clear();
      approvedTrade = null;
      const started = new Date();
      const matchId = `solo-${gameGeneration}`;
      const newPlayers: Player[] = configs.map((cfg, idx) => ({
        id: idx,
        name: cfg.name,
        isAI: cfg.isAI,
        token: cfg.token,
        color: cfg.color,
        money: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        getOutOfJailCards: 0,
        isBankrupt: false,
        landmarkLevel: 0,
      }));
      set({
        gameId: gameGeneration,
        ruleset,
        arcadeLanding: null,
        arcadeLandingSequence: 0,
        players: newPlayers,
        properties: createInitialProperties(ruleset),
        currentPlayerIndex: 0,
        turnPhase: 'PRE_ROLL',
        dice: [1, 1],
        doublesCount: 0,
        chanceDeck: shuffleDeck(CHANCE_CARDS),
        chestDeck: shuffleDeck(COMMUNITY_CHEST_CARDS),
        activeCard: null,
        resolvingCard: null,
        selectedSpaceId: null,
        hoveredSpaceId: null,
        pendingDebt: null,
        auction: null,
        heldJailCards: {},
        pendingTrade: null,
        railroadRaid: null,
        winner: null,
        isSetupModalOpen: false,
        turnNumber: 1,
        activity: [{ id: `${matchId}:1`, matchId, kind: 'match', sequence: 1, turn: 1,
          timestamp: started.toISOString(), title: `${ruleset === 'arcade' ? 'Arcade' : 'Classic'} match started with ${newPlayers.length} players.`, silent: true }],
        logs: [
          {
            id: `start-${gameGeneration}`,
            timestamp: started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message: `New game started with ${newPlayers.length} players! Each player receives $1,500.`,
            type: 'info',
          },
        ],
      });
    },

    setCameraMode: (cameraMode) => set({ cameraMode }),
    selectSpace: (selectedSpaceId) => set({ selectedSpaceId }),
    setHoveredSpace: (hoveredSpaceId) => set({ hoveredSpaceId }),
    setGameSpeed: (gameSpeed) => set({ gameSpeed }),
    setRulebookOpen: (isRulebookOpen) => set({ isRulebookOpen }),
    setTradeModalOpen: (isTradeModalOpen) => set({ isTradeModalOpen }),
    setSetupModalOpen: (isSetupModalOpen) => set({ isSetupModalOpen }),

    ownsFullGroup: (playerId, group) => {
      if (group === 'none') return false;
      const state = get();
      const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === group);
      return (
        groupSpaces.length === COLOR_GROUP_TOTALS[group] &&
        groupSpaces.every((s) => state.properties[s.id]?.ownerId === playerId)
      );
    },

    calculateRent: (spaceId, diceTotal) => {
      const state = get();
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      if (!prop || prop.ownerId === null || prop.isMortgaged) return 0;

      const ownerId = prop.ownerId;

      if (space.type === 'railroad') {
        const ownedRR = BOARD_SPACES.filter(
          (s) => s.type === 'railroad' && state.properties[s.id]?.ownerId === ownerId && !state.properties[s.id]?.isMortgaged
        ).length;
        return space.rent ? space.rent[Math.max(0, ownedRR - 1)] : 25;
      }

      if (space.type === 'utility') {
        const ownedUtilities = BOARD_SPACES.filter(
          (s) => s.type === 'utility' && state.properties[s.id]?.ownerId === ownerId && !state.properties[s.id]?.isMortgaged
        ).length;
        return ownedUtilities === 2 ? diceTotal * 10 : diceTotal * 4;
      }

      if (space.type === 'property' && space.rent) {
        if (state.ruleset === 'arcade') return arcadeRent(space, arcadeLevel(prop));
        if (prop.houses > 0) {
          return space.rent[prop.houses];
        }
        const hasMonopoly = get().ownsFullGroup(ownerId, space.colorGroup);
        return hasMonopoly ? space.rent[0] * 2 : space.rent[0];
      }

      return 0;
    },

    canBuildHouse: (playerId, spaceId) => {
      if (!canManage(playerId, true)) return false;
      const state = get();
      if (state.ruleset === 'arcade') return false;
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      const player = state.players.find((p) => p.id === playerId);
      if (!space || !prop || !player || space.type !== 'property' || !space.houseCost) return false;
      if (prop.ownerId !== playerId || prop.isMortgaged || prop.houses >= 5) return false;
      if (player.money < space.houseCost) return false;
      if (!get().ownsFullGroup(playerId, space.colorGroup)) return false;

      // Check that no property in the color group is mortgaged and enforce even-building rule
      const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === space.colorGroup);
      if (groupSpaces.some((s) => state.properties[s.id]?.isMortgaged)) return false;

      const minHouses = Math.min(...groupSpaces.map((s) => state.properties[s.id]?.houses ?? 0));
      return prop.houses === minHouses;
    },

    canUpgradeProperty: (playerId, spaceId) => {
      const state = get();
      const landing = state.arcadeLanding;
      if (state.ruleset !== 'arcade' || state.turnPhase !== 'END_TURN' || !canManage(playerId, true) ||
        !landing || landing.upgraded || landing.playerId !== playerId || landing.spaceId !== spaceId) return false;
      const player = state.players[state.currentPlayerIndex];
      const street = BOARD_SPACES[spaceId];
      const property = state.properties[spaceId];
      if (player.id !== playerId || player.inJail || player.position !== spaceId || street?.type !== 'property' ||
        property?.ownerId !== playerId || property.isMortgaged) return false;
      const nextLevel = arcadeNextLevel(arcadeLevel(property));
      return nextLevel !== undefined && player.money >= arcadeUpgradeCost(street, nextLevel);
    },

    canSellHouse: (playerId, spaceId) => {
      if (!canManage(playerId)) return false;
      const state = get();
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      if (!space || !prop || space.type !== 'property') return false;
      if (prop.ownerId !== playerId) return false;
      if (state.ruleset === 'arcade') return !prop.isMortgaged && arcadeLevel(prop) > 0;
      if (prop.houses <= 0) return false;

      const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === space.colorGroup);
      const maxHouses = Math.max(...groupSpaces.map((s) => state.properties[s.id]?.houses ?? 0));
      return prop.houses === maxHouses;
    },

    canToggleMortgage: (playerId, spaceId) => {
      if (!canManage(playerId)) return false;
      const state = get(), space = BOARD_SPACES[spaceId], prop = state.properties[spaceId];
      const player = state.players.find(p => p.id === playerId);
      if (!space?.mortgageValue || !prop || prop.ownerId !== playerId || !player) return false;
      if (prop.isMortgaged) return player.money >= unmortgageCost(space.mortgageValue);
      return state.ruleset === 'arcade' ? arcadeLevel(prop) === 0 : !groupHasBuildings(space, state.properties);
    },

    liquidationValue: (playerId) => {
      const state = get(), player = state.players.find(p => p.id === playerId);
      return (player?.money ?? 0) + Object.values(state.properties).reduce((sum, prop) => {
        if (prop.ownerId !== playerId) return sum;
        const space = BOARD_SPACES[prop.spaceId];
        return sum + getDevelopmentLiquidation(prop, state.ruleset) + (prop.isMortgaged ? 0 : space.mortgageValue ?? 0);
      }, 0);
    },

    rollDice: () => {
      const state = get();
      if (state.turnPhase !== 'PRE_ROLL' || state.winner || state.railroadRaid || state.pendingTrade) return;
      const generation = gameGeneration;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const isDoubles = d1 === d2;
      const total = d1 + d2;
      const player = state.players[state.currentPlayerIndex];

      set({ dice: [d1, d2], turnPhase: 'ROLLING', arcadeLanding: null,
        ...activityPatch(state, `${player.name} rolled ${d1} + ${d2} = ${total}${isDoubles ? ' (doubles)' : ''}.`, {
          kind: 'roll', actorId: player.id, silent: true,
        }) });
      if (!player.isAI) progressMission('rolls');

      animationTimer = setTimeout(() => {
        if (generation !== gameGeneration) return;
        const currentState = get();
        const activePlayer = currentState.players[currentState.currentPlayerIndex];

        // Handle Jail Roll
        if (activePlayer.inJail) {
          if (isDoubles) {
            set((s) => {
              const players = [...s.players];
              players[s.currentPlayerIndex] = {
                ...players[s.currentPlayerIndex],
                inJail: false,
                jailTurns: 0,
              };
              return { players, doublesCount: 0, turnPhase: 'MOVING' };
            });
            addLog(`${activePlayer.name} rolled doubles (${d1} & ${d2}) and escaped Jail!`, 'info', undefined,
              { kind: 'jail', actorId: activePlayer.id, spaceId: 10 });
            stepMovePlayer(currentState.currentPlayerIndex, total, evaluateLandedSpace);
            return;
          }

          const nextJailTurns = activePlayer.jailTurns + 1;
          if (nextJailTurns >= 3) {
            if (activePlayer.money >= 50) {
              set((s) => {
                const players = [...s.players];
                players[s.currentPlayerIndex] = {
                  ...players[s.currentPlayerIndex],
                  money: players[s.currentPlayerIndex].money - 50,
                  inJail: false,
                  jailTurns: 0,
                };
                return { players, turnPhase: 'MOVING' };
              });
              addLog(`${activePlayer.name} spent 3 turns in Jail, paid $50 bail, and moves ${total} spaces.`, 'alert',
                { fromId: activePlayer.id, toId: null, amount: 50, reason: 'Jail bail', category: 'jail', spaceId: 10 });
              stepMovePlayer(currentState.currentPlayerIndex, total, evaluateLandedSpace);
            } else {
              addLog(`${activePlayer.name} must raise $50 to leave Jail after the third failed roll.`, 'alert');
              set({
                pendingDebt: { amount: 50, creditorId: null, reason: 'Jail release after third failed roll', category: 'jail', spaceId: 10 },
                turnPhase: 'DEBT_RESOLUTION',
              });
            }
          } else {
            set((s) => {
              const players = [...s.players];
              players[s.currentPlayerIndex] = {
                ...players[s.currentPlayerIndex],
                jailTurns: nextJailTurns,
              };
              return { players, turnPhase: 'END_TURN' };
            });
            addLog(`${activePlayer.name} rolled ${d1} & ${d2} (no doubles) and stays in Jail (Turn ${nextJailTurns}/3).`, 'info', undefined,
              { kind: 'jail', actorId: activePlayer.id, spaceId: 10, silent: true });
          }
          return;
        }

        // Standard roll outside Jail
        const newDoublesCount = isDoubles ? currentState.doublesCount + 1 : 0;
        if (newDoublesCount === 3) {
          set((s) => {
            const players = [...s.players];
            players[s.currentPlayerIndex] = {
              ...players[s.currentPlayerIndex],
              position: 10,
              inJail: true,
              jailTurns: 0,
            };
            return { players, doublesCount: 0, turnPhase: 'END_TURN' };
          });
          addLog(`${activePlayer.name} rolled 3 consecutive doubles and goes directly to Jail!`, 'alert', undefined,
            { kind: 'jail', actorId: activePlayer.id, spaceId: 10, emphasis: 'important' });
          return;
        }

        addLog(
          `${activePlayer.name} rolled ${d1} + ${d2} = ${total}${isDoubles ? ' (DOUBLES!)' : ''}.`,
          'info'
        );
        set({ doublesCount: newDoublesCount, turnPhase: 'MOVING' });
        stepMovePlayer(currentState.currentPlayerIndex, total, evaluateLandedSpace);
      }, DICE_ROLL_MS / state.gameSpeed);
    },

    landmarkUpgradeCost: (playerId) => {
      const player = get().players.find((candidate) => candidate.id === playerId);
      if (!player || player.landmarkLevel >= 5) return Infinity;
      return 400 + player.landmarkLevel * 350;
    },

    upgradeLandmark: (expectedLevel, expectedPlayerId) => {
      const state = get();
      const player = state.players[state.currentPlayerIndex];
      if (!player || player.isBankrupt || player.landmarkLevel >= 5) return;
      if (expectedLevel !== undefined && player.landmarkLevel !== expectedLevel) return;
      if (expectedPlayerId !== undefined && player.id !== expectedPlayerId) return;
      if (state.railroadRaid || state.pendingTrade || state.winner) return;
      if (state.turnPhase !== 'PRE_ROLL' && state.turnPhase !== 'END_TURN') return;
      const cost = get().landmarkUpgradeCost(player.id);
      if (player.money < cost) return;
      set((current) => ({
        players: current.players.map((candidate) =>
          candidate.id === player.id
            ? { ...candidate, money: candidate.money - cost, landmarkLevel: candidate.landmarkLevel + 1 }
            : candidate
        ),
      }));
      addLog(`${player.name} upgraded their city landmark to level ${player.landmarkLevel + 1} for $${cost}.`, 'property',
        { fromId: player.id, toId: null, amount: cost, reason: `Landmark level ${player.landmarkLevel + 1}`, category: 'landmark' },
        { kind: 'landmark', previousLevel: player.landmarkLevel, level: player.landmarkLevel + 1 });
    },

    startBankHeist: () => {
      const raid = get().railroadRaid;
      if (!raid || raid.mode !== 'choose' || get().turnPhase !== 'END_TURN') return;
      set({ railroadRaid: { ...raid, mode: 'heist' } });
      addLog('Bank Heist started! Pick one of three vaults.', 'card', undefined,
        { kind: 'railroad', actorId: raid.attackerId, silent: true });
    },

    resolveBankHeist: (vaultIndex) => {
      const state = get();
      const raid = state.railroadRaid;
      if (!raid || raid.mode !== 'heist' || !Number.isInteger(vaultIndex) || vaultIndex < 0 || vaultIndex > 2 || state.turnPhase !== 'END_TURN') return;
      const reward = raid.vaultRewards[vaultIndex];
      const attacker = state.players.find((player) => player.id === raid.attackerId);
      if (!attacker || attacker.isBankrupt) {
        set({ railroadRaid: null });
        return;
      }
      set((current) => ({
        players: current.players.map((player) =>
          player.id === attacker.id ? { ...player, money: player.money + reward } : player
        ),
        railroadRaid: null,
      }));
      addLog(`${attacker.name} cracked vault ${vaultIndex + 1} and stole $${reward} from the Bank!`, 'money',
        { fromId: null, toId: attacker.id, amount: reward, reason: 'Bank heist', category: 'bonus' }, { kind: 'railroad' });
      if (!attacker.isAI) progressMission('railroadEvents');
    },

    shutdownLandmark: (targetPlayerId) => {
      const state = get();
      const raid = state.railroadRaid;
      if (!raid || raid.mode !== 'choose' || raid.attackerId === targetPlayerId) return;
      if (state.turnPhase !== 'END_TURN') return;
      const attacker = state.players.find((player) => player.id === raid.attackerId);
      const target = state.players.find((player) => player.id === targetPlayerId);
      if (!attacker || !target || attacker.isBankrupt || target.isBankrupt) return;
      if (target.landmarkLevel > 0) {
        set((current) => ({
          players: current.players.map((player) => {
            if (player.id === target.id) return { ...player, landmarkLevel: Math.max(0, player.landmarkLevel - 1) };
            if (player.id === attacker.id) return { ...player, money: player.money + 100 };
            return player;
          }),
          railroadRaid: null,
        }));
        addLog(`${attacker.name} shut down ${target.name}'s landmark and earned $100 from the Bank.`, 'alert',
          { fromId: null, toId: attacker.id, amount: 100, reason: 'Landmark shutdown', category: 'bonus' },
          { kind: 'railroad', counterpartyId: target.id, previousLevel: target.landmarkLevel, level: target.landmarkLevel - 1 });
        if (!attacker.isAI) progressMission('railroadEvents');
      } else {
        const stolen = Math.min(100, target.money);
        set((current) => ({
          players: current.players.map((player) => {
            if (player.id === target.id) return { ...player, money: player.money - stolen };
            if (player.id === attacker.id) return { ...player, money: player.money + stolen };
            return player;
          }),
          railroadRaid: null,
        }));
        addLog(`${attacker.name} raided ${target.name}'s empty landmark site and stole $${stolen}.`, 'alert',
          { fromId: target.id, toId: attacker.id, amount: stolen, reason: 'Landmark raid', category: 'bonus' },
          { kind: 'railroad', actorId: attacker.id, counterpartyId: target.id });
        if (!attacker.isAI) progressMission('railroadEvents');
      }
    },

    skipRailroadRaid: () => {
      if (!get().railroadRaid) return;
      set({ railroadRaid: null });
    },
    claimDailyReward: () => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER' || humanCardDecision(state)) return false;
      const player = state.players.find((candidate) => !candidate.isAI && !candidate.isBankrupt);
      if (!player) return false;
      const today = getLocalDateKey();
      if (state.metaProgress.lastDailyClaimDate === today) return false;

      const streak = state.metaProgress.lastDailyClaimDate === getYesterdayKey()
        ? state.metaProgress.dailyStreak + 1
        : 1;
      const rewardDay = ((streak - 1) % DAILY_REWARD_CYCLE.length) + 1;
      const reward = DAILY_REWARD_CYCLE[rewardDay - 1];
      const metaProgress = {
        ...state.metaProgress,
        lastDailyClaimDate: today,
        dailyStreak: streak,
        stickerPacks: state.metaProgress.stickerPacks + reward.packs,
      };
      saveMetaProgress(metaProgress);
      set((current) => ({
        players: current.players.map((candidate) => candidate.id === player.id
          ? { ...candidate, money: candidate.money + reward.cash }
          : candidate),
        metaProgress,
      }));
      addLog(`Daily reward claimed: $${reward.cash}${reward.packs ? ' and 1 Sticker Pack' : ''} (Day ${rewardDay}).`, 'money',
        { fromId: null, toId: player.id, amount: reward.cash, reason: 'Daily reward', category: 'bonus' });
      return true;
    },

    spinLuckyWheel: () => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER' || humanCardDecision(state)) return;
      const player = state.players.find((candidate) => !candidate.isAI && !candidate.isBankrupt);
      if (!player) return;
      const today = getLocalDateKey();
      if (state.metaProgress.lastWheelSpinDate === today) return;
      const reward = LUCKY_WHEEL_REWARDS[Math.floor(Math.random() * LUCKY_WHEEL_REWARDS.length)];
      const metaProgress = {
        ...state.metaProgress,
        lastWheelSpinDate: today,
        stickerPacks: state.metaProgress.stickerPacks + (reward.kind === 'pack' ? reward.amount : 0),
      };
      saveMetaProgress(metaProgress);
      set((current) => ({
        players: current.players.map((candidate) => candidate.id === player.id && reward.kind === 'cash'
          ? { ...candidate, money: candidate.money + reward.amount }
          : candidate),
        metaProgress,
        lastWheelReward: reward,
      }));
      addLog(`Lucky Wheel reward: ${reward.label}!`, reward.kind === 'cash' ? 'money' : 'card', reward.kind === 'cash'
        ? { fromId: null, toId: player.id, amount: reward.amount, reason: 'Lucky Wheel reward', category: 'bonus' } : undefined);
    },

    claimMissionReward: (missionId) => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER' || humanCardDecision(state)) return;
      const mission = DAILY_MISSIONS.find((candidate) => candidate.id === missionId);
      const player = state.players.find((candidate) => !candidate.isAI && !candidate.isBankrupt);
      const today = getLocalDateKey();
      if (!mission || !player || state.metaProgress.missionDate !== today) return;
      if (state.metaProgress.missionClaimed.includes(missionId)) return;
      if (state.metaProgress.missionProgress[mission.stat] < mission.target) return;

      const metaProgress = {
        ...state.metaProgress,
        stickerPacks: state.metaProgress.stickerPacks + mission.packReward,
        missionClaimed: [...state.metaProgress.missionClaimed, missionId],
      };
      saveMetaProgress(metaProgress);
      set((current) => ({
        players: current.players.map((candidate) => candidate.id === player.id
          ? { ...candidate, money: candidate.money + mission.cashReward }
          : candidate),
        metaProgress,
      }));
      addLog(`Mission completed: ${mission.title}. Collected $${mission.cashReward}.`, 'money',
        { fromId: null, toId: player.id, amount: mission.cashReward, reason: mission.title, category: 'bonus' });
    },

    openStickerPack: () => {
      const state = get();
      if (state.metaProgress.stickerPacks <= 0 || humanCardDecision(state)) return null;
      const opened = rewardStickerPack({
        ...state.metaProgress,
        stickerPacks: state.metaProgress.stickerPacks - 1,
      });
      saveMetaProgress(opened.metaProgress);
      set({ metaProgress: opened.metaProgress });
      addLog(`Sticker Pack opened: ${opened.stickers.length} stickers revealed, ${opened.duplicateCount} duplicates converted to stars.`, 'card');
      return { stickers: opened.stickers, duplicateCount: opened.duplicateCount };
    },

    redeemStickerStars: () => {
      const state = get();
      if (state.metaProgress.stickerStars < 10 || humanCardDecision(state)) return;
      const metaProgress = {
        ...state.metaProgress,
        stickerStars: state.metaProgress.stickerStars - 10,
        stickerPacks: state.metaProgress.stickerPacks + 1,
      };
      saveMetaProgress(metaProgress);
      set({ metaProgress });
      addLog('Exchanged 10 sticker stars for a Sticker Pack.', 'card');
    },

    claimStickerAlbumReward: () => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER' || humanCardDecision(state)) return;
      const player = state.players.find((candidate) => !candidate.isAI && !candidate.isBankrupt);
      if (!player || state.metaProgress.albumBonusClaimed) return;
      const complete = STICKER_COLLECTION.every((sticker) => (state.metaProgress.stickers[sticker.id] ?? 0) > 0);
      if (!complete) return;
      const metaProgress = { ...state.metaProgress, albumBonusClaimed: true };
      saveMetaProgress(metaProgress);
      set((current) => ({
        players: current.players.map((candidate) => candidate.id === player.id
          ? { ...candidate, money: candidate.money + 2500 }
          : candidate),
        metaProgress,
      }));
      addLog('Sticker Album completed! Collected the $2,500 grand album reward.', 'money',
        { fromId: null, toId: player.id, amount: 2500, reason: 'Sticker Album completion', category: 'bonus' });
    },

    payJailBail: () => {
      const state = get();
      if (state.pendingTrade || state.railroadRaid) return;
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || player.money < 50 || state.turnPhase !== 'PRE_ROLL') return;

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          money: player.money - 50,
          inJail: false,
          jailTurns: 0,
        };
        return { players };
      });
      addLog(`${player.name} paid $50 bail and is released from Jail.`, 'money',
        { fromId: player.id, toId: null, amount: 50, reason: 'Jail bail', category: 'jail', spaceId: 10 });
    },

    useJailCard: () => {
      const state = get();
      if (state.pendingTrade || state.railroadRaid) return;
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || player.getOutOfJailCards <= 0 || state.turnPhase !== 'PRE_ROLL') return;
      const held = state.heldJailCards[player.id] ?? [];
      const card = held[0];
      if (!card) return;

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          getOutOfJailCards: player.getOutOfJailCards - 1,
          inJail: false,
          jailTurns: 0,
        };
        return { players, heldJailCards: {...s.heldJailCards, [player.id]: held.slice(1)},
          ...(card.deck === 'chance' ? {chanceDeck: [...s.chanceDeck, card]} : {chestDeck: [...s.chestDeck, card]}) };
      });
      addLog(`${player.name} used a "Get Out of Jail Free" card!`, 'card', undefined, {
        kind: 'jail', actorId: player.id, spaceId: 10, details: [`${player.name} was released from Jail.`],
      });
    },

    buyCurrentProperty: () => {
      const state = get();
      if (state.turnPhase !== 'LANDED_ACTION' || state.pendingTrade) return;

      const player = state.players[state.currentPlayerIndex];
      const space = BOARD_SPACES[player.position];
      const prop = state.properties[space.id];
      if (!space.price || !prop || prop.ownerId !== null || player.money < space.price) return;

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          money: player.money - space.price!,
        };
        const properties = {
          ...s.properties,
          [space.id]: claimNewDeed(prop, player.id, state.ruleset),
        };
        return { players, properties, turnPhase: 'END_TURN' };
      });

      addLog(`${player.name} purchased ${space.name} for $${space.price}!`, 'property',
        { fromId: player.id, toId: null, amount: space.price, reason: `Purchased ${space.name}`, category: 'purchase', spaceId: space.id },
        { kind: 'purchase', level: state.ruleset === 'arcade' && space.type === 'property' ? 0 : undefined,
          details: [`${player.name} now owns the property.`] });
      if (!player.isAI) progressMission('purchases');
      if (space.type === 'railroad') openRailroadRaid(player.id);
    },

    auctionCurrentProperty: () => {
      const state = get();
      if (state.turnPhase !== 'LANDED_ACTION' || state.pendingTrade) return;
      const player = state.players[state.currentPlayerIndex];
      const space = BOARD_SPACES[player.position];
      const property = state.properties[space.id];
      if (!player || player.isBankrupt || !space.price || !property || property.ownerId !== null) return;

      const activePlayers = state.players.filter((candidate) => !candidate.isBankrupt);
      if (activePlayers.length < 2) {
        addLog('There are not enough active players to hold an auction.', 'info');
        set({ turnPhase: 'END_TURN' });
        return;
      }

      set({
        auction: {
          spaceId: space.id,
          currentBid: 0,
          highestBidderId: null,
          currentBidderId: player.id,
          passedPlayerIds: [],
        },
        turnPhase: 'AUCTION',
      });
      addLog(`Auction started for ${space.name}. Opening bid is $10.`, 'property', undefined,
        { kind: 'auction', actorId: player.id, spaceId: space.id, silent: true });
    },

    placeAuctionBid: (increment = 10, expectedBidderId, expectedCurrentBid) => {
      const state = get();
      const auction = state.auction;
      if (!auction || state.turnPhase !== 'AUCTION') return;
      if (expectedCurrentBid !== undefined && expectedCurrentBid !== auction.currentBid) return;
      const bidderId = auction.currentBidderId;
      const bidder = state.players.find((candidate) => candidate.id === bidderId);
      if (!bidder || bidder.isBankrupt) return;
      if (expectedBidderId !== undefined && expectedBidderId !== bidder.id) return;

      if (!Number.isSafeInteger(increment) || increment < 1 || (auction.currentBid === 0 && increment < 10)) return;
      const nextBid = auction.currentBid + increment;
      if (!Number.isSafeInteger(nextBid)) return;
      if (bidder.money < nextBid) {
        addLog(`${bidder.name} cannot afford the next bid of $${nextBid}.`, 'alert');
        return;
      }

      const nextAuction: PropertyAuction = {
        ...auction,
        currentBid: nextBid,
        highestBidderId: bidder.id,
        currentBidderId: null,
      };
      const afterIndex = state.players.findIndex((candidate) => candidate.id === bidder.id);
      for (let offset = 1; offset <= state.players.length; offset += 1) {
        const candidate = state.players[(afterIndex + offset) % state.players.length];
        if (
          candidate.isBankrupt ||
          candidate.id === bidder.id ||
          nextAuction.passedPlayerIds.includes(candidate.id)
        ) continue;
        nextAuction.currentBidderId = candidate.id;
        break;
      }

      if (nextAuction.currentBidderId === null) {
        const space = BOARD_SPACES[auction.spaceId];
        set((current) => ({
          players: current.players.map((candidate) =>
            candidate.id === bidder.id ? { ...candidate, money: candidate.money - nextBid } : candidate
          ),
          properties: {
            ...current.properties,
            [space.id]: claimNewDeed(current.properties[space.id], bidder.id, current.ruleset),
          },
          auction: null,
          turnPhase: 'END_TURN',
        }));
        addLog(`${bidder.name} won ${space.name} for $${nextBid}.`, 'property',
          { fromId: bidder.id, toId: null, amount: nextBid, reason: `Won ${space.name} at auction`, category: 'auction', spaceId: space.id });
        if (space.type === 'railroad') openRailroadRaid(state.players[state.currentPlayerIndex].id);
        return;
      }

      set({ auction: nextAuction });
      addLog(`${bidder.name} bid $${nextBid} for ${BOARD_SPACES[auction.spaceId].name}.`, 'info', undefined,
        { kind: 'auction', actorId: bidder.id, spaceId: auction.spaceId, amount: nextBid, silent: true });
    },

    passAuction: (expectedBidderId) => {
      const state = get();
      const auction = state.auction;
      if (!auction || state.turnPhase !== 'AUCTION' || auction.currentBidderId === null) return;
      if (expectedBidderId !== undefined && expectedBidderId !== auction.currentBidderId) return;

      const passingId = auction.currentBidderId;
      const passingPlayer = state.players.find(player => player.id === passingId)!;
      const space = BOARD_SPACES[auction.spaceId];
      const logPass = () => addLog(`${passingPlayer.name} passed on ${space.name}.`, 'info', undefined,
        { kind: 'auction', actorId: passingId, spaceId: space.id, silent: true });
      const passedPlayerIds = [...new Set([...auction.passedPlayerIds, passingId])];
      const nextAuction: PropertyAuction = {
        ...auction,
        passedPlayerIds,
        currentBidderId: null,
      };

      const passingIndex = state.players.findIndex((candidate) => candidate.id === passingId);
      for (let offset = 1; offset <= state.players.length; offset += 1) {
        const candidate = state.players[(passingIndex + offset) % state.players.length];
        if (
          candidate.isBankrupt ||
          candidate.id === auction.highestBidderId ||
          passedPlayerIds.includes(candidate.id)
        ) continue;
        nextAuction.currentBidderId = candidate.id;
        break;
      }

      if (nextAuction.currentBidderId !== null) {
        set({ auction: nextAuction });
        logPass();
        return;
      }

      const winner = auction.highestBidderId === null
        ? null
        : state.players.find((candidate) => candidate.id === auction.highestBidderId) ?? null;
      if (winner) {
        set((current) => ({
          players: current.players.map((candidate) =>
            candidate.id === winner.id ? { ...candidate, money: candidate.money - auction.currentBid } : candidate
          ),
          properties: {
            ...current.properties,
            [space.id]: claimNewDeed(current.properties[space.id], winner.id, current.ruleset),
          },
          auction: null,
          turnPhase: 'END_TURN',
        }));
        logPass();
        addLog(`${winner.name} won ${space.name} for $${auction.currentBid}.`, 'property',
          { fromId: winner.id, toId: null, amount: auction.currentBid, reason: `Won ${space.name} at auction`, category: 'auction', spaceId: space.id });
      } else {
        set({ auction: null, turnPhase: 'END_TURN' });
        logPass();
        addLog(`All players passed. ${space.name} remains unowned.`, 'info', undefined,
          { kind: 'auction', actorId: passingId, spaceId: space.id, silent: true });
      }
      if (space.type === 'railroad') openRailroadRaid(state.players[state.currentPlayerIndex].id);
    },
    declineProperty: () => {
      const state = get();
      if (state.turnPhase !== 'LANDED_ACTION' || state.pendingTrade) return;
      const player = state.players[state.currentPlayerIndex];
      const space = BOARD_SPACES[player.position];
      set({ turnPhase: 'END_TURN' });
      addLog(`${player.name} passed on buying ${space.name}.`, 'info', undefined,
        { kind: 'land', actorId: player.id, spaceId: space.id, silent: true });
      if (space.type === 'railroad') openRailroadRaid(player.id);
    },

    drawPendingCard: (expectedDrawId) => {
      const state = get();
      if (state.turnPhase !== 'CARD_PENDING' || state.cardDrawId !== expectedDrawId || state.winner) return;
      const player = state.players[state.currentPlayerIndex];
      const type = BOARD_SPACES[player.position].type;
      if (type !== 'chance' && type !== 'chest') return;

      const deckKey = type === 'chance' ? 'chanceDeck' : 'chestDeck';
      const [card, ...deck] = state[deckKey];
      if (card.actionType !== 'get_out_of_jail') deck.push(card);
      set({ [deckKey]: deck, activeCard: card, turnPhase: 'CARD_DRAWN' });
      addLog(`${player.name} drew ${type === 'chance' ? 'Chance' : 'Community Chest'}: "${card.title}"`, 'card');
    },

    applyActiveCard: (expectedDrawId) => {
      const state = get();
      const card = state.activeCard;
      if (!card || state.turnPhase !== 'CARD_DRAWN' || (expectedDrawId !== undefined && expectedDrawId !== state.cardDrawId)) return;

      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      set({ activeCard: null, resolvingCard: {
        card, drawId: state.cardDrawId, playerId: player.id, spaceId: player.position, transfers: [],
      } });

      const moveBy = (steps: number, rentOverride?: number) => {
        set({ turnPhase: 'MOVING' });
        stepMovePlayer(playerIndex, steps, () => {
          evaluateLandedSpace(1, rentOverride);
          const landed = get(), outcome = landed.resolvingCard;
          if (!outcome) return;
          set({ resolvingCard: { ...outcome, destinationId: landed.players[playerIndex].position } });
          if (!landed.pendingDebt) finishCard();
        });
      };

      switch (card.actionType) {
        case 'collect': {
          const amt = card.amount || 0;
          set((s) => {
            const players = [...s.players];
            players[playerIndex] = { ...players[playerIndex], money: players[playerIndex].money + amt };
            return { players, turnPhase: 'END_TURN' };
          });
          addLog(`${player.name} collected $${amt}.`, 'money',
            { fromId: null, toId: player.id, amount: amt, reason: card.title, category: 'card', spaceId: player.position });
          finishCard();
          break;
        }
        case 'pay': {
          const amt = card.amount || 0;
          if (player.money >= amt) {
            set((s) => {
              const players = [...s.players];
              players[playerIndex] = { ...players[playerIndex], money: players[playerIndex].money - amt };
              return { players, turnPhase: 'END_TURN' };
            });
            addLog(`${player.name} paid $${amt}.`, 'money',
              { fromId: player.id, toId: null, amount: amt, reason: card.title, category: 'card', spaceId: player.position });
            finishCard();
          } else {
            set({
              pendingDebt: { amount: amt, creditorId: null, reason: card.title, category: 'card', spaceId: player.position },
              turnPhase: 'DEBT_RESOLUTION',
            });
          }
          break;
        }
        case 'get_out_of_jail': {
          set((s) => {
            const players = [...s.players];
            players[playerIndex] = {
              ...players[playerIndex],
              getOutOfJailCards: players[playerIndex].getOutOfJailCards + 1,
            };
            return { players, heldJailCards: {...s.heldJailCards, [player.id]: [...(s.heldJailCards[player.id] ?? []), card]}, turnPhase: 'END_TURN' };
          });
          addLog(`${player.name} kept a "Get Out of Jail Free" card.`, 'card');
          finishCard(`${player.name} kept the card for a future Jail release.`);
          break;
        }
        case 'go_to_jail': {
          set((s) => {
            const players = [...s.players];
            players[playerIndex] = {
              ...players[playerIndex],
              position: 10,
              inJail: true,
              jailTurns: 0,
            };
            return { players, doublesCount: 0, turnPhase: 'END_TURN' };
          });
          addLog(`${player.name} was sent to Jail!`, 'alert', undefined,
            { kind: 'jail', actorId: player.id, spaceId: 10, emphasis: 'important' });
          finishCard(`${player.name} was sent directly to Jail.`);
          break;
        }
        case 'move_to': {
          const target = card.targetSpaceId ?? 0;
          const steps = (target - player.position + 40) % 40;
          moveBy(steps === 0 ? 40 : steps);
          break;
        }
        case 'move_relative': {
          const steps = card.steps ?? -3;
          moveBy(steps);
          break;
        }
        case 'nearest_utility': {
          const pos = player.position;
          const target = pos >= 12 && pos < 28 ? 28 : 12;
          const steps = (target - pos + 40) % 40;
          moveBy(steps, (state.dice[0] + state.dice[1]) * 10);
          break;
        }
        case 'nearest_railroad': {
          const pos = player.position;
          let target = 5;
          if (pos >= 5 && pos < 15) target = 15;
          else if (pos >= 15 && pos < 25) target = 25;
          else if (pos >= 25 && pos < 35) target = 35;
          const steps = (target - pos + 40) % 40;
          // This project's card says "pay owner rental due"; it does not
          // specify a double-rent modifier. Do not import another edition.
          moveBy(steps);
          break;
        }
        case 'repairs': {
          let totalCost = 0;
          Object.values(state.properties).forEach((prop) => {
            if (prop.ownerId === player.id) {
              if (state.ruleset === 'arcade') totalCost += arcadeRepairCharge(card, arcadeLevel(prop));
              else if (prop.houses === 5) totalCost += card.perHotel || 100;
              else if (prop.houses > 0) totalCost += prop.houses * (card.perHouse || 25);
            }
          });
          if (totalCost === 0) {
            addLog(`${player.name} owns no buildings—no repair cost due.`, 'info');
            set({ turnPhase: 'END_TURN' });
            finishCard('No repair cost was due.');
          } else if (player.money >= totalCost) {
            set((s) => {
              const players = [...s.players];
              players[playerIndex] = {
                ...players[playerIndex],
                money: players[playerIndex].money - totalCost,
              };
              return { players, turnPhase: 'END_TURN' };
            });
            addLog(`${player.name} paid $${totalCost} for street & property repairs.`, 'money',
              { fromId: player.id, toId: null, amount: totalCost, reason: card.title, category: 'card', spaceId: player.position });
            finishCard();
          } else {
            set({
              pendingDebt: { amount: totalCost, creditorId: null, reason: card.title, category: 'card', spaceId: player.position },
              turnPhase: 'DEBT_RESOLUTION',
            });
          }
          break;
        }
        case 'pay_each_player': {
          const perPlayer = card.amount || 50;
          const activeOthers = state.players.filter((p) => !p.isBankrupt && p.id !== player.id);
          resolvePayments(activeOthers.map(p => ({debtorId: player.id, creditorId: p.id, amount: perPlayer, reason: card.title})));
          break;
        }
        case 'collect_from_each_player': {
          const perPlayer = card.amount || 10;
          resolvePayments(state.players.filter(p => !p.isBankrupt && p.id !== player.id)
            .map(p => ({debtorId: p.id, creditorId: player.id, amount: perPlayer, reason: card.title})));
          break;
        }
      }
    },

    buildHouse: (spaceId) => {
      const state = get();
      const player = state.players[state.currentPlayerIndex];
      if (!get().canBuildHouse(player.id, spaceId)) return;

      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      const newLevel = prop.houses + 1;
      const cost = space.houseCost || 100;

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          money: player.money - cost,
        };
        const properties = {
          ...s.properties,
          [spaceId]: { ...prop, houses: newLevel },
        };
        return { players, properties };
      });

      addLog(
        `${player.name} built a ${newLevel === 5 ? 'hotel' : `house (#${newLevel})`} on ${space.name} for $${cost}.`,
        'property', { fromId: player.id, toId: null, amount: cost,
          reason: `${newLevel === 5 ? 'Hotel' : `House ${newLevel}`} on ${space.name}`, category: 'construction', spaceId },
        { kind: 'upgrade', previousLevel: prop.houses, level: newLevel }
      );
    },

    upgradeProperty: (spaceId, expectedLandingId) => set(state => {
      const landing = state.arcadeLanding;
      const player = state.players[state.currentPlayerIndex];
      if (!landing || !player || (expectedLandingId !== undefined && landing.id !== expectedLandingId) ||
        !state.canUpgradeProperty(player.id, spaceId)) return state;

      const street = BOARD_SPACES[spaceId], property = state.properties[spaceId];
      const previousLevel = arcadeLevel(property), level = arcadeNextLevel(previousLevel)!;
      const cost = arcadeUpgradeCost(street, level);
      const title = level === 3 ? `${player.name} completed a Level 3 Hotel at ${street.name}.`
        : `${player.name} upgraded ${street.name} to ${ARCADE_STAGES[level].name} Lv.${level}.`;
      const players = state.players.map(candidate => candidate.id === player.id ? { ...candidate, money: candidate.money - cost } : candidate);
      const properties = { ...state.properties, [spaceId]: { ...property, developmentLevel: level } };
      const receipt: CashTransfer = { fromId: player.id, toId: null, amount: cost,
        reason: `Upgraded ${street.name} to ${ARCADE_STAGES[level].name}`, category: 'construction', spaceId };
      return {
        players, properties, arcadeLanding: { ...landing, upgraded: true },
        ...logPatch({ ...state, players }, title, 'property', receipt, { kind: 'upgrade', previousLevel, level,
          emphasis: level === 3 ? 'milestone' : undefined,
          details: [`${ARCADE_STAGES[previousLevel].name} Lv.${previousLevel} → ${ARCADE_STAGES[level].name} Lv.${level}.`,
            `Rent is now $${arcadeRent(street, level).toLocaleString('en-US')}.`] }),
      };
    }),

    sellHouse: (spaceId, expectedLevel) => {
      const state = get();
      const player = managementPlayer();
      if (!player) return;
      if (!get().canSellHouse(player.id, spaceId)) return;

      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      const isArcade = state.ruleset === 'arcade';
      const currentArcadeLevel = arcadeLevel(prop);
      const level = isArcade ? currentArcadeLevel : prop.houses;
      if (expectedLevel !== undefined && expectedLevel !== level) return;
      const fallbackLevel = arcadePreviousLevel(currentArcadeLevel);
      const refund = isArcade ? arcadeSellRefund(space, currentArcadeLevel) : Math.floor((space.houseCost || 100) / 2);

      set((s) => {
        const players = [...s.players];
        const index = players.findIndex(p => p.id === player.id);
        players[index] = {
          ...players[index],
          money: player.money + refund,
        };
        const properties = {
          ...s.properties,
          [spaceId]: isArcade ? { ...prop, developmentLevel: fallbackLevel } : { ...prop, houses: prop.houses - 1 },
        };
        return { players, properties };
      });

      const building = isArcade ? ARCADE_STAGES[currentArcadeLevel].name : prop.houses === 5 ? 'Hotel' : 'House';
      const reason = building === 'Hotel' ? 'Hotel downgraded' : `${building} sold`;
      addLog(`${player.name} sold ${isArcade ? `the ${building}` : 'a building'} on ${space.name} for $${refund}.`, 'money',
        { fromId: null, toId: player.id, amount: refund, reason: `${reason} · ${space.name}`,
          category: 'construction', spaceId }, { kind: 'sale', previousLevel: level, level: isArcade ? fallbackLevel : level - 1 });
    },

    toggleMortgage: (spaceId, expectedIsMortgaged) => {
      const state = get();
      const player = managementPlayer();
      if (!player || !get().canToggleMortgage(player.id, spaceId)) return;
      const playerIndex = state.players.findIndex(p => p.id === player.id);
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      if (!space || !prop || prop.ownerId !== player.id || !space.mortgageValue) return;
      if (expectedIsMortgaged !== undefined && prop.isMortgaged !== expectedIsMortgaged) return;

      if (!prop.isMortgaged) {
        set((s) => {
          const players = [...s.players];
          players[playerIndex] = {
            ...players[playerIndex],
            money: player.money + space.mortgageValue!,
          };
          const properties = {
            ...s.properties,
            [spaceId]: { ...prop, isMortgaged: true },
          };
          return { players, properties };
        });
        addLog(`${player.name} mortgaged ${space.name} for $${space.mortgageValue}.`, 'money',
          { fromId: null, toId: player.id, amount: space.mortgageValue, reason: `Mortgaged ${space.name}`, category: 'mortgage', spaceId });
      } else {
        const cost = unmortgageCost(space.mortgageValue);
        if (player.money < cost) return;

        set((s) => {
          const players = [...s.players];
          players[playerIndex] = {
            ...players[playerIndex],
            money: player.money - cost,
          };
          const properties = {
            ...s.properties,
            [spaceId]: { ...prop, isMortgaged: false },
          };
          return { players, properties };
        });
        addLog(`${player.name} unmortgaged ${space.name} for $${cost}.`, 'property',
          { fromId: player.id, toId: null, amount: cost, reason: `Released mortgage on ${space.name}`, category: 'mortgage', spaceId });
      }
    },

    proposeTrade: (offer) => {
      const state = get();
      const key = offer.proposalId ?? JSON.stringify(offer);
      if (processedTrades.has(key)) return {accepted: false, message: 'This trade has already been completed.'};
      if (state.pendingTrade) return {accepted: false, message: 'Respond to the pending trade first.'};
      const fromPlayer = state.players.find((p) => p.id === offer.fromPlayerId);
      const toPlayer = state.players.find((p) => p.id === offer.toPlayerId);
      if (!fromPlayer || !toPlayer || fromPlayer.id === toPlayer.id) {
        return { accepted: false, message: 'Choose two different players.' };
      }
      if (fromPlayer.id !== managementPlayer()?.id || fromPlayer.isAI || fromPlayer.isBankrupt || toPlayer.isBankrupt) {
        return { accepted: false, message: 'Only the active human player can initiate a trade with an active rival.' };
      }
      if (state.winner || state.railroadRaid || !['PRE_ROLL', 'LANDED_ACTION', 'END_TURN', 'DEBT_RESOLUTION'].includes(state.turnPhase)) {
        return { accepted: false, message: 'Trades are available between actions during your turn.' };
      }

      if (
        !Number.isSafeInteger(offer.offerCash) ||
        !Number.isSafeInteger(offer.requestCash) ||
        offer.offerCash < 0 ||
        offer.requestCash < 0 ||
        !Array.isArray(offer.offerProperties) ||
        !Array.isArray(offer.requestProperties) ||
        new Set(offer.offerProperties).size !== offer.offerProperties.length ||
        new Set(offer.requestProperties).size !== offer.requestProperties.length
      ) {
        return { accepted: false, message: 'Trade values and property selections must be valid and non-negative.' };
      }

      if (fromPlayer.money < offer.offerCash || toPlayer.money < offer.requestCash) {
        return { accepted: false, message: 'Insufficient cash for this trade.' };
      }

      const offeredPropertiesValid = offer.offerProperties.every((id) =>
        Number.isInteger(id) && state.properties[id]?.ownerId === fromPlayer.id && !state.properties[id]?.isMortgaged
      );
      const requestedPropertiesValid = offer.requestProperties.every((id) =>
        Number.isInteger(id) && state.properties[id]?.ownerId === toPlayer.id && !state.properties[id]?.isMortgaged
      );
      if (!offeredPropertiesValid || !requestedPropertiesValid) {
        return { accepted: false, message: 'Only properties owned free and clear can be traded.' };
      }

      const tradedIds = [...offer.offerProperties, ...offer.requestProperties];
      if (state.ruleset !== 'arcade' && tradedIds.some((id) => groupHasBuildings(BOARD_SPACES[id], state.properties))) {
        return { accepted: false, message: 'Sell all buildings in a color group before trading its properties.' };
      }
      if (
        offer.offerCash === 0 &&
        offer.requestCash === 0 &&
        offer.offerProperties.length === 0 &&
        offer.requestProperties.length === 0
      ) {
        return { accepted: false, message: 'A trade must include cash or at least one property.' };
      }

      // AI evaluates the overall value of the exchange, including a modest set-completion bonus.
      const propertyValue = (id: number, acquiringPlayerId: number) => {
        const space = BOARD_SPACES[id];
        if (state.ruleset === 'arcade' && space.type === 'property') {
          return (space.price ?? 0) + arcadeDevelopmentValue(space, arcadeLevel(state.properties[id]));
        }
        const group = BOARD_SPACES.filter((candidate) => candidate.colorGroup === space.colorGroup);
        const completesSet = group.length > 0 && group.every((candidate) =>
          candidate.id === id || state.properties[candidate.id]?.ownerId === acquiringPlayerId
        );
        return (space.price || 150) * (completesSet ? 1.3 : 1);
      };
      const offeredPropVal = offer.offerProperties.reduce(
        (sum, id) => sum + propertyValue(id, toPlayer.id),
        0
      );
      const requestedPropVal = offer.requestProperties.reduce(
        (sum, id) => sum + propertyValue(id, fromPlayer.id),
        0
      );

      const totalOfferedValue = offer.offerCash + offeredPropVal;
      const totalRequestedValue = offer.requestCash + requestedPropVal;

      if (toPlayer.isAI && totalOfferedValue < totalRequestedValue * 0.95) {
        addLog(`${toPlayer.name} declined the trade with ${fromPlayer.name}.`, 'info', undefined,
          { kind: 'trade', actorId: fromPlayer.id, counterpartyId: toPlayer.id, silent: true });
        return {
          accepted: false,
          message: `${toPlayer.name} declined the trade.`,
        };
      }

      if (!toPlayer.isAI && approvedTrade !== offer) {
        set({pendingTrade: {...offer, proposalId: key}});
        addLog(`${fromPlayer.name} proposed a trade to ${toPlayer.name}.`, 'info', undefined,
          { kind: 'trade', actorId: fromPlayer.id, counterpartyId: toPlayer.id, silent: true });
        return {accepted: false, message: `Waiting for ${toPlayer.name} to accept or reject.`};
      }

      processedTrades.add(key);
      set((s) => {
        const players = s.players.map((p) => {
          if (p.id === fromPlayer.id) {
            return { ...p, money: p.money - offer.offerCash + offer.requestCash };
          }
          if (p.id === toPlayer.id) {
            return { ...p, money: p.money - offer.requestCash + offer.offerCash };
          }
          return p;
        });

        const properties = { ...s.properties };
        offer.offerProperties.forEach((id) => {
          properties[id] = { ...properties[id], ownerId: toPlayer.id };
        });
        offer.requestProperties.forEach((id) => {
          properties[id] = { ...properties[id], ownerId: fromPlayer.id };
        });

        return { players, properties };
      });

      addLog(`Trade completed between ${fromPlayer.name} and ${toPlayer.name}!`, 'property', [
        { fromId: fromPlayer.id, toId: toPlayer.id, amount: offer.offerCash, reason: 'Trade cash', category: 'trade' },
        { fromId: toPlayer.id, toId: fromPlayer.id, amount: offer.requestCash, reason: 'Trade cash', category: 'trade' },
      ], { kind: 'trade', actorId: fromPlayer.id, counterpartyId: toPlayer.id,
        details: [...offer.offerProperties.map(id => `${toPlayer.name} now owns ${BOARD_SPACES[id].name}.`),
          ...offer.requestProperties.map(id => `${fromPlayer.name} now owns ${BOARD_SPACES[id].name}.`)] });
      return { accepted: true, message: `${toPlayer.name} accepted your trade offer!` };
    },

    acceptTrade: (playerId) => {
      const offer = get().pendingTrade;
      if (!offer || offer.toPlayerId !== playerId) return {accepted: false, message: 'This offer is addressed to another player.'};
      approvedTrade = offer;
      set({pendingTrade: null});
      try { return get().proposeTrade(offer); } finally { approvedTrade = null; }
    },
    rejectTrade: () => {
      const state = get(), offer = state.pendingTrade;
      if (!offer) return;
      const from = state.players.find(player => player.id === offer.fromPlayerId)!;
      const to = state.players.find(player => player.id === offer.toPlayerId)!;
      set({ pendingTrade: null });
      addLog(`${to.name} declined the trade with ${from.name}.`, 'info', undefined,
        { kind: 'trade', actorId: to.id, counterpartyId: from.id, silent: true });
    },

    settlePendingDebt: (expectedDebt) => {
      const state = get();
      const debt = state.pendingDebt;
      const player = managementPlayer();
      if (!debt || (expectedDebt && debt !== expectedDebt) || !player || player.isBankrupt ||
        state.turnPhase !== 'DEBT_RESOLUTION' || state.pendingTrade || player.money < debt.amount) return;

      const jailRelease = debt.reason === 'Jail release after third failed roll';
      const jailMoveTotal = state.dice[0] + state.dice[1];
      const category = debt.category ?? (jailRelease ? 'jail' : 'debt');
      const spaceId = debt.spaceId ?? player.position;
      const creditor = state.players.find(candidate => candidate.id === debt.creditorId);
      const space = BOARD_SPACES[spaceId];
      const raidSpace = category === 'rent' ? space : BOARD_SPACES[player.position];
      const raid = !jailRelease && !debt.remainingPayments && raidSpace.type === 'railroad' ? createRailroadRaid(player.id) : null;
      const rentMessage = `${player.name} paid $${debt.amount} rent to ${creditor?.name ?? 'the owner'} for ${space.name}.`;
      const message = category === 'rent' ? rentMessage : debt.distribution
        ? `${player.name} paid ${debt.distribution.amountPerPlayer} to each active rival (${debt.amount} total).`
        : `${player.name} settled their ${debt.amount} debt (${debt.reason}).`;

      set((s) => {
        const players = s.players.map((p) => {
          if (p.id === player.id) {
            return {
              ...p,
              money: p.money - debt.amount,
              ...(jailRelease ? { inJail: false, jailTurns: 0 } : {}),
            };
          }
          if (debt.creditorId !== null && p.id === debt.creditorId) {
            return { ...p, money: p.money + debt.amount };
          }
          if (debt.distribution?.recipientIds.includes(p.id) && !p.isBankrupt) {
            return { ...p, money: p.money + debt.distribution.amountPerPlayer };
          }
          return p;
        });
        return {
          players,
          pendingDebt: null,
          turnPhase: jailRelease ? 'MOVING' : 'END_TURN',
          ...(raid && { railroadRaid: raid }),
          ...logPatch({ ...s, players }, message, 'money', debt.distribution
            ? debt.distribution.recipientIds.filter(id => players.some(p => p.id === id && !p.isBankrupt))
              .map(toId => ({ fromId: player.id, toId, amount: debt.distribution!.amountPerPlayer, reason: debt.reason, category: 'debt' as const }))
            : { fromId: player.id, toId: debt.creditorId, amount: debt.amount, reason: debt.reason, category, spaceId },
            category === 'tax' ? { kind: 'tax', title: `${player.name} paid $${debt.amount} for ${space.name}.` }
              : jailRelease ? { kind: 'bail', title: `${player.name} paid $${debt.amount} bail and was released from Jail.` }
              : undefined),
        };
      });

      if (jailRelease) {
        addLog(`${player.name} is released from Jail and moves ${jailMoveTotal} spaces.`, 'info');
        stepMovePlayer(state.currentPlayerIndex, jailMoveTotal, evaluateLandedSpace);
      } else if (debt.remainingPayments) {
        resolvePayments(debt.remainingPayments);
      } else {
        finishCard();
        if (raid) announceRailroadRaid(player.id);
      }
    },

    declareBankruptcy: (expectedDebt) => {
      const state = get();
      const player = managementPlayer();
      const debt = state.pendingDebt;
      if (!player || player.isBankrupt || !debt || (expectedDebt && debt !== expectedDebt) ||
        state.turnPhase !== 'DEBT_RESOLUTION' || state.winner || state.pendingTrade || get().liquidationValue(player.id) >= debt.amount) return;
      const creditorId = state.pendingDebt?.creditorId ?? null;
      const held = state.heldJailCards[player.id] ?? [];
      const deeds = Object.values(state.properties).filter(prop => prop.ownerId === player.id);
      const liquidation = deeds.reduce((sum, prop) => sum + getDevelopmentLiquidation(prop, state.ruleset), 0);

      const creditor = state.players.find(p => p.id === creditorId);

      set((s) => {
        const players = s.players.map((p) => {
          if (p.id === player.id) {
            return { ...p, money: 0, isBankrupt: true, landmarkLevel: 0, getOutOfJailCards: 0 };
          }
          if (creditorId !== null && p.id === creditorId) {
            return { ...p, money: p.money + Math.max(0, player.money) + liquidation, getOutOfJailCards: p.getOutOfJailCards + held.length };
          }
          return p;
        });

        const heldJailCards = {...s.heldJailCards, [player.id]: []};
        const chanceDeck = [...s.chanceDeck], chestDeck = [...s.chestDeck];
        if (creditorId !== null) heldJailCards[creditorId] = [...(heldJailCards[creditorId] ?? []), ...held];
        else held.forEach(card => (card.deck === 'chance' ? chanceDeck : chestDeck).push(card));
        const returnedCards = {heldJailCards, chanceDeck, chestDeck};

        const properties = { ...s.properties };
        Object.keys(properties).forEach((key) => {
          const id = Number(key);
          if (properties[id].ownerId === player.id) {
            properties[id] = {
              ...properties[id],
              ownerId: creditorId,
              houses: 0,
              ...(s.ruleset === 'arcade' && BOARD_SPACES[id].type === 'property' ? { developmentLevel: 0 as const } : {}),
              isMortgaged: creditorId !== null ? properties[id].isMortgaged : false,
            };
          }
        });

        const remainingPlayers = players.filter((p) => !p.isBankrupt);
        if (remainingPlayers.length === 1) {
          return {
            ...returnedCards,
            players,
            properties,
            pendingDebt: null,
            winner: remainingPlayers[0],
            turnPhase: 'GAME_OVER',
            activeCard: null, railroadRaid: null, auction: null, pendingTrade: null, doublesCount: 0,
            arcadeLanding: null,
          };
        }

        return { ...returnedCards, players, properties, pendingDebt: null,
          arcadeLanding: s.arcadeLanding?.playerId === player.id ? null : s.arcadeLanding,
          doublesCount: s.players[s.currentPlayerIndex]?.id === player.id ? 0 : s.doublesCount,
          turnPhase: 'END_TURN' };
      });
      const paid = Math.max(0, player.money) + (creditor ? liquidation : 0);
      addLog(`${player.name} declared bankruptcy over ${debt.reason}. Eligible assets go to ${creditor?.name ?? 'the Bank'}.`, 'alert',
        { fromId: player.id, toId: creditorId, amount: paid, reason: 'Bankruptcy settlement', category: debt.category === 'card' ? 'card' : 'debt' },
        { kind: 'bankruptcy', actorId: player.id, counterpartyId: creditor?.id, emphasis: 'important', details: deeds.map(property =>
          creditor ? `${creditor.name} received ${BOARD_SPACES[property.spaceId].name}.`
            : `${BOARD_SPACES[property.spaceId].name} returned to the Bank.`) });
      const result = get().resolvingCard;
      if (result) set({ resolvingCard: { ...result, notes: [...(result.notes ?? []),
        `${player.name} could not cover the $${debt.amount} obligation and was eliminated.`] } });
      const winner = get().winner;
      if (winner) {
        finishCard();
        addLog(`${winner.name} won the match!`, 'alert', undefined, { kind: 'victory', actorId: winner.id, emphasis: 'milestone' });
        return;
      }
      if (debt.remainingPayments) resolvePayments(debt.remainingPayments);
      else finishCard();
      if (get().players[get().currentPlayerIndex].isBankrupt) get().endTurn();
    },

    endTurn: () => {
      const state = get();
      if (state.turnPhase !== 'END_TURN' || state.railroadRaid || state.pendingTrade || state.winner) return;

      const currentPlayer = state.players[state.currentPlayerIndex];

      // If current player rolled doubles, is not in Jail, and not bankrupt, they get another turn!
      if (state.doublesCount > 0 && !currentPlayer.inJail && !currentPlayer.isBankrupt) {
        set({ turnPhase: 'PRE_ROLL', arcadeLanding: null });
        addLog(`${currentPlayer.name} rolled doubles and takes another turn!`, 'info', undefined,
          { kind: 'turn', actorId: currentPlayer.id, silent: true });
        return;
      }

      // Advance to next non-bankrupt player
      let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
      while (state.players[nextIdx].isBankrupt) {
        nextIdx = (nextIdx + 1) % state.players.length;
      }

      set({
        currentPlayerIndex: nextIdx,
        doublesCount: 0,
        turnPhase: 'PRE_ROLL',
        arcadeLanding: null,
        turnNumber: (state.turnNumber ?? 1) + 1,
      });
      const nextPlayer = state.players[nextIdx];
      addLog(nextPlayer.name === 'You' ? 'It’s your turn.' : `It’s ${nextPlayer.name}’s turn.`, 'info', undefined,
        { kind: 'turn', actorId: state.players[nextIdx].id, silent: true });
    },
  };
});
