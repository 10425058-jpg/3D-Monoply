import { getSpaceTransform } from '../../data/boardData';
import { smoothStep, tileActorHeight } from '../../presentation/animationMath';

export const ARCADE_PROPERTY_STAGES = ['land', 'house', 'apartment', 'hotel'] as const;
export const OWNER_PENNANT_MATERIAL = 'Arcade owner pennant';

/** The lot starts over the color strip, behind the printed name and token lanes. */
export function arcadePlotPlacement(spaceId: number, hovered: number | null, selected: number | null) {
  const tile = getSpaceTransform(spaceId);
  const inward = tile.depth / 2 - .363;
  const position: [number, number, number] = [
    tile.position[0] + tile.innerStripDirection[0] * inward,
    tileActorHeight(spaceId, hovered, selected) + .018,
    tile.position[2] + tile.innerStripDirection[2] * inward,
  ];
  return { position, rotationY: tile.rotationY };
}

export const arcadePropertyAsset = (stage: typeof ARCADE_PROPERTY_STAGES[number], extension: 'glb' | 'png') =>
  `assets/models/arcade-properties/${stage}.${extension}`;

export const CONSTRUCTION_MS = 635;
export const HOTEL_CONSTRUCTION_MS = 845;
export const ARCADE_CONSTRUCTION_MS = [470, CONSTRUCTION_MS, 735, HOTEL_CONSTRUCTION_MS] as const;
const STAGE_START = [[.99, .8, 0], [.96, .18, .16], [.95, .23, .09], [.94, .29, .12]] as const;

/** Wall-clock progress prevents resuming a completed reveal after backgrounding. */
export function arcadeConstructionPose(elapsed: number, duration: number, level = 1) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const [width, height, hold] = STAGE_START[level] ?? STAGE_START[1];
  const rise = smoothStep((t - hold) / (1 - hold));
  return {
    t,
    width: width + rise * (1 - width),
    height: height + rise * (1 - height),
  };
}
