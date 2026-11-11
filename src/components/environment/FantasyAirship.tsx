import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mayAnimateEnvironment } from './environmentMotion';
import { GltfEnvironmentModel } from './GltfEnvironmentModel';
import { qualityAsset } from './FantasyAssets';
import type { EnvironmentQuality } from './environmentLayout';

const PLACEMENTS = [{ position: [0,0,0] as [number,number,number], scale: 1.15 }];
export function FantasyAirship({ animate, quality }: { animate: boolean; quality: EnvironmentQuality }) {
  const ref = useRef<THREE.Group>(null), time = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current || !mayAnimateEnvironment(animate)) return;
    time.current += Math.min(delta,.1);
    const angle = -2.8 + Math.sin(time.current*.025)*.08;
    ref.current.position.set(Math.sin(angle)*84,-35+Math.sin(time.current*.17)*.6,Math.cos(angle)*84);
    ref.current.rotation.set(0,angle,Math.sin(time.current*.12)*.025);
  });
  return <group ref={ref} name="fantasy-airship" position={[Math.sin(-2.8)*84,-35,Math.cos(-2.8)*84]} rotation={[0,-2.8,0]}>
    <GltfEnvironmentModel file={qualityAsset('fantasy-airship',quality)} placements={PLACEMENTS} name="blender-airship" />
  </group>;
}
