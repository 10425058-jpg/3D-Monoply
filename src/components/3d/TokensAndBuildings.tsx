import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { TokenType } from '../../types/game';

type FloatingMoneyEvent = {
  id: number;
  text: string;
  position: [number, number, number];
  positive: boolean;
};

const FloatingMoneyLabel: React.FC<{ event: FloatingMoneyEvent }> = ({ event }) => {
  const groupRef = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current;
    group.position.y = event.position[1] + elapsed * 0.78;
    const pop = Math.min(1, elapsed / 0.12);
    group.scale.setScalar(0.72 + pop * 0.28);
  });

  return (
    <group ref={groupRef} position={event.position}>
      <Text
        fontSize={0.43}
        color={event.positive ? '#9df0b4' : '#ff9999'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#102033"
        fontWeight="bold"
        fillOpacity={1}
      >
        {event.text}
      </Text>
    </group>
  );
};

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
            <meshPhysicalMaterial color={color} metalness={0.72} roughness={0.18} clearcoat={0.95} clearcoatRoughness={0.12} />
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
            <meshPhysicalMaterial color={color} metalness={0.62} roughness={0.2} clearcoat={0.9} clearcoatRoughness={0.14} />
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
            <meshPhysicalMaterial color={color} metalness={0.68} roughness={0.16} clearcoat={1} clearcoatRoughness={0.1} />
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
  const gameSpeed = useGameStore((s) => s.gameSpeed);
  const [moneyPopups, setMoneyPopups] = useState<FloatingMoneyEvent[]>([]);
  const previousMoney = useRef<Record<number, number>>({});
  const popupId = useRef(0);
  const previousPositions = useRef<Record<number, number>>({});
  const jumpStartedAt = useRef<Record<number, number>>({});

  const tokenRefs = useRef<Record<number, THREE.Group | null>>({});

  useEffect(() => {
    const previous = previousMoney.current;
    const next: Record<number, number> = {};
    const events: FloatingMoneyEvent[] = [];

    players.forEach((player) => {
      next[player.id] = player.money;
      const prior = previous[player.id];
      if (prior === undefined || prior === player.money) return;
      const delta = player.money - prior;
      const transform = getSpaceTransform(player.position);
      events.push({
        id: ++popupId.current,
        text: `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('en-US')}`,
        position: [transform.position[0], 1.55, transform.position[2]],
        positive: delta > 0,
      });
    });

    previousMoney.current = next;
    if (events.length > 0) {
      setMoneyPopups((current) => [...current, ...events]);
      events.forEach((event) => {
        window.setTimeout(() => {
          setMoneyPopups((current) => current.filter((popup) => popup.id !== event.id));
        }, 1250);
      });
    }
  }, [players]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    players.forEach((player, idx) => {
      const group = tokenRefs.current[player.id];
      if (!group) return;

      const previousPosition = previousPositions.current[player.id];
      if (previousPosition !== undefined && previousPosition !== player.position) {
        jumpStartedAt.current[player.id] = t;
      }
      previousPositions.current[player.id] = player.position;

      const tf = getSpaceTransform(player.position);
      // Offset each player slightly so multiple tokens on the same space never overlap.
      const angle = (idx * Math.PI) / 2 + Math.PI / 4;
      const offsetRadius = 0.38;
      const targetX = tf.position[0] + Math.cos(angle) * offsetRadius;
      const targetZ = tf.position[2] + Math.sin(angle) * offsetRadius;
      const isCurrent = idx === currentPlayerIndex;
      const jumpDuration = 0.2 / gameSpeed;
      const jumpElapsed = t - (jumpStartedAt.current[player.id] ?? -10);
      const jumpProgress = jumpElapsed >= 0 && jumpElapsed < jumpDuration ? jumpElapsed / jumpDuration : 0;
      const jumpHeight = jumpProgress > 0 ? Math.sin(jumpProgress * Math.PI) * 0.48 : 0;
      const targetY = 0.22 + jumpHeight + (isCurrent ? Math.abs(Math.sin(t * 4.5)) * 0.12 : 0);

      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, Math.min(1, delta * 10));
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, Math.min(1, delta * 10));
      group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, Math.min(1, delta * 16));
    });
  });

  return (
    <group>
      {/* Floating money feedback appears above the player's current board location. */}
      {moneyPopups.map((event) => <FloatingMoneyLabel key={event.id} event={event} />)}

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
            scale={getSpaceTransform(player.position).isCorner ? 1.2 : 1.06}
          >
            <TokenMesh token={player.token} color={player.color} />
            {/* Coloured Player Ring Indicator */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.42, 0.54, 32]} />
              <meshStandardMaterial color={player.color} emissive={player.color} emissiveIntensity={0.9} metalness={0.18} roughness={0.25} side={THREE.DoubleSide} />
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
