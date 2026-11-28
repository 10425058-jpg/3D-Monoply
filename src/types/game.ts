export type SpaceType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export type ColorGroup =
  | 'brown'
  | 'light_blue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'dark_blue'
  | 'railroad'
  | 'utility'
  | 'none';

export type TokenType = 'top_hat' | 'racecar' | 'scottie_dog' | 'yacht' | 'rubber_duck' | 'cat';
export type SoloRuleset = 'classic' | 'arcade';
export type ArcadeLevel = 0 | 1 | 2 | 3;

export interface BoardSpace {
  id: number;
  name: string;
  shortName: string;
  type: SpaceType;
  colorGroup: ColorGroup;
  colorHex: string;
  price?: number;
  rent?: number[]; // [base, 1H, 2H, 3H, 4H, Hotel]
  houseCost?: number;
  mortgageValue?: number;
  taxAmount?: number;
}

export interface PropertyState {
  spaceId: number;
  ownerId: number | null;
  houses: number; // 0-4 houses, 5 = Hotel
  isMortgaged: boolean;
  developmentLevel?: ArcadeLevel;
}

export interface Player {
  id: number;
  name: string;
  isAI: boolean;
  token: TokenType;
  color: string;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  landmarkLevel: number;
}

export interface RailroadRaid {
  attackerId: number;
  mode: 'choose' | 'heist';
  vaultRewards: [number, number, number];
}

export interface PropertyAuction {
  spaceId: number;
  currentBid: number;
  highestBidderId: number | null;
  currentBidderId: number | null;
  passedPlayerIds: number[];
}

export type CardActionType =
  | 'collect'
  | 'pay'
  | 'move_to'
  | 'move_relative'
  | 'nearest_utility'
  | 'nearest_railroad'
  | 'go_to_jail'
  | 'get_out_of_jail'
  | 'repairs'
  | 'pay_each_player'
  | 'collect_from_each_player';

export interface DeckCard {
  id: string;
  deck: 'chance' | 'chest';
  title: string;
  description: string;
  actionType: CardActionType;
  amount?: number;
  targetSpaceId?: number;
  steps?: number;
  perHouse?: number;
  perHotel?: number;
}

export type TurnPhase =
  | 'SETUP'
  | 'PRE_ROLL'
  | 'ROLLING'
  | 'MOVING'
  | 'LANDED_ACTION'
  | 'CARD_PENDING'
  | 'CARD_DRAWN'
  | 'DEBT_RESOLUTION'
  | 'AUCTION'
  | 'END_TURN'
  | 'GAME_OVER';

export type CameraMode = 'isometric' | 'top' | 'follow' | 'city';

export interface CashTransfer {
  fromId: number | null;
  toId: number | null;
  amount: number;
  reason: string;
  category: 'purchase' | 'auction' | 'rent' | 'salary' | 'tax' | 'card' | 'mortgage' | 'construction' | 'trade' | 'jail' | 'landmark' | 'bonus' | 'debt';
  spaceId?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'money' | 'property' | 'alert' | 'card';
  transfers?: readonly CashTransfer[];
}

export interface TradeOffer {
  proposalId?: string;
  fromPlayerId: number;
  toPlayerId: number;
  offerCash: number;
  requestCash: number;
  offerProperties: number[];
  requestProperties: number[];
}


export interface MetaProgress {
  lastDailyClaimDate: string | null;
  dailyStreak: number;
  lastWheelSpinDate: string | null;
  stickers: Record<string, number>;
  stickerStars: number;
  stickerPacks: number;
  missionDate: string;
  missionProgress: {
    rolls: number;
    purchases: number;
    railroadEvents: number;
  };
  missionClaimed: string[];
  albumBonusClaimed: boolean;
}

export interface StickerPackResult {
  stickers: string[];
  duplicateCount: number;
}
