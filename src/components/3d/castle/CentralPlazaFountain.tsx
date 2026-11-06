import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';

// 8-Point Inlaid Star Compass Medallion
export const StarCompassMedallion: React.FC<{
  position?: [number, number, number];
  scale?: number;
}> = ({ position = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Outer Dark Stone Rim */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.02, 32]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.75} />
      </mesh>
      {/* Gold Inlaid Ring */}
      <mesh position={[0, 0.025, 0]}>
        <torusGeometry args={[0.82, 0.025, 8, 32]} />
        <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.88} roughness={0.2} />
      </mesh>
      {/* 8-Point Compass Star Rays */}
      {[0, 1, 2, 3].map((idx) => {
        const rot = (idx * Math.PI) / 4;
        return (
          <group key={`cstar-${idx}`} rotation={[0, rot, 0]}>
            {/* Long Diamond Spear */}
            <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 4, 0]}>
              <boxGeometry args={[0.18, 0.015, 1.4]} />
              <meshStandardMaterial color={idx % 2 === 0 ? CASTLE_COLORS.compassStarGold : CASTLE_COLORS.stoneWall} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* Center Gold Medallion Hub */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
        <meshStandardMaterial color={CASTLE_COLORS.compassStarGold} metalness={0.92} roughness={0.15} />
      </mesh>
    </group>
  );
};

export const CentralPlazaFountain: React.FC = () => {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const sprayGroupRef = useRef<THREE.Group>(null);
  const rippleRef = useRef<THREE.Mesh>(null);

  // Animated water flow and splashing
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (waterMeshRef.current) {
      // Gentle pulsing water level
      waterMeshRef.current.position.y = 0.23 + Math.sin(t * 2.8) * 0.008;
    }
    if (sprayGroupRef.current) {
      // Dynamic spray shimmer
      sprayGroupRef.current.rotation.y = t * 0.4;
      sprayGroupRef.current.position.y = Math.sin(t * 4.0) * 0.02;
    }
    if (rippleRef.current) {
      const s = 1.0 + Math.sin(t * 3.2) * 0.05;
      rippleRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={[0, 0.32, 1.2]}>
      {/* ============================================================== */}
      {/* 1. CIRCULAR PLAZA APRON & STAR COMPASS INLAYS                  */}
      {/* ============================================================== */}
      {/* Main Circular Stone Apron */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.25, 0.06, 40]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.7} />
      </mesh>
      {/* Concentric Outer Paver Ring */}
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <torusGeometry args={[3.12, 0.07, 8, 40]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <torusGeometry args={[2.4, 0.05, 8, 40]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePaverDark} roughness={0.7} />
      </mesh>

      {/* South Star Compass Medallion (Leading towards the fountain from board) */}
      <StarCompassMedallion position={[0, 0.025, 2.2]} scale={0.75} />
      {/* North Star Compass Medallion (Between castle stairs and fountain) */}
      <StarCompassMedallion position={[0, 0.025, -2.1]} scale={0.75} />

      {/* ============================================================== */}
      {/* 2. GRAND MULTI-TIER FOUNTAIN BASIN                            */}
      {/* ============================================================== */}
      {/* Lower Stone Basin Base Plinth */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.72, 1.8, 0.14, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.65} />
      </mesh>

      {/* Lower Basin Stone Wall */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.65, 1.72, 0.2, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>
      {/* Lower Basin Profiled Torus Rim */}
      <mesh position={[0, 0.32, 0]}>
        <torusGeometry args={[1.68, 0.08, 12, 36]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Basin Crystal Turquoise Water Surface */}
      <mesh ref={waterMeshRef} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[1.56, 1.56, 0.04, 36]} />
        <meshPhysicalMaterial
          color={CASTLE_COLORS.waterTurquoise}
          emissive={CASTLE_COLORS.waterDeep}
          emissiveIntensity={0.25}
          roughness={0.04}
          metalness={0.08}
          transmission={0.65}
          ior={1.333}
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>

      {/* Subtle Concentric Water Ripples */}
      <mesh ref={rippleRef} position={[0, 0.265, 0]}>
        <torusGeometry args={[1.1, 0.02, 6, 28]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.waterFoam}
          transparent
          opacity={0.35}
          roughness={0.1}
        />
      </mesh>

      {/* ============================================================== */}
      {/* 3. CENTRAL PEDESTAL & MIDDLE TIER BASIN                        */}
      {/* ============================================================== */}
      {/* Fluted Stone Pedestal Column */}
      <mesh position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.46, 0.44, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>
      {/* Gold Decorative Pedestal Collar Ring */}
      <mesh position={[0, 0.65, 0]}>
        <torusGeometry args={[0.42, 0.035, 8, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.18} />
      </mesh>

      {/* Middle Tier Stone Basin (Flared Scalloped Bowl) */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.88, 0.65, 0.18, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <torusGeometry args={[0.89, 0.05, 10, 24]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Middle Tier Water Pool */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.82, 0.82, 0.04, 24]} />
        <meshPhysicalMaterial
          color={CASTLE_COLORS.waterTurquoise}
          emissive={CASTLE_COLORS.waterDeep}
          emissiveIntensity={0.3}
          roughness={0.05}
          transmission={0.6}
          clearcoat={1}
        />
      </mesh>

      {/* Cascading Water Overflow Ring from Middle Tier */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.84, 0.92, 0.32, 24, 1, true]} />
        <meshStandardMaterial
          color={CASTLE_COLORS.waterSpray}
          transparent
          opacity={0.45}
          roughness={0.1}
        />
      </mesh>

      {/* ============================================================== */}
      {/* 4. UPPER TIER & WATER SPOUT JETS                               */}
      {/* ============================================================== */}
      {/* Upper Pedestal Stem */}
      <mesh position={[0, 1.08, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.38, 16]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
      </mesh>

      {/* Top Small Basin Bowl */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.32, 0.14, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <torusGeometry args={[0.49, 0.035, 8, 20]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Central Spouting Crown Nozzle */}
      <mesh position={[0, 1.48, 0]}>
        <cylinderGeometry args={[0.08, 0.16, 0.18, 12]} />
        <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Vertical Animated Spouting Water Column */}
      <group ref={sprayGroupRef} position={[0, 1.55, 0]}>
        {/* Core Vertical Water Jet */}
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.07, 0.14, 0.58, 12]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.waterSpray}
            emissive={CASTLE_COLORS.waterTurquoise}
            emissiveIntensity={0.6}
            transparent
            opacity={0.85}
            roughness={0.08}
          />
        </mesh>

        {/* Top Foaming Spray Plume */}
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.waterFoam}
            transparent
            opacity={0.92}
            roughness={0.1}
          />
        </mesh>

        {/* 4 Cascading Parabolic Water Arch Jets */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, jidx) => (
          <group key={`archjet-${jidx}`} rotation={[0, angle, 0]}>
            <mesh position={[0.42, 0.15, 0]} rotation={[0, 0, -Math.PI / 3.8]}>
              <cylinderGeometry args={[0.035, 0.055, 0.75, 8]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.waterSpray}
                transparent
                opacity={0.7}
                roughness={0.1}
              />
            </mesh>
            {/* Splash Drop at Lower Basin Contact Point */}
            <mesh position={[0.78, -0.45, 0]}>
              <sphereGeometry args={[0.06, 6, 6]} />
              <meshStandardMaterial color={CASTLE_COLORS.waterFoam} transparent opacity={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
