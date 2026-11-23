import { Vector3 } from 'three';
import type { EnvironmentPlacement } from './GltfEnvironmentModel';
import type { EnvironmentQuality } from './environmentLayout';
import type { SakuraPlacement } from './SakuraTree3D';
import { ARCHIPELAGO } from './archipelagoLayout';
import { FAR_LEFT, FAR_RIGHT, LEFT_ISLAND, LOW_FAR_LEFT, RIGHT_ISLAND, SUNSET_KINGDOM } from './sunsetKingdomLayout';

// Y values are the lawn elevations measured at the original trunk positions.
const BOARD_SITES = [
  [6, .28, -2.3, .52], [6, .28, 2.8, .52], [6, .28, 6.15, .43], [3.05, .28, 5.1, .45],
] as const;
const FALLBACK_SITES = [
  [4.8, .46, -2.6, .58], [2.8, .46, -1.8, .47], [3.2, .37, 2, .49], [5.4, .34, 5.8, .53],
] as const;

function boardSites(sites: typeof BOARD_SITES | typeof FALLBACK_SITES, name: string): SakuraPlacement[] {
  return [-1, 1].flatMap(side => sites.map(([x, y, z, scale], index) => ({
    id: `${name}-${side}-${index}`, position: [side * x, y, z], scale,
  })));
}

export const BOARD_SAKURA = boardSites(BOARD_SITES, 'board');
export const FALLBACK_SAKURA = boardSites(FALLBACK_SITES, 'fallback');

type LocalSite = readonly [x: number, y: number, z: number, scale: number];
const LEFT: readonly LocalSite[] = [
  [-6.6, .076, -1.8, .67], [6.1, .055, -2.7, .59], [3.9, .084, 3.5, .53],
  [-1.7, .087, 4.5, .46], [-4, .062, -3.8, .52],
];
const RIGHT: readonly LocalSite[] = [
  [-4.4, -.006, -3.2, .69], [6.4, .083, -.5, .54], [-1.6, .085, 4.3, .51],
  [2.7, .065, 4.6, .44], [-6.5, .089, 1, .44],
];
const LEFT_DISTANT: readonly LocalSite[] = [
  [-6.6, .018, -1.8, .67], [6.1, .028, -2.7, .59], [3.9, .058, 3.5, .53],
];
const RIGHT_DISTANT: readonly LocalSite[] = [
  [-4.4, .05, -3.2, .69], [6.4, .041, -.5, .54], [-1.6, .049, 4.3, .51],
];

function placeTrees(name: string, islands: readonly EnvironmentPlacement[], sites: readonly LocalSite[]): SakuraPlacement[] {
  const up = new Vector3(0, 1, 0);
  return islands.flatMap((island, copy) => sites.map(([x, y, z, scale], index) => ({
    id: `${name}-${copy}-${index}`,
    position: new Vector3(x, y, z).applyAxisAngle(up, island.rotation ?? 0)
      .multiplyScalar(island.scale).add(new Vector3(...island.position)).toArray(),
    rotation: island.rotation,
    scale: scale * island.scale,
  })));
}

export function scenicSakura(quality: EnvironmentQuality): SakuraPlacement[] {
  const royalCount = { high: 5, balanced: 4, low: 3 }[quality];
  const left = LEFT.slice(0, royalCount);
  const right = RIGHT.slice(0, royalCount);
  if (quality === 'low') {
    left[1] = [6.1, .047, -2.7, .59];
    right[0] = [-4.4, .012, -3.2, .69];
  }
  return [
    ...placeTrees('left', [LEFT_ISLAND], left),
    ...placeTrees('right', [RIGHT_ISLAND], right),
    ...placeTrees('far-left', quality === 'low' ? LOW_FAR_LEFT : FAR_LEFT, LEFT_DISTANT),
    ...placeTrees('far-right', quality === 'high' ? FAR_RIGHT : [], RIGHT_DISTANT),
    ...placeTrees('citadel', SUNSET_KINGDOM['royal-island-citadel'], [[-4.6, .042, .6, .66], [4.6, .038, .6, .66]]),
    ...placeTrees('garden', SUNSET_KINGDOM['sky-garden'], [[-3.8, .046, 1.4, .84], [3.4, .056, .9, .67], [-2.2, .067, -2.5, .51]]),
    ...placeTrees('windmill', SUNSET_KINGDOM['sky-windmill'], [[5.3, .043, .6, .58]]),
    ...placeTrees('observatory', ARCHIPELAGO.observatory, [[-3.6, .055, -.9, .56]]),
    ...placeTrees('ruins', ARCHIPELAGO.ruins, [[-3.6, .055, .8, .56]]),
    ...placeTrees('hamlet', ARCHIPELAGO.hamlet, [[5.2, .055, .8, .51]]),
  ];
}
