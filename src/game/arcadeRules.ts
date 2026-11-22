import { BOARD_SPACES } from '../data/boardData';
import type { ArcadeLevel, BoardSpace, DeckCard, PropertyState } from '../types/game';

export const ARCADE_STAGES = [
  { name: 'Land', costMultiplier: 0, rentIndex: 0, repairHouses: 0, repairHotels: 0,
    description: 'An owned plot ready for development.' },
  { name: 'House', costMultiplier: 1, rentIndex: 1, repairHouses: 1, repairHotels: 0,
    description: 'A miniature home with its first rent increase.' },
  { name: 'Apartment', costMultiplier: 2, rentIndex: 3, repairHouses: 3, repairHotels: 0,
    description: 'A multi-floor residence with higher rent.' },
  { name: 'Hotel', costMultiplier: 3, rentIndex: 5, repairHouses: 0, repairHotels: 1,
    description: 'A grand hotel at the highest rent tier.' },
] as const;

export const ARCADE_LIQUIDATION_FRACTION = 0.5;
const nextLevels = [1, 2, 3, undefined] as const;
const previousLevels = [0, 0, 1, 2] as const;

export const arcadeLevel = (property?: PropertyState): ArcadeLevel => {
  const level = property?.developmentLevel;
  return level === 1 || level === 2 || level === 3 ? level : 0;
};
export const arcadeNextLevel = (level: ArcadeLevel) => nextLevels[level];
export const arcadePreviousLevel = (level: ArcadeLevel) => previousLevels[level];
export const arcadeUpgradeCost = (street: BoardSpace, level: ArcadeLevel) =>
  level === 0 ? street.price! : ARCADE_STAGES[level].costMultiplier * street.houseCost!;
export const arcadeRent = (street: BoardSpace, level: ArcadeLevel) => street.rent![ARCADE_STAGES[level].rentIndex];
export const arcadeSellRefund = (street: BoardSpace, level: ArcadeLevel) =>
  level === 0 ? 0 : Math.floor(arcadeUpgradeCost(street, level) * ARCADE_LIQUIDATION_FRACTION);

export function arcadeDevelopmentValue(street: BoardSpace, level: ArcadeLevel) {
  const stages = [1, 2, 3] as const;
  return stages.filter(stage => stage <= level).reduce((total, stage) => total + arcadeSellRefund(street, stage), 0);
}

export function arcadeRepairCharge(card: DeckCard, level: ArcadeLevel) {
  const { repairHouses, repairHotels } = ARCADE_STAGES[level];
  return repairHouses * (card.perHouse || 25) + repairHotels * (card.perHotel || 100);
}

export function validateArcadeCatalog(spaces: readonly BoardSpace[]) {
  for (const street of spaces.filter(space => space.type === 'property')) {
    if (!Number.isSafeInteger(street.price) || street.price! <= 0 ||
      !Number.isSafeInteger(street.houseCost) || street.houseCost! <= 0 ||
      ARCADE_STAGES.some(({ rentIndex }) => !Number.isSafeInteger(street.rent?.[rentIndex]) || street.rent![rentIndex] <= 0)) {
      throw new Error(`Missing Arcade price, building cost, or rent tier for ${street.name}`);
    }
  }
}

validateArcadeCatalog(BOARD_SPACES);
