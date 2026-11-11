import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { FloatingIsland, qualityAsset } from './FantasyAssets';
import { AnimatedWaterfall } from './AnimatedWaterfall';
import { FantasyAirship } from './FantasyAirship';
import type { EnvironmentPlacement } from './GltfEnvironmentModel';
import type { EnvironmentQuality } from './environmentLayout';

export const WORLD_MILESTONE = 'fantasy-polish';
export const LEFT_ISLAND: EnvironmentPlacement = { position: [-29, -24, -20], scale: 1.3, rotation: .6 };
export const RIGHT_ISLAND: EnvironmentPlacement = { position: [28, -22, -20], scale: 1.3, rotation: .16 };
const LEFT_PLACEMENTS = [LEFT_ISLAND];
const RIGHT_PLACEMENTS = [RIGHT_ISLAND];
const FAR_LEFT: EnvironmentPlacement[] = [{ position: [-46,-42,-91], scale: .5, rotation: .4 },
  { position: [35,-51,-115], scale: .36, rotation: -.65 }];
const FAR_RIGHT: EnvironmentPlacement[] = [{ position: [71,-54,-104], scale: .48, rotation: -.3 }];
const LOW_FAR_LEFT = FAR_LEFT.slice(0,1);

/** Fixed world-space placements, independent of camera mode and game state. */
export function PremiumFantasyWorld({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const files = [qualityAsset('royal-island-left',quality), qualityAsset('royal-island-right',quality), qualityAsset('fantasy-airship',quality)];
  files.push(qualityAsset('royal-island-left','distant'));
  if (quality === 'high') files.push(qualityAsset('royal-island-right','distant'));
  // Warm just this quality's URLs in parallel; never fetch every LOD on startup.
  files.forEach(file => useGLTF.preload(environmentModelUrl(file)));
  return <group name="premium-fantasy-world">
    <FloatingIsland variant="left" quality={quality} placements={LEFT_PLACEMENTS} />
    <FloatingIsland variant="right" quality={quality} placements={RIGHT_PLACEMENTS} />
    {([LEFT_ISLAND,RIGHT_ISLAND] as const).map((site,index) => <group key={index} position={site.position} scale={site.scale} rotation={[0,site.rotation ?? 0,0]}>
      <AnimatedWaterfall file={files[index]} variant={index === 0 ? 'left' : 'right'} animate={animate} low={quality === 'low'} />
    </group>)}
    <FloatingIsland variant="left" quality="distant" placements={quality === 'low' ? LOW_FAR_LEFT : FAR_LEFT} />
    {quality === 'high' && <FloatingIsland variant="right" quality="distant" placements={FAR_RIGHT} />}
    <FantasyAirship quality={quality} animate={animate} />
    <EnvironmentReady files={files} quality={quality} />
  </group>;
}

export function EnvironmentReady({ files, quality }: { files: string[]; quality: EnvironmentQuality }) {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('graphicsAudit')) return;
    const state = { ready: true, milestone: WORLD_MILESTONE, quality, assetUrls: files.map(environmentModelUrl) };
    (window as any).__phase2Environment = state;
    return () => { if ((window as any).__phase2Environment === state) delete (window as any).__phase2Environment; };
  }, [files.join('|'), quality]);
  return null;
}
