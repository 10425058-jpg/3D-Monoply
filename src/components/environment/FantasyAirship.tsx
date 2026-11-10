import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mayAnimateEnvironment } from './environmentMotion';

export function FantasyAirship({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current || !mayAnimateEnvironment(animate)) return;
    time.current += Math.min(delta, .1);
    const angle = -2.8 + time.current * .006;
    ref.current.position.set(Math.sin(angle) * 84, -35 + Math.sin(time.current * .17) * .6, Math.cos(angle) * 84);
    ref.current.rotation.y = angle;
    ref.current.rotation.z = Math.sin(time.current * .12) * .025;
  });
  return <group ref={ref} name="fantasy-airship" position={[Math.sin(-2.8) * 84, -35, Math.cos(-2.8) * 84]} rotation={[0, -2.8, 0]}>
    <mesh scale={[4.8, 1.55, 1.55]} raycast={() => {}}>
      <sphereGeometry args={[1, 24, 12]} /><meshStandardMaterial color="#be876e" roughness={.82} fog={false} />
    </mesh>
    {[-2.7, 0, 2.7].map(x => <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} raycast={() => {}}>
      <torusGeometry args={[1.55 * Math.sqrt(1 - (x / 4.8) ** 2), .045, 5, 20]} />
      <meshBasicMaterial color="#e4bd80" fog={false} />
    </mesh>)}
    <mesh position={[0, -2.35, 0]} raycast={() => {}}>
      <boxGeometry args={[3.5, .7, 1.1]} /><meshStandardMaterial color="#695277" roughness={.9} fog={false} />
    </mesh>
    <mesh position={[0, -2.05, 0]} raycast={() => {}}>
      <boxGeometry args={[3.7, .13, 1.2]} /><meshStandardMaterial color="#d5b17b" roughness={.8} fog={false} />
    </mesh>
    {[-1.25, 1.25].map(x => <mesh key={x} position={[x, -1.6, 0]} raycast={() => {}}>
      <cylinderGeometry args={[.035, .035, 1.2, 5]} /><meshStandardMaterial color="#d0b693" fog={false} />
    </mesh>)}
    <mesh position={[-3.7, .2, 0]} rotation={[0, 0, -.3]} raycast={() => {}}>
      <boxGeometry args={[2.6, 1.5, .12]} /><meshStandardMaterial color="#6f527f" roughness={.9} fog={false} />
    </mesh>
    <mesh position={[-3.7, 0, 0]} raycast={() => {}}>
      <boxGeometry args={[2.5, .12, 2.6]} /><meshStandardMaterial color="#6f527f" roughness={.9} fog={false} />
    </mesh>
    <mesh position={[.2, -2.33, .56]} raycast={() => {}}>
      <boxGeometry args={[1.7, .25, .025]} /><meshBasicMaterial color="#ffd69b" fog={false} />
    </mesh>
  </group>;
}
