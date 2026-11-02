import React, { useState } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useGameStore } from '../../store/useGameStore';

export const Board3D: React.FC = () => {
  const selectSpace = useGameStore((s) => s.selectSpace);
  const setHoveredSpace = useGameStore((s) => s.setHoveredSpace);
  const selectedSpaceId = useGameStore((s) => s.selectedSpaceId);
  const hoveredSpaceId = useGameStore((s) => s.hoveredSpaceId);
  const properties = useGameStore((s) => s.properties);
  const players = useGameStore((s) => s.players);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <group>
      {/* Floating square plinth: layered toy-board sides with warm candy trim. */}
      <mesh position={[0, -1.18, 0]} receiveShadow>
        <RoundedBox args={[24.8, 0.62, 24.8]} radius={0.5} smoothness={6} />
        <meshStandardMaterial color="#8b75bc" roughness={0.62} />
      </mesh>
      <mesh position={[0, -0.79, 0]} receiveShadow castShadow>
        <RoundedBox args={[24.25, 0.32, 24.25]} radius={0.42} smoothness={6} />
        <meshStandardMaterial color="#e9a27a" metalness={0.22} roughness={0.42} />
      </mesh>
      <mesh position={[0, -0.59, 0]} receiveShadow>
        <RoundedBox args={[23.9, 0.2, 23.9]} radius={0.38} smoothness={6} />
        <meshStandardMaterial color="#fff0d5" roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.46, 0]}>
        <RoundedBox args={[23.7, 0.08, 23.7]} radius={0.34} smoothness={6} />
        <meshStandardMaterial color="#f5c77c" metalness={0.46} roughness={0.28} />
      </mesh>

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
            {/* Dark bevel and brass reveal make each space read as a separate crafted tile. */}
            <mesh position={[0, -0.055, 0]} castShadow>
              <RoundedBox args={[transform.width - 0.025, 0.12, transform.depth - 0.025]} radius={0.045} smoothness={3} />
              <meshStandardMaterial color="#c9a9ce" metalness={0.12} roughness={0.42} />
            </mesh>
            <mesh position={[0, -0.006, 0]} castShadow>
              <RoundedBox args={[transform.width - 0.045, 0.105, transform.depth - 0.045]} radius={0.04} smoothness={3} />
              <meshPhysicalMaterial color="#f0c36e" metalness={0.84} roughness={0.22} clearcoat={1} />
            </mesh>

            {/* Glossy porcelain top with a soft bevel and a warm enamel finish. */}
            <mesh
              position={[0, 0.012, 0]}
              castShadow
              receiveShadow
              onClick={(event) => {
                event.stopPropagation();
                selectSpace(space.id);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHoveredId(space.id);
                setHoveredSpace(space.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                setHoveredSpace(null);
                document.body.style.cursor = 'auto';
              }}
            >
              <RoundedBox args={[transform.width - 0.09, 0.09, transform.depth - 0.09]} radius={0.035} smoothness={4} />
              <meshPhysicalMaterial
                color={isHovered ? '#fff8e7' : property?.isMortgaged ? '#cbd5e1' : '#fff1e6'}
                roughness={0.27}
                metalness={0.06}
                clearcoat={0.92}
                clearcoatRoughness={0.16}
              />
            </mesh>

            {isHighlighted && (
              <group position={[0, 0.055, 0]}>
                <mesh position={[0, 0, -transform.depth / 2 + 0.055]}>
                  <boxGeometry args={[transform.width - 0.08, 0.028, 0.055]} />
                  <meshStandardMaterial color="#ffe7ad" emissive="#eab85e" emissiveIntensity={isSelected ? 0.95 : 0.68} />
                </mesh>
                <mesh position={[0, 0, transform.depth / 2 - 0.055]}>
                  <boxGeometry args={[transform.width - 0.08, 0.028, 0.055]} />
                  <meshStandardMaterial color="#ffe7ad" emissive="#eab85e" emissiveIntensity={isSelected ? 0.95 : 0.68} />
                </mesh>
                <mesh position={[-transform.width / 2 + 0.055, 0, 0]}>
                  <boxGeometry args={[0.055, 0.028, transform.depth - 0.08]} />
                  <meshStandardMaterial color="#ffe7ad" emissive="#eab85e" emissiveIntensity={isSelected ? 0.95 : 0.68} />
                </mesh>
                <mesh position={[transform.width / 2 - 0.055, 0, 0]}>
                  <boxGeometry args={[0.055, 0.028, transform.depth - 0.08]} />
                  <meshStandardMaterial color="#ffe7ad" emissive="#eab85e" emissiveIntensity={isSelected ? 0.95 : 0.68} />
                </mesh>
              </group>
            )}

            {/* Inner property color strip */}
            {space.type === 'property' && (
              <mesh position={[0, 0.054, -transform.depth / 2 + 0.34]} castShadow>
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
