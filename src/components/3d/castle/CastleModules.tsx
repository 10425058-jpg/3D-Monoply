import React, { useMemo } from 'react';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';

// ============================================================================
// 1. ARCHED WINDOW WITH GLOWING PANE & STONE CORNICE
// ============================================================================
export const CastleWindow: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Stone Sill */}
      <mesh position={[0, -0.32, 0.04]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.12]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
      </mesh>

      {/* Recessed Window Frame */}
      <mesh position={[0, 0, 0.02]} castShadow>
        <boxGeometry args={[0.34, 0.54, 0.06]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
      </mesh>

      {/* Arched Top Stone Hood */}
      <mesh position={[0, 0.27, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
      </mesh>

      {/* Warm Golden Emissive Glass Pane */}
      <mesh position={[0, -0.02, 0.04]}>
        <planeGeometry args={[0.26, 0.44]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.5}
          roughness={0.2}
        />
      </mesh>

      {/* Arched Pane Top */}
      <mesh position={[0, 0.2, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Window Mullions / Cross Frame */}
      <mesh position={[0, 0.04, 0.055]}>
        <boxGeometry args={[0.03, 0.42, 0.015]} />
        <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 0.055]}>
        <boxGeometry args={[0.26, 0.03, 0.015]} />
        <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ============================================================================
// 2. CRENELLATED STONE BATTLEMENTS
// ============================================================================
export const CastleBattlementRing: React.FC<{
  radius: number;
  count?: number;
  height?: number;
  width?: number;
  depth?: number;
  yOffset?: number;
}> = ({ radius, count = 8, height = 0.22, width = 0.22, depth = 0.12, yOffset = 0 }) => {
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
      {crenellations.map((c, i) => (
        <mesh key={`cren-${i}`} position={[c.x, height / 2, c.z]} rotation={[0, c.rotY, 0]} castShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// ============================================================================
// 3. ROYAL GOLDEN CROWN MEDALLION
// ============================================================================
export const CrownMedallion: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Stone Cartouche / Oval Plaque Backing */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.52, 0.08, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.5} />
      </mesh>

      {/* Golden Beveled Outer Ring */}
      <mesh position={[0, 0, 0.04]}>
        <torusGeometry args={[0.46, 0.045, 12, 32]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.goldPolished}
          metalness={0.94}
          roughness={0.16}
        />
      </mesh>

      {/* Inner Recessed Royal Velvet Core Disc */}
      <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.02, 24]} />
        <meshStandardMaterial
          color="#1e3a8a"
          roughness={0.4}
        />
      </mesh>

      {/* 3D Embossed Royal Crown Emblem */}
      <group position={[0, -0.04, 0.06]}>
        {/* Crown Base Circlet Band */}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.44, 0.07, 0.04]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.15} />
        </mesh>
        {/* Circlet Jewel Studs */}
        {[-0.14, 0, 0.14].map((jx, ji) => (
          <mesh key={`cjewel-${ji}`} position={[jx, -0.12, 0.025]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={ji === 1 ? '#ef4444' : '#3b82f6'} roughness={0.2} />
          </mesh>
        ))}

        {/* Central Crown Peak */}
        <mesh position={[0, 0.06, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.07, 0.28, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
        </mesh>

        {/* Left & Right Crown Peaks */}
        {[-0.14, 0.14].map((px, pi) => (
          <group key={`cpeak-${pi}`} position={[px, 0.02, 0]}>
            <mesh rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[0.055, 0.22, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.15} />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <sphereGeometry args={[0.028, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
            </mesh>
          </group>
        ))}

        {/* Outer Flaring Crown Finials */}
        {[-0.22, 0.22].map((ox, oi) => (
          <group key={`cout-${oi}`} position={[ox, -0.02, 0]} rotation={[0, 0, oi === 0 ? 0.35 : -0.35]}>
            <mesh rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[0.045, 0.16, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.15} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <sphereGeometry args={[0.024, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// ============================================================================
// 4. GRAND ARCHED CASTLE ENTRANCE PORTAL
// ============================================================================
export const ArchedEntrancePortal: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Stone Entrance Portico Jambs (Pillars on Left & Right) */}
      {[-0.85, 0.85].map((jx, ji) => (
        <group key={`jamb-${ji}`} position={[jx, 1.05, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.34, 2.1, 0.4]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
          </mesh>
          {/* Base Plinth */}
          <mesh position={[0, -0.95, 0.03]} castShadow>
            <boxGeometry args={[0.42, 0.2, 0.46]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
          </mesh>
          {/* Capital moulding */}
          <mesh position={[0, 0.98, 0.03]} castShadow>
            <boxGeometry args={[0.42, 0.14, 0.46]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* Grand Semi-Circular Stone Arch Trim (Voussoirs) */}
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.92, 0.92, 0.38, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
      </mesh>

      {/* Prominent Keystone with Gold Carving */}
      <mesh position={[0, 3.02, 0.08]} castShadow>
        <boxGeometry args={[0.3, 0.36, 0.44]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.02, 0.31]}>
        <boxGeometry args={[0.12, 0.18, 0.04]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Deep Recessed Doorway Arch Cavity */}
      <mesh position={[0, 1.05, -0.06]}>
        <boxGeometry args={[1.36, 2.1, 0.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.1, -0.06]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.68, 0.68, 0.3, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.8} />
      </mesh>

      {/* Heavy Double Wooden Castle Doors */}
      <group position={[0, 1.05, 0.02]}>
        {/* Left Door Leaf */}
        <mesh position={[-0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.62, 2.0, 0.08]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.65} />
        </mesh>
        {/* Right Door Leaf */}
        <mesh position={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.62, 2.0, 0.08]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.65} />
        </mesh>
        {/* Door Plank Vertical Seams */}
        {[-0.48, -0.16, 0.16, 0.48].map((px, pi) => (
          <mesh key={`dseam-${pi}`} position={[px, 0, 0.045]}>
            <boxGeometry args={[0.02, 1.96, 0.015]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.9} />
          </mesh>
        ))}

        {/* Wrought Iron Ornamental Hinges */}
        {[-0.6, 0.6].map((hx, hi) => (
          <React.Fragment key={`hinge-${hi}`}>
            <mesh position={[hx * 0.75, 0.65, 0.05]}>
              <boxGeometry args={[0.34, 0.06, 0.02]} />
              <meshStandardMaterial color={CASTLE_COLORS.ironHardware} metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[hx * 0.75, -0.65, 0.05]}>
              <boxGeometry args={[0.34, 0.06, 0.02]} />
              <meshStandardMaterial color={CASTLE_COLORS.ironHardware} metalness={0.85} roughness={0.3} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Golden Door Pull Handles / Knobs */}
        {[-0.08, 0.08].map((kx, ki) => (
          <mesh key={`dknob-${ki}`} position={[kx, -0.05, 0.06]}>
            <torusGeometry args={[0.045, 0.015, 8, 16]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.95} roughness={0.15} />
          </mesh>
        ))}
      </group>

      {/* Arched Fanlight Transom Glow Above Doors */}
      <mesh position={[0, 2.1, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.66, 0.66, 0.06, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.lightWarmInterior}
          emissive={CASTLE_COLORS.lightGlowEmissive}
          emissiveIntensity={1.8}
          roughness={0.2}
        />
      </mesh>
      {/* Transom Radial Sunburst Spokes */}
      {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI].map((rad, ri) => (
        <mesh key={`spoke-${ri}`} position={[0, 2.1, 0.06]} rotation={[0, 0, rad]}>
          <boxGeometry args={[0.03, 0.65, 0.03]} />
          <meshStandardMaterial color={CASTLE_COLORS.ironHardware} metalness={0.8} />
        </mesh>
      ))}

      {/* Twin Wall Sconces with Warm Glowing Lanterns */}
      {[-1.15, 1.15].map((sx, si) => (
        <group key={`sconce-${si}`} position={[sx, 1.4, 0.16]}>
          {/* Wall Bracket */}
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.22, 0.18]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
          </mesh>
          {/* Lantern Body */}
          <mesh position={[0, -0.08, 0.12]} castShadow>
            <cylinderGeometry args={[0.09, 0.06, 0.18, 6]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
          </mesh>
          {/* Glowing Flame Core */}
          <mesh position={[0, -0.08, 0.12]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial
              color="#fffbeb"
              emissive={CASTLE_COLORS.lightGlowEmissive}
              emissiveIntensity={2.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ============================================================================
// 5. ROYAL HERALDIC WALL BANNER
// ============================================================================
export const RoyalHeraldicBanner: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Top Gold Mounting Bracket & Crossbar */}
      <mesh position={[0, 0.95, 0.06]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.82, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.95} roughness={0.15} />
      </mesh>
      {/* Gold End Cap Finials */}
      {[-0.42, 0.42].map((ex, ei) => (
        <mesh key={`bfin-${ei}`} position={[ex, 0.95, 0.06]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
        </mesh>
      ))}

      {/* Royal Blue / Purple Fabric Banner */}
      <mesh position={[0, 0.35, 0.04]} castShadow>
        <boxGeometry args={[0.68, 1.2, 0.02]} />
        <meshStandardMaterial color={CASTLE_COLORS.bannerBlue} roughness={0.5} />
      </mesh>

      {/* Swallowtail / V-Notch Banner Bottom */}
      <mesh position={[0, -0.32, 0.04]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.34, 0.32, 3]} />
        <meshStandardMaterial color={CASTLE_COLORS.bannerBlue} roughness={0.5} />
      </mesh>

      {/* Gold Border Trim Around Banner */}
      <mesh position={[0, 0.35, 0.055]}>
        <boxGeometry args={[0.64, 1.16, 0.01]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.35, 0.062]}>
        <boxGeometry args={[0.56, 1.08, 0.01]} />
        <meshStandardMaterial color={CASTLE_COLORS.bannerBlue} roughness={0.5} />
      </mesh>

      {/* Golden Fleur-de-lis / Crown Insignia on Banner */}
      <group position={[0, 0.38, 0.075]}>
        {/* Central Petal */}
        <mesh position={[0, 0.08, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.07, 0.24, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.95} roughness={0.15} />
        </mesh>
        {/* Left & Right Curved Petals */}
        {[-0.09, 0.09].map((lx, li) => (
          <mesh key={`flpetal-${li}`} position={[lx, 0.02, 0]} rotation={[0, Math.PI / 4, li === 0 ? 0.45 : -0.45]}>
            <coneGeometry args={[0.05, 0.18, 4]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.95} roughness={0.15} />
          </mesh>
        ))}
        {/* Fleur-de-lis Tie Bar */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.22, 0.04, 0.02]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.95} roughness={0.15} />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 6. MODULAR CASTLE TOWER WITH CONICAL BLUE ROOF & GOLD FINIAL
// ============================================================================
export const CastleTower: React.FC<{
  position: [number, number, number];
  height: number;
  radius: number;
  roofHeight: number;
  roofRadius: number;
  hasBattlement?: boolean;
  hasWindow?: boolean;
  scale?: number;
}> = ({
  position,
  height,
  radius,
  roofHeight,
  roofRadius,
  hasBattlement = true,
  hasWindow = true,
  scale = 1,
}) => {
  return (
    <group position={position} scale={scale}>
      {/* Base Plinth Moulding */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.15, radius * 1.25, 0.3, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
      </mesh>

      {/* Main Stone Shaft */}
      <mesh position={[0, height / 2 + 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.96, radius, height, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>

      {/* Middle Stringcourse Belt */}
      <mesh position={[0, height * 0.55, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.05, radius * 1.05, 0.12, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Overhanging Machicolation Corbel Gallery */}
      <mesh position={[0, height + 0.08, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.22, radius * 0.98, 0.22, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Crenellated Battlements */}
      {hasBattlement && (
        <CastleBattlementRing
          radius={radius * 1.18}
          count={Math.max(6, Math.round(radius * 14))}
          height={0.24}
          width={radius * 0.4}
          depth={0.1}
          yOffset={height + 0.19}
        />
      )}

      {/* Elegant Conical Pointed Roof Spire with Flared Bottom */}
      <group position={[0, height + 0.22, 0]}>
        {/* Flared Eaves Trim */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[roofRadius * 0.92, roofRadius * 1.08, 0.16, 20]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofRoyalDark} roughness={0.35} />
        </mesh>

        {/* Main Conical Blue Roof */}
        <mesh position={[0, roofHeight / 2 + 0.16, 0]} castShadow>
          <coneGeometry args={[roofRadius, roofHeight, 20]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.roofRoyalBlue}
            roughness={0.28}
            metalness={0.12}
          />
        </mesh>

        {/* Golden Roof Band Rings */}
        <mesh position={[0, roofHeight * 0.35, 0]}>
          <torusGeometry args={[roofRadius * 0.65, 0.03, 8, 20]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.18} />
        </mesh>
        <mesh position={[0, roofHeight * 0.68, 0]}>
          <torusGeometry args={[roofRadius * 0.32, 0.024, 8, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.18} />
        </mesh>

        {/* Golden Spire Finial Sphere */}
        <mesh position={[0, roofHeight + 0.24, 0]}>
          <sphereGeometry args={[radius * 0.22, 14, 14]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
        </mesh>

        {/* Spire Needle & Red Pennant Flag */}
        <mesh position={[0, roofHeight + 0.52, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.56, 8]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.95} />
        </mesh>
        <mesh position={[0.2, roofHeight + 0.64, 0]} castShadow>
          <boxGeometry args={[0.38, 0.18, 0.02]} />
          <meshStandardMaterial color={CASTLE_COLORS.bannerRed} roughness={0.4} />
        </mesh>
      </group>

      {/* Arched Window on Front Facade */}
      {hasWindow && (
        <CastleWindow
          position={[0, height * 0.68, radius * 0.95]}
          scale={radius * 1.1}
        />
      )}
    </group>
  );
};
