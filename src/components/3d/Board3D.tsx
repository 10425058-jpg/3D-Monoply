import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useSceneState as useGameStore } from '../../presentation/SceneStore';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { createWalnutGrain } from './boardMaterials';

// Material colors
const GOLD_ACCENT = '#d8b568';
const CLIFF_STONE = '#5c4e78';
const CLIFF_GRASS = '#63885a';
const TILE_IVORY = '#f3ead8';
const TILE_BORDER = '#eedfc8';

// Space Icons & Special Renderers
const SpecialSpaceGraphic: React.FC<{ spaceId: number; labelRotation: [number, number, number] }> = ({ spaceId, labelRotation }) => {
  switch (spaceId) {
    case 0: // GO
      return (
        <group position={[0, 0.08, 0]} rotation={labelRotation}>
          {/* Bold 3D Red Directional Arrow */}
          <mesh position={[0, 0, 0.4]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.38, 0.75, 3]} />
            <meshStandardMaterial color="#e63946" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[-0.45, 0, 0.4]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.45, 0.04, 0.28]} />
            <meshStandardMaterial color="#e63946" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Bold GO Lettering */}
          <Text position={[0, 0.01, -0.35]} fontSize={0.72} color="#1f2937" fontWeight="black" anchorX="center" anchorY="middle">
            GO
          </Text>
        </group>
      );

    case 10: // JAIL / JUST VISITING
      return (
        <group position={[0, 0.08, 0]} rotation={labelRotation}>
          {/* Inner Jail Cell with Orange Floor */}
          <mesh position={[-0.32, 0, -0.32]}>
            <boxGeometry args={[1.35, 0.04, 1.35]} />
            <meshStandardMaterial color="#f97316" roughness={0.5} />
          </mesh>
          {/* 3D Black Iron Cage Bars */}
          {[-0.8, -0.5, -0.2, 0.1].map((bx, bidx) => (
            <mesh key={`bar-${bidx}`} position={[bx, 0.25, 0.32]}>
              <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
              <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[-0.35, 0.5, 0.32]}>
            <boxGeometry args={[1.1, 0.04, 0.05]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} />
          </mesh>
          <Text position={[-0.35, 0.03, -0.35]} fontSize={0.28} color="#ffffff" fontWeight="black" anchorX="center" anchorY="middle">
            JAIL
          </Text>
          <Text position={[0.42, 0.02, 0.42]} fontSize={0.16} color="#475569" fontWeight="bold" anchorX="center" anchorY="middle">
            JUST VISITING
          </Text>
        </group>
      );

    case 20: // FREE PARKING
      return (
        <group position={[0, 0.08, 0]} rotation={labelRotation}>
          {/* Red Retro Convertible Car Illustration */}
          <group position={[0, 0.08, -0.15]}>
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[0.7, 0.16, 0.4]} />
              <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.4} />
            </mesh>
            <mesh position={[-0.05, 0.2, 0]}>
              <boxGeometry args={[0.4, 0.12, 0.36]} />
              <meshStandardMaterial color="#fef08a" roughness={0.2} />
            </mesh>
            {/* Wheels */}
            {[-0.22, 0.22].map((wx, widx) => (
              <React.Fragment key={`wheel-${widx}`}>
                <mesh position={[wx, 0.04, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
                  <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[wx, 0.04, -0.21]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
                  <meshStandardMaterial color="#1e293b" />
                </mesh>
              </React.Fragment>
            ))}
          </group>
          <Text position={[0, 0.02, 0.52]} fontSize={0.2} color="#1e293b" fontWeight="black" textAlign="center">
            FREE{'\n'}PARKING
          </Text>
        </group>
      );

    case 30: // GO TO JAIL
      return (
        <group position={[0, 0.08, 0]} rotation={labelRotation}>
          {/* Police Cap / Badge */}
          <group position={[0, 0.1, -0.15]}>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.34, 0.38, 0.18, 16]} />
              <meshStandardMaterial color="#1e3a8a" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.05, 0.22]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.42, 0.03, 0.22]} />
              <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.7} />
            </mesh>
            {/* Gold Police Badge */}
            <mesh position={[0, 0.12, 0.32]}>
              <coneGeometry args={[0.08, 0.12, 5]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
            </mesh>
          </group>
          <Text position={[0, 0.02, 0.52]} fontSize={0.2} color="#1e293b" fontWeight="black" textAlign="center">
            GO TO{'\n'}JAIL
          </Text>
        </group>
      );

    default:
      return null;
  }
};

export const Board3D: React.FC = () => {
  const selectSpace = useGameStore((s) => s.selectSpace);
  const setHoveredSpace = useGameStore((s) => s.setHoveredSpace);
  const selectedSpaceId = useGameStore((s) => s.selectedSpaceId);
  const hoveredSpaceId = useGameStore((s) => s.hoveredSpaceId);
  const properties = useGameStore((s) => s.properties);
  const players = useGameStore((s) => s.players);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const walnutGrain = useMemo(createWalnutGrain, []);
  useEffect(() => () => walnutGrain.dispose(), [walnutGrain]);

  const cornerSpaces = useMemo(() => BOARD_SPACES.filter((space) => getSpaceTransform(space.id).isCorner), []);
  const edgeSpaces = useMemo(() => BOARD_SPACES.filter((space) => !getSpaceTransform(space.id).isCorner), []);

  const cornerBaseGeometry = useMemo(() => new RoundedBoxGeometry(2.875, 0.14, 2.875, 0.05, 4), []);
  const edgeBaseGeometry = useMemo(() => new RoundedBoxGeometry(1.775, 0.14, 2.875, 0.05, 4), []);
  const cornerTopGeometry = useMemo(() => new RoundedBoxGeometry(2.81, 0.09, 2.81, 0.04, 4), []);
  const edgeTopGeometry = useMemo(() => new RoundedBoxGeometry(1.71, 0.09, 2.81, 0.04, 4), []);

  const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cabbab', metalness: 0, roughness: 0.72,
  }), []);

  const topMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: TILE_IVORY, roughness: 0.62, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.42,
  }), []);

  const cornerBase = useRef<THREE.InstancedMesh>(null);
  const edgeBase = useRef<THREE.InstancedMesh>(null);
  const cornerTop = useRef<THREE.InstancedMesh>(null);
  const edgeTop = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const updateBatch = (
      mesh: React.RefObject<THREE.InstancedMesh>,
      spaces: typeof BOARD_SPACES,
      yOffset: number,
      withColor = false
    ) => {
      if (!mesh.current) return;
      spaces.forEach((space, index) => {
        const transform = getSpaceTransform(space.id);
        const isHovered = hoveredId === space.id || hoveredSpaceId === space.id;
        const isSelected = selectedSpaceId === space.id;
        const baseY = isHovered ? 0.38 : isSelected ? 0.34 : 0.26;
        dummy.position.set(transform.position[0], baseY + yOffset, transform.position[2]);
        dummy.rotation.set(0, transform.rotationY, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(index, dummy.matrix);
        if (withColor) {
          const property = properties[space.id];
          const tint = isHovered
            ? '#fffceb'
            : isSelected
              ? '#fff8d6'
              : property?.isMortgaged
                ? '#cbd5e1'
                : '#ffffff';
          mesh.current!.setColorAt(index, new THREE.Color(tint));
        }
      });
      mesh.current.instanceMatrix.needsUpdate = true;
      if (withColor && mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    };

    updateBatch(cornerBase, cornerSpaces, -0.05);
    updateBatch(edgeBase, edgeSpaces, -0.05);
    updateBatch(cornerTop, cornerSpaces, 0.015, true);
    updateBatch(edgeTop, edgeSpaces, 0.015, true);
  }, [cornerSpaces, edgeSpaces, hoveredId, hoveredSpaceId, selectedSpaceId, properties]);

  const handleTileClick = (event: any, spaces: typeof BOARD_SPACES) => {
    event.stopPropagation();
    const index = event.instanceId;
    const space = typeof index === 'number' ? spaces[index] : undefined;
    if (space) selectSpace(space.id);
  };
  const handleTileOver = (event: any, spaces: typeof BOARD_SPACES) => {
    event.stopPropagation();
    const index = event.instanceId;
    const space = typeof index === 'number' ? spaces[index] : undefined;
    if (space) {
      setHoveredId(space.id);
      setHoveredSpace(space.id);
      document.body.style.cursor = 'pointer';
    }
  };
  const handleTileOut = () => {
    setHoveredId(null);
    setHoveredSpace(null);
    document.body.style.cursor = 'auto';
  };

  return (
    <group name="game-board">
      {/* ============================================================== */}
      {/* 1. FLOATING DIORAMA CLIFF BASE & HANGING VINES                 */}
      {/* ============================================================== */}
      {/* Floating Island Rock Plinth underneath the board */}
      <mesh position={[0, -1.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[25.2, 1.4, 25.2]} />
        <meshStandardMaterial color={CLIFF_STONE} roughness={0.8} />
      </mesh>
      {/* Grassy Overhang layer under the golden frame */}
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[25.4, 0.35, 25.4]} />
        <meshStandardMaterial color={CLIFF_GRASS} roughness={0.75} />
      </mesh>

      {/* Under-Board Magical Neon Cyan/White Rim Glow Strip */}
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[25.0, 0.06, 25.0]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={0.45}
          roughness={0.1}
        />
      </mesh>

      {/* Hanging Lush Foliage & Pink Blossoms cascading off the cliff rim */}
      {[-11.5, -8.5, -5.5, -2.5, 0.5, 3.5, 6.5, 9.5, 11.5].map((fx, fidx) => (
        <React.Fragment key={`foliage-ns-${fidx}`}>
          {/* North and South hanging vines */}
          <mesh position={[fx, -0.85 - (fidx % 3) * 0.12, 12.7]} castShadow>
            <sphereGeometry args={[0.32 + (fidx % 2) * 0.14, 10, 10]} />
            <meshStandardMaterial color={fidx % 2 === 0 ? '#4da843' : '#388e3c'} roughness={0.7} />
          </mesh>
          <mesh position={[fx + 0.12, -0.98 - (fidx % 3) * 0.12, 12.8]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#ff9bb2" roughness={0.5} />
          </mesh>
          <mesh position={[fx, -0.85 - ((fidx + 1) % 3) * 0.12, -12.7]} castShadow>
            <sphereGeometry args={[0.32 + (fidx % 2) * 0.14, 10, 10]} />
            <meshStandardMaterial color={fidx % 2 === 0 ? '#4da843' : '#388e3c'} roughness={0.7} />
          </mesh>
          <mesh position={[fx - 0.12, -0.98 - ((fidx + 1) % 3) * 0.12, -12.8]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#ff9bb2" roughness={0.5} />
          </mesh>
          {/* East and West hanging vines */}
          <mesh position={[12.7, -0.85 - (fidx % 3) * 0.12, fx]} castShadow>
            <sphereGeometry args={[0.32 + (fidx % 2) * 0.14, 10, 10]} />
            <meshStandardMaterial color={fidx % 2 === 0 ? '#4da843' : '#388e3c'} roughness={0.7} />
          </mesh>
          <mesh position={[-12.7, -0.85 - ((fidx + 2) % 3) * 0.12, fx]} castShadow>
            <sphereGeometry args={[0.32 + (fidx % 2) * 0.14, 10, 10]} />
            <meshStandardMaterial color={fidx % 2 === 0 ? '#4da843' : '#388e3c'} roughness={0.7} />
          </mesh>
        </React.Fragment>
      ))}

      {/* ============================================================== */}
      {/* 2. SATIN WALNUT CHASSIS WITH BRUSHED GOLD INLAY               */}
      {/* ============================================================== */}
      <mesh position={[0, -0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[24.9, 0.42, 24.9]} />
        <meshPhysicalMaterial
          map={walnutGrain}
          metalness={0}
          roughness={0.54}
          clearcoat={0.18}
          clearcoatRoughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[24.5, 0.14, 24.5]} />
        <meshPhysicalMaterial
          color={GOLD_ACCENT}
          metalness={0.72}
          roughness={0.34}
          clearcoat={0.15}
        />
      </mesh>
      {/* Inner board tray reveal */}
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[22.6, 0.05, 22.6]} />
        <meshStandardMaterial color="#faecd9" roughness={0.6} />
      </mesh>

      {/* ============================================================== */}
      {/* 2B. PERIMETER FAIRY LIGHTS ON GOLDEN RAIL                      */}
      {/* (Evenly spaced glowing golden bulbs around the board rail)     */}
      {/* ============================================================== */}
      {useMemo(() => {
        const lights: Array<[number, number, number]> = [];
        const count = 7;
        const span = 23.6;
        const step = span / (count - 1);
        for (let i = 0; i < count; i++) {
          const coord = -span / 2 + i * step;
          // North edge
          lights.push([coord, 0.23, -12.18]);
          // South edge
          lights.push([coord, 0.23, 12.18]);
          // West edge (skip corners already added)
          if (i > 0 && i < count - 1) lights.push([-12.18, 0.23, coord]);
          // East edge (skip corners already added)
          if (i > 0 && i < count - 1) lights.push([12.18, 0.23, coord]);
        }
        return lights;
      }, []).map((lPos, lIdx) => (
        <group key={`fairy-light-${lIdx}`} position={lPos}>
          {/* Miniature Golden Brass Socket Post */}
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 0.1, 10]} />
            <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.15} />
          </mesh>
          {/* Glowing Warm Amber/Golden Bulb */}
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial
              color="#fffbeb"
              emissive="#f59e0b"
              emissiveIntensity={2.4}
              roughness={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Golden Corner Street Lanterns */}
      {[
        [-12.05, 0.28, 12.05],
        [12.05, 0.28, 12.05],
        [-12.05, 0.28, -12.05],
        [12.05, 0.28, -12.05],
      ].map((lPos, lIdx) => (
        <group key={`corner-lantern-${lIdx}`} position={lPos as any}>
          {/* Golden Lamp Post */}
          <mesh position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.08, 1.3, 12]} />
            <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.92} roughness={0.15} clearcoat={1} />
          </mesh>
          {/* Lantern Cap */}
          <mesh position={[0, 1.38, 0]} castShadow>
            <coneGeometry args={[0.16, 0.22, 6]} />
            <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.92} roughness={0.15} />
          </mesh>
          {/* Glowing Warm Core */}
          <mesh position={[0, 1.25, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={1.8} />
          </mesh>
        </group>
      ))}

      {/* ============================================================== */}
      {/* 3. BATCHED INSTANCED TILE BASES & TOPS                         */}
      {/* ============================================================== */}
      <instancedMesh ref={cornerBase} args={[cornerBaseGeometry, baseMaterial, cornerSpaces.length]} />
      <instancedMesh ref={edgeBase} args={[edgeBaseGeometry, baseMaterial, edgeSpaces.length]} />
      <instancedMesh
        name="corner-tile-top"
        ref={cornerTop}
        args={[cornerTopGeometry, topMaterial, cornerSpaces.length]}
        onClick={(event) => handleTileClick(event, cornerSpaces)}
        onPointerOver={(event) => handleTileOver(event, cornerSpaces)}
        onPointerOut={handleTileOut}
      />
      <instancedMesh
        name="edge-tile-top"
        ref={edgeTop}
        args={[edgeTopGeometry, topMaterial, edgeSpaces.length]}
        onClick={(event) => handleTileClick(event, edgeSpaces)}
        onPointerOver={(event) => handleTileOver(event, edgeSpaces)}
        onPointerOut={handleTileOut}
      />

      {/* ============================================================== */}
      {/* 4. PERIMETER SPACES & ILLUSTRATIONS                            */}
      {/* ============================================================== */}
      {BOARD_SPACES.map((space) => {
        const transform = getSpaceTransform(space.id);
        const property = properties[space.id];
        const owner = property && property.ownerId !== null
          ? players.find((player) => player.id === property.ownerId)
          : null;
        const isHovered = hoveredId === space.id || hoveredSpaceId === space.id;
        const isSelected = selectedSpaceId === space.id;
        const baseY = isHovered ? 0.38 : isSelected ? 0.34 : 0.26;

        // Keep label legible facing the outer edge
        const flipLabel = (space.id >= 20 && space.id <= 29) || space.id >= 30;
        const labelRotation: [number, number, number] = [-Math.PI / 2, 0, flipLabel ? Math.PI : 0];

        return (
          <group
            key={space.id}
            position={[transform.position[0], baseY, transform.position[2]]}
            rotation={[0, transform.rotationY, 0]}
          >
            {/* Special Space Corner/Action Graphics */}
            {transform.isCorner && (
              <SpecialSpaceGraphic spaceId={space.id} labelRotation={labelRotation} />
            )}

            {/* Property Color Strip Banner with gold trim */}
            {space.type === 'property' && (
              <group position={[0, 0.055, -transform.depth / 2 + 0.34]}>
                <mesh castShadow>
                  <boxGeometry args={[transform.width - 0.12, 0.05, 0.62]} />
                  <meshStandardMaterial
                    color={space.colorHex}
                    roughness={0.58}
                    metalness={0}
                  />
                </mesh>
                {/* Gold trim divider line */}
                <mesh position={[0, 0.026, 0.32]}>
                  <boxGeometry args={[transform.width - 0.12, 0.015, 0.03]} />
                  <meshStandardMaterial color={GOLD_ACCENT} metalness={0.8} />
                </mesh>
              </group>
            )}

            {/* Ownership border ribbon */}
            {owner && (
              <mesh position={[0, 0.075, transform.depth / 2 - 0.14]} castShadow>
                <boxGeometry args={[transform.width - 0.14, 0.08, 0.24]} />
                <meshPhysicalMaterial
                  color={owner.color}
                  emissive={owner.color}
                  emissiveIntensity={0.65}
                  metalness={0.6}
                  roughness={0.2}
                  clearcoat={1}
                />
              </mesh>
            )}

            {/* Selection / Hover Indicator Ring */}
            {(isSelected || isHovered) && (
              <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[transform.width - 0.05, 0.02, transform.depth - 0.05]} />
                <meshStandardMaterial
                  color={isSelected ? '#ffd23f' : '#ffffff'}
                  emissive={isSelected ? '#ffd23f' : '#ffffff'}
                  emissiveIntensity={0.5}
                  transparent
                  opacity={0.65}
                />
              </mesh>
            )}

            {/* Non-corner Space Titles */}
            {!transform.isCorner && (
              <Text
                position={[0, 0.065, space.type === 'property' ? 0.08 : -0.22]}
                rotation={labelRotation}
                fontSize={0.2}
                maxWidth={transform.width - 0.2}
                textAlign="center"
                color="#1e293b"
                anchorX="center"
                anchorY="middle"
                fontWeight="black"
              >
                {space.shortName}
              </Text>
            )}

            {/* Price or Pay amount */}
            {!transform.isCorner && (space.price || space.taxAmount) && (
              <Text
                position={[0, 0.065, transform.depth / 2 - 0.42]}
                rotation={labelRotation}
                fontSize={0.21}
                color="#475569"
                anchorX="center"
                anchorY="middle"
                fontWeight="black"
              >
                {space.price ? `$${space.price}` : `PAY $${space.taxAmount}`}
              </Text>
            )}

            {/* CHANCE Icon Card */}
            {space.type === 'chance' && !transform.isCorner && (
              <group position={[0, 0.08, 0.32]} rotation={labelRotation}>
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.62, 0.03, 0.72]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.018, 0]}>
                  <boxGeometry args={[0.56, 0.01, 0.66]} />
                  <meshStandardMaterial color="#fce7f3" roughness={0.3} />
                </mesh>
                <Text position={[0, 0.03, 0]} fontSize={0.62} color="#ec4899" fontWeight="black" anchorX="center" anchorY="middle">
                  ?
                </Text>
              </group>
            )}

            {/* COMMUNITY CHEST Icon Chest */}
            {space.type === 'chest' && !transform.isCorner && (
              <group position={[0, 0.08, 0.32]} rotation={labelRotation}>
                {/* Blue chest body */}
                <mesh position={[0, 0.1, 0]} castShadow>
                  <boxGeometry args={[0.62, 0.2, 0.44]} />
                  <meshStandardMaterial color="#2563eb" roughness={0.3} />
                </mesh>
                {/* Gold trim bands */}
                <mesh position={[0, 0.21, 0]}>
                  <boxGeometry args={[0.64, 0.04, 0.46]} />
                  <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.92} roughness={0.15} />
                </mesh>
                {/* Clasp */}
                <mesh position={[0, 0.1, 0.23]}>
                  <boxGeometry args={[0.1, 0.08, 0.04]} />
                  <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.1} />
                </mesh>
              </group>
            )}

            {/* RAILROAD Steam Locomotive Icon */}
            {space.type === 'railroad' && !transform.isCorner && (
              <group position={[0, 0.08, 0.32]} rotation={labelRotation}>
                {/* Locomotive Cabin */}
                <mesh position={[-0.15, 0.14, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.24, 0.28]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.4} />
                </mesh>
                {/* Locomotive Cylindrical Boiler */}
                <mesh position={[0.1, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.11, 0.11, 0.32, 16]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.4} />
                </mesh>
                {/* Smokestack Chimney */}
                <mesh position={[0.18, 0.24, 0]} castShadow>
                  <cylinderGeometry args={[0.045, 0.035, 0.16, 12]} />
                  <meshStandardMaterial color="#475569" roughness={0.3} />
                </mesh>
                {/* Golden Headlamp */}
                <mesh position={[0.27, 0.12, 0]}>
                  <sphereGeometry args={[0.045, 8, 8]} />
                  <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={1.2} />
                </mesh>
              </group>
            )}

            {/* TAX Gold Coins Icon */}
            {space.type === 'tax' && !transform.isCorner && (
              <group position={[0, 0.08, 0.28]} rotation={labelRotation}>
                <mesh position={[-0.12, 0.06, 0]} castShadow>
                  <cylinderGeometry args={[0.15, 0.15, 0.12, 16]} />
                  <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.15} clearcoat={1} />
                </mesh>
                <mesh position={[0.12, 0.1, 0.04]} castShadow>
                  <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
                  <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.15} clearcoat={1} />
                </mesh>
                <mesh position={[0, 0.15, -0.06]} castShadow>
                  <cylinderGeometry args={[0.15, 0.15, 0.14, 16]} />
                  <meshPhysicalMaterial color={GOLD_ACCENT} metalness={0.95} roughness={0.15} clearcoat={1} />
                </mesh>
              </group>
            )}

            {/* UTILITIES (Electric / Water) Icon */}
            {space.type === 'utility' && !transform.isCorner && (
              <group position={[0, 0.06, 0.3]} rotation={labelRotation}>
                {space.id === 12 ? ( // Electric Company
                  <mesh position={[0, 0.08, 0]} castShadow>
                    <sphereGeometry args={[0.16, 12, 12]} />
                    <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={0.7} />
                  </mesh>
                ) : ( // Water Works
                  <mesh position={[0, 0.08, 0]} castShadow>
                    <cylinderGeometry args={[0.08, 0.14, 0.2, 8]} />
                    <meshStandardMaterial color="#38bdf8" roughness={0.2} metalness={0.6} />
                  </mesh>
                )}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default Board3D;
