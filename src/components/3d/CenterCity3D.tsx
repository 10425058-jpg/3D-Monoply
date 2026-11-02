import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const CenterCity3D: React.FC = () => {
  const ferrisWheelRef = useRef<THREE.Group>(null);
  const piggyRef = useRef<THREE.Group>(null);
  const boatRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ferrisWheelRef.current) {
      ferrisWheelRef.current.rotation.z = t * 0.35;
    }
    if (piggyRef.current) {
      piggyRef.current.position.y = 2.6 + Math.sin(t * 2.2) * 0.15;
      piggyRef.current.rotation.y = Math.sin(t * 0.8) * 0.25;
    }
    if (boatRef.current) {
      boatRef.current.position.x = 1.2 + Math.sin(t * 0.5) * 0.8;
      boatRef.current.position.z = 3.2 + Math.cos(t * 0.5) * 0.4;
    }
  });

  // Downtown Skyscraper Definitions [x, z, width, depth, height, color, hasGlassTop]
  const skyscrapers: Array<[number, number, number, number, number, string, boolean]> = [
    [-2.4, -1.8, 1.15, 1.15, 5.4, '#38bdf8', true],
    [-1.0, -1.2, 1.05, 1.05, 4.7, '#60a5fa', true],
    [-2.8, -0.3, 1.0, 1.0, 4.1, '#93c5fd', false],
    [-1.3, 0.2, 1.1, 0.9, 3.8, '#e2e8f0', false],
    [-0.1, -2.2, 1.1, 1.1, 4.4, '#2563eb', true],
    [0.2, -0.8, 0.95, 0.95, 3.5, '#cbd5e1', false],
    [-3.6, -1.6, 0.9, 0.9, 3.6, '#f8fafc', false],
    [-2.2, 1.2, 1.1, 0.9, 3.1, '#f1f5f9', false],
    [-3.4, 0.8, 0.9, 0.9, 2.7, '#cbd5e1', false],
    [-0.9, 1.5, 0.85, 0.85, 2.9, '#94a3b8', false],
    [0.5, -2.9, 0.9, 0.9, 3.2, '#3b82f6', true],
    [-1.8, -3.1, 1.0, 0.9, 3.9, '#64748b', false],
  ];

  return (
    <group position={[0, 0.12, 0]}>
      {/* Crystal Turquoise Lagoon Water Base */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[16.2, 0.16, 16.2]} />
        <meshPhysicalMaterial
          color="#06b6d4"
          roughness={0.12}
          metalness={0.1}
          transmission={0.25}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Main Downtown Concrete & Harbor Island */}
      <mesh position={[-1.9, 0.15, -0.7]} receiveShadow castShadow>
        <boxGeometry args={[6.8, 0.32, 6.6]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>
      <mesh position={[-1.9, 0.32, -0.7]} receiveShadow>
        <boxGeometry args={[6.4, 0.06, 6.2]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>

      {/* Iconic Observation Tower (Space Needle Inspired) */}
      <group position={[-1.8, 0.35, -1.9]}>
        {/* Tower Core & Legs */}
        <mesh position={[0, 3.2, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.45, 6.4, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.3} roughness={0.3} />
        </mesh>
        {/* Observation Saucer */}
        <mesh position={[0, 6.2, 0]} castShadow>
          <cylinderGeometry args={[1.15, 0.75, 0.32, 24]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[0, 6.42, 0]} castShadow>
          <cylinderGeometry args={[0.85, 1.15, 0.22, 24]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.15} />
        </mesh>
        {/* Spire */}
        <mesh position={[0, 7.3, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.06, 1.6, 8]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* Downtown Skyscrapers */}
      {skyscrapers.map(([x, z, w, d, h, col, glass], idx) => (
        <group key={idx} position={[x, 0.35, z]}>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshPhysicalMaterial
              color={col}
              metalness={glass ? 0.65 : 0.2}
              roughness={glass ? 0.18 : 0.55}
              clearcoat={glass ? 0.8 : 0.1}
            />
          </mesh>
          {/* Roof HVAC / Crown Detail */}
          <mesh position={[0, h + 0.08, 0]} castShadow>
            <boxGeometry args={[w * 0.7, 0.16, d * 0.7]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
      ))}

      {/* Stadium & Red Construction Crane + Floating Piggy Bank (Top-Left Harbor) */}
      <group position={[-4.2, 0.25, -2.5]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.25, 1.05, 0.7, 24]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.85, 0.85, 0.6, 20]} />
          <meshStandardMaterial color="#16a34a" />
        </mesh>
        {/* Red Construction Crane */}
        <mesh position={[-0.9, 1.5, 0.8]} castShadow>
          <boxGeometry args={[0.14, 3.0, 0.14]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[-0.2, 2.9, 0.8]} castShadow>
          <boxGeometry args={[1.8, 0.12, 0.12]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      </group>

      {/* Floating Pink Piggy Bank with Gold Coin */}
      <group ref={piggyRef} position={[-3.6, 2.6, -1.6]}>
        <mesh castShadow>
          <sphereGeometry args={[0.52, 20, 20]} />
          <meshStandardMaterial color="#f472b6" roughness={0.3} />
        </mesh>
        {/* Gold Coin on Top */}
        <mesh position={[0, 0.58, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.08, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Amusement Pier with Animated Ferris Wheel (Bottom-Left Harbor) */}
      <group position={[-2.3, 0.18, 4.1]}>
        <mesh position={[0, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[3.1, 0.25, 2.6]} />
          <meshStandardMaterial color="#d6d3d1" />
        </mesh>
        {/* Ferris Wheel Support A-Frame */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.45, 1.6, 4]} />
          <meshStandardMaterial color="#e11d48" />
        </mesh>
        {/* Rotating Wheel */}
        <group ref={ferrisWheelRef} position={[0, 1.35, 0]}>
          <mesh castShadow>
            <torusGeometry args={[0.85, 0.05, 12, 28]} />
            <meshStandardMaterial color="#fb7185" />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i * Math.PI) / 4;
            return (
              <mesh key={i} position={[Math.cos(angle) * 0.85, Math.sin(angle) * 0.85, 0]}>
                <sphereGeometry args={[0.11, 10, 10]} />
                <meshStandardMaterial color={i % 2 === 0 ? '#facc15' : '#38bdf8'} />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* Rocky Lighthouse Islet (Bottom Edge) */}
      <group position={[-2.5, 0.15, 6.7]}>
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.95, 1]} />
          <meshStandardMaterial color="#57534e" roughness={0.9} />
        </mesh>
        <mesh position={[0.2, 0.85, -0.1]} castShadow>
          <cylinderGeometry args={[0.16, 0.26, 1.2, 12]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0.2, 1.5, -0.1]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Suspension Bridge Connecting Downtown to Green Park Island */}
      <group position={[1.7, 0.38, -0.7]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[1.6, 0.12, 0.9]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[-0.5, 0.45, 0.38]} castShadow>
          <boxGeometry args={[0.12, 0.9, 0.12]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh position={[0.5, 0.45, 0.38]} castShadow>
          <boxGeometry args={[0.12, 0.9, 0.12]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>

      {/* Green Park, Sandy Beach & Suburban Island (Right Side) */}
      <group position={[4.4, 0.12, 0.2]}>
        {/* Sandy Beach Base */}
        <mesh position={[-0.3, 0.04, 1.2]} receiveShadow>
          <cylinderGeometry args={[3.5, 3.8, 0.22, 24]} />
          <meshStandardMaterial color="#fde68a" roughness={0.85} />
        </mesh>
        {/* Lush Green Grass Hills */}
        <mesh position={[0.2, 0.22, -0.3]} receiveShadow castShadow>
          <cylinderGeometry args={[3.1, 3.5, 0.38, 24]} />
          <meshStandardMaterial color="#4ade80" roughness={0.75} />
        </mesh>
        {/* Suburban Villa & Community Buildings */}
        <mesh position={[0.8, 0.62, 0.4]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.55, 0.95]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        {/* Trees (Green & Autumn Orange) */}
        {[
          [-0.9, 0.6, -1.5, '#16a34a'],
          [0.4, 0.65, -1.8, '#ea580c'],
          [1.6, 0.6, -0.8, '#15803d'],
          [-1.1, 0.6, 1.6, '#ca8a04'],
          [0.2, 0.65, 2.0, '#16a34a'],
          [1.8, 0.6, 1.2, '#ea580c'],
          [-0.2, 0.65, 0.2, '#22c55e'],
        ].map(([tx, ty, tz, tcol], i) => (
          <group key={i} position={[tx as number, ty as number, tz as number]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 0.35, 6]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            <mesh position={[0, 0.15, 0]} castShadow>
              <dodecahedronGeometry args={[0.38, 1]} />
              <meshStandardMaterial color={tcol as string} roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Animated Harbor Yacht */}
      <group ref={boatRef} position={[1.2, 0.12, 3.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.65, 0.16, 0.28]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow>
          <coneGeometry args={[0.18, 0.45, 4]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
    </group>
  );
};
