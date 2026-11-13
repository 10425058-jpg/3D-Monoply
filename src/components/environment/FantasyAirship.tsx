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
    ref.current.position.set(-42+Math.sin(time.current*.025)*2.2,-11+Math.sin(time.current*.17)*.45,-73+Math.cos(time.current*.025)*.6);
    ref.current.rotation.set(0,-.32+Math.sin(time.current*.025)*.035,Math.sin(time.current*.12)*.018);
  });
  return <group ref={ref} name="fantasy-airship" position={[-42,-11,-72.4]} rotation={[0,-.32,0]}>
    <GltfEnvironmentModel file={qualityAsset('fantasy-airship',quality)} placements={PLACEMENTS} name="blender-airship" />
  </group>;
}
