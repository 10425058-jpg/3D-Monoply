import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

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

// Standard die opposition: 1-6, 2-5, 3-4.
const DICE_FACES: DiceFace[] = [
  { value: 1, normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  { value: 6, normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  { value: 2, normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  { value: 5, normal: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
  { value: 3, normal: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  { value: 4, normal: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
];

// The dice are positioned over the central lagoon, whose water surface is Y=0.72.
 // Keep the full 0.84-unit die above that surface with a small visual clearance.
const DICE_REST_HEIGHT = 1.2;
const HALF_SIZE = 0.385;
const PIP_SPACING = 0.18;
const PIP_RADIUS = 0.058;
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
  color: '#f6d88f',
  emissive: '#76552a',
  emissiveIntensity: 0.28,
  roughness: 0.28,
  metalness: 0.22,
});

const getTopFaceRotation = (value: number): THREE.Euler => {
  // The unrotated cube has 1 on top. Rotate the matching numbered face upward.
  switch (value) {
    case 2:
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 3:
      return new THREE.Euler(0, 0, Math.PI / 2);
    case 4:
      return new THREE.Euler(0, 0, -Math.PI / 2);
    case 5:
      return new THREE.Euler(Math.PI / 2, 0, 0);
    case 6:
      return new THREE.Euler(Math.PI, 0, 0);
    case 1:
    default:
      return new THREE.Euler(0, 0, 0);
  }
};

const Die: React.FC<{
  value: number;
  rolling: boolean;
  index: number;
  speed: 1 | 2;
}> = ({ value, rolling, index, speed }) => {
  const dieRef = useRef<THREE.Group>(null);
  const pipsRef = useRef<THREE.InstancedMesh>(null);
  const wasRolling = useRef(false);
  const landedAt = useRef<number | null>(null);

  const pipTransforms = useMemo(
    () => PIP_POSITIONS.map((position) => position.clone()),
    []
  );

  const targetQuaternion = useMemo(
    () => new THREE.Quaternion().setFromEuler(getTopFaceRotation(value)),
    [value]
  );

  useLayoutEffect(() => {
    const instancedPips = pipsRef.current;
    if (!instancedPips) return;

    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(PIP_RADIUS, PIP_RADIUS, PIP_RADIUS);
    const rotation = new THREE.Quaternion();

    pipTransforms.forEach((position, pipIndex) => {
      matrix.compose(position, rotation, scale);
      instancedPips.setMatrixAt(pipIndex, matrix);
    });

    instancedPips.instanceMatrix.needsUpdate = true;
    instancedPips.computeBoundingSphere();
  }, [pipTransforms]);

  useFrame(({ clock }, delta) => {
    const die = dieRef.current;
    if (!die) return;

    if (rolling) {
      wasRolling.current = true;
      landedAt.current = null;
      const time = clock.getElapsedTime();
      die.position.y = DICE_REST_HEIGHT + Math.abs(Math.sin(time * 17 * speed + index * 1.7)) * 0.58;
      die.rotation.x += delta * speed * (7.2 + index * 0.8);
      die.rotation.y += delta * speed * (8.6 + index * 0.65);
      die.rotation.z += delta * speed * (6.4 + index * 0.45);
      die.scale.setScalar(1 + Math.abs(Math.sin(time * 13 + index)) * 0.035);
      return;
    }

    if (wasRolling.current) {
      wasRolling.current = false;
      landedAt.current = clock.getElapsedTime();
    }
    if (landedAt.current === null) {
      const rotationError = 1 - Math.abs(die.quaternion.dot(targetQuaternion));
      if (Math.abs(die.position.y - DICE_REST_HEIGHT) < 0.001 && rotationError < 0.0002) return;
    }
    const landingElapsed = landedAt.current === null ? 1 : clock.getElapsedTime() - landedAt.current;
    const bounce = landedAt.current !== null && landingElapsed < 0.62
      ? Math.max(0, Math.sin(landingElapsed * 18) * Math.exp(-landingElapsed * 7.5))
      : 0;
    die.scale.set(1 + bounce * 0.1, 1 - bounce * 0.065, 1 + bounce * 0.1);
    if (landingElapsed >= 0.62) landedAt.current = null;

    die.position.y = THREE.MathUtils.damp(die.position.y, DICE_REST_HEIGHT, 10, delta);
    die.quaternion.slerp(targetQuaternion, 1 - Math.exp(-12 * delta));
  });

  return (
    <group ref={dieRef} position={[index === 0 ? -0.86 : 0.86, DICE_REST_HEIGHT, 0]}>
      {/* Brass reveal frame and deep navy enamel body stay readable on the pale board. */}
      <RoundedBox args={[0.84, 0.84, 0.84]} radius={0.095} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#c49b52" metalness={0.76} roughness={0.24} />
      </RoundedBox>
      <RoundedBox args={[0.77, 0.77, 0.77]} radius={0.075} smoothness={3} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#1b2e4c"
          roughness={0.2}
          metalness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.14}
        />
      </RoundedBox>

      {/* All 21 pips are instanced across the six faces. */}
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

  return (
    <group position={[1.4, 0, 5.2]}>
      <Die value={dice[0]} rolling={rolling} index={0} speed={gameSpeed} />
      <Die value={dice[1]} rolling={rolling} index={1} speed={gameSpeed} />
    </group>
  );
};

export default Dice3D;
