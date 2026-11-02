import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useGameStore } from '../../store/useGameStore';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';

export const Board3D: React.FC = () => {
  const selectSpace = useGameStore((s) => s.selectSpace);
  const setHoveredSpace = useGameStore((s) => s.setHoveredSpace);
  const selectedSpaceId = useGameStore((s) => s.selectedSpaceId);
  const hoveredSpaceId = useGameStore((s) => s.hoveredSpaceId);
  const properties = useGameStore((s) => s.properties);
  const players = useGameStore((s) => s.players);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const cornerSpaces = BOARD_SPACES.filter((space) => getSpaceTransform(space.id).isCorner);
  const edgeSpaces = BOARD_SPACES.filter((space) => !getSpaceTransform(space.id).isCorner);

  const cornerBaseGeometry = useMemo(() => new RoundedBoxGeometry(2.875, 0.12, 2.875, 0.045, 3), []);
  const edgeBaseGeometry = useMemo(() => new RoundedBoxGeometry(1.775, 0.12, 2.875, 0.045, 3), []);
  const cornerTrimGeometry = useMemo(() => new RoundedBoxGeometry(2.855, 0.105, 2.855, 0.04, 3), []);
  const edgeTrimGeometry = useMemo(() => new RoundedBoxGeometry(1.755, 0.105, 2.855, 0.04, 3), []);
  const cornerTopGeometry = useMemo(() => new RoundedBoxGeometry(2.81, 0.09, 2.81, 0.035, 4), []);
  const edgeTopGeometry = useMemo(() => new RoundedBoxGeometry(1.71, 0.09, 2.81, 0.035, 4), []);

  const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c9a9ce', metalness: 0.12, roughness: 0.42,
  }), []);
  const trimMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f0c36e', metalness: 0.84, roughness: 0.22, clearcoat: 1,
  }), []);
  const topMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.27, metalness: 0.06, clearcoat: 0.92, clearcoatRoughness: 0.16,
  }), []);

  const cornerBase = useRef<THREE.InstancedMesh>(null);
  const edgeBase = useRef<THREE.InstancedMesh>(null);
  const cornerTrim = useRef<THREE.InstancedMesh>(null);
  const edgeTrim = useRef<THREE.InstancedMesh>(null);
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
        const baseY = isHovered ? 0.36 : isSelected ? 0.32 : 0.24;
        dummy.position.set(transform.position[0], baseY + yOffset, transform.position[2]);
        dummy.rotation.set(0, transform.rotationY, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(index, dummy.matrix);
        if (withColor) {
          const property = properties[space.id];
          const tint = isHovered
            ? '#fff8e7'
            : property?.isMortgaged
              ? '#cbd5e1'
              : '#fff1e6';
          mesh.current!.setColorAt(index, new THREE.Color(tint));
        }
      });
      mesh.current.instanceMatrix.needsUpdate = true;
      if (withColor && mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    };

    updateBatch(cornerBase, cornerSpaces, -0.055);
    updateBatch(edgeBase, edgeSpaces, -0.055);
    updateBatch(cornerTrim, cornerSpaces, -0.006);
    updateBatch(edgeTrim, edgeSpaces, -0.006);
    updateBatch(cornerTop, cornerSpaces, 0.012, true);
    updateBatch(edgeTop, edgeSpaces, 0.012, true);
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
    <group>
      {/* Floating square plinth: layered toy-board sides with warm candy trim. */}
      <RoundedBox args={[24.8, 0.62, 24.8]} radius={0.5} smoothness={6} position={[0, -1.18, 0]} receiveShadow>
        <meshStandardMaterial color="#8b75bc" roughness={0.62} />
      </RoundedBox>
      <RoundedBox args={[24.25, 0.32, 24.25]} radius={0.42} smoothness={6} position={[0, -0.79, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#e9a27a" metalness={0.22} roughness={0.42} />
      </RoundedBox>
      <RoundedBox args={[23.9, 0.2, 23.9]} radius={0.38} smoothness={6} position={[0, -0.59, 0]} receiveShadow>
        <meshStandardMaterial color="#fff0d5" roughness={0.48} />
      </RoundedBox>
      <RoundedBox args={[23.7, 0.08, 23.7]} radius={0.34} smoothness={6} position={[0, -0.46, 0]}>
        <meshStandardMaterial color="#f5c77c" metalness={0.46} roughness={0.28} />
      </RoundedBox>

      {/* The 40 tile shells are batched into six instanced draws: corner/edge × base/trim/top. */}
      <instancedMesh ref={cornerBase} args={[cornerBaseGeometry, baseMaterial, cornerSpaces.length]}>
        <primitive object={cornerBaseGeometry} attach="geometry" />
        <primitive object={baseMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={edgeBase} args={[edgeBaseGeometry, baseMaterial, edgeSpaces.length]}>
        <primitive object={edgeBaseGeometry} attach="geometry" />
        <primitive object={baseMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={cornerTrim} args={[cornerTrimGeometry, trimMaterial, cornerSpaces.length]}>
        <primitive object={cornerTrimGeometry} attach="geometry" />
        <primitive object={trimMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={edgeTrim} args={[edgeTrimGeometry, trimMaterial, edgeSpaces.length]}>
        <primitive object={edgeTrimGeometry} attach="geometry" />
        <primitive object={trimMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh
        ref={cornerTop}
        args={[cornerTopGeometry, topMaterial, cornerSpaces.length]}
        onClick={(event) => handleTileClick(event, cornerSpaces)}
        onPointerOver={(event) => handleTileOver(event, cornerSpaces)}
        onPointerOut={handleTileOut}
      />
      <instancedMesh
        ref={edgeTop}
        args={[edgeTopGeometry, topMaterial, edgeSpaces.length]}
        onClick={(event) => handleTileClick(event, edgeSpaces)}
        onPointerOver={(event) => handleTileOver(event, edgeSpaces)}
        onPointerOut={handleTileOut}
      />

      {/* Compact card trays sit fully inside the lower blue inset, away from lane markings. */}
      <group position={[7.0, 0.36, 7.1]} rotation={[0, -0.14, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.18, 0.82]} />
          <meshStandardMaterial color="#a84b43" roughness={0.4} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.105, 0]}>
          <boxGeometry args={[1.08, 0.025, 0.72]} />
          <meshStandardMaterial color="#f1e6ce" roughness={0.62} />
        </mesh>
        <Text position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} maxWidth={1.0} textAlign="center" color="#7d302d" anchorX="center" anchorY="middle" fontWeight="bold">
          CHANCE
        </Text>
      </group>

      <group position={[-5.5, 0.36, 7.1]} rotation={[0, 0.14, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.18, 0.82]} />
          <meshStandardMaterial color="#327a8e" roughness={0.4} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.105, 0]}>
          <boxGeometry args={[1.08, 0.025, 0.72]} />
          <meshStandardMaterial color="#f1e6ce" roughness={0.62} />
        </mesh>
        <Text position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.105} maxWidth={1.0} textAlign="center" color="#1c596d" anchorX="center" anchorY="middle" fontWeight="bold">
          COMMUNITY CHEST
        </Text>
      </group>

      {/* Layered board chassis with a polished brass reveal */}
      <mesh position={[0, 0.005, 0]} receiveShadow castShadow>
        <boxGeometry args={[22.8, 0.42, 22.8]} />
        <meshStandardMaterial color="#e6a36a" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.075, 0]} receiveShadow castShadow>
        <boxGeometry args={[22.62, 0.28, 22.62]} />
        <meshStandardMaterial color="#796ac0" metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.218, 0]} receiveShadow>
        <boxGeometry args={[22.48, 0.035, 22.48]} />
        <meshStandardMaterial color="#ffe0b8" roughness={0.68} />
      </mesh>

      {/* Render all 40 interactive perimeter spaces */}
      {BOARD_SPACES.map((space) => {
        const transform = getSpaceTransform(space.id);
        const property = properties[space.id];
        const owner = property && property.ownerId !== null
          ? players.find((player) => player.id === property.ownerId)
          : null;
        const isHovered = hoveredId === space.id || hoveredSpaceId === space.id;
        const isSelected = selectedSpaceId === space.id;
        const isHighlighted = isHovered || isSelected;
        // Keep the text baseline aligned with the edge while correcting the far/bottom-facing sides.
        const flipLabel = (space.id >= 20 && space.id <= 29) || space.id >= 30;
        const labelRotation: [number, number, number] = [-Math.PI / 2, 0, flipLabel ? Math.PI : 0];
        const labelText = space.id === 20
          ? 'FREE PARKING'
          : space.id === 30
            ? 'GO TO JAIL'
            : space.shortName;

        return (
          <group
            key={space.id}
            position={[transform.position[0], isHovered ? 0.36 : isSelected ? 0.32 : 0.24, transform.position[2]]}
            rotation={[0, transform.rotationY, 0]}
          >
            {/* Inner property color strip */}
            {space.type === 'property' && (
              <mesh position={[0, 0.054, -transform.depth / 2 + 0.34]}>
                <boxGeometry args={[transform.width - 0.1, 0.045, 0.62]} />
                <meshPhysicalMaterial
                  color={space.colorHex}
                  roughness={0.24}
                  metalness={0.28}
                  clearcoat={1}
                  clearcoatRoughness={0.12}
                  emissive={space.colorHex}
                  emissiveIntensity={0.08}
                />
              </mesh>
            )}

            {/* Owner marker on the outer edge */}
            {owner && (
              <>
                <mesh position={[0, 0.075, transform.depth / 2 - 0.13]}>
                  <boxGeometry args={[transform.width - 0.13, 0.075, 0.22]} />
                  <meshPhysicalMaterial color={owner.color} emissive={owner.color} emissiveIntensity={0.82} metalness={0.58} roughness={0.18} clearcoat={1} />
                </mesh>
                <group position={[0, 0.055, 0]}>
                  <mesh position={[0, 0, -transform.depth / 2 + 0.045]}>
                    <boxGeometry args={[transform.width - 0.12, 0.035, 0.045]} />
                    <meshStandardMaterial color={owner.color} emissive={owner.color} emissiveIntensity={0.55} />
                  </mesh>
                  <mesh position={[0, 0, transform.depth / 2 - 0.045]}>
                    <boxGeometry args={[transform.width - 0.12, 0.035, 0.045]} />
                    <meshStandardMaterial color={owner.color} emissive={owner.color} emissiveIntensity={0.55} />
                  </mesh>
                  <mesh position={[-transform.width / 2 + 0.045, 0, 0]}>
                    <boxGeometry args={[0.045, 0.035, transform.depth - 0.12]} />
                    <meshStandardMaterial color={owner.color} emissive={owner.color} emissiveIntensity={0.55} />
                  </mesh>
                  <mesh position={[transform.width / 2 - 0.045, 0, 0]}>
                    <boxGeometry args={[0.045, 0.035, transform.depth - 0.12]} />
                    <meshStandardMaterial color={owner.color} emissive={owner.color} emissiveIntensity={0.55} />
                  </mesh>
                </group>
              </>
            )}

            {/* Space label */}
            <Text
              position={[0, 0.064, space.type === 'property' ? 0.08 : -0.15]}
              rotation={labelRotation}
              fontSize={transform.isCorner ? 0.33 : 0.19}
              maxWidth={transform.width - 0.18}
              textAlign="center"
              color="#4b3b64"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              outlineWidth={0.003}
              outlineColor="#f7f1e4"
            >
              {labelText}
            </Text>

            {/* Purchase price or tax */}
            {(space.price || space.taxAmount) && (
              <Text
                position={[0, 0.065, transform.depth / 2 - 0.42]}
                rotation={labelRotation}
                fontSize={0.20}
                color="#56446b"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {space.price ? `$${space.price}` : `PAY $${space.taxAmount}`}
              </Text>
            )}

            {space.type === 'chance' && (
              <Text
                position={[0, 0.065, 0.35]}
                rotation={labelRotation}
                fontSize={0.75}
                color={space.colorHex}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                ?
              </Text>
            )}
            {space.type === 'railroad' && (
              <Text
                position={[0, 0.065, 0.32]}
                rotation={labelRotation}
                fontSize={0.42}
                color="#25364c"
                anchorX="center"
                anchorY="middle"
              >
                🚂
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default Board3D;
