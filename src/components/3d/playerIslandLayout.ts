type Point = [number, number, number];

export const ISLAND_SCALE = 1.24;
export const ISLAND_BASE_RADIUS = 2.99;
export const ISLAND_RADIUS = ISLAND_BASE_RADIUS * ISLAND_SCALE;
export const ISLAND_DISTANCE = 17.82;
export const ISLAND_SURFACE_Y = -.78;
export const ISLAND_BOARD_DOCK = 12.62;
export const ISLAND_BOARD_DOCK_Y = -.44;
export const ISLAND_DOCK = 3.54;
export const ISLAND_DOCK_Y = -.25;
export const STATUE_PLINTH_TOP = .43;

// The scene uses the same stable seat IDs in Solo and Online. Facing is in world space.
export const PLAYER_ISLANDS = [
  { seat: 0, edge: 'east', direction: [1, 0], statue: 'RoyalGriffin', facing: -.46 },
  { seat: 1, edge: 'north', direction: [0, -1], statue: 'RoyalUnicorn', facing: -.6 },
  { seat: 2, edge: 'west', direction: [-1, 0], statue: 'RoyalCarriage', facing: .58 },
  { seat: 3, edge: 'south', direction: [0, 1], statue: 'RoyalPegasus', facing: -.65 },
] as const;

export type PlayerIslandSite = typeof PLAYER_ISLANDS[number];

export function islandPosition({ direction: [x, z] }: PlayerIslandSite): Point {
  return [x * ISLAND_DISTANCE, ISLAND_SURFACE_Y, z * ISLAND_DISTANCE];
}

// Fit the round shores and landmarks individually, without fitting empty diagonal corners.
export const PLAYER_ISLAND_OVERVIEW_POINTS: Point[] = PLAYER_ISLANDS.flatMap(site => {
  const [x, y, z] = islandPosition(site);
  const points: Point[] = [[x, y - 2.65, z], [x, y + STATUE_PLINTH_TOP + 2.72 * ISLAND_SCALE, z]];
  const shore = ISLAND_RADIUS + .13;
  for (let step = 0; step < 16; step++) {
    const angle = step * Math.PI / 8;
    points.push([x + Math.cos(angle) * shore, y - .17, z + Math.sin(angle) * shore]);
  }
  return points;
});
