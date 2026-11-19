import { create } from 'zustand';
import {
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
  TokenType,
  TradeOffer,
  TurnPhase,
} from '../types/game';
import { BOARD_SPACES, COLOR_GROUP_TOTALS } from '../data/boardData';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../data/cardsData';
import { DAILY_MISSIONS, DAILY_REWARD_CYCLE, LUCKY_WHEEL_REWARDS, STICKER_COLLECTION, type MissionId, type MissionStat, type WheelReward } from '../data/metaGameData';
import { groupHasBuildings, unmortgageCost } from '../game/soloRules';
import { DICE_ROLL_MS, TOKEN_STEP_MS } from '../presentation/animationMath';

interface SoloPayment {
  debtorId: number;
  creditorId: number | null;
  amount: number;
  reason: string;
}

interface PlayerSetupConfig {
  name: string;
  isAI: boolean;
  token: TokenType;
  color: string;
}

interface GameStore {
  gameId: number;
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
  selectedSpaceId: number | null;
  hoveredSpaceId: number | null;
  gameSpeed: 1 | 2;
  cameraMode: CameraMode;
  logs: LogEntry[];
  pendingDebt: {
    amount: number;
    creditorId: number | null;
    reason: string;
    debtorId?: number;
    remainingPayments?: SoloPayment[];
    distribution?: { recipientIds: number[]; amountPerPlayer: number };
  } | null;
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
  startNewGame: (configs: PlayerSetupConfig[]) => void;
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
  applyActiveCard: (expectedDrawId?: number) => void;
  buildHouse: (spaceId: number) => void;
  sellHouse: (spaceId: number) => void;
  toggleMortgage: (spaceId: number, expectedIsMortgaged?: boolean) => void;
  proposeTrade: (offer: TradeOffer) => { accepted: boolean; message: string };
  acceptTrade: (playerId: number) => { accepted: boolean; message: string };
  rejectTrade: () => void;
  settlePendingDebt: () => void;
  declareBankruptcy: () => void;
  endTurn: () => void;

  // Helpers
  canBuildHouse: (playerId: number, spaceId: number) => boolean;
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

function createInitialProperties(): Record<number, PropertyState> {
  const props: Record<number, PropertyState> = {};
  BOARD_SPACES.forEach((space) => {
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      props[space.id] = {
        spaceId: space.id,
        ownerId: null,
        houses: 0,
        isMortgaged: false,
      };
    }
  });
  return props;
}

const DEFAULT_PLAYERS: PlayerSetupConfig[] = [
  { name: 'You', isAI: false, token: 'rubber_duck', color: '#f59e0b' },
  { name: 'Victoria', isAI: true, token: 'cat', color: '#ec4899' },
  { name: 'Arthur', isAI: true, token: 'racecar', color: '#3b82f6' },
  { name: 'Elena', isAI: true, token: 'yacht', color: '#10b981' },
];

export const useGameStore = create<GameStore>((set, get) => {
  // Invalidate in-flight movement and dice callbacks whenever a new game starts.
  let gameGeneration = 0;
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
        set({pendingDebt: {...payment, remainingPayments: payments.slice(i + 1)}, turnPhase: 'DEBT_RESOLUTION'});
        return;
      }
      set(s => ({players: s.players.map(p => p.id === debtor.id ? {...p, money: p.money - payment.amount} :
        p.id === creditor?.id ? {...p, money: p.money + payment.amount} : p)}));
      addLog(`${debtor.name} paid $${payment.amount} to ${creditor?.name ?? 'the Bank'} (${payment.reason}).`, 'money',
        { fromId: debtor.id, toId: payment.creditorId, amount: payment.amount, reason: payment.reason, category: 'card' });
    }
    set({pendingDebt: null, turnPhase: 'END_TURN'});
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info', transfer?: CashTransfer | CashTransfer[]) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      type,
      ...(transfer && { transfers: (Array.isArray(transfer) ? transfer : [transfer]).filter(item => item.amount > 0) }),
    };
    set((state) => ({ logs: [entry, ...state.logs.slice(0, 79)] }));
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

  const openRailroadRaid = (attackerId: number) => {
    const shuffledRewards = shuffleDeck([150, 300, 550]);
    const vaultRewards: [number, number, number] = [shuffledRewards[0], shuffledRewards[1], shuffledRewards[2]];
    set({ railroadRaid: { attackerId, mode: 'choose', vaultRewards } });
    addLog('Railroad bonus unlocked: choose a Bank Heist or shut down a rival landmark.', 'card');
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

    addLog(`${player.name} landed on ${space.name}.`, 'info');

    if (space.type === 'go' || space.type === 'jail' || space.type === 'free_parking') {
      set({ turnPhase: 'END_TURN' });
      return;
    }

    if (space.type === 'go_to_jail') {
      addLog(`${player.name} is sent directly to Jail!`, 'alert');
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
          pendingDebt: { amount: tax, creditorId: null, reason: space.name },
          turnPhase: 'DEBT_RESOLUTION',
        });
      }
      return;
    }

    if (space.type === 'chance' || space.type === 'chest') {
      const isChance = space.type === 'chance';
      const deck = isChance ? [...state.chanceDeck] : [...state.chestDeck];
      const drawnCard = deck.shift()!;
      if (drawnCard.actionType !== 'get_out_of_jail') deck.push(drawnCard);

      set({
        chanceDeck: isChance ? deck : state.chanceDeck,
        chestDeck: !isChance ? deck : state.chestDeck,
        activeCard: drawnCard,
        cardDrawId: state.cardDrawId + 1,
        turnPhase: 'CARD_DRAWN',
      });
      addLog(`${player.name} drew ${isChance ? 'Chance' : 'Community Chest'}: "${drawnCard.title}"`, 'card');
      return;
    }

    // Property, Railroad, or Utility
    const propState = state.properties[space.id];
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

    // Calculate and charge rent
    const diceTotal = state.dice[0] + state.dice[1];
    const rent = rentOverride ?? get().calculateRent(space.id, diceTotal) * rentMultiplier;
    const owner = state.players.find((p) => p.id === propState.ownerId)!;

    if (player.money >= rent) {
      set((s) => {
        const players = s.players.map((p) => {
          if (p.id === player.id) return { ...p, money: p.money - rent };
          if (p.id === owner.id) return { ...p, money: p.money + rent };
          return p;
        });
        return { players, turnPhase: 'END_TURN' };
      });
      addLog(`${player.name} paid $${rent} rent to ${owner.name} for ${space.name}.`, 'money',
        { fromId: player.id, toId: owner.id, amount: rent, reason: `Rent on ${space.name}`, category: 'rent', spaceId: space.id });
      if (space.type === 'railroad') openRailroadRaid(player.id);
    } else {
      addLog(`${player.name} owes $${rent} rent to ${owner.name} and must raise funds!`, 'alert');
      set({
        pendingDebt: { amount: rent, creditorId: owner.id, reason: `Rent on ${space.name}` },
        turnPhase: 'DEBT_RESOLUTION',
      });
    }
  };

  return {
    gameId: 0,
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
    properties: createInitialProperties(),
    currentPlayerIndex: 0,
    turnPhase: 'PRE_ROLL',
    dice: [3, 4],
    doublesCount: 0,
    chanceDeck: shuffleDeck(CHANCE_CARDS),
    chestDeck: shuffleDeck(COMMUNITY_CHEST_CARDS),
    activeCard: null,
    cardDrawId: 0,
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

    startNewGame: (configs) => {
      if (configs.length < 2 || configs.length > 6) return;
      gameGeneration += 1;
      clearTimeout(animationTimer);
      processedTrades.clear();
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
        players: newPlayers,
        properties: createInitialProperties(),
        currentPlayerIndex: 0,
        turnPhase: 'PRE_ROLL',
        dice: [1, 1],
        doublesCount: 0,
        chanceDeck: shuffleDeck(CHANCE_CARDS),
        chestDeck: shuffleDeck(COMMUNITY_CHEST_CARDS),
        activeCard: null,
        cardDrawId: 0,
        selectedSpaceId: null,
        hoveredSpaceId: null,
        pendingDebt: null,
        auction: null,
        heldJailCards: {},
        pendingTrade: null,
        railroadRaid: null,
        winner: null,
        isSetupModalOpen: false,
        logs: [
          {
            id: `start-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

    canSellHouse: (playerId, spaceId) => {
      if (!canManage(playerId)) return false;
      const state = get();
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      if (!space || !prop || space.type !== 'property') return false;
      if (prop.ownerId !== playerId || prop.houses <= 0) return false;

      const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === space.colorGroup);
      const maxHouses = Math.max(...groupSpaces.map((s) => state.properties[s.id]?.houses ?? 0));
      return prop.houses === maxHouses;
    },

    canToggleMortgage: (playerId, spaceId) => {
      if (!canManage(playerId)) return false;
      const state = get(), space = BOARD_SPACES[spaceId], prop = state.properties[spaceId];
      const player = state.players.find(p => p.id === playerId);
      if (!space?.mortgageValue || !prop || prop.ownerId !== playerId || !player) return false;
      return prop.isMortgaged ? player.money >= unmortgageCost(space.mortgageValue) :
        !BOARD_SPACES.some(s => s.colorGroup === space.colorGroup && (state.properties[s.id]?.houses ?? 0) > 0);
    },

    liquidationValue: (playerId) => {
      const state = get(), player = state.players.find(p => p.id === playerId);
      return (player?.money ?? 0) + Object.values(state.properties).reduce((sum, prop) => {
        if (prop.ownerId !== playerId) return sum;
        const space = BOARD_SPACES[prop.spaceId];
        return sum + prop.houses * Math.floor((space.houseCost ?? 0) / 2) + (prop.isMortgaged ? 0 : space.mortgageValue ?? 0);
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

      set({ dice: [d1, d2], turnPhase: 'ROLLING' });
      if (!player.isAI) progressMission('rolls');

      animationTimer = setTimeout(() => {
        if (generation !== gameGeneration) return;
        const currentState = get();
        const activePlayer = currentState.players[currentState.currentPlayerIndex];

        // Handle Jail Roll
        if (activePlayer.inJail) {
          if (isDoubles) {
            addLog(`${activePlayer.name} rolled doubles (${d1} & ${d2}) and escaped Jail!`, 'info');
            set((s) => {
              const players = [...s.players];
              players[s.currentPlayerIndex] = {
                ...players[s.currentPlayerIndex],
                inJail: false,
                jailTurns: 0,
              };
              return { players, doublesCount: 0, turnPhase: 'MOVING' };
            });
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
                pendingDebt: { amount: 50, creditorId: null, reason: 'Jail release after third failed roll' },
                turnPhase: 'DEBT_RESOLUTION',
              });
            }
          } else {
            addLog(`${activePlayer.name} rolled ${d1} & ${d2} (no doubles) and stays in Jail (Turn ${nextJailTurns}/3).`, 'info');
            set((s) => {
              const players = [...s.players];
              players[s.currentPlayerIndex] = {
                ...players[s.currentPlayerIndex],
                jailTurns: nextJailTurns,
              };
              return { players, turnPhase: 'END_TURN' };
            });
          }
          return;
        }

        // Standard roll outside Jail
        const newDoublesCount = isDoubles ? currentState.doublesCount + 1 : 0;
        if (newDoublesCount === 3) {
          addLog(`${activePlayer.name} rolled 3 consecutive doubles and goes directly to Jail!`, 'alert');
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
        { fromId: player.id, toId: null, amount: cost, reason: `Landmark level ${player.landmarkLevel + 1}`, category: 'landmark' });
    },

    startBankHeist: () => {
      const raid = get().railroadRaid;
      if (!raid || raid.mode !== 'choose' || get().turnPhase !== 'END_TURN') return;
      set({ railroadRaid: { ...raid, mode: 'heist' } });
      addLog('Bank Heist started! Pick one of three vaults.', 'card');
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
        { fromId: null, toId: attacker.id, amount: reward, reason: 'Bank heist', category: 'bonus' });
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
        addLog(`${attacker.name} shut down ${target.name}'s landmark! Its level dropped by one.`, 'alert');
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
          { fromId: target.id, toId: attacker.id, amount: stolen, reason: 'Landmark raid', category: 'bonus' });
        if (!attacker.isAI) progressMission('railroadEvents');
      }
    },

    skipRailroadRaid: () => {
      if (!get().railroadRaid) return;
      set({ railroadRaid: null });
    },
    claimDailyReward: () => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER') return false;
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
      addLog(`Daily reward claimed: ${reward.cash}${reward.packs ? ' and 1 Sticker Pack' : ''} (Day ${rewardDay}).`, 'money');
      return true;
    },

    spinLuckyWheel: () => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER') return;
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
      addLog(`Lucky Wheel reward: ${reward.label}!`, reward.kind === 'cash' ? 'money' : 'card');
    },

    claimMissionReward: (missionId) => {
      const state = get();
      if (state.winner || state.turnPhase === 'GAME_OVER') return;
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
      addLog(`Mission completed: ${mission.title}. Collected ${mission.cashReward}.`, 'money');
    },

    openStickerPack: () => {
      const state = get();
      if (state.metaProgress.stickerPacks <= 0) return null;
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
      if (state.metaProgress.stickerStars < 10) return;
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
      if (state.winner || state.turnPhase === 'GAME_OVER') return;
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
      addLog('Sticker Album completed! Collected the $2,500 grand album reward.', 'money');
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
      addLog(`${player.name} used a "Get Out of Jail Free" card!`, 'card');
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
          [space.id]: { ...prop, ownerId: player.id },
        };
        return { players, properties, turnPhase: 'END_TURN' };
      });

      addLog(`${player.name} purchased ${space.name} for $${space.price}!`, 'property',
        { fromId: player.id, toId: null, amount: space.price, reason: `Purchased ${space.name}`, category: 'purchase', spaceId: space.id });
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
      addLog(`Auction started for ${space.name}. Opening bid is $10.`, 'property');
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
            [space.id]: { ...current.properties[space.id], ownerId: bidder.id },
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
      addLog(`${bidder.name} bid $${nextBid} for ${BOARD_SPACES[auction.spaceId].name}.`, 'info');
    },

    passAuction: (expectedBidderId) => {
      const state = get();
      const auction = state.auction;
      if (!auction || state.turnPhase !== 'AUCTION' || auction.currentBidderId === null) return;
      if (expectedBidderId !== undefined && expectedBidderId !== auction.currentBidderId) return;

      const passingId = auction.currentBidderId;
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
        addLog(`${state.players.find((candidate) => candidate.id === passingId)?.name ?? 'Player'} passed on ${BOARD_SPACES[auction.spaceId].name}.`, 'info');
        return;
      }

      const winner = auction.highestBidderId === null
        ? null
        : state.players.find((candidate) => candidate.id === auction.highestBidderId) ?? null;
      const space = BOARD_SPACES[auction.spaceId];

      if (winner) {
        set((current) => ({
          players: current.players.map((candidate) =>
            candidate.id === winner.id ? { ...candidate, money: candidate.money - auction.currentBid } : candidate
          ),
          properties: {
            ...current.properties,
            [space.id]: { ...current.properties[space.id], ownerId: winner.id },
          },
          auction: null,
          turnPhase: 'END_TURN',
        }));
        addLog(`${winner.name} won ${space.name} for $${auction.currentBid}.`, 'property',
          { fromId: winner.id, toId: null, amount: auction.currentBid, reason: `Won ${space.name} at auction`, category: 'auction', spaceId: space.id });
      } else {
        set({ auction: null, turnPhase: 'END_TURN' });
        addLog(`All players passed. ${space.name} remains unowned.`, 'info');
      }
      if (space.type === 'railroad') openRailroadRaid(state.players[state.currentPlayerIndex].id);
    },
    declineProperty: () => {
      const state = get();
      if (state.turnPhase !== 'LANDED_ACTION' || state.pendingTrade) return;
      const player = state.players[state.currentPlayerIndex];
      const space = BOARD_SPACES[player.position];
      addLog(`${player.name} passed on buying ${space.name}.`, 'info');
      set({ turnPhase: 'END_TURN' });
      if (space.type === 'railroad') openRailroadRaid(player.id);
    },

    applyActiveCard: (expectedDrawId) => {
      const state = get();
      const card = state.activeCard;
      if (!card || state.turnPhase !== 'CARD_DRAWN' || (expectedDrawId !== undefined && expectedDrawId !== state.cardDrawId)) return;

      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      set({ activeCard: null });

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
          } else {
            set({
              pendingDebt: { amount: amt, creditorId: null, reason: card.title },
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
          addLog(`${player.name} was sent to Jail!`, 'alert');
          break;
        }
        case 'move_to': {
          const target = card.targetSpaceId ?? 0;
          const steps = (target - player.position + 40) % 40;
          set({ turnPhase: 'MOVING' });
          stepMovePlayer(playerIndex, steps === 0 ? 40 : steps, evaluateLandedSpace);
          break;
        }
        case 'move_relative': {
          const steps = card.steps ?? -3;
          set({ turnPhase: 'MOVING' });
          stepMovePlayer(playerIndex, steps, evaluateLandedSpace);
          break;
        }
        case 'nearest_utility': {
          const pos = player.position;
          const target = pos >= 12 && pos < 28 ? 28 : 12;
          const steps = (target - pos + 40) % 40;
          set({ turnPhase: 'MOVING' });
          stepMovePlayer(playerIndex, steps, () =>
            evaluateLandedSpace(1, (state.dice[0] + state.dice[1]) * 10)
          );
          break;
        }
        case 'nearest_railroad': {
          const pos = player.position;
          let target = 5;
          if (pos >= 5 && pos < 15) target = 15;
          else if (pos >= 15 && pos < 25) target = 25;
          else if (pos >= 25 && pos < 35) target = 35;
          const steps = (target - pos + 40) % 40;
          set({ turnPhase: 'MOVING' });
          // This project's card says "pay owner rental due"; it does not
          // specify a double-rent modifier. Do not import another edition.
          stepMovePlayer(playerIndex, steps, evaluateLandedSpace);
          break;
        }
        case 'repairs': {
          let totalCost = 0;
          Object.values(state.properties).forEach((prop) => {
            if (prop.ownerId === player.id) {
              if (prop.houses === 5) totalCost += card.perHotel || 100;
              else if (prop.houses > 0) totalCost += prop.houses * (card.perHouse || 25);
            }
          });
          if (totalCost === 0) {
            addLog(`${player.name} owns no buildings—no repair cost due.`, 'info');
            set({ turnPhase: 'END_TURN' });
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
          } else {
            set({
              pendingDebt: { amount: totalCost, creditorId: null, reason: card.title },
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
          reason: `${newLevel === 5 ? 'Hotel' : `House ${newLevel}`} on ${space.name}`, category: 'construction', spaceId }
      );
    },

    sellHouse: (spaceId) => {
      const state = get();
      const player = managementPlayer();
      if (!player) return;
      if (!get().canSellHouse(player.id, spaceId)) return;

      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      const refund = Math.floor((space.houseCost || 100) / 2);

      set((s) => {
        const players = [...s.players];
        const index = players.findIndex(p => p.id === player.id);
        players[index] = {
          ...players[index],
          money: player.money + refund,
        };
        const properties = {
          ...s.properties,
          [spaceId]: { ...prop, houses: prop.houses - 1 },
        };
        return { players, properties };
      });

      addLog(`${player.name} sold a building on ${space.name} for $${refund}.`, 'money',
        { fromId: null, toId: player.id, amount: refund, reason: `${prop.houses === 5 ? 'Hotel downgraded' : 'House sold'} · ${space.name}`,
          category: 'construction', spaceId });
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
        // Cannot mortgage if any property in the color group has houses
        const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === space.colorGroup);
        if (groupSpaces.some((s) => (state.properties[s.id]?.houses ?? 0) > 0)) return;

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
      if (tradedIds.some((id) => groupHasBuildings(BOARD_SPACES[id], state.properties))) {
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
        return {
          accepted: false,
          message: `${toPlayer.name} declined the trade.`,
        };
      }

      if (!toPlayer.isAI && approvedTrade !== offer) {
        set({pendingTrade: {...offer, proposalId: key}});
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
      ]);
      return { accepted: true, message: `${toPlayer.name} accepted your trade offer!` };
    },

    acceptTrade: (playerId) => {
      const offer = get().pendingTrade;
      if (!offer || offer.toPlayerId !== playerId) return {accepted: false, message: 'This offer is addressed to another player.'};
      approvedTrade = offer;
      set({pendingTrade: null});
      try { return get().proposeTrade(offer); } finally { approvedTrade = null; }
    },
    rejectTrade: () => set({pendingTrade: null}),

    settlePendingDebt: () => {
      const state = get();
      const debt = state.pendingDebt;
      const player = managementPlayer();
      if (!debt || !player || player.isBankrupt || state.turnPhase !== 'DEBT_RESOLUTION' || state.pendingTrade || player.money < debt.amount) return;

      const jailRelease = debt.reason === 'Jail release after third failed roll';
      const jailMoveTotal = state.dice[0] + state.dice[1];

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
        };
      });

      addLog(
        debt.distribution
          ? `${player.name} paid ${debt.distribution.amountPerPlayer} to each active rival (${debt.amount} total).`
          : `${player.name} settled their ${debt.amount} debt (${debt.reason}).`,
        'money', (debt.distribution
          ? debt.distribution.recipientIds.filter(id => state.players.some(p => p.id === id && !p.isBankrupt))
            .map(toId => ({ fromId: player.id, toId, amount: debt.distribution!.amountPerPlayer, reason: debt.reason, category: 'debt' as const }))
          : { fromId: player.id, toId: debt.creditorId, amount: debt.amount, reason: debt.reason,
            category: jailRelease ? 'jail' : 'debt', spaceId: player.position })
      );
      if (jailRelease) {
        addLog(`${player.name} is released from Jail and moves ${jailMoveTotal} spaces.`, 'info');
        stepMovePlayer(state.currentPlayerIndex, jailMoveTotal, evaluateLandedSpace);
      } else if (debt.remainingPayments) {
        resolvePayments(debt.remainingPayments);
      } else if (BOARD_SPACES[player.position].type === 'railroad') {
        openRailroadRaid(player.id);
      }
    },

    declareBankruptcy: () => {
      const state = get();
      const player = managementPlayer();
      const debt = state.pendingDebt;
      if (!player || player.isBankrupt || !debt || state.turnPhase !== 'DEBT_RESOLUTION' || state.winner || state.pendingTrade || get().liquidationValue(player.id) >= debt.amount) return;
      const creditorId = state.pendingDebt?.creditorId ?? null;
      const held = state.heldJailCards[player.id] ?? [];
      const liquidation = Object.values(state.properties).reduce((sum, prop) => prop.ownerId === player.id ?
        sum + prop.houses * Math.floor((BOARD_SPACES[prop.spaceId].houseCost ?? 0) / 2) : sum, 0);

      const creditor = state.players.find(p => p.id === creditorId);
      addLog(`${player.name} declared bankruptcy over ${debt.reason}. Eligible assets go to ${creditor?.name ?? 'the Bank'}.`, 'alert');

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
          };
        }

        return { ...returnedCards, players, properties, pendingDebt: null,
          doublesCount: s.players[s.currentPlayerIndex]?.id === player.id ? 0 : s.doublesCount,
          turnPhase: 'END_TURN' };
      });
      if (get().winner) return;
      if (debt.remainingPayments) resolvePayments(debt.remainingPayments);
      if (get().players[get().currentPlayerIndex].isBankrupt) get().endTurn();
    },

    endTurn: () => {
      const state = get();
      if (state.turnPhase !== 'END_TURN' || state.railroadRaid || state.pendingTrade || state.winner) return;

      const currentPlayer = state.players[state.currentPlayerIndex];

      // If current player rolled doubles, is not in Jail, and not bankrupt, they get another turn!
      if (state.doublesCount > 0 && !currentPlayer.inJail && !currentPlayer.isBankrupt) {
        addLog(`${currentPlayer.name} rolled doubles and takes another turn!`, 'info');
        set({ turnPhase: 'PRE_ROLL' });
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
      });
    },
  };
});
