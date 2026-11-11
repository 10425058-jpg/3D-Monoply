import { GltfEnvironmentModel } from './GltfEnvironmentModel';
import type { EnvironmentPlacement } from './GltfEnvironmentModel';
import type { EnvironmentQuality } from './environmentLayout';

export const qualityAsset = (id: string, quality: EnvironmentQuality | 'distant') =>
  `${id}${quality === 'high' ? '' : `-${quality}`}.glb`;

export function FloatingIsland({ variant, quality, placements }: {
  variant: 'left' | 'right'; quality: EnvironmentQuality | 'distant'; placements: readonly EnvironmentPlacement[];
}) {
  return <GltfEnvironmentModel file={qualityAsset(`royal-island-${variant}`, quality)} placements={placements}
    name={`floating-island-${variant}-${quality}`} atmosphere={quality === 'distant' ? .34 : 0} />;
}

// Standalone exports share the same ground origin and atlas as the batched main
// islands. Future layouts can reuse them without unpacking a whole kingdom.
type Prop = { placements: readonly EnvironmentPlacement[]; quality?: EnvironmentQuality };
function Asset({ id, placements, quality = 'high' }: Prop & { id: string }) {
  return <GltfEnvironmentModel file={qualityAsset(id, quality === 'balanced' ? 'low' : quality)}
    placements={placements} name={id} />;
}
export const FantasyCastle = (props: Prop) => <Asset id="royal-castle" {...props} />;
export const FantasyVillage = (props: Prop) => <Asset id="fantasy-house" {...props} />;
export const CherryBlossomTree = (props: Prop) => <Asset id="cherry-blossom" {...props} />;
export const FantasyBridge = (props: Prop) => <Asset id="royal-bridge" {...props} />;
