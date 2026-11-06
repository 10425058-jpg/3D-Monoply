import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';

// ============================================================================
// 1. HIGH-QUALITY STYLIZED SAKURA (CHERRY BLOSSOM) TREE
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
      canopyRef.current.rotation.z = Math.sin(t * 1.5 + position[0]) * 0.025;
      canopyRef.current.rotation.x = Math.cos(t * 1.2 + position[2]) * 0.02;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Root Base Mound */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.34, 0.44, 0.16, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.9} />
      </mesh>

      {/* Main Curved Trunk */}
      <mesh position={[0, 0.65, 0]} rotation={[0.08, 0, 0.06]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 1.2, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
      </mesh>

      {/* Main Forking Branches */}
      <mesh position={[-0.22, 1.25, 0.08]} rotation={[0, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.7, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
      </mesh>
      <mesh position={[0.22, 1.22, -0.06]} rotation={[0, 0, -0.45]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.68, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.85} />
      </mesh>

      {/* Volumetric Pink Blossom Clusters (Canopy) */}
      <group ref={canopyRef} position={[0, 1.4, 0]}>
        {/* Central High Blossom Dome */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <sphereGeometry args={[0.88, 18, 18]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.sakuraLight}
            roughness={0.7}
          />
        </mesh>

        {/* Left Side Cluster (Bright Mid-Pink) */}
        <mesh position={[-0.52, 0.25, 0.28]} castShadow>
          <sphereGeometry args={[0.66, 16, 16]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.sakuraMid}
            roughness={0.7}
          />
        </mesh>

        {/* Right Side Cluster (Deep Rose) */}
        <mesh position={[0.55, 0.28, -0.22]} castShadow>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.sakuraDeep}
            roughness={0.7}
          />
        </mesh>

        {/* Foreground Cluster */}
        <mesh position={[0.18, 0.05, 0.52]} castShadow>
          <sphereGeometry args={[0.58, 14, 14]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.sakuraLight}
            roughness={0.7}
          />
        </mesh>

        {/* Background Accent Cluster */}
        <mesh position={[-0.28, 0.15, -0.48]} castShadow>
          <sphereGeometry args={[0.6, 14, 14]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.sakuraMid}
            roughness={0.7}
          />
        </mesh>

        {/* Topmost Petite Sprout */}
        <mesh position={[0.08, 0.92, 0.05]} castShadow>
          <sphereGeometry args={[0.46, 14, 14]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.sakuraLight}
            roughness={0.7}
          />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 2. STYLIZED CYPRESS / EVERGREEN PINE (Panel 07)
// ============================================================================
export const StylizedCypressTree: React.FC<{
  position: [number, number, number];
  scale?: number;
}> = ({ position, scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Short Trunk */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, 0.4, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.sakuraTrunk} roughness={0.9} />
      </mesh>

      {/* Tier 1 Bottom Cone */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <coneGeometry args={[0.58, 0.75, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.pineFoliage} roughness={0.75} flatShading />
      </mesh>

      {/* Tier 2 Middle Cone */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.46, 0.7, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.pineFoliageLight} roughness={0.75} flatShading />
      </mesh>

      {/* Tier 3 Top Cone */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[0.32, 0.65, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.pineFoliage} roughness={0.75} flatShading />
      </mesh>
    </group>
  );
};

// ============================================================================
// 3. FLOWER-COVERED ROMANTIC GARDEN ARBOR ARCHWAY (Panel 04)
// ============================================================================
export const GardenRoseArbor: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 2 Stone Arbor Pillars */}
      {[-0.55, 0.55].map((px, pi) => (
        <group key={`apill-${pi}`} position={[px, 0.75, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.065, 0.08, 1.5, 12]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.7, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.22]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* Semi-circular Arch Trellis */}
      <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.14, 16, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>

      {/* Climbing Green Foliage Layer */}
      <mesh position={[0, 1.54, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 0.18, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
      </mesh>

      {/* Pink & Red Rose Blossoms along the arch */}
      {[-0.45, -0.22, 0, 0.22, 0.45].map((rx, ri) => {
        const angle = (ri * Math.PI) / 4;
        const ax = Math.cos(angle) * 0.64;
        const ay = 1.5 + Math.sin(angle) * 0.64;
        return (
          <mesh key={`arose-${ri}`} position={[ax, ay, (ri % 2) * 0.08 - 0.04]}>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshStandardMaterial
              color={ri % 2 === 0 ? CASTLE_COLORS.flowerRose : CASTLE_COLORS.sakuraMid}
              roughness={0.6}
            />
          </mesh>
        );
      })}

      {/* Stepping Stone Garden Path through the arch */}
      {[-0.45, 0, 0.45].map((sz, si) => (
        <mesh key={`astep-${si}`} position={[0, 0.015, sz]} receiveShadow>
          <boxGeometry args={[0.52, 0.02, 0.32]} />
          <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// ============================================================================
// 4. CURVED GARDEN HEDGES & FLOWERBEDS
// ============================================================================
export const GardenFlowerBeds: React.FC = () => {
  return (
    <group>
      {/* Symmetrical Curved Plaza Border Hedges */}
      {[-2.2, 2.2].map((hx, hi) => (
        <group key={`plazabed-${hi}`} position={[hx, 0.32, 1.5]}>
          {/* Manicured Boxwood Hedge Segment */}
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.24, 0.38]} />
            <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
          </mesh>
          {/* Colorful Flower Tops */}
          {[-0.6, -0.2, 0.2, 0.6].map((fx, fi) => (
            <mesh key={`pflower-${hi}-${fi}`} position={[fx, 0.26, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial
                color={fi % 3 === 0 ? CASTLE_COLORS.flowerRose : fi % 3 === 1 ? CASTLE_COLORS.flowerYellow : CASTLE_COLORS.flowerLavender}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* North Symmetrical Hedges along Castle Apron */}
      {[-2.6, 2.6].map((hx, hi) => (
        <group key={`nbed-${hi}`} position={[hx, 0.32, -0.6]}>
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.24, 0.36]} />
            <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
          </mesh>
          {[-0.5, 0, 0.5].map((fx, fi) => (
            <mesh key={`nflower-${hi}-${fi}`} position={[fx, 0.26, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial
                color={fi % 2 === 0 ? CASTLE_COLORS.sakuraMid : CASTLE_COLORS.flowerYellow}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Stepping Flagstone Path from South Promenade to Plaza */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((stepZ, si) => (
        <mesh key={`flagstone-${si}`} position={[(si % 2 === 0 ? 0.08 : -0.08), 0.33, 4.2 + stepZ * 0.5]} receiveShadow>
          <boxGeometry args={[0.62, 0.02, 0.38]} />
          <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};
