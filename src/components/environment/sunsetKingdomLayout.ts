import type { EnvironmentPlacement } from './GltfEnvironmentModel';

export const LEFT_ISLAND: EnvironmentPlacement = { position: [-29,-24,-20], scale: 1.3, rotation: .6 };
export const RIGHT_ISLAND: EnvironmentPlacement = { position: [28,-22,-20], scale: 1.3, rotation: .16 };
export const FAR_LEFT: EnvironmentPlacement[] = [{ position: [-46,-42,-91], scale: .5, rotation: .4 },
  { position: [35,-51,-115], scale: .36, rotation: -.65 }];
export const FAR_RIGHT: EnvironmentPlacement[] = [{ position: [71,-54,-104], scale: .48, rotation: -.3 }];
export const LOW_FAR_LEFT = FAR_LEFT.slice(0, 1);

/** Fixed scenery around the full orbit. The distant upper tier makes a skyline;
 * the lower gardens frame the board without crossing its playable column. */
export const SUNSET_KINGDOM = {
  'crown-foundation': [{ position: [0, 0, 0], scale: 1 }],
  'royal-garden-dressing': [LEFT_ISLAND,RIGHT_ISLAND],
  'royal-island-citadel': [
    { position: [-36, -24.5, -65], scale: 1.52, rotation: .13 },
    { position: [9, -23, 98], scale: 1.25, rotation: 3.0 },
    { position: [-71, -24, -37], scale: 1.15, rotation: 1.3 },
  ],
  'sky-windmill': [
    { position: [28, -28, -110], scale: 1.65, rotation: -.18 },
    { position: [-74, -18, 18], scale: 1.2, rotation: 1.65 },
    { position: [50, -24, 68], scale: 1.2, rotation: -2.9 },
  ],
  'sky-garden': [
    { position: [38, -23, -68], scale: 1.6, rotation: -.20 },
    { position: [33, -27, 5], scale: 1.30, rotation: -.8 },
    { position: [-35, -31, 9], scale: 1.15, rotation: 1.1 },
    { position: [-48, -26, 64], scale: 1.15, rotation: 2.5 },
  ],
} satisfies Record<string, EnvironmentPlacement[]>;

export type SunsetLandmark = keyof typeof SUNSET_KINGDOM;
