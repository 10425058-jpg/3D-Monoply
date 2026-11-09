import React from 'react';
import { CASTLE_COLORS } from './CastleMaterials';

// Reusable Quoin Corner Stones for architectural depth
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
            <mesh position={[-width / 2, qy, depth / 2]} castShadow>
              <boxGeometry args={[isLong ? 0.22 : 0.14, 0.22, isLong ? 0.14 : 0.22]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
            {/* Front Right Corner */}
            <mesh position={[width / 2, qy, depth / 2]} castShadow>
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
// 1. LEFT SUPPORTING BUILDING: 2-STORY FRENCH TOWNHOUSE CAFÉ (Panels 04 & 05)
// ============================================================================
export const LeftTownhouseCafe: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position = [-4.6, 0.34, -0.2], rotation = [0, 0.15, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Stone Foundation Plinth */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.75, 0.2, 2.55]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
      </mesh>

      {/* Ground Floor Main Body */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.55, 1.2, 2.35]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Stringcourse Belt Moulding */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[2.7, 0.1, 2.5]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Second Floor Main Body */}
      <mesh position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.1, 2.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Corner Quoin Stones */}
      <CornerQuoins height={2.5} width={2.52} depth={2.32} />

      {/* Terracotta Stepped Hip Roof with Shingle Tile Texture */}
      <group position={[0, 2.6, 0]}>
        <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[2.0, 1.25, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracotta} roughness={0.42} />
        </mesh>
        {/* Stepped Shingle Tile Bands */}
        {[0.2, 0.45, 0.72].map((sy, si) => (
          <mesh key={`cshingle-${si}`} position={[0, sy, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2.0 - si * 0.4, 0.1, 4]} />
            <meshStandardMaterial color={si % 2 === 0 ? CASTLE_COLORS.roofTerracottaDark : '#ea580c'} roughness={0.45} />
          </mesh>
        ))}
        {/* Roof Ridge Trim & Finials */}
        <mesh position={[0, 1.18, 0]} castShadow>
          <boxGeometry args={[0.95, 0.08, 0.08]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracottaDark} roughness={0.5} />
        </mesh>
        {[-0.45, 0.45].map((rx, ri) => (
          <mesh key={`rfinial-cafe-${ri}`} position={[rx, 1.25, 0]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Red Brick Chimney with Chimney Pots */}
      <group position={[0.8, 3.15, -0.45]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 1.0, 0.34]} />
          <meshStandardMaterial color="#c24128" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.54, 0]} castShadow>
          <boxGeometry args={[0.4, 0.08, 0.4]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
        </mesh>
        {/* Chimney Terracotta Pot */}
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.065, 0.075, 0.16, 8]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracottaDark} roughness={0.6} />
        </mesh>
      </group>

      {/* Front Scalloped Striped Awning (Red & White) with Support Brackets */}
      <group position={[0, 1.25, 1.32]}>
        {/* Main Red Awning Base */}
        <mesh rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[2.35, 0.1, 0.78]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
        {/* Alternating White Canvas Stripes */}
        {[-0.85, -0.45, -0.05, 0.35, 0.75].map((sx, si) => (
          <mesh key={`cawn-s-${si}`} position={[sx, 0.015, 0]} rotation={[0.32, 0, 0]}>
            <boxGeometry args={[0.2, 0.105, 0.79]} />
            <meshStandardMaterial color={CASTLE_COLORS.awningWhite} roughness={0.4} />
          </mesh>
        ))}
        {/* Hanging Front Valance Fringe */}
        <mesh position={[0, -0.16, 0.34]} castShadow>
          <boxGeometry args={[2.35, 0.14, 0.04]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
        {/* Wrought Iron Support Brackets Under Awning */}
        {[-1.0, 1.0].map((bx, bi) => (
          <mesh key={`awn-bracket-${bi}`} position={[bx, -0.22, 0.15]} rotation={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.5, 6]} />
            <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Hanging Café Signboard (Panel 05) */}
      <group position={[-1.38, 1.3, 1.25]}>
        {/* Wrought Iron Mounting Arm */}
        <mesh position={[0.1, 0.08, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.03]} />
          <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} />
        </mesh>
        {/* Hanging Wooden Sign Plaque */}
        <mesh position={[0.2, -0.1, 0]} castShadow>
          <boxGeometry args={[0.03, 0.24, 0.36]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.7} />
        </mesh>
        {/* Gold Coffee Cup / Café Emblem */}
        <mesh position={[0.22, -0.1, 0]}>
          <cylinderGeometry args={[0.055, 0.045, 0.09, 8]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} />
        </mesh>
      </group>

      {/* Ground Floor Café French Arched Door & Windows */}
      <group position={[0, 0.7, 1.18]}>
        {/* Arched Center Door with Warm Glow Pane */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.64, 1.12, 0.06]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.14, 0.035]}>
          <planeGeometry args={[0.44, 0.58]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.lightWarmInterior}
            emissive={CASTLE_COLORS.lightGlowEmissive}
            emissiveIntensity={1.8}
          />
        </mesh>
        {/* Flanking Storefront Paned Windows */}
        {[-0.75, 0.75].map((wx, wi) => (
          <group key={`cwin-g-${wi}`} position={[wx, 0.08, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.56, 0.78, 0.06]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[0.46, 0.68]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.lightWarmInterior}
                emissive={CASTLE_COLORS.lightGlowEmissive}
                emissiveIntensity={1.8}
              />
            </mesh>
            {/* Window Mullions */}
            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[0.02, 0.66, 0.015]} />
              <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <boxGeometry args={[0.44, 0.02, 0.015]} />
              <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Second Floor Paned Windows with Window Flower Boxes */}
      {[-0.64, 0.64].map((wx, wi) => (
        <group key={`cwin-2f-${wi}`} position={[wx, 2.05, 1.16]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.7, 0.06]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[0.38, 0.6]} />
            <meshStandardMaterial
              color={CASTLE_COLORS.lightWarmInterior}
              emissive={CASTLE_COLORS.lightGlowEmissive}
              emissiveIntensity={1.8}
            />
          </mesh>
          {/* Wooden Window Flower Box */}
          <mesh position={[0, -0.4, 0.12]} castShadow>
            <boxGeometry args={[0.56, 0.15, 0.16]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
          </mesh>
          {/* Blooming Pink & Rose Blossom Clusters */}
          <mesh position={[0, -0.32, 0.14]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.sakuraMid} roughness={0.6} />
          </mesh>
          <mesh position={[-0.15, -0.34, 0.13]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.sakuraLight} roughness={0.6} />
          </mesh>
          <mesh position={[0.15, -0.34, 0.13]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.flowerRose} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Roof Dormer Window with Triangular Pediment */}
      <group position={[0, 2.82, 0.88]}>
        <mesh castShadow>
          <boxGeometry args={[0.56, 0.62, 0.48]} />
          <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
        </mesh>
        {/* Triangular Pediment */}
        <mesh position={[0, 0.4, 0.08]} castShadow>
          <coneGeometry args={[0.46, 0.38, 3]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracotta} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.04, 0.25]}>
          <planeGeometry args={[0.32, 0.42]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.lightWarmInterior}
            emissive={CASTLE_COLORS.lightGlowEmissive}
            emissiveIntensity={1.8}
          />
        </mesh>
      </group>

      {/* Outdoor Terrace Patio with Striped Parasols & Bistro Furniture (Panel 04/05) */}
      <group position={[0.2, 0.02, 2.05]}>
        {/* Paved Stone Patio */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[2.6, 0.03, 1.85]} />
          <meshStandardMaterial color={CASTLE_COLORS.stonePavement} roughness={0.75} />
        </mesh>

        {/* 2 Striped Canvas Parasols (Umbrellas) */}
        {[-0.68, 0.68].map((px, pi) => (
          <group key={`parasol-${pi}`} position={[px, 0, pi === 0 ? 0.32 : -0.28]} rotation={[0, pi * 0.4, 0.06]}>
            {/* Dark Wood Pole */}
            <mesh position={[0, 0.74, 0]} castShadow>
              <cylinderGeometry args={[0.026, 0.032, 1.48, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.7} />
            </mesh>
            {/* Parasol Canopy (Striped Red & White Cone) */}
            <mesh position={[0, 1.38, 0]} castShadow>
              <coneGeometry args={[0.74, 0.4, 12]} />
              <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.35} />
            </mesh>
            {/* Gold Finial on Parasol Top */}
            <mesh position={[0, 1.62, 0]}>
              <sphereGeometry args={[0.052, 8, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Round Bistro Table */}
            <mesh position={[0, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 0.04, 14]} />
              <meshStandardMaterial color="#ffffff" roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.18, 0]} castShadow>
              <cylinderGeometry args={[0.026, 0.036, 0.36, 8]} />
              <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.8} />
            </mesh>

            {/* Table Cups */}
            <mesh position={[0.08, 0.4, 0.05]}>
              <cylinderGeometry args={[0.025, 0.02, 0.05, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>

            {/* Wooden Ladderback Chairs */}
            {[-0.34, 0.34].map((cx, ci) => (
              <group key={`chair-${pi}-${ci}`} position={[cx, 0, 0]} rotation={[0, ci === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
                <mesh position={[0, 0.22, 0]} castShadow>
                  <boxGeometry args={[0.19, 0.03, 0.19]} />
                  <meshStandardMaterial color={CASTLE_COLORS.woodPlank} roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.4, -0.09]} castShadow>
                  <boxGeometry args={[0.19, 0.36, 0.025]} />
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
        <boxGeometry args={[2.75, 0.2, 2.55]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneDark} roughness={0.7} />
      </mesh>

      {/* Main Ground Floor Body */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.55, 1.2, 2.35]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Stringcourse Belt */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[2.7, 0.1, 2.5]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.5} />
      </mesh>

      {/* Second Floor Body */}
      <mesh position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.1, 2.3]} />
        <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.6} />
      </mesh>

      {/* Corner Quoins */}
      <CornerQuoins height={2.5} width={2.52} depth={2.32} />

      {/* Terracotta Hip Roof with Stepped Shingles & Cresting */}
      <group position={[0, 2.6, 0]}>
        <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[2.0, 1.25, 4]} />
          <meshStandardMaterial color={CASTLE_COLORS.roofTerracotta} roughness={0.42} />
        </mesh>
        {/* Shingle Bands */}
        {[0.2, 0.45, 0.72].map((sy, si) => (
          <mesh key={`bshingle-${si}`} position={[0, sy, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2.0 - si * 0.4, 0.1, 4]} />
            <meshStandardMaterial color={si % 2 === 0 ? CASTLE_COLORS.roofTerracottaDark : '#ea580c'} roughness={0.45} />
          </mesh>
        ))}
        {/* Gold Roof Ridge Cresting */}
        <mesh position={[0, 1.18, 0]}>
          <boxGeometry args={[0.95, 0.08, 0.08]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} roughness={0.2} />
        </mesh>
        {[-0.45, 0.45].map((rx, ri) => (
          <mesh key={`rfinial-boutique-${ri}`} position={[rx, 1.25, 0]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.goldHighlight} metalness={0.65} />
          </mesh>
        ))}
      </group>

      {/* Striped Canopy Awning over Boutique Front */}
      <group position={[0, 1.25, 1.32]}>
        <mesh rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[2.35, 0.1, 0.78]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
        {[-0.85, -0.45, -0.05, 0.35, 0.75].map((sx, si) => (
          <mesh key={`bawn-s-${si}`} position={[sx, 0.015, 0]} rotation={[0.32, 0, 0]}>
            <boxGeometry args={[0.2, 0.105, 0.79]} />
            <meshStandardMaterial color={CASTLE_COLORS.awningWhite} roughness={0.4} />
          </mesh>
        ))}
        {/* Hanging Fringe */}
        <mesh position={[0, -0.16, 0.34]} castShadow>
          <boxGeometry args={[2.35, 0.14, 0.04]} />
          <meshStandardMaterial color={CASTLE_COLORS.awningRed} roughness={0.4} />
        </mesh>
      </group>

      {/* Hanging Boutique Signboard */}
      <group position={[1.38, 1.3, 1.25]}>
        <mesh position={[-0.1, 0.08, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.03]} />
          <meshStandardMaterial color={CASTLE_COLORS.bronzeLamp} metalness={0.85} />
        </mesh>
        <mesh position={[-0.2, -0.1, 0]} castShadow>
          <boxGeometry args={[0.03, 0.24, 0.36]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.7} />
        </mesh>
        {/* Gold Crown / Flower Boutique Insignia */}
        <mesh position={[-0.22, -0.1, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={CASTLE_COLORS.goldPolished} metalness={0.92} />
        </mesh>
      </group>

      {/* Ground Floor Boutique Windows & Entrance */}
      <group position={[0, 0.7, 1.18]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.64, 1.12, 0.06]} />
          <meshStandardMaterial color={CASTLE_COLORS.woodDoor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.14, 0.035]}>
          <planeGeometry args={[0.44, 0.58]} />
          <meshStandardMaterial
            color={CASTLE_COLORS.lightWarmInterior}
            emissive={CASTLE_COLORS.lightGlowEmissive}
            emissiveIntensity={1.8}
          />
        </mesh>
        {[-0.75, 0.75].map((wx, wi) => (
          <group key={`bwin-g-${wi}`} position={[wx, 0.08, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.56, 0.78, 0.06]} />
              <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <planeGeometry args={[0.46, 0.68]} />
              <meshStandardMaterial
                color={CASTLE_COLORS.lightWarmInterior}
                emissive={CASTLE_COLORS.lightGlowEmissive}
                emissiveIntensity={1.8}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Second Floor Paned Windows with Flower Planters */}
      {[-0.64, 0.64].map((wx, wi) => (
        <group key={`bwin-2f-${wi}`} position={[wx, 2.05, 1.16]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.7, 0.06]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneTrim} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[0.38, 0.6]} />
            <meshStandardMaterial
              color={CASTLE_COLORS.lightWarmInterior}
              emissive={CASTLE_COLORS.lightGlowEmissive}
              emissiveIntensity={1.8}
            />
          </mesh>
          <mesh position={[0, -0.4, 0.12]} castShadow>
            <boxGeometry args={[0.56, 0.15, 0.16]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodDark} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.32, 0.14]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.flowerRose} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Adjoining Garden Rose Arbor Pergola on the outer side */}
      <group position={[1.85, 0, 0.4]}>
        {/* 4 Classical Stone Columns with Fluted Stems */}
        {[
          [-0.48, -0.58],
          [-0.48, 0.58],
          [0.48, -0.58],
          [0.48, 0.58],
        ].map(([cx, cz], ci) => (
          <mesh key={`pcol-${ci}`} position={[cx, 0.88, cz]} castShadow>
            <cylinderGeometry args={[0.075, 0.09, 1.76, 12]} />
            <meshStandardMaterial color={CASTLE_COLORS.stoneWall} roughness={0.5} />
          </mesh>
        ))}
        {/* Overhead Wooden Trellis Beams */}
        {[-0.42, 0, 0.42].map((tx, ti) => (
          <mesh key={`tbeam-${ti}`} position={[tx, 1.78, 0]} castShadow>
            <boxGeometry args={[0.09, 0.09, 1.48]} />
            <meshStandardMaterial color={CASTLE_COLORS.woodPlank} roughness={0.7} />
          </mesh>
        ))}
        {/* Climbing Ivy Foliage & Blooming Roses */}
        <mesh position={[0, 1.86, 0]}>
          <boxGeometry args={[1.15, 0.2, 1.35]} />
          <meshStandardMaterial color={CASTLE_COLORS.hedgeGreen} roughness={0.8} />
        </mesh>
        {[-0.32, 0.12, 0.38].map((fx, fi) => (
          <mesh key={`rrose-${fi}`} position={[fx, 1.98, (fi % 2) * 0.4 - 0.2]}>
            <sphereGeometry args={[0.095, 8, 8]} />
            <meshStandardMaterial color={CASTLE_COLORS.flowerRose} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
