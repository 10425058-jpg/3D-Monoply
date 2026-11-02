export type MissionId = 'roll-dice' | 'buy-property' | 'railroad-event';

export type MissionStat = 'rolls' | 'purchases' | 'railroadEvents';

export interface DailyMission {
  id: MissionId;
  title: string;
  description: string;
  target: number;
  stat: MissionStat;
  cashReward: number;
  packReward: number;
}

export interface DailyReward {
  day: number;
  cash: number;
  packs: number;
}

export interface WheelReward {
  id: string;
  label: string;
  kind: 'cash' | 'pack';
  amount: number;
}

export interface StickerDefinition {
  id: string;
  name: string;
  set: string;
  emoji: string;
  rarity: 'Common' | 'Rare' | 'Epic';
}

export const DAILY_REWARD_CYCLE: DailyReward[] = [
  { day: 1, cash: 100, packs: 0 },
  { day: 2, cash: 150, packs: 0 },
  { day: 3, cash: 200, packs: 0 },
  { day: 4, cash: 250, packs: 0 },
  { day: 5, cash: 300, packs: 0 },
  { day: 6, cash: 400, packs: 0 },
  { day: 7, cash: 600, packs: 1 },
];

export const LUCKY_WHEEL_REWARDS: WheelReward[] = [
  { id: 'cash-100', label: '$100', kind: 'cash', amount: 100 },
  { id: 'cash-200', label: '$200', kind: 'cash', amount: 200 },
  { id: 'cash-350', label: '$350', kind: 'cash', amount: 350 },
  { id: 'cash-500', label: '$500', kind: 'cash', amount: 500 },
  { id: 'cash-750', label: '$750', kind: 'cash', amount: 750 },
  { id: 'sticker-pack', label: 'Sticker Pack', kind: 'pack', amount: 1 },
];

export const DAILY_MISSIONS: DailyMission[] = [
  {
    id: 'roll-dice',
    title: 'Take a chance',
    description: 'Roll the dice 3 times.',
    target: 3,
    stat: 'rolls',
    cashReward: 150,
    packReward: 0,
  },
  {
    id: 'buy-property',
    title: 'Property investor',
    description: 'Purchase 1 property.',
    target: 1,
    stat: 'purchases',
    cashReward: 200,
    packReward: 0,
  },
  {
    id: 'railroad-event',
    title: 'Railroad business',
    description: 'Complete 1 Bank Heist or Shutdown.',
    target: 1,
    stat: 'railroadEvents',
    cashReward: 250,
    packReward: 1,
  },
];

export const STICKER_COLLECTION: StickerDefinition[] = [
  { id: 'skyline-01', name: 'First Light', set: 'City Lights', emoji: '🌇', rarity: 'Common' },
  { id: 'skyline-02', name: 'Glass Tower', set: 'City Lights', emoji: '🏙️', rarity: 'Common' },
  { id: 'skyline-03', name: 'Golden Avenue', set: 'City Lights', emoji: '🌃', rarity: 'Rare' },
  { id: 'skyline-04', name: 'City Tram', set: 'City Lights', emoji: '🚋', rarity: 'Common' },
  { id: 'skyline-05', name: 'Grand Hotel', set: 'City Lights', emoji: '🏨', rarity: 'Rare' },
  { id: 'skyline-06', name: 'Night Crown', set: 'City Lights', emoji: '👑', rarity: 'Epic' },
  { id: 'park-01', name: 'Ferris Glow', set: 'Wonder Park', emoji: '🎡', rarity: 'Common' },
  { id: 'park-02', name: 'Roller Rush', set: 'Wonder Park', emoji: '🎢', rarity: 'Rare' },
  { id: 'park-03', name: 'Carousel', set: 'Wonder Park', emoji: '🎠', rarity: 'Common' },
  { id: 'park-04', name: 'Circus Night', set: 'Wonder Park', emoji: '🎪', rarity: 'Common' },
  { id: 'park-05', name: 'Fireworks', set: 'Wonder Park', emoji: '🎆', rarity: 'Rare' },
  { id: 'park-06', name: 'Magic Ticket', set: 'Wonder Park', emoji: '🎟️', rarity: 'Epic' },
  { id: 'royal-01', name: 'Treasure Vault', set: 'Royal Fortune', emoji: '💰', rarity: 'Common' },
  { id: 'royal-02', name: 'Golden Key', set: 'Royal Fortune', emoji: '🗝️', rarity: 'Common' },
  { id: 'royal-03', name: 'Royal Train', set: 'Royal Fortune', emoji: '🚂', rarity: 'Rare' },
  { id: 'royal-04', name: 'Diamond', set: 'Royal Fortune', emoji: '💎', rarity: 'Rare' },
  { id: 'royal-05', name: 'Crown Jewel', set: 'Royal Fortune', emoji: '👸', rarity: 'Epic' },
  { id: 'royal-06', name: 'Tycoon Legend', set: 'Royal Fortune', emoji: '🏆', rarity: 'Epic' },
];
