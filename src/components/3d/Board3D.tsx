import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {BoardTileDetails} from './BoardTileDetails';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useSceneState as useGameStore } from '../../presentation/SceneStore';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { createWalnutGrain } from './boardMaterials';
import { releaseInstanceBuffers } from '../environment/instanceResources';

// Material colors
const GOLD_ACCENT = '#d8b568';
const CLIFF_STONE = '#5c4e78';
const CLIFF_GRASS = '#63885a';
const TILE_IVORY = '#f3ead8';

type DecorationInstance = { position: [number, number, number]; radius?: number; color?: string };
type DecorationBatch = { name: string; geometry: THREE.BufferGeometry; material: THREE.Material; items: DecorationInstance[]; castShadow?: boolean };

/** The original 114 static ornaments share seven primitive/material draws.
 * Keep exact authored tessellation and shadow participation; only the instance
 * matrices and two foliage colors differ within a batch. */
function StaticBoardDecorations() {
  const batches = useMemo(() => {
    const foliage: DecorationInstance[] = [], blossoms: DecorationInstance[] = [];
    [-11.5, -8.5, -5.5, -2.5, 0.5, 3.5, 6.5, 9.5, 11.5].forEach((fx, index) => {
      const radius = 0.32 + (index % 2) * 0.14;
      const color = index % 2 === 0 ? '#4da843' : '#388e3c';
      foliage.push(
        { position: [fx, -0.85 - (index % 3) * 0.12, 12.7], radius, color },
        { position: [fx, -0.85 - ((index + 1) % 3) * 0.12, -12.7], radius, color },
        { position: [12.7, -0.85 - (index % 3) * 0.12, fx], radius, color },
        { position: [-12.7, -0.85 - ((index + 2) % 3) * 0.12, fx], radius, color },
      );
      blossoms.push(
        { position: [fx + 0.12, -0.98 - (index % 3) * 0.12, 12.8] },
        { position: [fx - 0.12, -0.98 - ((index + 1) % 3) * 0.12, -12.8] },
      );
    });
    const rail: [number, number][] = [];
    for (let index = 0; index < 7; index++) {
      const coord = -23.6 / 2 + index * (23.6 / 6);
      rail.push([coord, -12.18], [coord, 12.18]);
      if (index > 0 && index < 6) rail.push([-12.18, coord], [12.18, coord]);
    }
    const corners = [[-12.05, 12.05], [12.05, 12.05], [-12.05, -12.05], [12.05, -12.05]];
    const atHeight = (positions: number[][], height: number): DecorationInstance[] => positions.map(([x, z]) => ({ position: [x, height, z] }));
    return [
      { name: 'board-hanging-foliage', geometry: new THREE.SphereGeometry(1, 10, 10), material: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), items: foliage, castShadow: true },
      { name: 'board-hanging-blossoms', geometry: new THREE.SphereGeometry(0.15, 8, 8), material: new THREE.MeshStandardMaterial({ color: '#ff9bb2', roughness: 0.5 }), items: blossoms },
      { name: 'board-rail-sockets', geometry: new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10), material: new THREE.MeshPhysicalMaterial({ color: GOLD_ACCENT, metalness: 0.95, roughness: 0.15 }), items: atHeight(rail, 0.23 + 0.04), castShadow: true },
      { name: 'board-rail-bulbs', geometry: new THREE.SphereGeometry(0.08, 12, 10), material: new THREE.MeshStandardMaterial({ color: '#fffbeb', emissive: '#f59e0b', emissiveIntensity: 2.4, roughness: 0.1 }), items: atHeight(rail, 0.23 + 0.14) },
      { name: 'board-corner-lantern-posts', geometry: new THREE.CylinderGeometry(0.045, 0.08, 1.3, 12), material: new THREE.MeshPhysicalMaterial({ color: GOLD_ACCENT, metalness: 0.92, roughness: 0.15, clearcoat: 1 }), items: atHeight(corners, 0.28 + 0.65), castShadow: true },
      { name: 'board-corner-lantern-caps', geometry: new THREE.ConeGeometry(0.16, 0.22, 6), material: new THREE.MeshPhysicalMaterial({ color: GOLD_ACCENT, metalness: 0.92, roughness: 0.15 }), items: atHeight(corners, 0.28 + 1.38), castShadow: true },
      { name: 'board-corner-lantern-cores', geometry: new THREE.SphereGeometry(0.09, 8, 8), material: new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#f59e0b', emissiveIntensity: 1.8 }), items: atHeight(corners, 0.28 + 1.25) },
    ] satisfies DecorationBatch[];
  }, []);
  useEffect(() => () => batches.forEach(batch => { batch.geometry.dispose(); batch.material.dispose(); }), [batches]);
  return <group name="board-static-ornaments">{batches.map(batch => <BoardDecorationBatch key={batch.name} batch={batch} />)}</group>;
}

function BoardDecorationBatch({ batch }: { batch: DecorationBatch }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const instance = ref.current;
    if (!instance) return;
    const dummy = new THREE.Object3D();
    batch.items.forEach((item, index) => {
      dummy.position.fromArray(item.position); dummy.scale.setScalar(item.radius ?? 1); dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      if (item.color) instance.setColorAt(index, new THREE.Color(item.color));
    });
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    instance.computeBoundingSphere();
    return () => releaseInstanceBuffers(instance);
  }, [batch]);
  return <instancedMesh ref={ref} name={batch.name} args={[batch.geometry, batch.material, batch.items.length]}
    castShadow={batch.castShadow ?? false} dispose={null} raycast={() => {}} />;
}

const tileTransforms = BOARD_SPACES.map(space => getSpaceTransform(space.id));

export const Board3D: React.FC = () => {
  const selectSpace = useGameStore((s) => s.selectSpace);
  const setHoveredSpace = useGameStore((s) => s.setHoveredSpace);
  const selectedSpaceId = useGameStore((s) => s.selectedSpaceId);
  const hoveredSpaceId = useGameStore((s) => s.hoveredSpaceId);
  const properties = useGameStore((s) => s.properties);
  const walnutGrain = useMemo(createWalnutGrain, []);
  useEffect(() => () => walnutGrain.dispose(), [walnutGrain]);

  const cornerSpaces = useMemo(() => BOARD_SPACES.filter(space => tileTransforms[space.id].isCorner), []);
  const edgeSpaces = useMemo(() => BOARD_SPACES.filter(space => !tileTransforms[space.id].isCorner), []);
  const tileScratch = useMemo(() => ({ dummy: new THREE.Object3D(), color: new THREE.Color() }), []);

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
    const { dummy, color } = tileScratch;
    const updateBatch = (
      mesh: React.RefObject<THREE.InstancedMesh>,
      spaces: typeof BOARD_SPACES,
      yOffset: number,
      withColor = false
    ) => {
      if (!mesh.current) return;
      spaces.forEach((space, index) => {
        const transform = tileTransforms[space.id];
        const isHovered = hoveredSpaceId === space.id;
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
          mesh.current!.setColorAt(index, color.set(tint));
        }
      });
      mesh.current.instanceMatrix.needsUpdate = true;
      if (withColor && mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    };

    updateBatch(cornerBase, cornerSpaces, -0.05);
    updateBatch(edgeBase, edgeSpaces, -0.05);
    updateBatch(cornerTop, cornerSpaces, 0.015, true);
    updateBatch(edgeTop, edgeSpaces, 0.015, true);
  }, [cornerSpaces, edgeSpaces, hoveredSpaceId, selectedSpaceId, properties, tileScratch]);

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
      setHoveredSpace(space.id);
      document.body.style.cursor = 'pointer';
    }
  };
  const handleTileOut = () => {
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

      <StaticBoardDecorations />

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
      <BoardTileDetails />
    </group>
  );
};

export default Board3D;
