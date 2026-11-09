import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';

// ============================================================================
// 1. INLAID PLAZA ROYAL CROWN & COMPASS STAR MEDALLION (Panel 07)
// ============================================================================
export const PlazaCrownMedallion: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Outer Circular Dark Paver Ring */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[1.65, 1.65, 0.02, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.7} />
      </mesh>
      {/* Concentric Gold Trim Ring */}
      <mesh position={[0, 0.025, 0]}>
        <torusGeometry args={[1.52, 0.035, 8, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.025, 0]}>
        <torusGeometry args={[0.95, 0.03, 8, 32]} />
        <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Radial Stone Fan Segments (16 Wedges) */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((widx) => {
        const wa = (widx * Math.PI * 2) / 16;
        const isAlt = widx % 2 === 0;
        return (
          <mesh key={`pwedge-${widx}`} position={[Math.sin(wa) * 1.25, 0.02, Math.cos(wa) * 1.25]} rotation={[0, wa, 0]}>
            <boxGeometry args={[0.22, 0.012, 0.44]} />
            <meshStandardMaterial
              color={isAlt ? CASTLE_COLORS.stonePavement : CASTLE_COLORS.stonePaverDark}
              roughness={0.75}
            />
          </mesh>
        );
      })}

      {/* Center Royal Crown Inlay Motif in Gold & Stone */}
      <group position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Crown Base Arc */}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.68, 0.08, 0.015]} />
          <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.94} roughness={0.16} />
        </mesh>
        {/* Central Crown Peak */}
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.14, 0.48, 3]} />
          <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.94} roughness={0.16} />
        </mesh>
        {/* Side Peaks */}
        {[-0.22, 0.22].map((px, pi) => (
          <mesh key={`cpeak-inlay-${pi}`} position={[px, 0.02, 0]} rotation={[0, 0, pi === 0 ? 0.35 : -0.35]}>
            <coneGeometry args={[0.1, 0.38, 3]} />
            <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.94} roughness={0.16} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// 8-Point Inlaid Star Compass Medallion
export const StarCompassMedallion: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Outer Dark Stone Rim */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.02, 32]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.75} />
      </mesh>
      {/* Gold Inlaid Ring */}
      <mesh position={[0, 0.025, 0]}>
        <torusGeometry args={[0.86, 0.028, 8, 32]} />
        <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* 8-Point Compass Star Rays */}
      {[0, 1, 2, 3].map((idx) => {
        const rot = (idx * Math.PI) / 4;
        return (
          <group key={`cstar-${idx}`} rotation={[0, rot, 0]}>
            {/* Long Diamond Spear */}
            <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 4, 0]}>
              <boxGeometry args={[0.18, 0.015, 1.48]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? CASTLE_COLORS.compassStarGold : CASTLE_COLORS.stoneWall}
                roughness={0.45}
                metalness={idx % 2 === 0 ? 0.88 : 0.1}
              />
            </mesh>
          </group>
        );
      })}
      {/* Center Gold Medallion Hub */}
      <mesh position={[0, 0.042, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.025, 16]} />
        <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.94} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.055, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} />
      </mesh>
    </group>
  );
};

// ============================================================================
// 2. PRODUCTION MULTI-TIER FOUNTAIN WITH SCALLOPED BASINS & VFX
// ============================================================================
export const CentralPlazaFountain: React.FC = () => {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const midWaterRef = useRef<THREE.Mesh>(null);
  const sprayGroupRef = useRef<THREE.Group>(null);
  const ripple1Ref = useRef<THREE.Mesh>(null);
  const ripple2Ref = useRef<THREE.Mesh>(null);

  // Animated water flow and splashing
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (waterMeshRef.current) {
      waterMeshRef.current.position.y = 0.24 + Math.sin(t * 3.0) * 0.008;
    }
    if (midWaterRef.current) {
      midWaterRef.current.position.y = 0.86 + Math.sin(t * 3.4) * 0.006;
    }
    if (sprayGroupRef.current) {
      sprayGroupRef.current.rotation.y = t * 0.45;
      sprayGroupRef.current.position.y = Math.sin(t * 4.2) * 0.02;
    }
    if (ripple1Ref.current) {
      const s = 1.0 + (t * 0.5) % 0.45;
      ripple1Ref.current.scale.set(s, 1, s);
    }
    if (ripple2Ref.current) {
      const s = 1.0 + ((t * 0.5 + 0.25) % 0.45);
      ripple2Ref.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={[0, 0.32, 1.2]}>
      {/* ============================================================== */}
      {/* 1. CIRCULAR PLAZA APRON & ROYAL MEDALLION INLAYS               */}
      {/* ============================================================== */}
      {/* Main Circular Stone Apron */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[3.35, 3.4, 0.06, 40]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.7} />
      </mesh>
      {/* Concentric Outer Paver Rings */}
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <torusGeometry args={[3.25, 0.08, 8, 40]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <torusGeometry args={[2.55, 0.055, 8, 40]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.7} />
      </mesh>

      {/* Radial Paver Dividing Lines (12 radial sectors) */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((sidx) => {
        const sa = (sidx * Math.PI) / 6;
        return (
          <mesh key={`prad-${sidx}`} position={[Math.sin(sa) * 2.85, 0.03, Math.cos(sa) * 2.85]} rotation={[0, sa, 0]}>
            <boxGeometry args={[0.06, 0.015, 0.7]} />
            <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.7} />
          </mesh>
        );
      })}

      {/* South Inlaid Star Compass Medallion (Leading towards fountain) */}
      <StarCompassMedallion position={[0, 0.025, 2.3]} scale={0.78} />
      {/* North Inlaid Plaza Crown Medallion (Between castle stairs and fountain) */}
      <PlazaCrownMedallion position={[0, 0.025, -2.15]} scale={0.65} />

      {/* ============================================================== */}
      {/* 2. GRAND MULTI-TIER FOUNTAIN LOWER BASIN                       */}
      {/* ============================================================== */}
      {/* Lower Stone Basin Base Plinth */}
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.78, 1.86, 0.16, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
      </mesh>

      {/* Lower Basin Stone Wall with Scalloped Profile */}
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.78, 0.22, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>
      {/* Lower Basin Profiled Torus Rim */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <torusGeometry args={[1.74, 0.09, 12, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* 4 Gold Escutcheon / Gargoyle Spouts around Lower Basin Perimeter */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((ga, gi) => (
        <group key={`gargoyle-${gi}`} position={[Math.sin(ga) * 1.75, 0.28, Math.cos(ga) * 1.75]} rotation={[0, ga, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.16, 0.08]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.04, 0.06]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Basin Crystal Turquoise Water Surface */}
      <mesh ref={waterMeshRef} position={[0, 0.25, 0]}>
        <cylinderGeometry args={[1.62, 1.62, 0.04, 36]} />
        <meshPhysicalMaterial
          color={CASTLE_COLORS.waterTurquoise}
          emissive={CASTLE_COLORS.waterDeep}
          emissiveIntensity={0.28}
          roughness={0.03}
          metalness={0.08}
          transmission={0.72}
          ior={1.333}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Dynamic Concentric Water Ripples */}
      <mesh ref={ripple1Ref} position={[0, 0.272, 0]}>
        <torusGeometry args={[1.1, 0.02, 6, 28]} />
        <meshStandardMaterial color={CASTLE_COLORS.waterFoam} transparent opacity={0.35} roughness={0.1} />
      </mesh>
      <mesh ref={ripple2Ref} position={[0, 0.272, 0]}>
        <torusGeometry args={[0.7, 0.018, 6, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.waterFoam} transparent opacity={0.3} roughness={0.1} />
      </mesh>

      {/* ============================================================== */}
      {/* 3. FLUTED PEDESTAL & MIDDLE TIER SCALLOPED BASIN               */}
      {/* ============================================================== */}
      {/* Classical Fluted Pedestal Column with Vertical Ridges */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.48, 0.48, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>
      {/* Fluted Column Rings */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((fa, fi) => {
        const rad = (fi * Math.PI * 2) / 8;
        return (
          <mesh key={`flutecol-${fi}`} position={[Math.sin(rad) * 0.41, 0.52, Math.cos(rad) * 0.41]} castShadow>
            <cylinderGeometry args={[0.04, 0.045, 0.46, 6]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
          </mesh>
        );
      })}

      {/* Gold Decorative Pedestal Collar Ring */}
      <mesh position={[0, 0.7, 0]}>
        <torusGeometry args={[0.44, 0.04, 8, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.94} roughness={0.16} />
      </mesh>

      {/* Middle Tier Scalloped Stone Basin Bowl */}
      <mesh position={[0, 0.84, 0]} castShadow>
        <cylinderGeometry args={[0.92, 0.68, 0.2, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>
      {/* Scalloped Bowl Torus Rim */}
      <mesh position={[0, 0.94, 0]}>
        <torusGeometry args={[0.93, 0.055, 10, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Middle Tier Water Pool */}
      <mesh ref={midWaterRef} position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.86, 0.86, 0.04, 24]} />
        <meshPhysicalMaterial
          color={CASTLE_COLORS.waterTurquoise}
          emissive={CASTLE_COLORS.waterDeep}
          emissiveIntensity={0.32}
          roughness={0.04}
          transmission={0.65}
          clearcoat={1}
        />
      </mesh>

      {/* Cascading Water Overflow Ring from Middle Tier to Lower Basin */}
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.88, 0.96, 0.36, 24, 1, true]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.waterSpray}
          transparent
          opacity={0.48}
          roughness={0.08}
        />
      </mesh>

      {/* ============================================================== */}
      {/* 4. UPPER TIER & ANIMATED WATER SPRAY JETS                      */}
      {/* ============================================================== */}
      {/* Upper Pedestal Stem */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.32, 0.42, 16]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <torusGeometry args={[0.26, 0.03, 8, 16]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} />
      </mesh>

      {/* Top Small Basin Bowl */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.34, 0.16, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.47, 0]}>
        <torusGeometry args={[0.53, 0.04, 8, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Central Spouting Golden Crown Urn Nozzle */}
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[0.09, 0.18, 0.2, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.94} roughness={0.16} />
      </mesh>
      <mesh position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} />
      </mesh>

      {/* Animated Vertical Water Spray Column & Arched Jets */}
      <group ref={sprayGroupRef} position={[0, 1.66, 0]}>
        {/* Core Vertical Water Jet */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.075, 0.15, 0.65, 12]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.waterSpray}
            emissive={CASTLE_COLORS.waterTurquoise}
            emissiveIntensity={0.65}
            transparent
            opacity={0.88}
            roughness={0.06}
          />
        </mesh>

        {/* Top Foaming Spray Plume */}
        <mesh position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.waterFoam}
            transparent
            opacity={0.94}
            roughness={0.08}
          />
        </mesh>

        {/* 6 Cascading Parabolic Water Arch Jets */}
        {[0, 1, 2, 3, 4, 5].map((jidx) => {
          const angle = (jidx * Math.PI) / 3;
          return (
            <group key={`archjet-${jidx}`} rotation={[0, angle, 0]}>
              <mesh position={[0.46, 0.18, 0]} rotation={[0, 0, -Math.PI / 3.8]}>
                <cylinderGeometry args={[0.038, 0.06, 0.82, 8]} />
                <meshStandardMaterial
                  color={CASTLE_COLORS.waterSpray}
                  transparent
                  opacity={0.72}
                  roughness={0.08}
                />
              </mesh>
              {/* Splash Drops at Contact Points */}
              <mesh position={[0.85, -0.48, 0]}>
                <sphereGeometry args={[0.065, 6, 6]} />
                <meshStandardMaterial color={CASTLE_COLORS.waterFoam} transparent opacity={0.85} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
};
