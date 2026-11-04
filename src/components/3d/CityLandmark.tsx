import React from 'react';

interface CityLandmarkProps {
  level: number; // 1 to 5
}

// Colors for the fairy-tale royal palace
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
      {/* ============================================================== */}
      {/* 1. GRAND STONE PLAZA TERRACE & STAIRWAYS                       */}
      {/* ============================================================== */}
      {/* Base Foundation Platform */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.4, 3.8]} />
        <meshStandardMaterial color={STONE_WALL} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.0, 0.08, 4.0]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
      </mesh>

      {/* Front Cascading Grand Stone Staircase descending into Plaza */}
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

      {/* Grand Arch Entrance Portal */}
      <mesh position={[0, 0.95, 1.48]} castShadow>
        <boxGeometry args={[1.2, 1.1, 0.16]} />
        <meshStandardMaterial color={WOOD_DOOR} roughness={0.7} />
      </mesh>
      {/* Warm Golden Glow Inside Portal */}
      <mesh position={[0, 0.92, 1.54]}>
        <boxGeometry args={[0.7, 0.95, 0.05]} />
        <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, 1.55, 1.52]}>
        <cylinderGeometry args={[0.6, 0.6, 0.14, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
      </mesh>
      {/* Arch Portal Top Semicircle Glow */}
      <mesh position={[0, 1.45, 1.54]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={1.4} />
      </mesh>

      {/* ============================================================== */}
      {/* 2. CENTRAL PALACE KEEP & CORNER TOWERS (Level 1+)             */}
      {/* ============================================================== */}
      {/* Main Castle Center Body */}
      <mesh position={[0, 1.35, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.9, 2.6]} />
        <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
      </mesh>
      {/* Battlements along front wall */}
      {[-1.3, -0.65, 0, 0.65, 1.3].map((x, idx) => (
        <mesh key={`cren-${idx}`} position={[x, 2.38, 1.42]} castShadow>
          <boxGeometry args={[0.3, 0.24, 0.16]} />
          <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
        </mesh>
      ))}

      {/* Flanking Left & Right Round Watchtowers with Blue Conical Spires */}
      {[-1.8, 1.8].map((sideX, sIdx) => (
        <group key={`flank-tower-${sIdx}`} position={[sideX, 0, 0.7]}>
          {/* Stone Tower Shaft */}
          <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.62, 2.4, 16]} />
            <meshStandardMaterial color={STONE_WALL} roughness={0.55} />
          </mesh>
          {/* Overhanging parapet rim */}
          <mesh position={[0, 2.85, 0]} castShadow>
            <cylinderGeometry args={[0.68, 0.58, 0.18, 16]} />
            <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
          </mesh>
          {/* Blue Conical Roof Spire */}
          <mesh position={[0, 3.75, 0]} castShadow>
            <coneGeometry args={[0.76, 1.65, 16]} />
            <meshStandardMaterial color={ROOF_BLUE} roughness={0.3} metalness={0.1} />
          </mesh>
          {/* Golden Finial Sphere */}
          <mesh position={[0, 4.65, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 3. GRAND HIGH CENTRAL TOWER & ROYAL SPIRE                     */}
      {/* ============================================================== */}
      <group position={[0, 0, -0.2]}>
        {/* Upper Keep Tier */}
        <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 1.5, 2.0]} />
          <meshStandardMaterial color={STONE_WALL} roughness={0.55} />
        </mesh>
        <mesh position={[0, 3.4, 0]} castShadow>
          <boxGeometry args={[2.55, 0.16, 2.15]} />
          <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
        </mesh>

        {/* Central High Spire Shaft */}
        <mesh position={[0, 4.1, 0]} castShadow>
          <cylinderGeometry args={[0.65, 0.75, 1.5, 16]} />
          <meshStandardMaterial color={STONE_WALL} roughness={0.55} />
        </mesh>
        {/* Royal Blue Grand Spire Roof */}
        <mesh position={[0, 5.4, 0]} castShadow>
          <coneGeometry args={[0.95, 2.1, 16]} />
          <meshStandardMaterial color={ROOF_ROYAL} roughness={0.28} metalness={0.12} />
        </mesh>
        {/* Golden Finial with Royal Flag */}
        <mesh position={[0, 6.55, 0]}>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0, 6.85, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} />
        </mesh>
        <mesh position={[0.22, 7.05, 0]}>
          <boxGeometry args={[0.42, 0.22, 0.02]} />
          <meshStandardMaterial color={BANNER_RED} roughness={0.3} />
        </mesh>
      </group>

      {/* Royal Wall Banners */}
      {[-0.9, 0.9].map((bx, bidx) => (
        <group key={`banner-${bidx}`} position={[bx, 1.8, 1.44]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.28, 0.9, 0.04]} />
            <meshStandardMaterial color={BANNER_RED} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.52, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.14, 0.22, 3]} />
            <meshStandardMaterial color={BANNER_RED} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.14, 0.025]}>
            <boxGeometry args={[0.16, 0.16, 0.02]} />
            <meshStandardMaterial color={BANNER_GOLD} metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 4. PROGRESSION UPGRADES (Levels 2 to 5)                         */}
      {/* ============================================================== */}
      {/* Level 2+: Rear High Towers with Spires */}
      {currentLevel >= 2 && (
        <group>
          {[-1.6, 1.6].map((rx, ridx) => (
            <group key={`rear-tower-${ridx}`} position={[rx, 0, -1.4]}>
              <mesh position={[0, 2.5, 0]} castShadow>
                <cylinderGeometry args={[0.48, 0.55, 4.2, 16]} />
                <meshStandardMaterial color={STONE_WALL} roughness={0.55} />
              </mesh>
              <mesh position={[0, 4.9, 0]} castShadow>
                <coneGeometry args={[0.68, 1.5, 16]} />
                <meshStandardMaterial color={ROOF_BLUE} roughness={0.3} />
              </mesh>
              <mesh position={[0, 5.75, 0]}>
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Level 3+: Royal Balcony & Decorative Wings */}
      {currentLevel >= 3 && (
        <group>
          <mesh position={[0, 2.05, 1.35]} castShadow>
            <boxGeometry args={[1.6, 0.12, 0.5]} />
            <meshStandardMaterial color={STONE_TRIM} roughness={0.5} />
          </mesh>
          <mesh position={[0, 2.25, 1.58]}>
            <boxGeometry args={[1.56, 0.26, 0.04]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Level 4+: Royal Clock Face & Golden Trims */}
      {currentLevel >= 4 && (
        <group>
          <mesh position={[0, 2.8, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.06, 20]} />
            <meshStandardMaterial color="#fffef0" roughness={0.2} metalness={0.1} />
          </mesh>
          <mesh position={[0, 2.8, 0.85]}>
            <torusGeometry args={[0.3, 0.03, 8, 20]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      )}

      {/* Level 5: Royal Citadel with Grand Golden Crest & Celebration Torches */}
      {currentLevel >= 5 && (
        <group>
          <mesh position={[0, 5.2, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.96, 0.04, 8, 24]} />
            <meshStandardMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.1} />
          </mesh>
          {[-2.2, 2.2].map((tx, tidx) => (
            <group key={`corner-turret-${tidx}`} position={[tx, 0.4, 1.7]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.26, 0.3, 1.0, 12]} />
                <meshStandardMaterial color={STONE_WALL} roughness={0.6} />
              </mesh>
              <mesh position={[0, 1.25, 0]} castShadow>
                <coneGeometry args={[0.38, 0.7, 12]} />
                <meshStandardMaterial color={ROOF_BLUE} roughness={0.3} />
              </mesh>
              <mesh position={[0, 1.65, 0]}>
                <sphereGeometry args={[0.06, 10, 10]} />
                <meshStandardMaterial color={GOLD_ACCENT} metalness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
};
