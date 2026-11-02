import React, { useState } from 'react';
import { Text } from '@react-three/drei';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useGameStore } from '../../store/useGameStore';

export const Board3D: React.FC = () => {
  const selectSpace = useGameStore((s) => s.selectSpace);
  const properties = useGameStore((s) => s.properties);
  const players = useGameStore((s) => s.players);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <group>
      {/* Dark walnut presentation table */}
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <cylinderGeometry args={[21.5, 21.5, 0.7, 96]} />
        <meshStandardMaterial color="#352536" roughness={0.36} metalness={0.14} />
      </mesh>
      <mesh position={[0, -0.86, 0]} receiveShadow>
        <cylinderGeometry args={[20.9, 20.4, 0.5, 96]} />
        <meshStandardMaterial color="#1c1723" roughness={0.48} />
      </mesh>
      <mesh position={[0, -1.12, 0]} receiveShadow>
        <cylinderGeometry args={[19.8, 19.8, 0.045, 96]} />
        <meshStandardMaterial color="#0c1322" roughness={0.86} />
      </mesh>
      <mesh position={[0, -0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[20.45, 0.045, 8, 128]} />
        <meshStandardMaterial color="#9a713b" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[19.95, 0.018, 6, 128]} />
        <meshStandardMaterial color="#bf9855" metalness={0.82} roughness={0.2} />
      </mesh>

      {/* Chance and Community Chest decks sit on the upper corners of the board inset. */}
      <group position={[-8.55, 0.31, -6.75]} rotation={[0, 0.18, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.55, 0.22, 1.12]} />
          <meshStandardMaterial color="#a84b43" roughness={0.42} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.125, 0]}>
          <boxGeometry args={[1.43, 0.035, 1.0]} />
          <meshStandardMaterial color="#f1e6ce" roughness={0.62} />
        </mesh>
        <Text position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.19} maxWidth={1.3} textAlign="center" color="#7d302d" anchorX="center" anchorY="middle" fontWeight="bold">
          CHANCE
        </Text>
      </group>

      <group position={[8.55, 0.31, -6.75]} rotation={[0, -0.18, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.55, 0.22, 1.12]} />
          <meshStandardMaterial color="#327a8e" roughness={0.42} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.125, 0]}>
          <boxGeometry args={[1.43, 0.035, 1.0]} />
          <meshStandardMaterial color="#f1e6ce" roughness={0.62} />
        </mesh>
        <Text position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} maxWidth={1.3} textAlign="center" color="#1c596d" anchorX="center" anchorY="middle" fontWeight="bold">
          COMMUNITY
          {'\n'}
          CHEST
        </Text>
      </group>

      {/* Layered board chassis with a polished brass reveal */}
      <mesh position={[0, 0.005, 0]} receiveShadow castShadow>
        <boxGeometry args={[22.8, 0.42, 22.8]} />
        <meshStandardMaterial color="#b58a47" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.075, 0]} receiveShadow castShadow>
        <boxGeometry args={[22.62, 0.28, 22.62]} />
        <meshStandardMaterial color="#142238" metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.218, 0]} receiveShadow>
        <boxGeometry args={[22.48, 0.035, 22.48]} />
        <meshStandardMaterial color="#d6c49d" roughness={0.68} />
      </mesh>

      {/* Render all 40 interactive perimeter spaces */}
      {BOARD_SPACES.map((space) => {
        const transform = getSpaceTransform(space.id);
        const property = properties[space.id];
        const owner = property && property.ownerId !== null
          ? players.find((player) => player.id === property.ownerId)
          : null;
        const isHovered = hoveredId === space.id;
        // Keep the text baseline aligned with the edge while correcting the far/bottom-facing sides.
        const flipLabel = (space.id >= 20 && space.id <= 29) || space.id >= 30;
        const labelRotation: [number, number, number] = [-Math.PI / 2, 0, flipLabel ? Math.PI : 0];
        const labelText = space.id === 20
          ? 'FREE\\nPARKING'
          : space.id === 30
            ? 'GO TO\\nJAIL'
            : space.shortName;

        return (
          <group
            key={space.id}
            position={[transform.position[0], 0.24, transform.position[2]]}
            rotation={[0, transform.rotationY, 0]}
          >
            {/* Dark bevel below each tile */}
            <mesh position={[0, -0.055, 0]} castShadow>
              <boxGeometry args={[transform.width - 0.025, 0.12, transform.depth - 0.025]} />
              <meshStandardMaterial color="#253249" metalness={0.35} roughness={0.32} />
            </mesh>

            {/* Porcelain tile surface */}
            <mesh
              receiveShadow
              onClick={(event) => {
                event.stopPropagation();
                selectSpace(space.id);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setHoveredId(space.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = 'auto';
              }}
            >
              <boxGeometry args={[transform.width - 0.07, 0.09, transform.depth - 0.07]} />
              <meshPhysicalMaterial
                color={isHovered ? '#f8e8bd' : property?.isMortgaged ? '#aab2bd' : '#e9e3d5'}
                roughness={0.48}
                metalness={0.04}
                clearcoat={0.48}
              />
            </mesh>

            {/* Inner property color strip */}
            {space.type === 'property' && (
              <mesh position={[0, 0.054, -transform.depth / 2 + 0.34]} castShadow>
                <boxGeometry args={[transform.width - 0.1, 0.045, 0.62]} />
                <meshStandardMaterial color={space.colorHex} roughness={0.36} metalness={0.12} />
              </mesh>
            )}

            {/* Owner marker on the outer edge */}
            {owner && (
              <mesh position={[0, 0.06, transform.depth / 2 - 0.14]}>
                <boxGeometry args={[transform.width - 0.13, 0.045, 0.2]} />
                <meshStandardMaterial
                  color={owner.color}
                  emissive={owner.color}
                  emissiveIntensity={0.25}
                />
              </mesh>
            )}

            {/* Space label */}
            <Text
              position={[0, 0.064, space.type === 'property' ? 0.08 : -0.15]}
              rotation={labelRotation}
              fontSize={transform.isCorner ? 0.30 : 0.165}
              maxWidth={transform.width - 0.18}
              textAlign="center"
              color="#17263a"
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
                fontSize={0.18}
                color="#27364b"
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
