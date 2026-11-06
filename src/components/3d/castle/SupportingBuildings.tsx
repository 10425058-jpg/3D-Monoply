import React from 'react';
import { CASTLE_COLORS } from './CastleMaterials';

// Reusable Quoin Corner Stones
const CornerQuoins: React.FC<{ height: number; width: number; depth: number }> = ({
  height,
  width,
  depth,
}) => {
  const steps = Math.floor(height / 0.28);
  return (
    <group>
      {Array.from({ length: steps }).map((_, idx) => {
        const isLong = idx % 2 === 0;
        const qy = 0.14 + idx * 0.28;
        return (
          <React.Fragment key={`quoin-${idx}`}>
            {/* Front Left Corner */}
            <mesh position={[-width / 2, qy, depth / 2]}>
              <boxGeometry args={[isLong ? 0.22 : 0.14, 0.22, isLong ? 0.14 : 0.22]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
            {/* Front Right Corner */}
            <mesh position={[width / 2, qy, depth / 2]}>
              <boxGeometry args={[isLong ? 0.22 : 0.14, 0.22, isLong ? 0.14 : 0.22]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
          </React.Fragment>
        );
      })}
    </group>
  );
};

// ============================================================================
// 1. LEFT SUPPORTING BUILDING: 2-STORY FRENCH TOWNHOUSE CAFÉ
// ============================================================================
export const LeftTownhouseCafe: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position = [-4.6, 0.34, -0.2], rotation = [0, 0.15, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Stone Foundation Plinth */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.2, 2.5]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
      </mesh>

      {/* Ground Floor Main Body */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.2, 2.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Stringcourse Belt Moulding */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[2.65, 0.1, 2.45]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Second Floor Main Body */}
      <mesh position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.45, 1.1, 2.25]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Corner Quoin Stones */}
      <CornerQuoins height={2.5} width={2.48} depth={2.28} />

      {/* Terracotta Hip Roof */}
      <group position={[0, 2.6, 0]}>
        <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[1.95, 1.2, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracotta} roughness={0.38} />
        </mesh>
        {/* Roof Ridge Trim */}
        <mesh position={[0, 1.16, 0]}>
          <boxGeometry args={[0.9, 0.08, 0.08]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracottaDark} roughness={0.5} />
        </mesh>
      </group>

      {/* Red Brick Chimney */}
      <group position={[0.75, 3.1, -0.45]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.95, 0.32]} />
          <meshStandardMaterial color="#c24128" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.38, 0.08, 0.38]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
        </mesh>
      </group>

      {/* Front Scalloped Striped Awning (Red & White) */}
      <group position={[0, 1.25, 1.3]}>
        {/* Main Red Awning Base */}
        <mesh rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[2.3, 0.1, 0.75]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
        {/* Alternating White Stripes */}
        {[-0.8, -0.4, 0, 0.4, 0.8].map((sx, si) => (
          <mesh key={`cawn-s-${si}`} position={[sx, 0.015, 0]} rotation={[0.32, 0, 0]}>
            <boxGeometry args={[0.2, 0.105, 0.76]} />
            <meshStandardMaterial color={CASTLE_COLORS.awningWhite} roughness={0.4} />
          </mesh>
        ))}
        {/* Hanging Front Valance Fringe */}
        <mesh position={[0, -0.16, 0.32]} castShadow>
          <boxGeometry args={[2.3, 0.14, 0.04]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
      </group>

      {/* Ground Floor Café French Arched Door & Windows */}
      <group position={[0, 0.7, 1.16]}>
        {/* Arched Center Door */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.62, 1.1, 0.06]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.12, 0.035]}>
          <planeGeometry args={[0.42, 0.55]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.lightWarmInterior}
            emissive={CASTLE_COLORS.lightGlowEmissive}
            emissiveIntensity={1.4}
          />
        </mesh>
        {/* Flanking Warm Storefront Windows */}
        {[-0.72, 0.72].map((wx, wi) => (
          <group key={`cwin-g-${wi}`} position={[wx, 0.08, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.54, 0.75, 0.06]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[0.44, 0.65]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.lightWarmInterior}
                emissive={CASTLE_COLORS.lightGlowEmissive}
                emissiveIntensity={1.6}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Second Floor Paned Windows with Flower Boxes */}
      {[-0.62, 0.62].map((wx, wi) => (
        <group key={`cwin-2f-${wi}`} position={[wx, 2.05, 1.14]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.68, 0.06]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[0.36, 0.58]} />
            <meshStandardMaterial
              color={CASTLE_COLORS.lightWarmInterior}
              emissive={CASTLE_COLORS.lightGlowEmissive}
              emissiveIntensity={1.5}
            />
          </mesh>
          {/* Wooden Window Flower Box */}
          <mesh position={[0, -0.38, 0.1]} castShadow>
            <boxGeometry args={[0.52, 0.14, 0.14]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
          </mesh>
          {/* Blooming Pink Flower Cluster */}
          <mesh position={[0, -0.3, 0.12]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.sakuraMid} roughness={0.6} />
          </mesh>
          <mesh position={[-0.14, -0.32, 0.11]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.sakuraLight} roughness={0.6} />
          </mesh>
          <mesh position={[0.14, -0.32, 0.11]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.flowerRose} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Roof Dormer Window with Triangular Pediment */}
      <group position={[0, 2.8, 0.85]}>
        <mesh castShadow>
          <boxGeometry args={[0.54, 0.6, 0.45]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
        </mesh>
        {/* Triangular Pediment */}
        <mesh position={[0, 0.38, 0.08]} castShadow>
          <coneGeometry args={[0.44, 0.36, 3]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracotta} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.24]}>
          <planeGeometry args={[0.3, 0.4]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.lightWarmInterior}
            emissive={CASTLE_COLORS.lightGlowEmissive}
            emissiveIntensity={1.5}
          />
        </mesh>
      </group>

      {/* Outdoor Terrace Patio with Striped Parasols & Bistro Furniture */}
      <group position={[0.2, 0.02, 2.0]}>
        {/* Paved Stone Patio */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[2.5, 0.03, 1.8]} />
          <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.75} />
        </mesh>

        {/* 2 Striped Canvas Parasols (Umbrellas) */}
        {[-0.65, 0.65].map((px, pi) => (
          <group key={`parasol-${pi}`} position={[px, 0, pi === 0 ? 0.3 : -0.25]} rotation={[0, pi * 0.4, 0.06]}>
            {/* Dark Wood Pole */}
            <mesh position={[0, 0.72, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.03, 1.45, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.7} />
            </mesh>
            {/* Parasol Canopy (Striped Red & White Cone) */}
            <mesh position={[0, 1.35, 0]} castShadow>
              <coneGeometry args={[0.72, 0.38, 12]} />
              <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.35} />
            </mesh>
            {/* Gold Finial on Parasol Top */}
            <mesh position={[0, 1.58, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Round Bistro Table */}
            <mesh position={[0, 0.35, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.26, 0.04, 14]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.17, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.035, 0.34, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
            </mesh>

            {/* Wooden Ladderback Chairs */}
            {[-0.32, 0.32].map((cx, ci) => (
              <group key={`chair-${pi}-${ci}`} position={[cx, 0, 0]} rotation={[0, ci === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
                <mesh position={[0, 0.2, 0]} castShadow>
                  <boxGeometry args={[0.18, 0.03, 0.18]} />
                  <meshStandardMaterial color={CASTLE_COLORS.woodPlank} roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.38, -0.08]} castShadow>
                  <boxGeometry args={[0.18, 0.34, 0.025]} />
                  <meshStandardMaterial color={CASTLE_COLORS.woodPlank} roughness={0.7} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
};

// ============================================================================
// 2. RIGHT SUPPORTING BUILDING: BOUTIQUE SHOP & FLORAL ROSE PERGOLA
// ============================================================================
export const RightTownhouseBoutique: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position = [4.6, 0.34, -0.2], rotation = [0, -0.15, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Stone Foundation Plinth */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.2, 2.5]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
      </mesh>

      {/* Main Ground Floor Body */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.2, 2.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Stringcourse Belt */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[2.65, 0.1, 2.45]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Second Floor Body */}
      <mesh position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.45, 1.1, 2.25]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Corner Quoins */}
      <CornerQuoins height={2.5} width={2.48} depth={2.28} />

      {/* Terracotta Hip Roof with Cresting */}
      <group position={[0, 2.6, 0]}>
        <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[1.95, 1.2, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracotta} roughness={0.38} />
        </mesh>
        {/* Gold Roof Ridge Cresting */}
        <mesh position={[0, 1.16, 0]}>
          <boxGeometry args={[0.9, 0.08, 0.08]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
        </mesh>
      </group>

      {/* Striped Canopy Awning over Boutique Front */}
      <group position={[0, 1.25, 1.3]}>
        <mesh rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[2.3, 0.1, 0.75]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
        {[-0.8, -0.4, 0, 0.4, 0.8].map((sx, si) => (
          <mesh key={`bawn-s-${si}`} position={[sx, 0.015, 0]} rotation={[0.32, 0, 0]}>
            <boxGeometry args={[0.2, 0.105, 0.76]} />
            <meshStandardMaterial color={CASTLE_COLORS.awningWhite} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Ground Floor Boutique Windows & Entrance */}
      <group position={[0, 0.7, 1.16]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.62, 1.1, 0.06]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.12, 0.035]}>
          <planeGeometry args={[0.42, 0.55]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.lightWarmInterior}
            emissive={CASTLE_COLORS.lightGlowEmissive}
            emissiveIntensity={1.4}
          />
        </mesh>
        {[-0.72, 0.72].map((wx, wi) => (
          <group key={`bwin-g-${wi}`} position={[wx, 0.08, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.54, 0.75, 0.06]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[0.44, 0.65]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.lightWarmInterior}
                emissive={CASTLE_COLORS.lightGlowEmissive}
                emissiveIntensity={1.6}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Second Floor Paned Windows with Flower Planters */}
      {[-0.62, 0.62].map((wx, wi) => (
        <group key={`bwin-2f-${wi}`} position={[wx, 2.05, 1.14]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.68, 0.06]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[0.36, 0.58]} />
            <meshStandardMaterial
              color={CASTLE_COLORS.lightWarmInterior}
              emissive={CASTLE_COLORS.lightGlowEmissive}
              emissiveIntensity={1.5}
            />
          </mesh>
          <mesh position={[0, -0.38, 0.1]} castShadow>
            <boxGeometry args={[0.52, 0.14, 0.14]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.3, 0.12]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.flowerRose} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Adjoining Garden Rose Arbor Pergola on the outer side */}
      <group position={[1.8, 0, 0.4]}>
        {/* 4 Classical Stone Columns */}
        {[
          [-0.45, -0.55],
          [-0.45, 0.55],
          [0.45, -0.55],
          [0.45, 0.55],
        ].map(([cx, cz], ci) => (
          <mesh key={`pcol-${ci}`} position={[cx, 0.85, cz]} castShadow>
            <cylinderGeometry args={[0.07, 0.085, 1.7, 12]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.5} />
          </mesh>
        ))}
        {/* Overhead Wooden Trellis Beams */}
        {[-0.4, 0, 0.4].map((tx, ti) => (
          <mesh key={`tbeam-${ti}`} position={[tx, 1.74, 0]} castShadow>
            <boxGeometry args={[0.08, 0.08, 1.4]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodPlank} roughness={0.7} />
          </mesh>
        ))}
        {/* Climbing Ivy Foliage & Pink Rose Blossoms */}
        <mesh position={[0, 1.82, 0]}>
          <boxGeometry args={[1.1, 0.18, 1.3]} />
          <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
        </mesh>
        {[-0.3, 0.1, 0.35].map((fx, fi) => (
          <mesh key={`rrose-${fi}`} position={[fx, 1.94, (fi % 2) * 0.4 - 0.2]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.flowerRose} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
