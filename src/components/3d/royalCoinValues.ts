export const COIN_VALUES = [1, 5, 10, 20, 50, 100, 500, 1000] as const;
export type CoinValue = typeof COIN_VALUES[number];

export function coinTier(value: CoinValue) {
  return value < 20 ? 'copper' : value < 500 ? 'silver' : 'gold';
}

/** Greedy change, retaining the highest value pieces if the visual budget fills. */
export function coinPieces(amount: number, limit = 7): CoinValue[] {
  let remaining = Math.trunc(Math.abs(amount));
  const pieces: CoinValue[] = [];
  if (!Number.isFinite(remaining)) return pieces;
  for (const value of [...COIN_VALUES].reverse()) {
    const count = Math.min(Math.floor(remaining / value), limit - pieces.length);
    for (let i = 0; i < count; i++) pieces.push(value);
    remaining -= count * value;
    if (!remaining || pieces.length >= limit) break;
  }
  return pieces;
}
