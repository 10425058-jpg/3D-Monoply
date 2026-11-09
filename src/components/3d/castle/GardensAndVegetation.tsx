import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';

// ============================================================================
// 1. PRODUCTION STYLIZED SAKURA (CHERRY BLOSSOM) TREE (Panels 01, 05, 06)
// ============================================================================
export const StylizedSakuraTree: React.FC<{
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
}> = ({ position, scale = 1, rotationY = 0 }) => {
  const canopyRef = useRef<THREE.Group>(null);

  // Subtle wind sway animation
  useFrame(({ clock }) => {
    if (canopyRef.current) {
      const t = clock.elapsedTime;
      canopyRef.current.rotation.z = Math.sin(t * 1.4 + position[0] * 1.5) * 0.022;
      canopyRef.current.rotation.x = Math.cos(t * 1.1 + position[2] * 1.5) * 0.018;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Root Base Mound & Gnarled Buttress Roots */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.34, 0.48, 0.16, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.9} />
      </mesh>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((ra, ri) => (
        <mesh
          key={`root-${ri}`}
          position={[Math.sin(ra) * 0.28, 0.05, Math.cos(ra) * 0.28]}
          rotation={[0, ra, 0.2]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.1, 0.3]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.9} />
        </mesh>
      ))}

      {/* Main Curved Organic Trunk */}
      <mesh position={[0.02, 0.65, 0]} rotation={[0.08, 0, 0.06]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 1.25, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
      </mesh>

      {/* Primary Organic Forking Branches */}
      <group position={[0, 1.2, 0]}>
        <mesh position={[-0.24, 0.26, 0.08]} rotation={[0.1, 0, 0.52]} castShadow>
          <cylinderGeometry args={[0.1, 0.15, 0.74, 6]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
        </mesh>
        <mesh position={[0.24, 0.24, -0.06]} rotation={[-0.1, 0, -0.5]} castShadow>
          <cylinderGeometry args={[0.1, 0.15, 0.72, 6]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.3, -0.2]} rotation={[-0.52, 0, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.13, 0.62, 6]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
        </mesh>
      </group>

      {/* Rich Multi-Tonal Blossom Canopy (Cloud-Like Fluffy Clusters) */}
      <group ref={canopyRef} position={[0, 1.45, 0]}>
        {/* Core Upper Crown (Bright Vivid Blossom) */}
        <mesh position={[0, 0.52, 0]} scale={[1, 0.82, 0.94]} castShadow>
          <sphereGeometry args={[0.88, 16, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraMid} roughness={0.92} />
        </mesh>

        {/* Top Highlight Dome (Pastel Soft Blossom) */}
        <mesh position={[0.06, 0.95, 0.04]} castShadow>
          <sphereGeometry args={[0.54, 14, 14]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraLight} roughness={0.92} />
        </mesh>

        {/* Left Side Cluster (Deep Rose Petal Shadow) */}
        <mesh position={[-0.58, 0.3, 0.25]} scale={[1.08, 0.78, 0.9]} castShadow>
          <sphereGeometry args={[0.72, 14, 14]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraDeep} roughness={0.92} />
        </mesh>

        {/* Right Side Cluster (Vivid Blossom Pink) */}
        <mesh position={[0.6, 0.32, -0.22]} castShadow>
          <sphereGeometry args={[0.74, 14, 14]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraMid} roughness={0.92} />
        </mesh>

        {/* Front Foreground Puff (Soft Pastel Blossom) */}
        <mesh position={[0.22, 0.1, 0.54]} castShadow>
          <sphereGeometry args={[0.64, 14, 14]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraLight} roughness={0.92} />
        </mesh>

        {/* Rear Accent Puff (Deep Magenta) */}
        <mesh position={[-0.28, 0.2, -0.52]} castShadow>
          <sphereGeometry args={[0.66, 14, 14]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraDeep} roughness={0.92} />
        </mesh>

        {/* Flanking Side Puffs */}
        <mesh position={[-0.45, 0.65, -0.2]} castShadow>
          <sphereGeometry args={[0.48, 12, 12]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraLight} roughness={0.92} />
        </mesh>
        <mesh position={[0.42, 0.68, 0.18]} castShadow>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraMid} roughness={0.92} />
        </mesh>

        {/* Fresh Leaf Sprigs peeking through blossoms */}
        {[-0.38, 0.42].map((lx, li) => (
          <mesh key={`lsprig-${li}`} position={[lx, 0.06, (li % 2) * 0.4 - 0.2]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.pineFoliageLight} roughness={0.75} />
          </mesh>
        ))}
      </group>

      {/* Fallen Blossom Petal Clusters at Base */}
      {[-0.35, 0.3, -0.12, 0.26].map((px, pi) => (
        <mesh key={`petal-${pi}`} position={[px, 0.02, pi % 2 === 0 ? 0.34 : -0.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.01, 6]} />
          <meshStandardMaterial color={CASTLE_COLORS.sakuraMid} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
};

// ============================================================================
// 2. PRODUCTION SCULPTED EVERGREEN CYPRESS (Panels 07 & 09)
// ============================================================================
export const StylizedCypressTree: React.FC<{
  position: [number, number, number];
  scale?: number;
}> = ({ position, scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Organic Trunk Base */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.44, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.9} />
      </mesh>

      {/* Tier 1 Bottom Branch Whorl (Faceted with Shaded Underside Rim) */}
      <group position={[0, 0.72, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.68, 0.7, 10]} />
          <meshStandardMaterial color={CASTLE_COLORS.pineFoliage} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <cylinderGeometry args={[0.66, 0.7, 0.08, 10]} />
          <meshStandardMaterial color="#0f4a24" roughness={0.8} />
        </mesh>
      </group>

      {/* Tier 2 Middle Branch Whorl */}
      <group position={[0, 1.25, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.54, 0.65, 10]} />
          <meshStandardMaterial color={CASTLE_COLORS.pineFoliageLight} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.52, 0.56, 0.07, 10]} />
          <meshStandardMaterial color="#15803d" roughness={0.8} />
        </mesh>
      </group>

      {/* Tier 3 Upper Branch Whorl */}
      <group position={[0, 1.74, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.38, 0.6, 8]} />
          <meshStandardMaterial color={CASTLE_COLORS.pineFoliage} roughness={0.7} flatShading />
        </mesh>
      </group>

      {/* Tier 4 Top Spire Tip */}
      <mesh position={[0, 2.18, 0]} castShadow>
        <coneGeometry args={[0.2, 0.52, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.pineFoliageLight} roughness={0.7} flatShading />
      </mesh>
    </group>
  );
};

// ============================================================================
// 3. FLOWER-COVERED ROMANTIC GARDEN ROSE ARBOR (Panel 04 & 07)
// ============================================================================
export const GardenRoseArbor: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 2 Stone Arbor Pillars with Plinths */}
      {[-0.6, 0.6].map((px, pi) => (
        <group key={`apill-${pi}`} position={[px, 0.8, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.09, 1.6, 12]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.74, 0]} castShadow>
            <boxGeometry args={[0.24, 0.14, 0.24]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.92} />
          </mesh>
        </group>
      ))}

      {/* Semi-circular Arch Trellis */}
      <mesh position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.16, 18, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>

      {/* Lush Climbing Green Vine Foliage */}
      <mesh position={[0, 1.64, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.7, 0.7, 0.22, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
      </mesh>

      {/* Blooming Pink & Rose Blossoms along the archway */}
      {[-0.48, -0.24, 0, 0.24, 0.48].map((rx, ri) => {
        const angle = (ri * Math.PI) / 4;
        const ax = Math.cos(angle) * 0.68;
        const ay = 1.6 + Math.sin(angle) * 0.68;
        return (
          <mesh key={`arose-${ri}`} position={[ax, ay, (ri % 2) * 0.09 - 0.045]}>
            <sphereGeometry args={[0.085, 8, 8]} />
            <meshStandardMaterial
              color={ri % 2 === 0 ? CASTLE_COLORS.flowerRose : CASTLE_COLORS.sakuraMid}
              roughness={0.6}
            />
          </mesh>
        );
      })}

      {/* Stepping Stone Garden Path through the archway */}
      {[-0.5, 0, 0.5].map((sz, si) => (
        <mesh key={`astep-${si}`} position={[0, 0.015, sz]} receiveShadow>
          <boxGeometry args={[0.55, 0.02, 0.35]} />
          <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// ============================================================================
// 4. RICH GARDEN HEDGES, BORDERS & FLOWERBEDS (Panels 05 & 06)
// ============================================================================
export const GardenFlowerBeds: React.FC = () => {
  return (
    <group>
      {/* Symmetrical Curved Plaza Border Hedges with Stone Edging */}
      {[-2.25, 2.25].map((hx, hi) => (
        <group key={`plazabed-${hi}`} position={[hx, 0.32, 1.5]}>
          {/* Stone Kerb Edging */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[1.72, 0.08, 0.46]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
          </mesh>
          {/* Boxwood Hedge Mass */}
          <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.65, 0.26, 0.4]} />
            <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
          </mesh>
          {/* Multi-tonal Flower Clusters (Roses, Daisies, Lavender) */}
          {[-0.65, -0.22, 0.22, 0.65].map((fx, fi) => (
            <mesh key={`pflower-${hi}-${fi}`} position={[fx, 0.3, 0]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial
                color={
                  fi % 3 === 0
                    ? CASTLE_COLORS.flowerRose
                    : fi % 3 === 1
                    ? CASTLE_COLORS.flowerYellow
                    : CASTLE_COLORS.flowerLavender
                }
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* North Symmetrical Flowerbeds along Castle Apron */}
      {[-2.7, 2.7].map((hx, hi) => (
        <group key={`nbed-${hi}`} position={[hx, 0.32, -0.6]}>
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[1.6, 0.08, 0.42]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.52, 0.25, 0.38]} />
            <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
          </mesh>
          {[-0.52, 0, 0.52].map((fx, fi) => (
            <mesh key={`nflower-${hi}-${fi}`} position={[fx, 0.28, 0]}>
              <sphereGeometry args={[0.085, 8, 8]} />
              <meshStandardMaterial
                color={fi % 2 === 0 ? CASTLE_COLORS.sakuraMid : CASTLE_COLORS.flowerYellow}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Stepping Flagstone Path from South Promenade to Central Plaza */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((stepZ, si) => (
        <mesh
          key={`flagstone-${si}`}
          position={[si % 2 === 0 ? 0.08 : -0.08, 0.33, 4.2 + stepZ * 0.5]}
          receiveShadow
        >
          <boxGeometry args={[0.65, 0.02, 0.4]} />
          <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};
