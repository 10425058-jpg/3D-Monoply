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
  SculptedRoof,
} from './CastleModules';

export interface CentralCastleProps {
  level?: number;
}

export const CentralCastle: React.FC<CentralCastleProps> = ({ level = 5 }) => {
  const currentLevel = Math.max(1, Math.min(5, level || 1));
  const flag1Ref = useRef<THREE.Mesh>(null);
  const flag2Ref = useRef<THREE.Mesh>(null);
  const flag3Ref = useRef<THREE.Mesh>(null);
  const flagOuterLRef = useRef<THREE.Mesh>(null);
  const flagOuterRRef = useRef<THREE.Mesh>(null);
  const crownHaloRef = useRef<THREE.Group>(null);

  // Subtle wind flutter animation for royal pennant flags
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const wave = Math.sin(t * 3.5) * 0.16;
    if (flag1Ref.current) flag1Ref.current.rotation.y = wave;
    if (flag2Ref.current) flag2Ref.current.rotation.y = Math.sin(t * 3.2 + 0.8) * 0.15;
    if (flag3Ref.current) flag3Ref.current.rotation.y = Math.sin(t * 3.6 + 1.6) * 0.16;
    if (flagOuterLRef.current) flagOuterLRef.current.rotation.y = Math.sin(t * 3.4 + 2.2) * 0.14;
    if (flagOuterRRef.current) flagOuterRRef.current.rotation.y = Math.sin(t * 3.3 + 1.1) * 0.14;

    if (crownHaloRef.current) {
      crownHaloRef.current.rotation.z = t * 0.45;
    }
  });

  return (
    <group position={[0, 0.45, -1.8]}>
      {/* ============================================================== */}
      {/* 1. ELEVATED PALACE FOUNDATION PLATFORM & BALUSTRADES           */}
      {/* ============================================================== */}
      {/* Main Stone Base Terrace */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.8, 0.44, 5.0]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
      </mesh>
      {/* Platform Rusticated Ashlar Base Trim */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[9.1, 0.18, 5.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.72} />
      </mesh>
      {/* Platform Upper Beveled Trim */}
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[9.0, 0.1, 5.15]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
      </mesh>

      {/* Perimeter Stone Balustrades along Front Terrace */}
      {[-3.7, -2.6, 2.6, 3.7].map((bx, bi) => (
        <group key={`balustrade-${bi}`} position={[bx, 0.68, 2.44]}>
          <mesh castShadow>
            <boxGeometry args={[0.98, 0.34, 0.16]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
          </mesh>
          {/* Decorative Gold Finial Urns */}
          <mesh position={[0.44, 0.24, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh position={[-0.44, 0.24, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.72} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 2. GRAND CASCADING FRONT STAIRCASE WITH CEREMONIAL CARPET      */}
      {/* ============================================================== */}
      <group position={[0, 0, 2.55]}>
        {[0, 1, 2, 3, 4, 5].map((stepIdx) => {
          const stepY = 0.04 + (5 - stepIdx) * 0.078;
          const stepZ = stepIdx * 0.26;
          const stepWidth = 3.8 + stepIdx * 0.22;
          return (
            <group key={`castlestair-${stepIdx}`}>
              {/* Stone Tread */}
              <mesh position={[0, stepY, stepZ]} receiveShadow castShadow>
                <boxGeometry args={[stepWidth, 0.08, 0.28]} />
                <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.72} />
              </mesh>
              {/* Center Royal Blue Carpet Runner (Panel 02) */}
              <mesh position={[0, stepY + 0.042, stepZ]}>
                <boxGeometry args={[1.5, 0.008, 0.27]} />
                <meshStandardMaterial color={CASTLE_COLORS.carpetRoyalBlue} roughness={0.5} />
              </mesh>
              {/* Carpet Gold Border Lines */}
              {[-0.74, 0.74].map((lx, li) => (
                <mesh key={`cborder-${stepIdx}-${li}`} position={[lx, stepY + 0.045, stepZ]}>
                  <boxGeometry args={[0.03, 0.01, 0.27]} />
                  <meshStandardMaterial color={CASTLE_COLORS.carpetTrimGold} metalness={0.72} roughness={0.3} />
                </mesh>
              ))}
            </group>
          );
        })}

        {/* Flanking Stepped Balustrades with Gold Urns & Flower Planters */}
        {[-2.15, 2.15].map((sideX, sIdx) => (
          <group key={`stair-bal-${sIdx}`} position={[sideX, 0.38, 0.65]}>
            {/* Ramped Stone Railing */}
            <mesh rotation={[0.26, 0, 0]} castShadow>
              <boxGeometry args={[0.24, 0.3, 1.8]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
            </mesh>
            {/* Lower Gold Urn on Pedestal */}
            <group position={[0, -0.16, 0.85]}>
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.28, 0.3]} />
                <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.72} />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.72} roughness={0.3} />
              </mesh>
            </group>
            {/* Upper Gold Urn */}
            <group position={[0, 0.3, -0.75]}>
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.28, 0.3]} />
                <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.72} />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.72} roughness={0.3} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* ============================================================== */}
      {/* 3. CENTRAL GATEHOUSE & GRAND ENTRANCE                          */}
      {/* ============================================================== */}
      <group position={[0, 0.5, 0]}>
        {/* Gatehouse Center Stone Mass */}
        <mesh position={[0, 1.45, 0.5]} castShadow receiveShadow>
          <boxGeometry args={[3.8, 2.5, 2.5]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
        </mesh>

        {/* Vertical Quoin Ashlar Corners on Gatehouse */}
        {[-1.85, 1.85].map((qx, qi) => (
          <group key={`gquoin-${qi}`} position={[qx, 1.45, 1.7]}>
            <mesh castShadow>
              <boxGeometry args={[0.18, 2.4, 0.22]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneQuoin} roughness={0.72} />
            </mesh>
          </group>
        ))}

        {/* Gatehouse Upper Cornice with Dentil Band */}
        <mesh position={[0, 2.72, 0.5]} castShadow>
          <boxGeometry args={[4.05, 0.16, 2.7]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
        </mesh>
        <mesh position={[0, 2.62, 1.76]} castShadow>
          <boxGeometry args={[3.95, 0.06, 0.06]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.72} />
        </mesh>

        {/* Crenellations on Gatehouse Roof Terrace */}
        {[-1.6, -1.0, -0.4, 0.4, 1.0, 1.6].map((cx, ci) => (
          <group key={`gcren-${ci}`} position={[cx, 2.92, 1.78]}>
            <mesh castShadow>
              <boxGeometry args={[0.34, 0.26, 0.16]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.14, 0]} castShadow>
              <boxGeometry args={[0.38, 0.04, 0.18]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
            </mesh>
          </group>
        ))}

        {/* Arched Entrance Portal (Triple Archivolts, Oak Doors, Sconces) */}
        <ArchedEntrancePortal position={[0, 0, 1.66]} scale={1.06} />

        {/* Classical Pediment / Gable with Crown Medallion (Panel 02) */}
        <group position={[0, 2.88, 1.72]}>
          {/* Triangular Tympanum Stone Wall */}
          <mesh castShadow>
            <coneGeometry args={[1.65, 1.25, 3]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
          </mesh>
          {/* Moulded Raking Cornice */}
          <mesh position={[0, 0.08, 0.06]} castShadow>
            <coneGeometry args={[1.74, 1.34, 3]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
          </mesh>

          {/* High-Relief Royal Golden Crown Medallion */}
          <CrownMedallion position={[0, -0.06, 0.24]} scale={1.18} />
        </group>

        {/* Flanking Royal Heraldic Banners */}
        <RoyalHeraldicBanner position={[-1.48, 1.7, 1.78]} scale={0.98} />
        <RoyalHeraldicBanner position={[1.48, 1.7, 1.78]} scale={0.98} />
      </group>

      {/* ============================================================== */}
      {/* 4. SYMMETRICAL CASTLE WINGS (Connecting Keep to Spires)       */}
      {/* ============================================================== */}
      {[-2.8, 2.8].map((wingX, wIdx) => (
        <group key={`wing-${wIdx}`} position={[wingX, 0.5, 0]}>
          {/* Wing Stone Body */}
          <mesh position={[0, 1.3, 0.1]} castShadow receiveShadow>
            <boxGeometry args={[2.5, 2.1, 2.3]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
          </mesh>
          {/* Wing Stringcourse */}
          <mesh position={[0, 1.25, 1.26]} castShadow>
            <boxGeometry args={[2.55, 0.08, 0.08]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
          </mesh>

          {/* Wing Pitched Royal Blue Roof with Shingle Hip */}
          <group position={[0, 2.7, 0.1]}>
            <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[1.9, 1.3, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.roofRoyalBlue} roughness={0.48} metalness={0.04} />
            </mesh>
            {/* Shingle Shadow Edge Ring */}
            <mesh position={[0, -0.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[2.0, 0.2, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.roofRoyalDark} roughness={0.48} />
            </mesh>
            {/* Gold Roof Ridge Cresting */}
            <mesh position={[0, 0.68, 0]}>
              <boxGeometry args={[1.7, 0.09, 0.09]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.72} roughness={0.3} />
            </mesh>
            {[-0.6, 0, 0.6].map((fx, fi) => (
              <mesh key={`wfinial-${wIdx}-${fi}`} position={[fx, 0.78, 0]}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.72} roughness={0.3} />
              </mesh>
            ))}
          </group>

          {/* Wing Arched Windows (Upper & Lower) */}
          <CastleWindow position={[-0.48, 1.4, 1.26]} scale={0.92} />
          <CastleWindow position={[0.48, 1.4, 1.26]} scale={0.92} />

          {/* Roof Dormer Window */}
          <group position={[0, 2.36, 1.12]}>
            <mesh castShadow>
              <boxGeometry args={[0.58, 0.68, 0.44]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.42, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[0.45, 0.48, 4]} />
              <meshStandardMaterial color={CASTLE_COLORS.roofRoyalBlue} roughness={0.48} metalness={0.04} />
            </mesh>
            <mesh position={[0, 0.06, 0.24]}>
              <planeGeometry args={[0.3, 0.4]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.lightWarmInterior}
                emissive={CASTLE_COLORS.lightGlowEmissive}
                emissiveIntensity={1.8}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 5. INTERMEDIATE TOWERS (Flanking the Main Gatehouse)           */}
      {/* ============================================================== */}
      <CastleTower
        position={[-1.72, 0.5, 1.15]}
        height={2.9}
        radius={0.62}
        roofHeight={2.05}
        roofRadius={0.82}
        hasBattlement
        hasWindow
        hasDormer
        dormerAngle={0.2}
        flagColor={CASTLE_COLORS.bannerRed}
        flagRef={flag2Ref}
      />
      <CastleTower
        position={[1.72, 0.5, 1.15]}
        height={2.9}
        radius={0.62}
        roofHeight={2.05}
        roofRadius={0.82}
        hasBattlement
        hasWindow
        hasDormer
        dormerAngle={-0.2}
        flagColor={CASTLE_COLORS.bannerRed}
        flagRef={flag3Ref}
      />

      {/* ============================================================== */}
      {/* 6. OUTER GRAND FLANKING TOWERS (At the Wing Terminals)         */}
      {/* ============================================================== */}
      <CastleTower
        position={[-3.8, 0.5, 0.45]}
        height={3.5}
        radius={0.74}
        roofHeight={2.35}
        roofRadius={0.98}
        hasBattlement
        hasWindow
        hasDormer
        dormerAngle={0.35}
        flagColor={CASTLE_COLORS.bannerBlue}
        flagRef={flagOuterLRef}
      />
      <CastleTower
        position={[3.8, 0.5, 0.45]}
        height={3.5}
        radius={0.74}
        roofHeight={2.35}
        roofRadius={0.98}
        hasBattlement
        hasWindow
        hasDormer
        dormerAngle={-0.35}
        flagColor={CASTLE_COLORS.bannerBlue}
        flagRef={flagOuterRRef}
      />

      {/* ============================================================== */}
      {/* 7. DOMINANT CENTRAL HIGH KEEP & GRAND ROYAL BLUE SPIRE         */}
      {/* ============================================================== */}
      <group position={[0, 0.5, -0.4]}>
        {/* Upper Keep Tier Stone Mass */}
        <mesh position={[0, 3.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 1.9, 2.4]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
        </mesh>
        <mesh position={[0, 3.96, 0]} castShadow>
          <boxGeometry args={[3.05, 0.18, 2.65]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
        </mesh>

        {/* Upper Keep Arched Windows */}
        {[-0.65, 0.65].map((wx, wi) => (
          <CastleWindow key={`upperwin-${wi}`} position={[wx, 3.1, 1.22]} scale={0.85} />
        ))}

        {/* Central High Spire Octagonal Shaft */}
        <mesh position={[0, 4.8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.82, 0.94, 1.9, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
        </mesh>
        {/* Vertical Pilaster Trim Bands */}
        <mesh position={[0, 4.8, 0]}>
          <cylinderGeometry args={[0.84, 0.96, 0.12, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
        </mesh>

        {/* Machicolation Gallery with Deep Stone Corbels */}
        <mesh position={[0, 5.76, 0]} castShadow>
          <cylinderGeometry args={[1.12, 0.88, 0.24, 16]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.72} />
        </mesh>
        <CastleBattlementRing radius={1.1} count={10} height={0.25} width={0.25} yOffset={5.88} />

        {/* Grand Royal Conical Blue Spire with Stepped Scalloped Tiles */}
        <group position={[0, 5.92, 0]}>
          <SculptedRoof
            radius={1.28}
            height={3.0}
            hasDormer
            dormerAngle={0}
            flagColor={CASTLE_COLORS.bannerRed}
            flagRef={flag1Ref}
          />
        </group>
      </group>

      {/* ============================================================== */}
      {/* 8. LEVEL PROGRESSION ARCHITECTURAL ENHANCEMENTS (Levels 2-5)   */}
      {/* ============================================================== */}
      {currentLevel >= 2 && (
        <>
          {/* Rear Grand High Towers */}
          <CastleTower
            position={[-2.5, 0.5, -1.9]}
            height={4.3}
            radius={0.65}
            roofHeight={2.1}
            roofRadius={0.86}
            hasBattlement
            hasWindow={false}
            hasDormer={false}
          />
          <CastleTower
            position={[2.5, 0.5, -1.9]}
            height={4.3}
            radius={0.65}
            roofHeight={2.1}
            roofRadius={0.86}
            hasBattlement
            hasWindow={false}
            hasDormer={false}
          />
        </>
      )}

      {currentLevel >= 3 && (
        /* Front Corner Watch Turrets with Conical Roofs & Finials */
        <>
          {[-4.3, 4.3].map((tx, ti) => (
            <group key={`front-turret-${ti}`} position={[tx, 0.5, 2.3]}>
              <mesh position={[0, 0.75, 0]} castShadow>
                <cylinderGeometry args={[0.36, 0.4, 1.5, 14]} />
                <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.72} />
              </mesh>
              <CastleBattlementRing radius={0.42} count={6} height={0.18} width={0.16} yOffset={1.52} />
              <group position={[0, 1.55, 0]}>
                <SculptedRoof
                  radius={0.52}
                  height={1.05}
                  hasDormer={false}
                  flagColor={CASTLE_COLORS.bannerRed}
                />
              </group>
            </group>
          ))}
        </>
      )}

      {currentLevel >= 4 && (
        /* Royal Clock Face & Golden Sunburst on Keep Facade */
        <group position={[0, 3.9, 0.9]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 24]} />
            <meshStandardMaterial color="#fffef0" roughness={0.2} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0, 0.046]}>
            <torusGeometry args={[0.42, 0.04, 8, 24]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.72} roughness={0.3} />
          </mesh>
          {/* Clock Hands in Gold */}
          <mesh position={[0, 0.08, 0.052]}>
            <boxGeometry args={[0.03, 0.22, 0.01]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldFiligree} metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh position={[0.06, 0, 0.052]} rotation={[0, 0, -Math.PI / 3]}>
            <boxGeometry args={[0.025, 0.16, 0.01]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldFiligree} metalness={0.72} roughness={0.3} />
          </mesh>
        </group>
      )}

      {currentLevel >= 5 && (
        /* Golden Royal Halo / Aureole over High Spire */
        <group ref={crownHaloRef} position={[0, 8.4, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.25, 0.048, 8, 32]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.goldHighlight}
            metalness={0.72}
            roughness={0.3}
            emissive={CASTLE_COLORS.goldPolished}
            emissiveIntensity={0.35}
          />
        </group>
      )}
    </group>
  );
};
