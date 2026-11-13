import { Suspense } from 'react';
import { ARCHIPELAGO, ArchipelagoKind } from './archipelagoLayout';
import { GltfEnvironmentModel } from './GltfEnvironmentModel';
import { AnimatedWaterfall } from './AnimatedWaterfall';
import { qualityAsset } from './FantasyAssets';
import { EnvironmentAssetBoundary, LandmarkFallback } from './EnvironmentAssetBoundary';
import type { EnvironmentQuality } from './environmentLayout';

export const supportingFiles = (quality: EnvironmentQuality) =>
  (Object.keys(ARCHIPELAGO) as ArchipelagoKind[]).map(kind => qualityAsset(`sky-${kind}`, quality));

/** Ten destinations, three material-batched GLBs. Low retains the same world
 * coverage and landmarks, using smaller exported topology rather than hiding it. */
export function SupportingKingdoms({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  return <group name="supporting-kingdoms">{(Object.keys(ARCHIPELAGO) as ArchipelagoKind[]).map(kind => {
    const file = qualityAsset(`sky-${kind}`, quality), placements = ARCHIPELAGO[kind];
    const fallback = <LandmarkFallback placements={placements} />;
    return <EnvironmentAssetBoundary key={file} label={file} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfEnvironmentModel file={file} placements={placements} name={`skyway-${kind}`} atmosphere={.12} />
        {kind === 'hamlet' && placements.map((site, i) => <group key={i} position={site.position}
          scale={site.scale} rotation={[0, site.rotation ?? 0, 0]} name={`millstream-${i}`}>
          <AnimatedWaterfall file={file} variant="left" name={`waterfall-hamlet-${i}`} animate={animate} low={quality === 'low'} />
        </group>)}
      </Suspense>
    </EnvironmentAssetBoundary>;
  })}</group>;
}
