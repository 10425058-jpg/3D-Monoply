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
      {/* Circular Wooden Garden Table (Matching Reference Image) */}
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <cylinderGeometry args={[21.5, 21.5, 0.7, 64]} />
        <meshStandardMaterial color="#c27849" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.85, 0]}>
        <cylinderGeometry args={[20.8, 19.5, 0.5, 64]} />
        <meshStandardMaterial color="#7c3f1c" roughness={0.7} />
      </mesh>

      {/*Decorative Cash Stacks & Card Decks on the Wooden Table */}
      <group position={[14.2, -0.05, 4.5]} rotation={[0, -0.4, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.25, 3.1]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
      </group>
      <group position={[-13.5, -0.05, -7.2]} rotation={[0, 0.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.14, 1.3]} />
          <meshStandardMaterial color="#86efac" />
        </mesh>
        <mesh position={[0.4, 0.08, 0.8]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.14, 1.3]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>
      <group position={[13.8, -0.05, -5.5]} rotation={[0, -0.35, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.16, 1.3]} />
          <meshStandardMaterial color="#c4b5fd" />
        </mesh>
        <mesh position={[-0.5, 0.09, 0.9]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.16, 1.3]} />
          <meshStandardMaterial color="#fde047" />
        </mesh>
      </group>

      {/* Main Black-Bordered Monopoly Board Base (22.6 x 22.6) */}
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[22.6, 0.24, 22.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} />
      </mesh>

      {/* Render All 40 Perimeter Spaces */}
      {BOARD_SPACES.map((space) => {
        const tf = getSpaceTransform(space.id);
        const propState = properties[space.id];
        const owner =
          propState && propState.ownerId !== null
            ? players.find((p) => p.id === propState.ownerId)
            : null;
        const isHovered = hoveredId === space.id;

        return (
          <group
            key={space.id}
            position={[tf.position[0], 0.17, tf.position[2]]}
            rotation={[0, tf.rotationY, 0]}
          >
            {/* Interactive Mint-Cream Tile Base */}
            <mesh
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                selectSpace(space.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId(space.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredId(null);
                document.body.style.cursor = 'auto';
              }}
            >
              <boxGeometry args={[tf.width - 0.05, 0.08, tf.depth - 0.05]} />
              <meshStandardMaterial
                color={isHovered ? '#fef08a' : propState?.isMortgaged ? '#94a3b8' : '#d9f0d8'}
                roughness={0.65}
              />
            </mesh>

            {/* Property Color Band on Inner Edge */}
            {space.type === 'property' && (
              <mesh position={[0, 0.05, -tf.depth / 2 + 0.34]} receiveShadow>
                <boxGeometry args={[tf.width - 0.08, 0.04, 0.62]} />
                <meshStandardMaterial color={space.colorHex} roughness={0.4} />
              </mesh>
            )}

            {/* Owner Color Ribbon on Outer Edge */}
            {owner && (
              <mesh position={[0, 0.05, tf.depth / 2 - 0.14]}>
                <boxGeometry args={[tf.width - 0.12, 0.05, 0.2]} />
                <meshStandardMaterial color={owner.color} emissive={owner.color} emissiveIntensity={0.35} />
              </mesh>
            )}

            {/* Space Name Label */}
            <Text
              position={[0, 0.06, space.type === 'property' ? 0.08 : -0.15]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={tf.isCorner ? 0.28 : 0.165}
              maxWidth={tf.width - 0.18}
              textAlign="center"
              color="#0f172a"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {space.shortName}
            </Text>

            {/* Space Purchase Price or Tax Label */}
            {(space.price || space.taxAmount) && (
              <Text
                position={[0, 0.06, tf.depth / 2 - 0.42]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.18}
                color="#1e293b"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {space.price ? `$${space.price}` : `PAY $${space.taxAmount}`}
              </Text>
            )}

            {/* Special Space Accent Icons */}
            {space.type === 'chance' && (
              <Text
                position={[0, 0.06, 0.35]}
                rotation={[-Math.PI / 2, 0, 0]}
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
                position={[0, 0.06, 0.32]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.42}
                color="#0f172a"
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
