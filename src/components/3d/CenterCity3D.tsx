import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { CityLandmark } from './CityLandmark';
import { CityDistricts } from './CityDistricts';

const GRASS_LUSH = '#559c38';
const GRASS_TERRACE = '#65ac44';
const CLIFF_ROCK = '#6a5a8e';
const PATHWAY_STONE = '#faecd8';

export const CenterCity3D: React.FC = () => {
  const players = useGameStore((s) => s.players);

  const landmarkLevel = useMemo(() => {
    const maxLevel = Math.max(...players.map((p) => p.landmarkLevel || 0));
    return Math.max(1, maxLevel);
  }, [players]);

  const crystalRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystalRef.current) {
      crystalRef.current.position.y = 5.6 + Math.sin(t * 1.8) * 0.15;
      crystalRef.current.rotation.y = t * 0.9;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[15.6, 0.65, 15.6]} />
        <meshStandardMaterial color={CLIFF_ROCK} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[15.3, 0.12, 15.3]} />
        <meshStandardMaterial color={GRASS_LUSH} roughness={0.78} />
      </mesh>

      <mesh position={[0, 0.35, -3.2]} receiveShadow castShadow>
        <boxGeometry args={[11.2, 0.2, 5.8]} />
        <meshStandardMaterial color={GRASS_TERRACE} roughness={0.72} />
      </mesh>

      <mesh position={[-4.2, 0.3, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[6.0, 0.14, 5.2]} />
        <meshStandardMaterial color={GRASS_TERRACE} roughness={0.72} />
      </mesh>

      <mesh position={[4.2, 0.3, -0.2]} receiveShadow castShadow>
        <boxGeometry args={[6.0, 0.14, 5.2]} />
        <meshStandardMaterial color={GRASS_TERRACE} roughness={0.72} />
      </mesh>

      <mesh position={[0, 0.27, 4.8]} receiveShadow castShadow>
        <boxGeometry args={[12.8, 0.1, 2.6]} />
        <meshStandardMaterial color={GRASS_TERRACE} roughness={0.72} />
      </mesh>

      <mesh position={[0, 0.29, -1.5]} receiveShadow>
        <boxGeometry args={[3.2, 0.03, 2.6]} />
        <meshStandardMaterial color={PATHWAY_STONE} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.29, 0.2]} receiveShadow>
        <boxGeometry args={[11.4, 0.03, 2.4]} />
        <meshStandardMaterial color={PATHWAY_STONE} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.28, 5.6]} receiveShadow>
        <boxGeometry args={[10.5, 0.025, 1.0]} />
        <meshStandardMaterial color={PATHWAY_STONE} roughness={0.8} />
      </mesh>

      {[0, 1, 2, 3].map((stepIdx) => (
        <mesh
          key={`stair-${stepIdx}`}
          position={[0, 0.26 + (3 - stepIdx) * 0.04, -2.1 + stepIdx * 0.22]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[3.6 - stepIdx * 0.2, 0.05, 0.24]} />
          <meshStandardMaterial color="#faecd8" roughness={0.65} />
        </mesh>
      ))}

      {[-4.2, -2.1, 0, 2.1, 4.2].map((hx, hidx) => (
        <React.Fragment key={`fhedge-${hidx}`}>
          <mesh position={[hx, 0.36, 4.2]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.18, 0.45]} />
            <meshStandardMaterial color="#3d7e26" roughness={0.8} />
          </mesh>
          {[-0.4, 0, 0.4].map((fx, fidx) => (
            <mesh key={`hflower-${hidx}-${fidx}`} position={[hx + fx, 0.46, 4.2]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color={fidx % 2 === 0 ? '#ff85a2' : '#facc15'} roughness={0.5} />
            </mesh>
          ))}
        </React.Fragment>
      ))}

      <CityLandmark level={landmarkLevel} />

      <group ref={crystalRef} position={[0, 5.6, -3.2]}>
        <mesh>
          <octahedronGeometry args={[0.28, 0]} />
          <meshPhysicalMaterial
            color="#6feaff"
            emissive="#38d4f0"
            emissiveIntensity={0.85}
            roughness={0.1}
            metalness={0.1}
            transmission={0.4}
            ior={1.4}
          />
        </mesh>
      </group>

      <CityDistricts />
    </group>
  );
};

export default CenterCity3D;
