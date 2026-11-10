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
const smoothRange = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};
const foreground = (z: number) => smoothRange(-16, 42, z);

// Keep the rear valley/horizon intact; lower and flatten only the nearer apron.
export const terrainHeight = (x: number, z: number) => {
  const radius = Math.hypot(x, z), front = foreground(z);
  const apron = 1 - smoothRange(64, 150, radius);
  return -14 - radius * .54 - front * apron * 20 +
    Math.sin(x * .045) * Math.cos(z * .034) * 7 * (1 - front * .65) +
    Math.sin((x + z) * .07) * 3 * (1 - front * .6);
};

// The old 30-unit circular cutout exposed a hard, mound-shaped sky/terrain seam.
// Open the foreground outward and dissolve its rim into the sky, instead.
export const terrainInnerRadius = (angle: number) => 30 + Math.sin(angle * 3) * 3 +
  Math.cos(angle * 7) * 2 + smoothRange(-.25, .65, Math.cos(angle)) * 38;
export const terrainOpacity = (x: number, z: number) => {
  const inner = terrainInnerRadius(Math.atan2(x, z));
  return smoothRange(inner, inner + 28, Math.hypot(x, z));
};

export interface CloudLayout { position: Vec3; size: [number, number] }
export function cloudLayout(quality: EnvironmentQuality): CloudLayout[] {
  const entries: CloudLayout[] = [];
  for (let i = 0; i < ENVIRONMENT_BUDGETS[quality].clouds; i++) {
    const near = i < 12, angle = i * 2.399963;
    const front = smoothRange(-.25, .65, Math.cos(angle));
    const radius = near ? 44 + variation(i, 21) * 14 + front * 18 : 64 + variation(i, 22) * 84 + front * 14;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    entries.push({ position: [x, near ? -26 - variation(i, 23) * 6 - front * 8 : terrainHeight(x, z) + 6, z],
      size: near ? [13 + variation(i, 24) * 6, 3 + variation(i, 25) * 1.2] : [17 + variation(i, 26) * 9, 4.5 + variation(i, 27) * 2.5] });
  }
  for (const site of CASTLE_SITES) {
    const length = Math.hypot(site.x, site.z);
    const x = site.x - site.x / length * 8.5 * site.size, z = site.z - site.z / length * 8.5 * site.size;
    entries.push({ position: [x, terrainHeight(x, z) + .6, z], size: [6 * site.size, 2.6 * site.size] });
  }
  // No billboards directly underneath the board: this space remains open air.
  return entries;
}
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
