import { Suspense } from 'react';
import { SUNSET_KINGDOM, SunsetLandmark } from './sunsetKingdomLayout';
import { GltfEnvironmentModel } from './GltfEnvironmentModel';
import { AnimatedWaterfall } from './AnimatedWaterfall';
import { qualityAsset } from './FantasyAssets';
import { EnvironmentAssetBoundary } from './EnvironmentAssetBoundary';
import type { EnvironmentQuality } from './environmentLayout';
import { LanternHalos } from './LanternHalos';

export const sunsetFiles = (quality: EnvironmentQuality) =>
  (Object.keys(SUNSET_KINGDOM) as SunsetLandmark[]).map(id => qualityAsset(id, quality));

/** Material-batched Blender scenery. No input handlers, extra lights, board
 * transforms or realtime shadow casters. Each family loads independently. */
export function SunsetKingdoms({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  return <group name="sunset-kingdoms">{(Object.keys(SUNSET_KINGDOM) as SunsetLandmark[]).map(id => {
    const file = qualityAsset(id, quality), sites = SUNSET_KINGDOM[id];
    return <EnvironmentAssetBoundary key={file} label={file} fallback={null}>
      <Suspense fallback={null}>
        <GltfEnvironmentModel file={file} placements={sites} name={id} atmosphere={id === 'crown-foundation' ? 0 : .045} />
        <LanternHalos file={file} placements={sites} />
        {id !== 'crown-foundation' && id !== 'royal-garden-dressing' && sites.map((site, index) => <group key={index} position={site.position}
          scale={site.scale} rotation={[0, ('rotation' in site ? site.rotation : 0) ?? 0, 0]}>
          <AnimatedWaterfall file={file} variant="left" animate={animate} low={quality === 'low'} name={`cascade-${id}-${index}`} />
        </group>)}
      </Suspense>
    </EnvironmentAssetBoundary>;
  })}</group>;
}
