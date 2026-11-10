import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { CASTLE_COLORS } from './castle/CastleMaterials';
import { ContactOcclusion } from './ContactOcclusion';
import { CentralCastle } from './castle/CentralCastle';
import { CentralPlazaFountain } from './castle/CentralPlazaFountain';
import { LeftTownhouseCafe, RightTownhouseBoutique } from './castle/SupportingBuildings';
import {
  StylizedSakuraTree,
  StylizedCypressTree,
  GardenRoseArbor,
  GardenFlowerBeds,
} from './castle/GardensAndVegetation';
import {
  VictorianStreetLamp,
  RoyalStandingBanner,
  ClassicParkBench,
  StoneFlowerPlanter,
  WoodenBarrel,
  GoldStoneBollard,
} from './castle/CastleProps';

export const CenterCity3D: React.FC = () => {
  const players = useGameStore((s) => s.players);

  // Highest landmark level among players
  const landmarkLevel = useMemo(() => {
    const maxLevel = Math.max(...players.map((p) => p.landmarkLevel || 0));
    return Math.max(1, maxLevel);
  }, [players]);

  const crystalRef = useRef<THREE.Group>(null);

  // Floating magic crystal bobbing and rotation above the grand spire
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystalRef.current) {
      crystalRef.current.position.y = 8.1 + Math.sin(t * 1.8) * 0.15;
      crystalRef.current.rotation.y = t * 0.9;
    }
  });

  return (
    <group name="center-city" position={[0, 0, 0]}>
      {/* ============================================================== */}
      {/* 1. COHESIVE NATURAL TERRAIN DIORAMA BASE                       */}
      {/* ============================================================== */}
      {/* Sub-surface Island Plinth */}
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[15.6, 0.65, 15.6]} />
        <meshStandardMaterial color="#6a5a8e" roughness={0.8} />
      </mesh>

      {/* Main Ground Grass Base Layer */}
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[15.3, 0.12, 15.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.grassLush} roughness={0.78} />
      </mesh>

      {/* Elevated North Castle Plateau */}
      <mesh position={[0, 0.35, -2.0]} receiveShadow castShadow>
        <boxGeometry args={[11.8, 0.22, 5.8]} />
        <meshStandardMaterial color={CASTLE_COLORS.grassLush} roughness={0.9} />
      </mesh>

      {/* West Residential Garden Terrace (Café) */}
      <mesh position={[-4.5, 0.3, 0.2]} receiveShadow castShadow>
        <boxGeometry args={[5.8, 0.14, 5.2]} />
        <meshStandardMaterial color={CASTLE_COLORS.grassLush} roughness={0.9} />
      </mesh>

      {/* East Commercial / Boutique Terrace */}
      <mesh position={[4.5, 0.3, 0.2]} receiveShadow castShadow>
        <boxGeometry args={[5.8, 0.14, 5.2]} />
        <meshStandardMaterial color={CASTLE_COLORS.grassLush} roughness={0.9} />
      </mesh>

      {/* Extended Foreground Garden Terrace (South - fills down to inner board edge) */}
      <mesh position={[0, 0.28, 5.2]} receiveShadow castShadow>
        <boxGeometry args={[13.6, 0.12, 4.2]} />
        <meshStandardMaterial color={CASTLE_COLORS.grassLush} roughness={0.9} />
      </mesh>

      {/* Cobblestone Stone Pathways connecting Castle, Plaza, and Townhouses */}
      {/* North-South Grand Avenue */}
      <mesh position={[0, 0.29, -0.2]} receiveShadow>
        <boxGeometry args={[3.8, 0.03, 2.8]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.78} />
      </mesh>
      {/* West-East Promenade linking Café, Central Plaza, and Boutique */}
      <mesh position={[0, 0.29, 1.2]} receiveShadow>
        <boxGeometry args={[12.8, 0.03, 2.8]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.78} />
      </mesh>
      {/* South Garden Promenade along inner property track */}
      <mesh position={[0, 0.3, 6.2]} receiveShadow>
        <boxGeometry args={[12.2, 0.025, 1.5]} />
        <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.8} />
      </mesh>

      {/* Foreground Crystal Reflecting Water Canal & Stone Banks */}
      <group position={[0, 0.26, 4.2]}>
        {/* Turquoise Water Canal */}
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[13.2, 0.05, 1.9]} />
          <meshPhysicalMaterial
            color={CASTLE_COLORS.waterTurquoise}
            roughness={0.3}
            metalness={0}
            ior={1.333}
            clearcoat={0.35}
            clearcoatRoughness={0.22}
          />
        </mesh>
        {/* North Canal Stone Quay Bank */}
        <mesh position={[0, 0.06, -0.98]} receiveShadow>
          <boxGeometry args={[13.4, 0.1, 0.18]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
        </mesh>
        {/* South Canal Stone Quay Bank */}
        <mesh position={[0, 0.06, 0.98]} receiveShadow>
          <boxGeometry args={[13.4, 0.1, 0.18]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
        </mesh>

        {/* West Arched Stone Bridge */}
        <group position={[-3.6, 0.08, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.14, 2.2]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
          {[-0.7, 0.7].map((bx, bi) => (
            <mesh key={`cbridge-w-rail-${bi}`} position={[bx, 0.26, 0]} castShadow>
              <boxGeometry args={[0.1, 0.16, 2.1]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
            </mesh>
          ))}
        </group>

        {/* East Arched Stone Bridge */}
        <group position={[3.6, 0.08, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.14, 2.2]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
          {[-0.7, 0.7].map((bx, bi) => (
            <mesh key={`cbridge-e-rail-${bi}`} position={[bx, 0.26, 0]} castShadow>
              <boxGeometry args={[0.1, 0.16, 2.1]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ============================================================== */}
      {/* 2. THE GRAND CENTRAL FANTASY CASTLE (Milestone 1.2 Refined)    */}
      {/* ============================================================== */}
      <ContactOcclusion />
      <CentralCastle level={landmarkLevel} />

      {/* Floating Magic Crystal above the High Spire */}
      <group ref={crystalRef} position={[0, 8.1, -2.2]}>
        <mesh>
          <octahedronGeometry args={[0.34, 0]} />
          <meshPhysicalMaterial
            color="#6feaff"
            emissive="#38d4f0"
            emissiveIntensity={0.9}
            roughness={0.1}
            metalness={0.1}
            ior={1.4}
          />
        </mesh>
      </group>

      {/* ============================================================== */}
      {/* 3. CENTRAL CIRCULAR PLAZA & 3-TIER ANIMATED FOUNTAIN           */}
      {/* ============================================================== */}
      <CentralPlazaFountain />

      {/* ============================================================== */}
      {/* 4. SUPPORTING BUILDINGS (West Café & East Boutique)            */}
      {/* ============================================================== */}
      <LeftTownhouseCafe position={[-4.5, 0.34, 0.2]} rotation={[0, 0.15, 0]} />
      <RightTownhouseBoutique position={[4.5, 0.34, 0.2]} rotation={[0, -0.15, 0]} />

      {/* ============================================================== */}
      {/* 5. GARDENS, SCULPTED SAKURA & CYPRESS TREES                    */}
      {/* ============================================================== */}
      {/* Stylized Sakura (Cherry Blossom) Trees */}
      <StylizedSakuraTree position={[-4.8, 0.36, -2.6]} scale={1.22} rotationY={0.3} />
      <StylizedSakuraTree position={[4.8, 0.36, -2.6]} scale={1.22} rotationY={-0.3} />
      <StylizedSakuraTree position={[-2.8, 0.36, -1.8]} scale={1.08} rotationY={0.6} />
      <StylizedSakuraTree position={[2.8, 0.36, -1.8]} scale={1.08} rotationY={-0.5} />
      <StylizedSakuraTree position={[-3.2, 0.32, 2.0]} scale={0.98} rotationY={1.2} />
      <StylizedSakuraTree position={[3.2, 0.32, 2.0]} scale={0.98} rotationY={-1.0} />
      <StylizedSakuraTree position={[-5.4, 0.32, 5.8]} scale={1.08} rotationY={0.2} />
      <StylizedSakuraTree position={[5.4, 0.32, 5.8]} scale={1.08} rotationY={-0.4} />

      {/* Stylized Cypress / Pine Trees with Drooping Tips */}
      <StylizedCypressTree position={[-2.4, 0.36, -0.6]} scale={0.96} />
      <StylizedCypressTree position={[2.4, 0.36, -0.6]} scale={0.96} />
      <StylizedCypressTree position={[-1.8, 0.32, 2.6]} scale={0.88} />
      <StylizedCypressTree position={[1.8, 0.32, 2.6]} scale={0.88} />
      <StylizedCypressTree position={[-1.8, 0.32, 5.8]} scale={0.88} />
      <StylizedCypressTree position={[1.8, 0.32, 5.8]} scale={0.88} />

      {/* Garden Rose Arbor Pergola */}
      <GardenRoseArbor position={[3.4, 0.32, 2.4]} rotationY={-0.2} />

      {/* Garden Hedges, Stepping Flagstones & Flowerbeds */}
      <GardenFlowerBeds />

      {/* Foreground Hedges & Flowerbeds along South Promenade */}
      {[-3.8, -1.2, 1.2, 3.8].map((hx, hi) => (
        <group key={`south-hedge-${hi}`} position={[hx, 0.32, 6.7]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.22, 0.32]} />
            <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
          </mesh>
          {[-0.5, 0, 0.5].map((fx, fi) => (
            <mesh key={`shflower-${hi}-${fi}`} position={[fx, 0.16, 0]}>
              <sphereGeometry args={[0.075, 8, 8]} />
              <meshStandardMaterial
                color={fi % 2 === 0 ? CASTLE_COLORS.flowerRose : CASTLE_COLORS.flowerYellow}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ============================================================== */}
      {/* 6. MODULAR DECORATIVE PROPS, BARRELS & LIGHTING                */}
      {/* ============================================================== */}
      {/* Victorian Street Lampposts */}
      <VictorianStreetLamp position={[-2.2, 0.36, -0.2]} scale={0.95} />
      <VictorianStreetLamp position={[2.2, 0.36, -0.2]} scale={0.95} />
      <VictorianStreetLamp position={[-1.9, 0.32, 2.4]} scale={0.95} />
      <VictorianStreetLamp position={[1.9, 0.32, 2.4]} scale={0.95} />
      <VictorianStreetLamp position={[-3.8, 0.32, 5.6]} scale={0.9} />
      <VictorianStreetLamp position={[3.8, 0.32, 5.6]} scale={0.9} />
      <VictorianStreetLamp position={[-1.5, 0.32, 6.7]} scale={0.9} />
      <VictorianStreetLamp position={[1.5, 0.32, 6.7]} scale={0.9} />

      {/* Royal Standing Banners on Gold Poles */}
      <RoyalStandingBanner position={[-2.4, 0.32, 1.2]} rotationY={0.3} scale={0.95} />
      <RoyalStandingBanner position={[2.4, 0.32, 1.2]} rotationY={-0.3} scale={0.95} />

      {/* Classic Slatted Wooden Park Benches */}
      <ClassicParkBench position={[-1.6, 0.32, 1.2]} rotationY={Math.PI / 2} scale={0.9} />
      <ClassicParkBench position={[1.6, 0.32, 1.2]} rotationY={-Math.PI / 2} scale={0.9} />
      <ClassicParkBench position={[-2.0, 0.32, 6.0]} rotationY={0} scale={0.9} />
      <ClassicParkBench position={[2.0, 0.32, 6.0]} rotationY={0} scale={0.9} />

      {/* Stone Flower Planter Boxes */}
      <StoneFlowerPlanter position={[-2.1, 0.32, 0.5]} scale={0.95} />
      <StoneFlowerPlanter position={[2.1, 0.32, 0.5]} scale={0.95} />
      <StoneFlowerPlanter position={[-2.6, 0.32, 2.8]} scale={0.9} />
      <StoneFlowerPlanter position={[2.6, 0.32, 2.8]} scale={0.9} />
      <StoneFlowerPlanter position={[-3.6, 0.32, 6.6]} scale={0.9} />
      <StoneFlowerPlanter position={[3.6, 0.32, 6.6]} scale={0.9} />

      {/* Rustic Wooden Barrels (Café Patio & Boutique Entrance) */}
      <WoodenBarrel position={[-3.1, 0.32, 1.6]} rotationY={0.4} scale={0.9} />
      <WoodenBarrel position={[-3.3, 0.32, 1.8]} rotationY={-0.3} scale={0.8} />
      <WoodenBarrel position={[3.1, 0.32, 1.6]} rotationY={-0.5} scale={0.9} />

      {/* Gold-Tipped Stone Bollards along South Promenade boundary */}
      {[-4.6, -3.2, -1.8, 1.8, 3.2, 4.6].map((bx, bi) => (
        <GoldStoneBollard key={`bollard-${bi}`} position={[bx, 0.32, 6.8]} />
      ))}
    </group>
  );
};

export default CenterCity3D;
