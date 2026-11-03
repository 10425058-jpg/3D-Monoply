import React from 'react';

interface CityLandmarkProps {
  level: number;
}

const STONE_WALL = '#fefbf3';
const STONE_TRIM = '#ecd8be';
const ROOF_BLUE = '#2b6cb0';
const ROOF_ROYAL = '#1e4e8c';
const GOLD_ACCENT = '#f59e0b';
const BANNER_RED = '#ef4444';
const BANNER_GOLD = '#fbbf24';
const WOOD_DOOR = '#78350f';

export const CityLandmark: React.FC<CityLandmarkProps> = ({ level }) => {
  const currentLevel = Math.max(1, Math.min(5, level || 1));

  return (
    <group position={[0, 0.45, -2.5]}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.4, 3.8]} />
        <meshStandardMaterial color={STONE_WALL} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.0, 0.08, 4.0]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
      </mesh>

      <mesh position={[0, 0.08, 2.3]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.16, 0.65]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.2, 2.0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.16, 0.55]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.32, 1.7]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.16, 0.45]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.6} />
      </mesh>

      <mesh position={[0, 0.95, 1.5]} castShadow>
        <boxGeometry args={[1.2, 1.1, 0.2]} />
        <meshStandardMaterial color={WOOD_DOOR} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.55, 1.52]}>
        <cylinderGeometry args={[0.6, 0.6, 0.14, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
      </mesh>

      <mesh position={[0, 1.35, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.9, 2.6]} />
        <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
      </mesh>
      {[-1.3, -0.65, 0, 0.65, 1.3].map((x, idx) => (
        <mesh key={`cren-${idx}`} position={[x, 2.38, 1.42]} castShadow>
          <boxGeometry args={[0.3, 0.24, 0.16]} />
          <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
        </mesh>
      ))}

      {[-1.8, 1.8].map((sideX, sIdx) => (
        <group key={`flank-tower-${sIdx}`} position={[sideX, 0, 0.7]}>
          <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.62, 2.4, 16]} />
            <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.85, 0]} castShadow>
            <cylinderGeometry args={[0.68, 0.55, 0.22, 16]} />
            <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
          </mesh>
          <mesh position={[0, 3.65, 0]} castShadow>
            <coneGeometry args={[0.82, 1.45, 16]} />
            <meshPhysicalMaterial color={ROOF_BLUE} roughness={0.3} metalness={0.15} clearcoat={0.6} />
          </mesh>
          <mesh position={[0, 4.45, 0]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {currentLevel >= 2 && (
        <group position={[0, 2.3, -0.2]}>
          <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 1.6, 2.0]} />
            <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
          </mesh>
          {[-0.8, 0, 0.8].map((bx, bidx) => (
            <mesh key={`up-cren-${bidx}`} position={[bx, 1.68, 1.02]} castShadow>
              <boxGeometry args={[0.26, 0.2, 0.12]} />
              <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
            </mesh>
          ))}
          {[-0.6, 0.6].map((bx, bi) => (
            <group key={`banner-${bi}`} position={[bx, 0.8, 1.05]}>
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.8, 0.04]} />
                <meshStandardMaterial color={bi % 2 === 0 ? BANNER_RED : BANNER_GOLD} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.42, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.42, 6]} />
                <meshStandardMaterial color={GOLD_ACCENT} metalness={0.8} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {currentLevel >= 3 && (
        <group position={[0, 3.9, -0.3]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.7, 0.8, 1.8, 16]} />
            <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.85, 0]} castShadow>
            <cylinderGeometry args={[0.85, 0.7, 0.2, 16]} />
            <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
          </mesh>
          <mesh position={[0, 2.75, 0]} castShadow>
            <coneGeometry args={[1.05, 1.7, 16]} />
            <meshPhysicalMaterial color={ROOF_ROYAL} roughness={0.25} metalness={0.2} clearcoat={0.8} />
          </mesh>
          <mesh position={[0, 3.65, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.15} />
          </mesh>
        </group>
      )}

      {currentLevel >= 4 && (
        <group>
          {[-1.8, 1.8].map((bx, bi) => (
            <group key={`rear-spire-${bi}`} position={[bx, 0, -1.2]}>
              <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.42, 0.48, 3.2, 12]} />
                <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
              </mesh>
              <mesh position={[0, 3.9, 0]} castShadow>
                <coneGeometry args={[0.62, 1.4, 12]} />
                <meshPhysicalMaterial color={ROOF_BLUE} roughness={0.3} metalness={0.15} clearcoat={0.6} />
              </mesh>
              <mesh position={[0, 4.65, 0]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          ))}
          <group position={[0, 2.8, 0.85]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.32, 0.32, 0.1, 24]} />
              <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.9} roughness={0.2} clearcoat={1} />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <circleGeometry args={[0.26, 24]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.08, 0.08]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.04, 0.16, 0.02]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0.06, 0, 0.08]} rotation={[0, 0, -Math.PI / 2]}>
              <boxGeometry args={[0.03, 0.12, 0.02]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>
        </group>
      )}

      {currentLevel >= 5 && (
        <group position={[0, 7.6, -0.3]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.26, 0.9, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.48, 0.32, 0.03]} />
            <meshStandardMaterial color={BANNER_RED} roughness={0.3} />
          </mesh>
          {[-1.2, 1.2].map((fx, fi) => (
            <group key={`cflag-${fi}`} position={[fx, -0.8, 0]}>
              <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.8, 6]} />
                <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} />
              </mesh>
              <mesh position={[0.18, 0.65, 0]}>
                <boxGeometry args={[0.32, 0.22, 0.02]} />
                <meshStandardMaterial color={BANNER_GOLD} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
};

export default CityLandmark;
