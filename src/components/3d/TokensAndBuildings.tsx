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
  const enamel = { metalness: 0.62, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 };
  const gold = '#e9c36d';

  switch (token) {
    case 'top_hat':
      return (
        <group>
          <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.39, 0.39, 0.09, 40]} />
            <meshPhysicalMaterial color={gold} metalness={0.88} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.115, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.035, 40]} />
            <meshStandardMaterial color="#101827" metalness={0.52} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.31, 0]} castShadow>
            <cylinderGeometry args={[0.225, 0.25, 0.38, 40]} />
            <meshPhysicalMaterial color="#101827" {...enamel} />
          </mesh>
          <mesh position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.253, 0.253, 0.075, 40]} />
            <meshPhysicalMaterial color={color} metalness={0.72} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.505, 0]}>
            <cylinderGeometry args={[0.225, 0.225, 0.045, 40]} />
            <meshStandardMaterial color={gold} metalness={0.9} roughness={0.18} />
          </mesh>
        </group>
      );

    case 'racecar':
      return (
        <group>
          <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.39, 0.15, 0.68]} />
            <meshPhysicalMaterial color={color} {...enamel} />
          </mesh>
          <mesh position={[0, 0.255, -0.055]} castShadow>
            <boxGeometry args={[0.29, 0.16, 0.31]} />
            <meshPhysicalMaterial color="#a9d8ef" metalness={0.42} roughness={0.12} clearcoat={1} transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 0.17, 0.31]}>
            <boxGeometry args={[0.25, 0.055, 0.08]} />
            <meshStandardMaterial color={gold} metalness={0.8} roughness={0.2} />
          </mesh>
          {[-1, 1].map((side) => [-1, 1].map((axle) => (
            <group key={side + ':' + axle} position={[side * 0.21, 0.105, axle * 0.21]} rotation={[0, 0, Math.PI / 2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.105, 0.105, 0.09, 18]} />
                <meshStandardMaterial color="#101722" roughness={0.72} />
              </mesh>
              <mesh position={[0, 0, 0.047]}>
                <cylinderGeometry args={[0.047, 0.047, 0.012, 16]} />
                <meshStandardMaterial color={gold} metalness={0.9} roughness={0.18} />
              </mesh>
            </group>
          )))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.115, 0.18, 0.355]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color="#fff0b4" emissive="#ffc75b" emissiveIntensity={0.8} />
            </mesh>
          ))}
          <mesh position={[0, 0.225, -0.31]} castShadow>
            <boxGeometry args={[0.31, 0.045, 0.07]} />
            <meshStandardMaterial color={gold} metalness={0.82} roughness={0.2} />
          </mesh>
        </group>
      );

    case 'scottie_dog':
      return (
        <group>
          <mesh position={[0, 0.205, -0.02]} scale={[0.19, 0.18, 0.32]} castShadow>
            <sphereGeometry args={[1, 24, 18]} />
            <meshPhysicalMaterial color={color} {...enamel} />
          </mesh>
          <mesh position={[0, 0.34, 0.2]} scale={[0.17, 0.16, 0.18]} castShadow>
            <sphereGeometry args={[1, 24, 18]} />
            <meshPhysicalMaterial color={color} {...enamel} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.105, 0.43, 0.15]} rotation={[0, 0, side * -0.28]} castShadow>
              <coneGeometry args={[0.075, 0.19, 8]} />
              <meshPhysicalMaterial color={color} {...enamel} />
            </mesh>
          ))}
          <mesh position={[0, 0.32, 0.355]} scale={[0.085, 0.07, 0.085]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#e8d5b8" roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.355, 0.425]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.105, 0.095, 0.04]} castShadow>
              <cylinderGeometry args={[0.055, 0.065, 0.18, 10]} />
              <meshPhysicalMaterial color={color} {...enamel} />
            </mesh>
          ))}
          <mesh position={[0, 0.24, -0.34]} rotation={[Math.PI / 3, 0, 0]}>
            <coneGeometry args={[0.055, 0.2, 8]} />
            <meshPhysicalMaterial color={color} {...enamel} />
          </mesh>
          <mesh position={[0, 0.31, 0.19]}>
            <torusGeometry args={[0.16, 0.025, 8, 24]} />
            <meshStandardMaterial color={gold} metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      );

    case 'yacht':
    default:
      return (
        <group>
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.18, 0.36, 0.72, 10]} />
            <meshPhysicalMaterial color="#172c45" metalness={0.72} roughness={0.18} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.19, -0.07]} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.26]} />
            <meshPhysicalMaterial color={color} {...enamel} />
          </mesh>
          <mesh position={[0, 0.31, -0.07]}>
            <boxGeometry args={[0.15, 0.035, 0.17]} />
            <meshStandardMaterial color="#bde7f7" metalness={0.38} roughness={0.12} />
          </mesh>
          <mesh position={[0, 0.44, -0.04]} castShadow>
            <cylinderGeometry args={[0.018, 0.022, 0.72, 10]} />
            <meshStandardMaterial color={gold} metalness={0.9} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.56, 0.07]} rotation={[0, 0, -0.08]} castShadow>
            <coneGeometry args={[0.25, 0.48, 3]} />
            <meshPhysicalMaterial color="#f3ead2" roughness={0.38} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.43, -0.13]} rotation={[0, Math.PI, 0]} castShadow>
            <coneGeometry args={[0.16, 0.32, 3]} />
            <meshPhysicalMaterial color={color} roughness={0.28} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[0.44, 0.025, 0.8]} />
            <meshStandardMaterial color={gold} metalness={0.82} roughness={0.2} />
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
      const jumpWave = jumpProgress > 0 ? Math.sin(jumpProgress * Math.PI) : 0;
      const jumpHeight = jumpWave * 0.62;
      const targetY = 0.22 + jumpHeight + (isCurrent ? Math.abs(Math.sin(t * 4.5)) * 0.075 : 0);
      const targetRotation = Math.sin(t * 0.8 + idx) * 0.025 + jumpWave * 0.42;
      const baseScale = tf.isCorner ? 1.2 : 1.06;
      const landingPulse = 1 + jumpWave * 0.13;

      group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 11, delta);
      group.position.z = THREE.MathUtils.damp(group.position.z, targetZ, 11, delta);
      group.position.y = THREE.MathUtils.damp(group.position.y, targetY, 17, delta);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotation, 13, delta);
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, jumpWave * 0.08, 13, delta);
      group.scale.setScalar(baseScale * landingPulse);
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
                  <boxGeometry args={[0.58, 0.38, 0.42]} />
                  <meshPhysicalMaterial color="#a92337" metalness={0.35} roughness={0.24} clearcoat={0.9} />
                </mesh>
                <mesh position={[0, 0.22, 0.214]}>
                  <boxGeometry args={[0.18, 0.23, 0.025]} />
                  <meshStandardMaterial color="#f1d89b" emissive="#c28b45" emissiveIntensity={0.22} />
                </mesh>
                <mesh position={[0, 0.2, 0.235]}>
                  <boxGeometry args={[0.065, 0.19, 0.012]} />
                  <meshStandardMaterial color="#5c2432" roughness={0.35} />
                </mesh>
                {[-1, 1].map((side) => (
                  <mesh key={side} position={[side * 0.19, 0.2, 0.218]}>
                    <boxGeometry args={[0.09, 0.12, 0.018]} />
                    <meshStandardMaterial color="#bce8f5" emissive="#7fc9e8" emissiveIntensity={0.55} />
                  </mesh>
                ))}
                <mesh position={[0, 0.405, 0]}>
                  <boxGeometry args={[0.64, 0.045, 0.48]} />
                  <meshStandardMaterial color="#e9c36d" metalness={0.86} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.49, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <coneGeometry args={[0.42, 0.2, 4]} />
                  <meshPhysicalMaterial color="#5b1c2a" metalness={0.32} roughness={0.28} />
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
                      <boxGeometry args={[0.28, 0.25, 0.28]} />
                      <meshPhysicalMaterial color="#e9dfc6" roughness={0.3} metalness={0.08} clearcoat={0.7} />
                    </mesh>
                    <mesh position={[0, 0.035, 0.145]}>
                      <boxGeometry args={[0.065, 0.15, 0.018]} />
                      <meshStandardMaterial color="#64452f" roughness={0.48} />
                    </mesh>
                    {[-1, 1].map((side) => (
                      <mesh key={side} position={[side * 0.085, 0.055, 0.15]}>
                        <boxGeometry args={[0.055, 0.07, 0.018]} />
                        <meshStandardMaterial color="#9bd7ea" emissive="#5ab5dd" emissiveIntensity={0.45} />
                      </mesh>
                    ))}
                    <mesh position={[0, 0.19, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                      <coneGeometry args={[0.23, 0.2, 4]} />
                      <meshPhysicalMaterial color="#176b4a" metalness={0.28} roughness={0.3} clearcoat={0.75} />
                    </mesh>
                    <mesh position={[0, 0.085, 0.16]}>
                      <boxGeometry args={[0.31, 0.035, 0.025]} />
                      <meshStandardMaterial color="#e9c36d" metalness={0.75} roughness={0.24} />
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
