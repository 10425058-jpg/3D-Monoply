import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_COLORS } from './CastleMaterials';
import {
  CastleTower,
  CastleWindow,
  CrownMedallion,
  ArchedEntrancePortal,
  RoyalHeraldicBanner,
  CastleBattlementRing,
} from './CastleModules';

export interface CentralCastleProps {
  level?: number;
}

export const CentralCastle: React.FC<CentralCastleProps> = ({ level = 5 }) => {
  const currentLevel = Math.max(1, Math.min(5, level || 1));
  const flag1Ref = useRef<THREE.Mesh>(null);
  const flag2Ref = useRef<THREE.Mesh>(null);
  const flag3Ref = useRef<THREE.Mesh>(null);
  const crownHaloRef = useRef<THREE.Group>(null);

  // Subtle wind flutter animation for royal pennant flags
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const wave = Math.sin(t * 3.5) * 0.15;
    if (flag1Ref.current) flag1Ref.current.rotation.y = wave;
    if (flag2Ref.current) flag2Ref.current.rotation.y = Math.sin(t * 3.2 + 0.8) * 0.14;
    if (flag3Ref.current) flag3Ref.current.rotation.y = Math.sin(t * 3.6 + 1.6) * 0.16;

    if (crownHaloRef.current) {
      crownHaloRef.current.rotation.z = t * 0.4;
    }
  });

  return (
    <group position={[0, 0.45, -1.8]}>
      {/* ============================================================== */}
      {/* 1. ELEVATED PALACE FOUNDATION PLATFORM & BALUSTRADES           */}
      {/* ============================================================== */}
      {/* Main Stone Base Terrace */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.6, 0.44, 4.8]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.65} />
      </mesh>
      {/* Platform Upper Beveled Trim */}
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.85, 0.1, 5.0]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Perimeter Stone Balustrades along Front Terrace */}
      {[-3.6, -2.5, 2.5, 3.6].map((bx, bi) => (
        <group key={`balustrade-${bi}`} position={[bx, 0.65, 2.38]}>
          <mesh castShadow>
            <boxGeometry args={[0.95, 0.32, 0.14]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
          </mesh>
          {/* Decorative Gold Finial Post */}
          <mesh position={[0.42, 0.22, 0]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[-0.42, 0.22, 0]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 2. GRAND CASCADING FRONT STAIRCASE TO PLAZA                    */}
      {/* ============================================================== */}
      <group position={[0, 0, 2.5]}>
        {[0, 1, 2, 3, 4].map((stepIdx) => {
          const stepY = 0.05 + (4 - stepIdx) * 0.085;
          const stepZ = stepIdx * 0.28;
          const stepWidth = 3.6 + stepIdx * 0.25;
          return (
            <mesh
              key={`castlestair-${stepIdx}`}
              position={[0, stepY, stepZ]}
              receiveShadow
              castShadow
            >
              <boxGeometry args={[stepWidth, 0.09, 0.32]} />
              <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.6} />
            </mesh>
          );
        })}

        {/* Flanking Stairway Stepped Balustrades with Gold Finials */}
        {[-2.0, 2.0].map((sideX, sIdx) => (
          <group key={`stair-bal-${sIdx}`} position={[sideX, 0.35, 0.6]}>
            <mesh rotation={[0.26 * (sIdx === 0 ? 1 : 1), 0, 0]} castShadow>
              <boxGeometry args={[0.22, 0.28, 1.6]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
            </mesh>
            {/* Lower Gold Urn/Finial on stair landing */}
            <mesh position={[0, -0.15, 0.72]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.18} />
            </mesh>
            {/* Upper Gold Finial */}
            <mesh position={[0, 0.28, -0.65]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.18} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ============================================================== */}
      {/* 3. CENTRAL GATEHOUSE & GRAND ENTRANCE                          */}
      {/* ============================================================== */}
      <group position={[0, 0.5, 0]}>
        {/* Gatehouse Center Stone Mass */}
        <mesh position={[0, 1.4, 0.5]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 2.4, 2.4]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
        </mesh>

        {/* Gatehouse Upper Cornice */}
        <mesh position={[0, 2.65, 0.5]} castShadow>
          <boxGeometry args={[3.85, 0.16, 2.6]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
        </mesh>

        {/* Crenellations on Gatehouse Roof Terrace */}
        {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((cx, ci) => (
          <mesh key={`gcren-${ci}`} position={[cx, 2.85, 1.74]} castShadow>
            <boxGeometry args={[0.34, 0.26, 0.16]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.55} />
          </mesh>
        ))}

        {/* Arched Entrance Portal (Doors, Transom, Lanterns) */}
        <ArchedEntrancePortal position={[0, 0, 1.62]} scale={1.05} />

        {/* Steep Triangular Pediment / Gable above Main Entrance */}
        <group position={[0, 2.8, 1.65]}>
          {/* Triangular Gable Stone Wall */}
          <mesh castShadow>
            <coneGeometry args={[1.5, 1.1, 3]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
          </mesh>
          {/* Gable Stone Raking Cornice */}
          <mesh position={[0, 0.08, 0.06]} castShadow>
            <coneGeometry args={[1.58, 1.18, 3]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
          </mesh>

          {/* Golden Royal Crown Medallion mounted on the pediment */}
          <CrownMedallion position={[0, -0.05, 0.22]} scale={1.12} />
        </group>

        {/* Flanking Royal Heraldic Banners */}
        <RoyalHeraldicBanner position={[-1.38, 1.65, 1.72]} scale={0.95} />
        <RoyalHeraldicBanner position={[1.38, 1.65, 1.72]} scale={0.95} />
      </group>

      {/* ============================================================== */}
      {/* 4. SYMMETRICAL CASTLE WINGS (Connecting Keep to Spires)       */}
      {/* ============================================================== */}
      {[-2.7, 2.7].map((wingX, wIdx) => (
        <group key={`wing-${wIdx}`} position={[wingX, 0.5, 0]}>
          {/* Wing Stone Body */}
          <mesh position={[0, 1.25, 0.1]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 2.0, 2.2]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
          </mesh>
          {/* Wing Pitched Royal Blue Roof */}
          <mesh position={[0, 2.65, 0.1]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[1.8, 1.2, 4]} />
            <meshStandardMaterial color={CASTLE_COLORS.roofRoyalBlue} roughness={0.28} metalness={0.12} />
          </mesh>
          {/* Gold Roof Ridge Cresting */}
          <mesh position={[0, 3.28, 0.1]}>
            <boxGeometry args={[1.6, 0.08, 0.08]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.18} />
          </mesh>

          {/* Wing Arched Windows */}
          <CastleWindow position={[-0.45, 1.35, 1.18]} scale={0.9} />
          <CastleWindow position={[0.45, 1.35, 1.18]} scale={0.9} />

          {/* Roof Dormer Window */}
          <group position={[0, 2.3, 1.05]}>
            <mesh castShadow>
              <boxGeometry args={[0.55, 0.65, 0.4]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[0.42, 0.45, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.roofRoyalBlue} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.05, 0.22]}>
              <planeGeometry args={[0.28, 0.38]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.lightWarmInterior}
                emissive={CASTLE_COLORS.lightGlowEmissive}
                emissiveIntensity={1.5}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 5. INTERMEDIATE TOWERS (Flanking the Entrance)                 */}
      {/* ============================================================== */}
      <CastleTower
        position={[-1.65, 0.5, 1.1]}
        height={2.8}
        radius={0.58}
        roofHeight={1.9}
        roofRadius={0.76}
        hasBattlement
        hasWindow
      />
      <CastleTower
        position={[1.65, 0.5, 1.1]}
        height={2.8}
        radius={0.58}
        roofHeight={1.9}
        roofRadius={0.76}
        hasBattlement
        hasWindow
      />

      {/* ============================================================== */}
      {/* 6. OUTER GRAND FLANKING TOWERS (At the ends of the wings)      */}
      {/* ============================================================== */}
      <CastleTower
        position={[-3.65, 0.5, 0.4]}
        height={3.4}
        radius={0.7}
        roofHeight={2.2}
        roofRadius={0.92}
        hasBattlement
        hasWindow
      />
      <CastleTower
        position={[3.65, 0.5, 0.4]}
        height={3.4}
        radius={0.7}
        roofHeight={2.2}
        roofRadius={0.92}
        hasBattlement
        hasWindow
      />

      {/* ============================================================== */}
      {/* 7. DOMINANT CENTRAL HIGH TOWER & ROYAL BLUE SPIRE              */}
      {/* ============================================================== */}
      <group position={[0, 0.5, -0.4]}>
        {/* Upper Keep Tier Stone Mass */}
        <mesh position={[0, 2.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 1.8, 2.2]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
        </mesh>
        <mesh position={[0, 3.82, 0]} castShadow>
          <boxGeometry args={[2.85, 0.16, 2.45]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
        </mesh>

        {/* Central High Spire Octagonal Shaft */}
        <mesh position={[0, 4.65, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.76, 0.88, 1.8, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.55} />
        </mesh>
        {/* Machicolation Gallery */}
        <mesh position={[0, 5.58, 0]} castShadow>
          <cylinderGeometry args={[1.05, 0.82, 0.22, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
        </mesh>
        <CastleBattlementRing radius={1.02} count={10} height={0.24} width={0.24} yOffset={5.68} />

        {/* Grand Royal Conical Blue Spire */}
        <group position={[0, 5.72, 0]}>
          {/* Flared Eaves Rim */}
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[1.08, 1.25, 0.18, 20]} />
            <meshStandardMaterial color={CASTLE_COLORS.roofRoyalDark} roughness={0.35} />
          </mesh>

          {/* High Pointed Conical Roof */}
          <mesh position={[0, 1.55, 0]} castShadow>
            <coneGeometry args={[1.18, 2.8, 20]} />
            <meshStandardMaterial
              color={CASTLE_COLORS.roofRoyalBlue}
              roughness={0.26}
              metalness={0.14}
            />
          </mesh>

          {/* Golden Spire Rings */}
          <mesh position={[0, 1.0, 0]}>
            <torusGeometry args={[0.82, 0.04, 8, 24]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.94} roughness={0.15} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <torusGeometry args={[0.45, 0.035, 8, 20]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.94} roughness={0.15} />
          </mesh>

          {/* Golden Finial Sphere */}
          <mesh position={[0, 3.02, 0]}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.98} roughness={0.1} />
          </mesh>

          {/* Grand Needle & Main Red Royal Banner */}
          <mesh position={[0, 3.42, 0]}>
            <cylinderGeometry args={[0.028, 0.035, 0.82, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.95} />
          </mesh>
          <mesh ref={flag1Ref} position={[0.32, 3.65, 0]} castShadow>
            <boxGeometry args={[0.58, 0.28, 0.02]} />
            <meshStandardMaterial color={CASTLE_COLORS.bannerRed} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* ============================================================== */}
      {/* 8. LEVEL PROGRESSION & REAR SPIRES (Levels 2-5)                */}
      {/* ============================================================== */}
      {currentLevel >= 2 && (
        <>
          {/* Rear Grand High Towers */}
          <CastleTower
            position={[-2.4, 0.5, -1.8]}
            height={4.2}
            radius={0.62}
            roofHeight={2.0}
            roofRadius={0.82}
            hasBattlement
            hasWindow={false}
          />
          <CastleTower
            position={[2.4, 0.5, -1.8]}
            height={4.2}
            radius={0.62}
            roofHeight={2.0}
            roofRadius={0.82}
            hasBattlement
            hasWindow={false}
          />
        </>
      )}

      {currentLevel >= 3 && (
        /* Front Corner Watch Turrets */
        <>
          {[-4.2, 4.2].map((tx, ti) => (
            <group key={`front-turret-${ti}`} position={[tx, 0.5, 2.2]}>
              <mesh position={[0, 0.7, 0]} castShadow>
                <cylinderGeometry args={[0.34, 0.38, 1.4, 14]} />
                <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
              </mesh>
              <CastleBattlementRing radius={0.4} count={6} height={0.18} width={0.16} yOffset={1.42} />
              <mesh position={[0, 1.85, 0]} castShadow>
                <coneGeometry args={[0.48, 0.9, 14]} />
                <meshStandardMaterial color={CASTLE_COLORS.roofRoyalBlue} roughness={0.3} />
              </mesh>
              <mesh position={[0, 2.34, 0]}>
                <sphereGeometry args={[0.07, 10, 10]} />
                <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {currentLevel >= 4 && (
        /* Royal Clock & Sunburst Crest on Upper Facade */
        <group position={[0, 3.8, 0.85]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.08, 24]} />
            <meshStandardMaterial color="#fffef0" roughness={0.2} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <torusGeometry args={[0.38, 0.035, 8, 24]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.96} roughness={0.15} />
          </mesh>
        </group>
      )}

      {currentLevel >= 5 && (
        /* Golden Royal Halo / Aureole over Spire */
        <group ref={crownHaloRef} position={[0, 8.2, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.2, 0.045, 8, 32]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.goldHighlight}
            metalness={0.98}
            roughness={0.1}
            emissive={CASTLE_COLORS.goldPolished}
            emissiveIntensity={0.3}
          />
        </group>
      )}
    </group>
  );
};
