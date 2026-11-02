import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

export const Dice3D: React.FC = () => {
  const turnPhase = useGameStore((s) => s.turnPhase);
  const dice = useGameStore((s) => s.dice);
  const die1Ref = useRef<THREE.Mesh>(null);
  const die2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const isRolling = turnPhase === 'ROLLING';

    if (die1Ref.current && die2Ref.current) {
      if (isRolling) {
        die1Ref.current.position.y = 2.8 + Math.abs(Math.sin(t * 18)) * 1.4;
        die1Ref.current.rotation.x += 0.35;
        die1Ref.current.rotation.z += 0.28;

        die2Ref.current.position.y = 2.8 + Math.abs(Math.cos(t * 18)) * 1.4;
        die2Ref.current.rotation.y += 0.38;
        die2Ref.current.rotation.x += 0.3;
      } else {
        die1Ref.current.position.y = THREE.MathUtils.lerp(die1Ref.current.position.y, 0.72, 0.2);
        die2Ref.current.position.y = THREE.MathUtils.lerp(die2Ref.current.position.y, 0.72, 0.2);
        die1Ref.current.rotation.set(0, 0.25, 0);
        die2Ref.current.rotation.set(0, -0.35, 0);
      }
    }
  });

  return (
    <group position={[1.4, 0, 5.2]}>
      <mesh ref={die1Ref} position={[-0.65, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      <mesh ref={die2Ref} position={[0.65, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      {/* Top Pips */}
      <mesh position={[-0.65, 1.09, 0]}>
        <sphereGeometry args={[0.07 + dice[0] * 0.008, 12, 12]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.65, 1.09, 0]}>
        <sphereGeometry args={[0.07 + dice[1] * 0.008, 12, 12]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
    </group>
  );
};
