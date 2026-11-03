import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';

type PipPoint = [number, number];

const PIP_LAYOUTS: Record<number, PipPoint[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

type DiceFace = {
  value: number;
  normal: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
};

const DICE_FACES: DiceFace[] = [
  { value: 1, normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  { value: 6, normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  { value: 2, normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  { value: 5, normal: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
  { value: 3, normal: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  { value: 4, normal: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
];

const DICE_REST_HEIGHT = 0.95;
const HALF_SIZE = 0.385;
const PIP_SPACING = 0.18;
const PIP_COUNT = 21;

const PIP_POSITIONS: THREE.Vector3[] = DICE_FACES.flatMap((face) =>
  PIP_LAYOUTS[face.value].map(([x, y]) => {
    const normal = new THREE.Vector3(...face.normal);
    const right = new THREE.Vector3(...face.right);
    const up = new THREE.Vector3(...face.up);

    return normal
      .multiplyScalar(HALF_SIZE + 0.006)
      .addScaledVector(right, x * PIP_SPACING)
      .addScaledVector(up, y * PIP_SPACING);
  })
);

const PIP_GEOMETRY = new THREE.SphereGeometry(1, 10, 10);
const PIP_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#0f172a',
  roughness: 0.2,
  metalness: 0.1,
});

const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

const Die: React.FC<{
  value: number;
  rolling: boolean;
  index: number;
  speed: number;
}> = ({ value, rolling, index, speed }) => {
  const dieRef = useRef<THREE.Group>(null);
  const pipsRef = useRef<THREE.InstancedMesh>(null);
  const wasRolling = useRef(false);
  const landedAt = useRef<number | null>(null);

  const targetQuaternion = useMemo(() => {
    const rot = FACE_ROTATIONS[value] ?? [0, 0, 0];
    const euler = new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ');
    return new THREE.Quaternion().setFromEuler(euler);
  }, [value]);

  useLayoutEffect(() => {
    const pips = pipsRef.current;
    if (!pips) return;

    const dummy = new THREE.Object3D();
    const scale = 0.058;

    PIP_POSITIONS.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      pips.setMatrixAt(i, dummy.matrix);
    });

    pips.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ clock }, delta) => {
    const die = dieRef.current;
    if (!die) return;

    if (rolling) {
      wasRolling.current = true;
      landedAt.current = null;
      const time = clock.getElapsedTime();
      die.position.y = DICE_REST_HEIGHT + Math.abs(Math.sin(time * 18 * speed + index * 1.7)) * 0.75;
      die.rotation.x += delta * speed * (8.5 + index * 0.9);
      die.rotation.y += delta * speed * (9.5 + index * 0.7);
      die.rotation.z += delta * speed * (7.2 + index * 0.5);
      die.scale.setScalar(1 + Math.abs(Math.sin(time * 14 + index)) * 0.05);
      return;
    }

    if (wasRolling.current) {
      wasRolling.current = false;
      landedAt.current = clock.getElapsedTime();
    }

    const landingElapsed = landedAt.current === null ? 999.0 : clock.getElapsedTime() - landedAt.current;

    const bounce = landingElapsed < 0.65
      ? Math.max(0, Math.sin(landingElapsed * 18) * Math.exp(-landingElapsed * 7.5))
      : 0;
    
    const targetScale = landingElapsed < 3.0 ? (1 + bounce * 0.12) : 0;
    die.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-6 * delta));

    die.position.y = THREE.MathUtils.damp(die.position.y, DICE_REST_HEIGHT, 11, delta);
    die.quaternion.slerp(targetQuaternion, 1 - Math.exp(-12 * delta));
  });

  return (
    <group ref={dieRef} position={[index === 0 ? -0.85 : 0.85, DICE_REST_HEIGHT, 0]}>
      <RoundedBox args={[0.82, 0.82, 0.82]} radius={0.11} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.15}
          metalness={0.05}
          clearcoat={0.9}
          clearcoatRoughness={0.12}
        />
      </RoundedBox>

      <instancedMesh
        ref={pipsRef}
        args={[PIP_GEOMETRY, PIP_MATERIAL, PIP_COUNT]}
        castShadow
      />
    </group>
  );
};

export const Dice3D: React.FC = () => {
  const turnPhase = useGameStore((state) => state.turnPhase);
  const dice = useGameStore((state) => state.dice);
  const gameSpeed = useGameStore((state) => state.gameSpeed);
  const rolling = turnPhase === 'ROLLING';

  useEffect(() => {
    if (rolling) {
      sounds.playDiceRoll();
    }
  }, [rolling]);

  return (
    <group position={[0, 0, 4.2]}>
      <Die value={dice[0]} rolling={rolling} index={0} speed={gameSpeed} />
      <Die value={dice[1]} rolling={rolling} index={1} speed={gameSpeed} />
    </group>
  );
};

export default Dice3D;
