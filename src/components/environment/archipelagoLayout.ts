import type { EnvironmentPlacement } from './GltfEnvironmentModel';

/** World-fixed destinations on the same skyway. Rear landmarks read in the
 * lower gameplay angle; the nearer pair frames the steep overview. The southern
 * sanctuary completes the reverse orbit. No placement follows the camera. */
export const ARCHIPELAGO = {
  observatory: [
    { position: [-64, -30, -91], scale: 1.05, rotation: -.12 },
    { position: [30, -29, 0], scale: 1.12, rotation: -.4 },
    // Seen above the board in a tall phone viewport. In the closer desktop
    // overview it naturally passes behind the board, rather than following it.
    { position: [0, -45, -43], scale: .95, rotation: .45 },
    { position: [65, -16, 25], scale: .95, rotation: -1.4 },
  ],
  ruins: [
    { position: [55, -28, -108], scale: .95, rotation: .18 },
    { position: [-28, -30, 0], scale: 1.16, rotation: .3 },
    { position: [57, -27, 95], scale: 1.25, rotation: 2.4 },
  ],
  hamlet: [
    { position: [-17, -31, -101], scale: 1.05, rotation: .12 },
    { position: [48, -34, -36], scale: 1.05, rotation: -.32 },
    { position: [-65, -17, 14], scale: .95, rotation: 1.2 },
  ],
} satisfies Record<string, EnvironmentPlacement[]>;

export type ArchipelagoKind = keyof typeof ARCHIPELAGO;
