import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import {BoardTileDetails} from './BoardTileDetails';
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

export const Board3D: React.FC = () => {
  const selectSpace = useGameStore((s) => s.selectSpace);
  const setHoveredSpace = useGameStore((s) => s.setHoveredSpace);
  const selectedSpaceId = useGameStore((s) => s.selectedSpaceId);
  const hoveredSpaceId = useGameStore((s) => s.hoveredSpaceId);
  const properties = useGameStore((s) => s.properties);
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
      <BoardTileDetails hoveredId={hoveredId} />
    </group>
  );
};

export default Board3D;
