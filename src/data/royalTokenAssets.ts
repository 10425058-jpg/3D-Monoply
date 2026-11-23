import type { TokenType } from '../types/game';

export type RoyalTokenAsset = { name: string; file: string };

export const ROYAL_TOKEN_ASSETS = {
  racecar: { name: 'Royal Carriage', file: 'RoyalCarriage.glb' },
  cat: { name: 'Royal Unicorn', file: 'RoyalUnicorn.glb' },
  top_hat: { name: 'Royal Pegasus', file: 'RoyalPegasus.glb' },
  rubber_duck: { name: 'Royal Griffin', file: 'RoyalGriffin.glb' },
} as const satisfies Partial<Record<TokenType, RoyalTokenAsset>>;

const assets: Partial<Record<TokenType, RoyalTokenAsset>> = ROYAL_TOKEN_ASSETS;
export const royalTokenAsset = (token: TokenType) => assets[token];
