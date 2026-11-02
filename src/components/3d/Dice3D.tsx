import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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

const HALF_SIZE = 0.36;
const PIP_SPACING = 0.17;
const PIP_RADIUS = 0.052;
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
  color: '#172033',
  roughness: 0.32,
  metalness: 0.08,
});

const getTopFaceRotation = (value: number): THREE.Euler => {
  // The unrotated cube has 1 on top. Rotate the matching numbered face upward.
  switch (value) {
    case 2:
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 3:
      return new THREE.Euler(0, 0, -Math.PI / 2);
    case 4:
      return new THREE.Euler(0, 0, Math.PI / 2);
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
}> = ({ value, rolling, index }) => {
  const dieRef = useRef<THREE.Group>(null);
  const pipsRef = useRef<THREE.InstancedMesh>(null);

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
      const time = clock.getElapsedTime();
      die.position.y = 0.95 + Math.abs(Math.sin(time * 17 + index * 1.7)) * 0.58;
      die.rotation.x += delta * (7.2 + index * 0.8);
      die.rotation.y += delta * (8.6 + index * 0.65);
      die.rotation.z += delta * (6.4 + index * 0.45);
      return;
    }

    die.position.y = THREE.MathUtils.damp(die.position.y, 0.72, 10, delta);
    die.quaternion.slerp(targetQuaternion, 1 - Math.exp(-12 * delta));
  });

  return (
    <group ref={dieRef} position={[index === 0 ? -0.65 : 0.65, 0.72, 0]}>
      {/* Ivory body with a softly polished finish */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshPhysicalMaterial
          color="#f7f3e9"
          roughness={0.24}
          metalness={0.025}
          clearcoat={0.82}
          clearcoatRoughness={0.2}
        />
      </mesh>

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
  const rolling = turnPhase === 'ROLLING';

  return (
    <group position={[1.4, 0, 5.2]}>
      <Die value={dice[0]} rolling={rolling} index={0} />
      <Die value={dice[1]} rolling={rolling} index={1} />
    </group>
  );
};

export default Dice3D;
