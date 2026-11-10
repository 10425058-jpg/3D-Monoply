export type EnvironmentQuality = 'low' | 'balanced' | 'high';
export type Vec3 = [number, number, number];
export interface Instance { position: Vec3; scale: Vec3; rotation?: Vec3; color?: string }
export const ENVIRONMENT_BUDGETS = {
  low: { trees: 240, houses: 22, peaks: 30, clouds: 22 },
  balanced: { trees: 650, houses: 40, peaks: 48, clouds: 36 },
  high: { trees: 1100, houses: 62, peaks: 66, clouds: 48 },
} as const;
// Deterministic scenery: never consume the game's random-number stream.
export const variation = (index: number, seed = 1) => {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
};
export const terrainHeight = (x: number, z: number) => -14 - Math.hypot(x, z) * 0.54 +
  Math.sin(x * 0.045) * Math.cos(z * 0.034) * 7 + Math.sin((x + z) * 0.07) * 3;
export const VILLAGE_SITES = [[-45, -63], [82, -34], [-68, 35], [45, 80]] as const;
export const CASTLE_SITES = [
  { x: 52, z: -78, size: 1, rise: 12 },
  { x: -70, z: -60, size: 0.64, rise: 9 },
  { x: 80, z: 48, size: 0.7, rise: 10 },
];
export const RIVER_POINTS: [number, number][] = [
  [-128, -110], [-91, -88], [-65, -68], [-43, -58], [-15, -65],
  [16, -77], [46, -74], [69, -60], [93, -40], [115, 3], [126, 52],
];
