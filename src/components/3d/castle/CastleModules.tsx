import React, { useMemo } from 'react';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';

// ============================================================================
// 1. REFINED ARCHED WINDOW WITH STEPPED STONE VOUSSOIRS & SILL
// ============================================================================
export const CastleWindow: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Heavy Beveled Stone Sill */}
      <mesh position={[0, -0.34, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.48, 0.09, 0.16]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
      </mesh>
      {/* Lower Sill Support Corbels */}
      {[-0.16, 0.16].map((cx, ci) => (
        <mesh key={`sill-corbel-${ci}`} position={[cx, -0.41, 0.04]} castShadow>
          <boxGeometry args={[0.07, 0.06, 0.1]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
        </mesh>
      ))}

      {/* Outer Stone Jambs (Left & Right) */}
      {[-0.2, 0.2].map((jx, ji) => (
        <mesh key={`wjamb-${ji}`} position={[jx, 0, 0.03]} castShadow>
          <boxGeometry args={[0.08, 0.58, 0.12]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
        </mesh>
      ))}

      {/* Outer Arched Stone Arch Hood (Moulded Archivolt) */}
      <mesh position={[0, 0.29, 0.03]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.12, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
      </mesh>

      {/* Carved Stone Keystone at Top Apex */}
      <mesh position={[0, 0.44, 0.06]} castShadow>
        <boxGeometry args={[0.11, 0.13, 0.14]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.5} />
      </mesh>

      {/* Deep Recessed Cavity Wall */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.34, 0.62, 0.08]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.08, 14, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.8} />
      </mesh>

      {/* Warm Golden Emissive Glass Pane */}
      <mesh position={[0, 0.03, 0.025]}>
        <planeGeometry args={[0.3, 0.54]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.25}
          roughness={0.15}
        />
      </mesh>
      <mesh position={[0, 0.28, 0.025]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.01, 14, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.25}
        />
      </mesh>

      {/* Architectural Dark Wooden Window Mullions */}
      <mesh position={[0, 0.12, 0.045]}>
        <boxGeometry args={[0.035, 0.56, 0.02]} />
        <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.08, 0.045]}>
        <boxGeometry args={[0.3, 0.035, 0.02]} />
        <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.25, 0.045]}>
        <boxGeometry args={[0.26, 0.03, 0.02]} />
        <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.85} />
      </mesh>
    </group>
  );
};

// ============================================================================
// 2. GABLED ROOF DORMER (Inset into Conical Tower Roof)
// ============================================================================
export const RoofDormer: React.FC<{
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
}> = ({ position = [0, 0, 0], rotationY = 0, scale = 1 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Dormer Stone Box Base */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.38, 0.44, 0.35]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>

      {/* Dormer Gabled Conical/Pitched Roof */}
      <mesh position={[0, 0.52, 0.02]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.32, 0.38, 4]} />
        <meshStandardMaterial color={CASTLE_COLORS.roofRoyalBlue} roughness={0.3} metalness={0.15} />
      </mesh>
      {/* Gold Ridge Peak Finial */}
      <mesh position={[0, 0.74, 0.02]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} />
      </mesh>

      {/* Dormer Front Arched Window */}
      <mesh position={[0, 0.2, 0.18]}>
        <planeGeometry args={[0.22, 0.28]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.25}
        />
      </mesh>
      <mesh position={[0, 0.34, 0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.01, 10, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.25}
        />
      </mesh>
      {/* Dark Mullion Cross */}
      <mesh position={[0, 0.22, 0.19]}>
        <boxGeometry args={[0.02, 0.28, 0.01]} />
        <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ============================================================================
// 3. PRODUCTION SCULPTED ROOF WITH STEPPED TILES & GOLD FILIGREE
// ============================================================================
export const SculptedRoof: React.FC<{
  radius: number;
  height: number;
  hasDormer?: boolean;
  dormerAngle?: number;
  flagColor?: string;
  flagRef?: React.RefObject<THREE.Mesh>;
}> = ({
  radius,
  height,
  hasDormer = true,
  dormerAngle = 0,
  flagColor = CASTLE_COLORS.bannerRed,
  flagRef,
}) => {
  // Stepped scalloped roof tile rings
  const tileRings = useMemo(() => {
    const rings = 5;
    return Array.from({ length: rings }).map((_, i) => {
      const frac = (i + 1) / (rings + 1);
      const ringY = height * frac * 0.85;
      const ringRadius = radius * (1 - frac * 0.82) * 1.05;
      return { y: ringY, r: ringRadius, isLight: i % 2 === 0 };
    });
  }, [radius, height]);

  return (
    <group position={[0, 0, 0]}>
      {/* Flared Eaves Trim with Shadow Lip */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.94, radius * 1.15, 0.16, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.roofRoyalDark} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <torusGeometry args={[radius * 1.05, 0.045, 8, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
      </mesh>

      {/* Main Faceted Conical Roof (16-sided for crisp stylized specular facets) */}
      <mesh position={[0, height / 2 + 0.15, 0]} castShadow>
        <coneGeometry args={[radius, height, 20]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.roofRoyalBlue}
          roughness={0.48}
          metalness={0.06}
        />
      </mesh>

      {/* Stepped Concentric Tile Ribs / Shingle Overlaps */}
      {tileRings.map((ring, idx) => (
        <group key={`tilerib-${idx}`} position={[0, ring.y + 0.15, 0]}>
          {/* Overlapping Shingle Torus Band */}
          <mesh castShadow>
            <torusGeometry args={[ring.r, 0.038, 8, 20]} />
            <meshStandardMaterial
              color={ring.isLight ? CASTLE_COLORS.roofRoyalTileLight : CASTLE_COLORS.roofRoyalTileDark}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Lower Gold Filigree Ring with Bead Moulding */}
      <group position={[0, height * 0.36, 0]}>
        <mesh>
          <torusGeometry args={[radius * 0.65, 0.036, 8, 24]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} roughness={0.18} />
        </mesh>
        {/* Bead studs along ring */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((bidx) => {
          const ba = (bidx * Math.PI * 2) / 8;
          const bx = Math.sin(ba) * radius * 0.65;
          const bz = Math.cos(ba) * radius * 0.65;
          return (
            <mesh key={`goldbead-${bidx}`} position={[bx, 0, bz]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
            </mesh>
          );
        })}
      </group>

      {/* Upper Gold Collar Ring */}
      <mesh position={[0, height * 0.72, 0]}>
        <torusGeometry args={[radius * 0.32, 0.03, 8, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} roughness={0.18} />
      </mesh>

      {/* Inset Roof Dormer Window */}
      {hasDormer && (
        <RoofDormer
          position={[
            Math.sin(dormerAngle) * (radius * 0.7),
            height * 0.24,
            Math.cos(dormerAngle) * (radius * 0.7),
          ]}
          rotationY={dormerAngle}
          scale={radius * 0.75}
        />
      )}

      {/* Golden Finial Base & Ornate Sphere */}
      <mesh position={[0, height + 0.16, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 0.16, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} />
      </mesh>
      <mesh position={[0, height + 0.3, 0]}>
        <sphereGeometry args={[radius * 0.22, 16, 16]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
      </mesh>

      {/* Finial Needle & Royal Pennant Flag */}
      <mesh position={[0, height + 0.58, 0]}>
        <cylinderGeometry args={[0.02, 0.028, 0.58, 8]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} />
      </mesh>
      <mesh position={[0, height + 0.88, 0]}>
        <coneGeometry args={[0.035, 0.12, 6]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} />
      </mesh>

      {/* Flag with custom ref for wind animation */}
      <mesh
        ref={flagRef}
        position={[radius * 0.28, height + 0.7, 0]}
        castShadow
      >
        <boxGeometry args={[radius * 0.6, 0.22, 0.02]} />
        <meshStandardMaterial color={flagColor} roughness={0.4} />
      </mesh>
    </group>
  );
};

// ============================================================================
// 4. CRENELLATED STONE BATTLEMENTS WITH CORBEL BRACKETS
// ============================================================================
export const CastleBattlementRing: React.FC<{
  radius: number;
  count?: number;
  height?: number;
  width?: number;
  depth?: number;
  yOffset?: number;
}> = ({ radius, count = 8, height = 0.24, width = 0.22, depth = 0.12, yOffset = 0 }) => {
  const crenellations = useMemo(() => {
    return Array.from({ length: count }).map((_, idx) => {
      const angle = (idx * Math.PI * 2) / count;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      return { x, z, rotY: angle };
    });
  }, [radius, count]);

  return (
    <group position={[0, yOffset, 0]}>
      {/* Supporting Stone Corbels Underneath */}
      {crenellations.map((c, i) => (
        <group key={`corbel-group-${i}`} position={[c.x * 0.88, -0.06, c.z * 0.88]} rotation={[0, c.rotY, 0]}>
          <mesh castShadow>
            <boxGeometry args={[width * 0.7, 0.14, depth * 1.2]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Walkway Slab */}
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.05, radius * 1.05, 0.06, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
      </mesh>

      {/* Crenellation Merlons with Coping Stones */}
      {crenellations.map((c, i) => (
        <group key={`cren-${i}`} position={[c.x, height / 2, c.z]} rotation={[0, c.rotY, 0]}>
          <mesh castShadow>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
          </mesh>
          {/* Beveled Top Coping Stone */}
          <mesh position={[0, height / 2 + 0.02, 0]} castShadow>
            <boxGeometry args={[width * 1.12, 0.04, depth * 1.15]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ============================================================================
// 5. ROYAL GOLDEN CROWN MEDALLION (High Relief with Studded Jewels)
// ============================================================================
export const CrownMedallion: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Classical Stone Cartouche Frame */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.56, 0.09, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.5} />
      </mesh>

      {/* Golden Filigree Scrollwork Ring */}
      <mesh position={[0, 0, 0.045]}>
        <torusGeometry args={[0.5, 0.05, 12, 32]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.goldPolished}
          metalness={0.7}
          roughness={0.16}
        />
      </mesh>
      {/* Outer Laurel / Filigree Beads */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((fidx) => {
        const fa = (fidx * Math.PI * 2) / 12;
        return (
          <mesh key={`fbead-${fidx}`} position={[Math.sin(fa) * 0.53, Math.cos(fa) * 0.53, 0.045]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
          </mesh>
        );
      })}

      {/* Inner Recessed Royal Velvet Core Disc */}
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.02, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.carpetRoyalBlue} roughness={0.4} />
      </mesh>

      {/* High-Relief 3D Embossed Royal Crown */}
      <group position={[0, -0.05, 0.07]}>
        {/* Crown Circlet Band */}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.48, 0.08, 0.05]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.14} />
        </mesh>
        {/* Circlet Jewel Studs (Ruby, Emerald, Sapphire) */}
        {[-0.16, -0.08, 0, 0.08, 0.16].map((jx, ji) => (
          <mesh key={`cjewel-${ji}`} position={[jx, -0.12, 0.032]}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshStandardMaterial
              color={
                ji === 2
                  ? CASTLE_COLORS.gemRuby
                  : ji % 2 === 0
                  ? CASTLE_COLORS.gemSapphire
                  : CASTLE_COLORS.gemEmerald
              }
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>
        ))}

        {/* Central Dominant Peak */}
        <mesh position={[0, 0.08, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.08, 0.32, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.14} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
        </mesh>

        {/* Intermediate Peaks */}
        {[-0.15, 0.15].map((px, pi) => (
          <group key={`cpeak-${pi}`} position={[px, 0.03, 0]}>
            <mesh rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[0.06, 0.24, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.14} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.032, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
            </mesh>
          </group>
        ))}

        {/* Outer Flaring Wings */}
        {[-0.24, 0.24].map((ox, oi) => (
          <group key={`cout-${oi}`} position={[ox, -0.02, 0]} rotation={[0, 0, oi === 0 ? 0.38 : -0.38]}>
            <mesh rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[0.05, 0.18, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.14} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// ============================================================================
// 6. GRAND ARCHED ENTRANCE PORTAL (Triple Archivolts & Sconces)
// ============================================================================
export const ArchedEntrancePortal: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Flanking Stone Pilasters with Layered Mouldings */}
      {[-0.92, 0.92].map((jx, ji) => (
        <group key={`portal-pilaster-${ji}`} position={[jx, 1.1, 0]}>
          {/* Main Shaft */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.38, 2.2, 0.44]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
          </mesh>
          {/* Base Plinth */}
          <mesh position={[0, -1.02, 0.04]} castShadow>
            <boxGeometry args={[0.46, 0.22, 0.52]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
          </mesh>
          {/* Classical Capital */}
          <mesh position={[0, 1.05, 0.04]} castShadow>
            <boxGeometry args={[0.46, 0.16, 0.52]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* Triple Stepped Archivolts (Concentric Arches) */}
      {/* Outer Archivolt */}
      <mesh position={[0, 2.18, 0.04]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.02, 1.02, 0.42, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
      </mesh>
      {/* Middle Archivolt */}
      <mesh position={[0, 2.18, 0.08]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.36, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>
      {/* Inner Archivolt */}
      <mesh position={[0, 2.18, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.74, 0.74, 0.3, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.6} />
      </mesh>

      {/* Prominent Keystone with Gold Fleur-de-lis Relief */}
      <group position={[0, 3.12, 0.12]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.4, 0.48]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.26]}>
          <coneGeometry args={[0.08, 0.22, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} roughness={0.16} />
        </mesh>
      </group>

      {/* Deep Recessed Doorway Arch Cavity */}
      <mesh position={[0, 1.1, -0.06]}>
        <boxGeometry args={[1.44, 2.2, 0.32]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.18, -0.06]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.72, 0.72, 0.32, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.8} />
      </mesh>

      {/* Heavy Double Wooden Castle Doors */}
      <group position={[0, 1.05, 0.02]}>
        {/* Left Door Leaf */}
        <mesh position={[-0.34, 0, 0]} castShadow>
          <boxGeometry args={[0.66, 2.05, 0.09]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.65} />
        </mesh>
        {/* Right Door Leaf */}
        <mesh position={[0.34, 0, 0]} castShadow>
          <boxGeometry args={[0.66, 2.05, 0.09]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.65} />
        </mesh>

        {/* Door Plank Vertical Seams */}
        {[-0.52, -0.18, 0.18, 0.52].map((px, pi) => (
          <mesh key={`dseam-${pi}`} position={[px, 0, 0.052]}>
            <boxGeometry args={[0.02, 2.0, 0.015]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.9} />
          </mesh>
        ))}

        {/* Wrought Iron Ornamental Hinges & Studs */}
        {[-0.64, 0.64].map((hx, hi) => (
          <React.Fragment key={`hinge-${hi}`}>
            <mesh position={[hx * 0.78, 0.68, 0.055]}>
              <boxGeometry args={[0.36, 0.07, 0.02]} />
              <meshStandardMaterial color={CASTLE_COLORS.ironHardware} metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[hx * 0.78, -0.68, 0.055]}>
              <boxGeometry args={[0.36, 0.07, 0.02]} />
              <meshStandardMaterial color={CASTLE_COLORS.ironHardware} metalness={0.85} roughness={0.3} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Golden Lion-Head / Ring Door Knockers */}
        {[-0.1, 0.1].map((kx, ki) => (
          <group key={`dknob-${ki}`} position={[kx, -0.06, 0.065]}>
            <mesh>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} roughness={0.15} />
            </mesh>
            <mesh position={[0, -0.04, 0]}>
              <torusGeometry args={[0.045, 0.014, 8, 16]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} roughness={0.15} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Arched Fanlight Transom Glow Above Doors */}
      <mesh position={[0, 2.18, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.7, 0.7, 0.06, 18, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={2.0}
          roughness={0.2}
        />
      </mesh>
      {/* Transom Radial Sunburst Spokes */}
      {[0, Math.PI / 6, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3, (5 * Math.PI) / 6, Math.PI].map(
        (rad, ri) => (
          <mesh key={`spoke-${ri}`} position={[0, 2.18, 0.065]} rotation={[0, 0, rad]}>
            <boxGeometry args={[0.028, 0.7, 0.025]} />
            <meshStandardMaterial color={CASTLE_COLORS.ironHardware} metalness={0.8} />
          </mesh>
        )
      )}

      {/* Twin Wall Sconces with Warm Glowing Lanterns */}
      {[-1.25, 1.25].map((sx, si) => (
        <group key={`sconce-${si}`} position={[sx, 1.5, 0.2]}>
          {/* Wall Scrollwork Bracket */}
          <mesh castShadow>
            <boxGeometry args={[0.09, 0.24, 0.2]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} />
          </mesh>
          {/* Hexagonal Bronze Lantern Body */}
          <mesh position={[0, -0.08, 0.14]} castShadow>
            <cylinderGeometry args={[0.1, 0.07, 0.2, 6]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} />
          </mesh>
          {/* Glowing Flame Core */}
          <mesh position={[0, -0.08, 0.14]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color="#fffbeb"
              emissive={CASTLE_COLORS.lightGlowEmissive}
              emissiveIntensity={3.0}
            />
          </mesh>
          {/* Local Warm Sconce Point Light */}
          <pointLight position={[0, -0.08, 0.18]} color="#fed7aa" intensity={0.5} distance={3.2} decay={2} />
        </group>
      ))}
    </group>
  );
};

// ============================================================================
// 7. ROYAL HERALDIC BANNER WITH GOLDEN FLEUR-DE-LIS & TASSELS
// ============================================================================
export const RoyalHeraldicBanner: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Top Gold Mounting Bracket & Crossbar */}
      <mesh position={[0, 1.0, 0.08]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.7} roughness={0.15} />
      </mesh>
      {/* Gold End Cap Finials */}
      {[-0.46, 0.46].map((ex, ei) => (
        <mesh key={`bfin-${ei}`} position={[ex, 1.0, 0.08]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} roughness={0.1} />
        </mesh>
      ))}

      {/* Royal Blue / Purple Fabric Banner Body */}
      <mesh position={[0, 0.38, 0.05]} castShadow>
        <boxGeometry args={[0.74, 1.25, 0.02]} />
        <meshStandardMaterial color={CASTLE_COLORS.bannerBlue} roughness={0.5} />
      </mesh>

      {/* V-Notch Swallowtail Bottom with Gold Tassels */}
      <mesh position={[0, -0.32, 0.05]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.37, 0.34, 3]} />
        <meshStandardMaterial color={CASTLE_COLORS.bannerBlue} roughness={0.5} />
      </mesh>

      {/* Gold Border Trim Around Banner */}
      <mesh position={[0, 0.38, 0.065]}>
        <boxGeometry args={[0.7, 1.2, 0.01]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.38, 0.072]}>
        <boxGeometry args={[0.62, 1.12, 0.01]} />
        <meshStandardMaterial color={CASTLE_COLORS.bannerBlue} roughness={0.5} />
      </mesh>

      {/* Golden Fleur-de-lis Insignia on Banner */}
      <group position={[0, 0.42, 0.085]}>
        {/* Central Petal */}
        <mesh position={[0, 0.1, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.08, 0.28, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.96} roughness={0.14} />
        </mesh>
        {/* Left & Right Curved Petals */}
        {[-0.1, 0.1].map((lx, li) => (
          <mesh key={`flpetal-${li}`} position={[lx, 0.03, 0]} rotation={[0, Math.PI / 4, li === 0 ? 0.48 : -0.48]}>
            <coneGeometry args={[0.06, 0.2, 4]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.96} roughness={0.14} />
          </mesh>
        ))}
        {/* Fleur-de-lis Tie Bar */}
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.26, 0.05, 0.025]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.96} roughness={0.14} />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 8. PRODUCTION MODULAR CASTLE TOWER WITH SCULPTED ROOF
// ============================================================================
export const CastleTower: React.FC<{
  position: [number, number, number];
  height: number;
  radius: number;
  roofHeight: number;
  roofRadius: number;
  hasBattlement?: boolean;
  hasWindow?: boolean;
  hasDormer?: boolean;
  dormerAngle?: number;
  flagColor?: string;
  flagRef?: React.RefObject<THREE.Mesh>;
  scale?: number;
}> = ({
  position,
  height,
  radius,
  roofHeight,
  roofRadius,
  hasBattlement = true,
  hasWindow = true,
  hasDormer = true,
  dormerAngle = 0,
  flagColor = CASTLE_COLORS.bannerRed,
  flagRef,
  scale = 1,
}) => {
  return (
    <group position={position} scale={scale}>
      {/* Heavy Rusticated Base Plinth */}
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.18, radius * 1.28, 0.32, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.08, radius * 1.18, 0.12, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
      </mesh>

      {/* Main Stone Tower Shaft */}
      <mesh position={[0, height / 2 + 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.96, radius, height, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>

      {/* Vertical Stone Pilasters (4 Quadrants) for Architectural Depth */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((pa, pi) => {
        const px = Math.sin(pa) * (radius * 0.98);
        const pz = Math.cos(pa) * (radius * 0.98);
        return (
          <mesh key={`tpilaster-${pi}`} position={[px, height / 2 + 0.2, pz]} rotation={[0, pa, 0]} castShadow>
            <boxGeometry args={[radius * 0.18, height * 0.92, 0.08]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
        );
      })}

      {/* Middle Beveled Stringcourse Belt */}
      <mesh position={[0, height * 0.55, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.08, radius * 1.08, 0.14, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Overhanging Machicolation Gallery with Deep Corbels */}
      <mesh position={[0, height + 0.1, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.25, radius * 0.98, 0.26, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Crenellated Battlements */}
      {hasBattlement && (
        <CastleBattlementRing
          radius={radius * 1.2}
          count={Math.max(6, Math.round(radius * 14))}
          height={0.24}
          width={radius * 0.42}
          depth={0.12}
          yOffset={height + 0.22}
        />
      )}

      {/* Production Sculpted Roof Spire with Stepped Tiles & Finial */}
      <group position={[0, height + 0.26, 0]}>
        <SculptedRoof
          radius={roofRadius}
          height={roofHeight}
          hasDormer={hasDormer}
          dormerAngle={dormerAngle}
          flagColor={flagColor}
          flagRef={flagRef}
        />
      </group>

      {/* Front Arched Window */}
      {hasWindow && (
        <CastleWindow
          position={[0, height * 0.68, radius * 0.96]}
          scale={radius * 1.08}
        />
      )}
    </group>
  );
};
