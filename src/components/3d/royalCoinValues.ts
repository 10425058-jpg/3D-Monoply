export const COIN_VALUES = [1, 5, 10, 20, 50, 100, 500, 1000] as const;
export type CoinValue = typeof COIN_VALUES[number];

export function coinTier(value: CoinValue) {
  return value < 20 ? 'copper' : value < 500 ? 'silver' : 'gold';
}

/** Five pieces at most are visible in each physical stack. Counts retain the full decomposition. */
export function treasuryStacks(balance: number) {
  let remaining = Number.isFinite(balance) ? Math.max(0, Math.trunc(balance)) : 0;
  return [...COIN_VALUES].reverse().map(value => {
    const count = Math.floor(remaining / value);
    remaining -= value * count;
    return { value, count, visible: Math.min(5, count) };
  });
}

/** Greedy change, retaining the highest value pieces if the visual budget fills. */
export function coinPieces(amount: number, limit = 7): CoinValue[] {
  const pieces: CoinValue[] = [];
  for (const { value, count } of treasuryStacks(Math.abs(amount))) {
    for (let i = 0, available = Math.min(limit - pieces.length, count); i < available; i++) pieces.push(value);
    if (pieces.length >= limit) break;
  }
  return pieces;
}
