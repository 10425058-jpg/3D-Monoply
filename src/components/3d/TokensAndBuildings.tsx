import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { TokenType } from '../../types/game';

const TokenMesh: React.FC<{ token: TokenType; color: string }> = ({ token, color }) => {
  switch (token) {
    case 'top_hat':
      return (
        <group>
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.08, 24]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.28, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.22, 0.42, 24]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.08, 24]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case 'racecar':
      return (
        <group>
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.36, 0.16, 0.62]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.26, -0.05]} castShadow>
            <boxGeometry args={[0.28, 0.14, 0.28]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      );
    case 'scottie_dog':
      return (
        <group>
          <mesh position={[0, 0.18, 0]} castShadow>
            <boxGeometry args={[0.24, 0.24, 0.45]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.34, 0.16]} castShadow>
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
          </mesh>
        </group>
      );
    case 'yacht':
    default:
      return (
        <group>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.32, 0.16, 0.56]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.34, 0]} castShadow>
            <coneGeometry args={[0.22, 0.38, 4]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
      );
  }
};

export const TokensAndBuildings: React.FC = () => {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const properties = useGameStore((s) => s.properties);

  const tokenRefs = useRef<Record<number, THREE.Group | null>>({});

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    players.forEach((player, idx) => {
      const group = tokenRefs.current[player.id];
      if (!group) return;

      const tf = getSpaceTransform(player.position);
      // Offset each player slightly so multiple tokens on the same space never overlap
      const angle = (idx * Math.PI) / 2 + Math.PI / 4;
      const offsetRadius = 0.38;
      const targetX = tf.position[0] + Math.cos(angle) * offsetRadius;
      const targetZ = tf.position[2] + Math.sin(angle) * offsetRadius;
      const isCurrent = idx === currentPlayerIndex;
      const targetY = 0.22 + (isCurrent ? Math.abs(Math.sin(t * 4.5)) * 0.18 : 0);

      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, Math.min(1, delta * 10));
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, Math.min(1, delta * 10));
      group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, Math.min(1, delta * 12));
    });
  });

  return (
    <group>
      {/* Player Tokens */}
      {players.map((player) => {
        if (player.isBankrupt) return null;
        return (
          <group
            key={player.id}
            ref={(el) => {
              tokenRefs.current[player.id] = el;
            }}
            position={[9.5, 0.22, 9.5]}
          >
            <TokenMesh token={player.token} color={player.color} />
            {/* Coloured Player Ring Indicator */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.34, 0.44, 24]} />
              <meshBasicMaterial color={player.color} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}

      {/* 3D Green Houses & Red Hotels on Color Strips */}
      {BOARD_SPACES.map((space) => {
        const prop = properties[space.id];
        if (!prop || prop.houses <= 0) return null;
        const tf = getSpaceTransform(space.id);

        return (
          <group
            key={`bld-${space.id}`}
            position={[tf.position[0], 0.22, tf.position[2]]}
            rotation={[0, tf.rotationY, 0]}
          >
            {prop.houses === 5 ? (
              /* Red 3D Hotel */
              <group position={[0, 0.18, -tf.depth / 2 + 0.34]}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.58, 0.36, 0.42]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.26, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <coneGeometry args={[0.42, 0.22, 4]} />
                  <meshStandardMaterial color="#991b1b" />
                </mesh>
              </group>
            ) : (
              /* 1 to 4 Green 3D Houses */
              Array.from({ length: prop.houses }).map((_, hIdx) => {
                const spacing = 0.38;
                const startX = -((prop.houses - 1) * spacing) / 2;
                return (
                  <group
                    key={hIdx}
                    position={[startX + hIdx * spacing, 0.13, -tf.depth / 2 + 0.34]}
                  >
                    <mesh castShadow receiveShadow>
                      <boxGeometry args={[0.28, 0.24, 0.28]} />
                      <meshStandardMaterial color="#16a34a" roughness={0.4} />
                    </mesh>
                    <mesh position={[0, 0.18, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                      <coneGeometry args={[0.22, 0.15, 4]} />
                      <meshStandardMaterial color="#15803d" />
                    </mesh>
                  </group>
                );
              })
            )}
          </group>
        );
      })}
    </group>
  );
};
