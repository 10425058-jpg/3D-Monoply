import React from 'react';
import { CASTLE_COLORS } from './CastleMaterials';

// ============================================================================
// 1. VICTORIAN STREET LAMPPOST WITH WARM GLOWING LANTERN
// ============================================================================
export const VictorianStreetLamp: React.FC<{
  position: [number, number, number];
  scale?: number;
}> = ({ position, scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Stone / Bronze Base Plinth */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.16, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Main Fluted Bronze Post */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.038, 0.055, 1.0, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Middle Decorative Ring */}
      <mesh position={[0, 0.42, 0]}>
        <torusGeometry args={[0.052, 0.018, 6, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Upper Capital / Lantern Cradle */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.045, 0.12, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} />
      </mesh>

      {/* Hexagonal Glass Lantern Cage */}
      <mesh position={[0, 1.34, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.09, 0.22, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} roughness={0.25} wireframe={false} />
      </mesh>

      {/* Lantern Roof Cap & Top Spike */}
      <mesh position={[0, 1.48, 0]} castShadow>
        <coneGeometry args={[0.14, 0.12, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.9} />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.1, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.95} />
      </mesh>

      {/* Warm Emissive Core Bulb */}
      <mesh position={[0, 1.33, 0]}>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshStandardMaterial
          color="#fffbeb"
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={2.6}
        />
      </mesh>

      {/* Point Light for local tabletop glow */}
      <pointLight position={[0, 1.35, 0]} color="#fed7aa" intensity={0.45} distance={3.8} decay={2} />
    </group>
  );
};

// ============================================================================
// 2. ROYAL STANDING BANNER ON GOLD POLE (Panel 07)
// ============================================================================
export const RoyalStandingBanner: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}> = ({ position, rotationY = 0, scale = 1 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Base Plinth */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.12, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
      </mesh>

      {/* Tall Gold Pole */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
      </mesh>

      {/* Spearhead Top Finial */}
      <mesh position={[0, 1.95, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.08, 0.22, 4]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
      </mesh>

      {/* Crossbar */}
      <mesh position={[0, 1.65, 0.08]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.65, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} />
      </mesh>

      {/* Royal Purple / Blue Fabric Banner */}
      <group position={[0, 1.15, 0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.54, 0.95, 0.02]} />
          <meshStandardMaterial color={CASTLE_COLORS.bannerPurple} roughness={0.45} />
        </mesh>
        {/* V-Notch Swallowtail Bottom */}
        <mesh position={[0, -0.55, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.27, 0.24, 3]} />
          <meshStandardMaterial color={CASTLE_COLORS.bannerPurple} roughness={0.45} />
        </mesh>
        {/* Gold Fleur-de-lis Emblem */}
        <mesh position={[0, 0.05, 0.02]}>
          <boxGeometry args={[0.18, 0.28, 0.015]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.95} roughness={0.15} />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 3. CLASSIC SLATTED WOODEN PARK BENCH (Panel 07)
// ============================================================================
export const ClassicParkBench: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}> = ({ position, rotationY = 0, scale = 1 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* 3 Wooden Seat Slats */}
      {[-0.07, 0, 0.07].map((sz, si) => (
        <mesh key={`seat-slat-${si}`} position={[0, 0.2, sz]} castShadow>
          <boxGeometry args={[1.05, 0.03, 0.055]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodBench} roughness={0.7} />
        </mesh>
      ))}

      {/* 2 Wooden Backrest Slats */}
      {[0.32, 0.42].map((by, bi) => (
        <mesh key={`back-slat-${bi}`} position={[0, by, -0.12]} rotation={[-0.18, 0, 0]} castShadow>
          <boxGeometry args={[1.05, 0.065, 0.03]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodBench} roughness={0.7} />
        </mesh>
      ))}

      {/* Curved Dark Cast-Iron Legs & Armrests */}
      {[-0.44, 0.44].map((lx, li) => (
        <group key={`bench-leg-${li}`} position={[lx, 0, 0]}>
          {/* Front Leg */}
          <mesh position={[0, 0.1, 0.09]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.2, 6]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
          </mesh>
          {/* Back Leg */}
          <mesh position={[0, 0.1, -0.09]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.2, 6]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
          </mesh>
          {/* Curved Armrest Loop */}
          <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.1, 0.016, 6, 12, Math.PI]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ============================================================================
// 4. SQUARE STONE FLOWER PLANTER BOX (Panel 07)
// ============================================================================
export const StoneFlowerPlanter: React.FC<{
  position: [number, number, number];
  scale?: number;
}> = ({ position, scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Stone Base Plinth */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.12, 0.48]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
      </mesh>
      {/* Stone Planter Body */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.22, 0.42]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
      </mesh>
      {/* Top Moulded Rim */}
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.48, 0.04, 0.48]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.5} />
      </mesh>

      {/* Soil */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.38, 0.02, 0.38]} />
        <meshStandardMaterial color="#3f2e1e" roughness={0.9} />
      </mesh>

      {/* Lush Blooming Flower Cluster */}
      <group position={[0, 0.4, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
        </mesh>
        {/* Flower Blossoms */}
        {[-0.08, 0.08].map((fx, fi) => (
          <mesh key={`plflower-${fi}`} position={[fx, 0.06, (fi % 2) * 0.1 - 0.05]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial
              color={fi === 0 ? CASTLE_COLORS.flowerRose : CASTLE_COLORS.flowerYellow}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// ============================================================================
// 5. GOLD-TIPPED STONE BOLLARD PILLAR (Panel 07)
// ============================================================================
export const GoldStoneBollard: React.FC<{
  position: [number, number, number];
}> = ({ position }) => {
  return (
    <group position={position}>
      {/* Stone Base */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.22, 0.3, 0.22]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
      </mesh>
      {/* Beveled Top Cap */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.26, 0.06, 0.26]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.55} />
      </mesh>
      {/* Polished Gold Sphere Finial */}
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.95} roughness={0.15} />
      </mesh>
    </group>
  );
};
