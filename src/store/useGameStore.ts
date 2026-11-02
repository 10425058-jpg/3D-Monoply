import { create } from 'zustand';
import {
  BoardSpace,
  CameraMode,
  ColorGroup,
  DeckCard,
  LogEntry,
  Player,
  PropertyState,
  RailroadRaid,
  TokenType,
  TradeOffer,
  TurnPhase,
} from '../types/game';
import { BOARD_SPACES, COLOR_GROUP_TOTALS } from '../data/boardData';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../data/cardsData';
import confetti from 'canvas-confetti';

interface PlayerSetupConfig {
  name: string;
  isAI: boolean;
  token: TokenType;
  color: string;
}

interface GameStore {
  players: Player[];
  properties: Record<number, PropertyState>;
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  dice: [number, number];
  doublesCount: number;
  chanceDeck: DeckCard[];
  chestDeck: DeckCard[];
  activeCard: DeckCard | null;
  selectedSpaceId: number | null;
  cameraMode: CameraMode;
  logs: LogEntry[];
  pendingDebt: { amount: number; creditorId: number | null; reason: string } | null;
  railroadRaid: RailroadRaid | null;
  winner: Player | null;
  isRulebookOpen: boolean;
  isTradeModalOpen: boolean;
  isSetupModalOpen: boolean;

  // Actions
  startNewGame: (configs: PlayerSetupConfig[]) => void;
  setCameraMode: (mode: CameraMode) => void;
  selectSpace: (spaceId: number | null) => void;
  setRulebookOpen: (open: boolean) => void;
  setTradeModalOpen: (open: boolean) => void;
  setSetupModalOpen: (open: boolean) => void;

  // Core Gameplay Actions
  rollDice: () => void;
  upgradeLandmark: () => void;
  startBankHeist: () => void;
  resolveBankHeist: (vaultIndex: number) => void;
  shutdownLandmark: (targetPlayerId: number) => void;
  skipRailroadRaid: () => void;
  payJailBail: () => void;
  useJailCard: () => void;
  buyCurrentProperty: () => void;
  declineProperty: () => void;
  applyActiveCard: () => void;
  buildHouse: (spaceId: number) => void;
  sellHouse: (spaceId: number) => void;
  toggleMortgage: (spaceId: number) => void;
  proposeTrade: (offer: TradeOffer) => { accepted: boolean; message: string };
  settlePendingDebt: () => void;
  declareBankruptcy: () => void;
  endTurn: () => void;

  // Helpers
  canBuildHouse: (playerId: number, spaceId: number) => boolean;
  canSellHouse: (playerId: number, spaceId: number) => boolean;
  calculateRent: (spaceId: number, diceTotal: number) => number;
  landmarkUpgradeCost: (playerId: number) => number;
  ownsFullGroup: (playerId: number, group: ColorGroup) => boolean;
}

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
  { name: 'You (Tycoon)', isAI: false, token: 'top_hat', color: '#10b981' },
  { name: 'Victoria AI', isAI: true, token: 'racecar', color: '#ef4444' },
  { name: 'Arthur AI', isAI: true, token: 'scottie_dog', color: '#3b82f6' },
  { name: 'Elena AI', isAI: true, token: 'yacht', color: '#f59e0b' },
];

export const useGameStore = create<GameStore>((set, get) => {
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      type,
    };
    set((state) => ({ logs: [entry, ...state.logs.slice(0, 79)] }));
  };

  const openRailroadRaid = (attackerId: number) => {
    const vaultRewards = shuffleDeck([150, 300, 550]) as [number, number, number];
    set({ railroadRaid: { attackerId, mode: 'choose', vaultRewards } });
    addLog('Railroad bonus unlocked: choose a Bank Heist or shut down a rival landmark.', 'card');
  };

  const stepMovePlayer = (playerIndex: number, totalSteps: number, onComplete: () => void) => {
    let remaining = Math.abs(totalSteps);
    const direction = totalSteps >= 0 ? 1 : -1;

    const tick = () => {
      if (remaining <= 0) {
        onComplete();
        return;
      }
      set((state) => {
        const updated = [...state.players];
        const player = { ...updated[playerIndex] };
        const prevPos = player.position;
        const nextPos = (prevPos + direction + 40) % 40;
        player.position = nextPos;

        // Collect $200 when passing or landing on GO moving forward
        if (direction > 0 && nextPos === 0) {
          const goReward = 200 + player.landmarkLevel * 50;
          player.money += goReward;
          addLog(`${player.name} passed GO and collected ${goReward} (including landmark income)!`, 'money');
        }
        updated[playerIndex] = player;
        return { players: updated };
      });
      remaining -= 1;
      setTimeout(tick, 155);
    };

    tick();
  };

  const evaluateLandedSpace = () => {
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
        addLog(`${player.name} paid $${tax} for ${space.name}.`, 'money');
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
      deck.push(drawnCard);

      set({
        chanceDeck: isChance ? deck : state.chanceDeck,
        chestDeck: !isChance ? deck : state.chestDeck,
        activeCard: drawnCard,
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
    const rent = get().calculateRent(space.id, diceTotal);
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
      addLog(`${player.name} paid ${rent} rent to ${owner.name} for ${space.name}.`, 'money');
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
    selectedSpaceId: null,
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
    railroadRaid: null,
    winner: null,
    isRulebookOpen: false,
    isTradeModalOpen: false,
    isSetupModalOpen: false,

    startNewGame: (configs) => {
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
        players: newPlayers,
        properties: createInitialProperties(),
        currentPlayerIndex: 0,
        turnPhase: 'PRE_ROLL',
        dice: [1, 1],
        doublesCount: 0,
        chanceDeck: shuffleDeck(CHANCE_CARDS),
        chestDeck: shuffleDeck(COMMUNITY_CHEST_CARDS),
        activeCard: null,
        selectedSpaceId: null,
        pendingDebt: null,
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
      const state = get();
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      if (!space || !prop || space.type !== 'property') return false;
      if (prop.ownerId !== playerId || prop.houses <= 0) return false;

      const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === space.colorGroup);
      const maxHouses = Math.max(...groupSpaces.map((s) => state.properties[s.id]?.houses ?? 0));
      return prop.houses === maxHouses;
    },

    rollDice: () => {
      const state = get();
      if (state.turnPhase !== 'PRE_ROLL') return;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const isDoubles = d1 === d2;
      const total = d1 + d2;
      const player = state.players[state.currentPlayerIndex];

      set({ dice: [d1, d2], turnPhase: 'ROLLING' });

      setTimeout(() => {
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
            addLog(`${activePlayer.name} spent 3 turns in Jail, paid $50 bail, and moves ${total} spaces.`, 'alert');
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
            stepMovePlayer(currentState.currentPlayerIndex, total, evaluateLandedSpace);
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
      }, 650);
    },

    landmarkUpgradeCost: (playerId) => {
      const player = get().players.find((candidate) => candidate.id === playerId);
      if (!player || player.landmarkLevel >= 5) return Infinity;
      return 400 + player.landmarkLevel * 350;
    },

    upgradeLandmark: () => {
      const state = get();
      const player = state.players[state.currentPlayerIndex];
      if (!player || player.isAI || player.isBankrupt || player.landmarkLevel >= 5) return;
      const cost = get().landmarkUpgradeCost(player.id);
      if (player.money < cost) return;
      set((current) => ({
        players: current.players.map((candidate) =>
          candidate.id === player.id
            ? { ...candidate, money: candidate.money - cost, landmarkLevel: candidate.landmarkLevel + 1 }
            : candidate
        ),
      }));
      addLog(`${player.name} upgraded their city landmark to level ${player.landmarkLevel + 1} for ${cost}.`, 'property');
    },

    startBankHeist: () => {
      const raid = get().railroadRaid;
      if (!raid || raid.mode !== 'choose') return;
      set({ railroadRaid: { ...raid, mode: 'heist' } });
      addLog('Bank Heist started! Pick one of three vaults.', 'card');
    },

    resolveBankHeist: (vaultIndex) => {
      const state = get();
      const raid = state.railroadRaid;
      if (!raid || raid.mode !== 'heist' || vaultIndex < 0 || vaultIndex > 2) return;
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
      addLog(`${attacker.name} cracked vault ${vaultIndex + 1} and stole ${reward} from the bank!`, 'money');
    },

    shutdownLandmark: (targetPlayerId) => {
      const state = get();
      const raid = state.railroadRaid;
      if (!raid || raid.mode !== 'choose' || raid.attackerId === targetPlayerId) return;
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
        addLog(`${attacker.name} raided ${target.name}'s empty landmark site and stole ${stolen}.`, 'alert');
      }
    },

    skipRailroadRaid: () => {
      if (!get().railroadRaid) return;
      set({ railroadRaid: null });
    },
    payJailBail: () => {
      const state = get();
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
      addLog(`${player.name} paid $50 bail and is released from Jail.`, 'money');
    },

    useJailCard: () => {
      const state = get();
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || player.getOutOfJailCards <= 0 || state.turnPhase !== 'PRE_ROLL') return;

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          getOutOfJailCards: player.getOutOfJailCards - 1,
          inJail: false,
          jailTurns: 0,
        };
        return { players };
      });
      addLog(`${player.name} used a "Get Out of Jail Free" card!`, 'card');
    },

    buyCurrentProperty: () => {
      const state = get();
      if (state.turnPhase !== 'LANDED_ACTION') return;

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

      addLog(`${player.name} purchased ${space.name} for ${space.price}!`, 'property');
      if (space.type === 'railroad') openRailroadRaid(player.id);
    },

    declineProperty: () => {
      const state = get();
      if (state.turnPhase !== 'LANDED_ACTION') return;
      const player = state.players[state.currentPlayerIndex];
      const space = BOARD_SPACES[player.position];
      addLog(`${player.name} passed on buying ${space.name}.`, 'info');
      set({ turnPhase: 'END_TURN' });
      if (space.type === 'railroad') openRailroadRaid(player.id);
    },

    applyActiveCard: () => {
      const state = get();
      const card = state.activeCard;
      if (!card || state.turnPhase !== 'CARD_DRAWN') return;

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
          addLog(`${player.name} collected $${amt}.`, 'money');
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
            addLog(`${player.name} paid $${amt}.`, 'money');
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
            return { players, turnPhase: 'END_TURN' };
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
          stepMovePlayer(playerIndex, steps, evaluateLandedSpace);
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
            addLog(`${player.name} paid $${totalCost} for street & property repairs.`, 'money');
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
          const totalNeeded = perPlayer * activeOthers.length;
          if (player.money >= totalNeeded) {
            set((s) => {
              const players = s.players.map((p) => {
                if (p.id === player.id) return { ...p, money: p.money - totalNeeded };
                if (!p.isBankrupt) return { ...p, money: p.money + perPlayer };
                return p;
              });
              return { players, turnPhase: 'END_TURN' };
            });
            addLog(`${player.name} paid $${perPlayer} to each player ($${totalNeeded} total).`, 'money');
          } else {
            set({
              pendingDebt: { amount: totalNeeded, creditorId: null, reason: card.title },
              turnPhase: 'DEBT_RESOLUTION',
            });
          }
          break;
        }
        case 'collect_from_each_player': {
          const perPlayer = card.amount || 10;
          let collected = 0;
          set((s) => {
            const players = s.players.map((p) => {
              if (!p.isBankrupt && p.id !== player.id) {
                const gift = Math.min(p.money, perPlayer);
                collected += gift;
                return { ...p, money: p.money - gift };
              }
              return p;
            });
            players[playerIndex] = {
              ...players[playerIndex],
              money: players[playerIndex].money + collected,
            };
            return { players, turnPhase: 'END_TURN' };
          });
          addLog(`${player.name} collected $${collected} in birthday gifts!`, 'money');
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

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          money: player.money - (space.houseCost || 100),
        };
        const properties = {
          ...s.properties,
          [spaceId]: { ...prop, houses: newLevel },
        };
        return { players, properties };
      });

      addLog(
        `${player.name} built a ${newLevel === 5 ? 'HOTEL' : `House (#${newLevel})`} on ${space.name} for $${space.houseCost}.`,
        'property'
      );
    },

    sellHouse: (spaceId) => {
      const state = get();
      const player = state.players[state.currentPlayerIndex];
      if (!get().canSellHouse(player.id, spaceId)) return;

      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      const refund = Math.floor((space.houseCost || 100) / 2);

      set((s) => {
        const players = [...s.players];
        players[s.currentPlayerIndex] = {
          ...players[s.currentPlayerIndex],
          money: player.money + refund,
        };
        const properties = {
          ...s.properties,
          [spaceId]: { ...prop, houses: prop.houses - 1 },
        };
        return { players, properties };
      });

      addLog(`${player.name} sold a building on ${space.name} for $${refund}.`, 'money');
    },

    toggleMortgage: (spaceId) => {
      const state = get();
      const player = state.players[state.currentPlayerIndex];
      const space = BOARD_SPACES[spaceId];
      const prop = state.properties[spaceId];
      if (!space || !prop || prop.ownerId !== player.id || !space.mortgageValue) return;

      if (!prop.isMortgaged) {
        // Cannot mortgage if any property in the color group has houses
        const groupSpaces = BOARD_SPACES.filter((s) => s.colorGroup === space.colorGroup);
        if (groupSpaces.some((s) => (state.properties[s.id]?.houses ?? 0) > 0)) return;

        set((s) => {
          const players = [...s.players];
          players[s.currentPlayerIndex] = {
            ...players[s.currentPlayerIndex],
            money: player.money + space.mortgageValue!,
          };
          const properties = {
            ...s.properties,
            [spaceId]: { ...prop, isMortgaged: true },
          };
          return { players, properties };
        });
        addLog(`${player.name} mortgaged ${space.name} for $${space.mortgageValue}.`, 'money');
      } else {
        const unmortgageCost = Math.ceil(space.mortgageValue * 1.1);
        if (player.money < unmortgageCost) return;

        set((s) => {
          const players = [...s.players];
          players[s.currentPlayerIndex] = {
            ...players[s.currentPlayerIndex],
            money: player.money - unmortgageCost,
          };
          const properties = {
            ...s.properties,
            [spaceId]: { ...prop, isMortgaged: false },
          };
          return { players, properties };
        });
        addLog(`${player.name} unmortgaged ${space.name} for $${unmortgageCost}.`, 'property');
      }
    },

    proposeTrade: (offer) => {
      const state = get();
      const fromPlayer = state.players.find((p) => p.id === offer.fromPlayerId);
      const toPlayer = state.players.find((p) => p.id === offer.toPlayerId);
      if (!fromPlayer || !toPlayer) return { accepted: false, message: 'Invalid players.' };

      if (fromPlayer.money < offer.offerCash || toPlayer.money < offer.requestCash) {
        return { accepted: false, message: 'Insufficient cash for this trade.' };
      }

      // Calculate fair value for AI evaluation
      const offeredPropVal = offer.offerProperties.reduce(
        (sum, id) => sum + (BOARD_SPACES[id].price || 150),
        0
      );
      const requestedPropVal = offer.requestProperties.reduce(
        (sum, id) => sum + (BOARD_SPACES[id].price || 150),
        0
      );

      const totalOfferedValue = offer.offerCash + offeredPropVal;
      const totalRequestedValue = offer.requestCash + requestedPropVal;

      if (toPlayer.isAI && totalOfferedValue < totalRequestedValue * 0.95) {
        return {
          accepted: false,
          message: `${toPlayer.name} declined the trade: "I need at least equal value ($${totalRequestedValue}) to accept!"`,
        };
      }

      // Execute trade
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
          if (properties[id]) properties[id] = { ...properties[id], ownerId: toPlayer.id };
        });
        offer.requestProperties.forEach((id) => {
          if (properties[id]) properties[id] = { ...properties[id], ownerId: fromPlayer.id };
        });

        return { players, properties };
      });

      addLog(`Trade completed between ${fromPlayer.name} and ${toPlayer.name}!`, 'property');
      return { accepted: true, message: `${toPlayer.name} accepted your trade offer!` };
    },

    settlePendingDebt: () => {
      const state = get();
      const debt = state.pendingDebt;
      const player = state.players[state.currentPlayerIndex];
      if (!debt || player.money < debt.amount) return;

      set((s) => {
        const players = s.players.map((p) => {
          if (p.id === player.id) return { ...p, money: p.money - debt.amount };
          if (debt.creditorId !== null && p.id === debt.creditorId) {
            return { ...p, money: p.money + debt.amount };
          }
          return p;
        });
        return { players, pendingDebt: null, turnPhase: 'END_TURN' };
      });

      addLog(`${player.name} settled their $${debt.amount} debt (${debt.reason}).`, 'money');
    },

    declareBankruptcy: () => {
      const state = get();
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      const creditorId = state.pendingDebt?.creditorId ?? null;

      addLog(`${player.name} has declared BANKRUPTCY and is eliminated!`, 'alert');

      set((s) => {
        const players = s.players.map((p) => {
          if (p.id === player.id) {
            return { ...p, money: 0, isBankrupt: true, landmarkLevel: 0 };
          }
          if (creditorId !== null && p.id === creditorId) {
            return { ...p, money: p.money + Math.max(0, player.money) };
          }
          return p;
        });

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
          confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
          return {
            players,
            properties,
            pendingDebt: null,
            winner: remainingPlayers[0],
            turnPhase: 'GAME_OVER',
          };
        }

        return { players, properties, pendingDebt: null, doublesCount: 0, turnPhase: 'END_TURN' };
      });
    },

    endTurn: () => {
      const state = get();
      if (state.turnPhase !== 'END_TURN') return;

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
