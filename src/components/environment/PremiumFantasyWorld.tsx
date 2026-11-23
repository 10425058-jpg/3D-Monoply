import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { FloatingIsland, qualityAsset } from './FantasyAssets';
import { AnimatedWaterfall } from './AnimatedWaterfall';
import { FantasyAirship } from './FantasyAirship';
import type { EnvironmentQuality } from './environmentLayout';
import { SupportingKingdoms, supportingFiles } from './SupportingKingdoms';
import { EnvironmentAssetBoundary } from './EnvironmentAssetBoundary';
import { SunsetKingdoms, sunsetFiles } from './SunsetKingdoms';
import { FAR_LEFT, FAR_RIGHT, LEFT_ISLAND, LOW_FAR_LEFT, RIGHT_ISLAND } from './sunsetKingdomLayout';
import { cloudAtlasUrl } from './cloudAtlas';
import { scenicSakura } from './sakuraLayout';
import { SakuraTree3D, sakuraModelUrl } from './SakuraTree3D';
export { LEFT_ISLAND, RIGHT_ISLAND } from './sunsetKingdomLayout';

export const WORLD_MILESTONE = 'final-background-overhaul-v1';
const LEFT_PLACEMENTS = [LEFT_ISLAND];
const RIGHT_PLACEMENTS = [RIGHT_ISLAND];

/** Fixed world-space placements, independent of camera mode and game state. */
export function PremiumFantasyWorld({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const trees = useMemo(() => scenicSakura(quality), [quality]);
  const files = [qualityAsset('royal-island-left',quality), qualityAsset('royal-island-right',quality), qualityAsset('fantasy-airship',quality)];
  files.push(qualityAsset('royal-island-left','distant'));
  if (quality === 'high') files.push(qualityAsset('royal-island-right','distant'));
  files.push(...supportingFiles(quality));
  files.push(...sunsetFiles(quality));
  const urls = [...files.map(environmentModelUrl), sakuraModelUrl('lite')];
  // Warm just this quality's URLs in parallel; never fetch every LOD on startup.
  urls.forEach(url => useGLTF.preload(url));
  return <group name="premium-fantasy-world">
    <FloatingIsland variant="left" quality={quality} placements={LEFT_PLACEMENTS} />
    <FloatingIsland variant="right" quality={quality} placements={RIGHT_PLACEMENTS} />
    {([LEFT_ISLAND,RIGHT_ISLAND] as const).map((site,index) => <group key={index} position={site.position} scale={site.scale} rotation={[0,site.rotation ?? 0,0]}>
      <AnimatedWaterfall file={files[index]} variant={index === 0 ? 'left' : 'right'} animate={animate} low={quality === 'low'} />
    </group>)}
    <FloatingIsland variant="left" quality="distant" placements={quality === 'low' ? LOW_FAR_LEFT : FAR_LEFT} />
    {quality === 'high' && <FloatingIsland variant="right" quality="distant" placements={FAR_RIGHT} />}
    <FantasyAirship quality={quality} animate={animate} />
    <SupportingKingdoms quality={quality} animate={animate} />
    <SunsetKingdoms quality={quality} animate={animate} />
    <SakuraTree3D name="island-sakura" placements={trees} detail="scenic" cullInstances />
    <EnvironmentAssetBoundary key={`ready-${quality}`} label="asset readiness" fallback={null}>
      <Suspense fallback={null}><EnvironmentReady urls={urls} quality={quality} /></Suspense>
    </EnvironmentAssetBoundary>
  </group>;
}

export function EnvironmentReady({ urls, quality }: { urls: string[]; quality: EnvironmentQuality }) {
  // Individual URLs share the exact cache keys used by the visible models.
  // Loading the array as a new useGLTF key would download every GLB twice.
  // The enclosing Suspense commits the marker only once all children resolve.
  return <>{urls.map(url => <LoadedEnvironmentAsset key={url} url={url} />)}
    <LoadedCloudAtlas quality={quality} />
    <EnvironmentReadyMarker urls={urls} quality={quality} /></>;
}

function LoadedCloudAtlas({quality}:{quality:EnvironmentQuality}){
  useTexture(cloudAtlasUrl(quality));
  return null;
}

function LoadedEnvironmentAsset({ url }: { url: string }) {
  useGLTF(url);
  return null;
}

function EnvironmentReadyMarker({ urls, quality }: { urls: string[]; quality: EnvironmentQuality }) {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('graphicsAudit')) return;
    const state = { ready: true, milestone: WORLD_MILESTONE, quality, assetUrls: urls,textureUrls:[cloudAtlasUrl(quality)] };
    (window as any).__phase2Environment = state;
    return () => { if ((window as any).__phase2Environment === state) delete (window as any).__phase2Environment; };
  }, [urls.join('|'), quality]);
  return null;
}
