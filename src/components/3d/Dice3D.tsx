import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore, useSceneState as useGameStore } from '../../presentation/SceneStore';
import { DIE_REST_ROTATIONS } from '../../presentation/animationMath';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import { isGameReset } from '../../presentation/effectEvents';

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};
const DICE_FACES: { value: number; normal: [number, number, number]; right: [number, number, number]; up: [number, number, number] }[] = [
  { value: 1, normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  { value: 6, normal: [0, -1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  { value: 2, normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  { value: 5, normal: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
  { value: 3, normal: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  { value: 4, normal: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
];
const DICE_REST_HEIGHT = 0.95;
const PIP_COUNT = 21;
const PIP_POSITIONS = DICE_FACES.flatMap(face => PIP_LAYOUTS[face.value].map(([x, y]) =>
  new THREE.Vector3(...face.normal).multiplyScalar(0.391)
    .addScaledVector(new THREE.Vector3(...face.right), x * 0.18)
    .addScaledVector(new THREE.Vector3(...face.up), y * 0.18)
));


const Die: React.FC<{
  value: number; rolling: boolean; index: number; speed: number; reduced: boolean; visible: boolean; trails: boolean;
}> = ({ value, rolling, index, speed, reduced, visible, trails }) => {
  const store = useSceneStore();
  const die = useRef<THREE.Group>(null);
  const pips = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const contact = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const started = useRef(performance.now());
  const landed = useRef<number | null>(null);
  const hadRoll = useRef(rolling);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(...DIE_REST_ROTATIONS[value])), [value]);
  const rest = useRef(target.clone());

  useEffect(() => store.subscribe((next, previous) => {
    if (next.dice !== previous.dice) rest.current.setFromEuler(new THREE.Euler(...DIE_REST_ROTATIONS[next.dice[index]]));
    if (isGameReset(previous, next)) {
      hadRoll.current = false; landed.current = null;
      if (die.current) die.current.visible = false;
      return;
    }
    if (previous.turnPhase !== 'ROLLING' && next.turnPhase === 'ROLLING') {
      started.current = performance.now(); landed.current = null; hadRoll.current = true;
    } else if (previous.turnPhase === 'ROLLING' && next.turnPhase !== 'ROLLING' && hadRoll.current) {
      landed.current = performance.now();
      die.current?.quaternion.copy(rest.current);
    }
  }), [index, store]);

  useLayoutEffect(() => {
    PIP_POSITIONS.forEach((point, i) => {
      dummy.position.copy(point); dummy.scale.setScalar(0.058); dummy.updateMatrix();
      pips.current?.setMatrixAt(i, dummy.matrix);
    });
    if (pips.current) pips.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(() => {
    if (!die.current || !visible) return;
    const now = performance.now();
    const actual = store.getState();
    const rollingNow = actual.turnPhase === 'ROLLING';
    const age = landed.current === null ? Infinity : (now - landed.current) / 1000;
    die.current.visible = rollingNow || age < 2.2;
    if (contact.current) contact.current.visible = die.current.visible;
    const t = Math.min(1, (now - started.current) / (650 / speed));
    if (rollingNow && !reduced) {
      const remaining = (1 - t) * (1 - t);
      const rotation = DIE_REST_ROTATIONS[actual.dice[index]];
      die.current.rotation.set(rotation[0] + remaining * Math.PI * 6, rotation[1] + remaining * Math.PI * 4, rotation[2] + remaining * Math.PI * (index ? -4 : 4));
      die.current.position.y = DICE_REST_HEIGHT + Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 0.9;
    } else {
      die.current.quaternion.copy(rest.current);
      die.current.position.y = DICE_REST_HEIGHT + (!reduced && age < 0.3 ? Math.abs(Math.sin(age * 22)) * Math.exp(-age * 12) * 0.16 : 0);
    }
    const scale = reduced ? 1 : age > 1.9 ? Math.max(0, (2.2 - age) / 0.3) : 1;
    die.current.scale.setScalar(scale);
    if (halo.current) {
      halo.current.visible = !reduced && (rollingNow || age < 0.45);
      halo.current.scale.setScalar(rollingNow ? 0.9 : 1 + age * 2);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = rollingNow ? 0.12 : Math.max(0, 0.3 - age * 0.7);
    }
    if (trail.current) {
      trail.current.visible = trails && !reduced && rollingNow && t < 1;
      for (let i = 0; i < 8; i++) {
        const angle = t * Math.PI * 4 - i * 0.35;
        dummy.position.set(Math.cos(angle) * 0.75, die.current.position.y - DICE_REST_HEIGHT + Math.sin(angle) * 0.3, Math.sin(angle) * 0.6);
        dummy.scale.setScalar(0.055 * (1 - i / 9)); dummy.updateMatrix();
        trail.current.setMatrixAt(i, dummy.matrix);
      }
      trail.current.instanceMatrix.needsUpdate = true;
    }
  });

  return <group position={[index === 0 ? -0.85 : 0.85, 0, 0]}>
    <mesh ref={contact} visible={false} position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <circleGeometry args={[0.58, 24]} /><meshBasicMaterial color="#24162f" transparent opacity={0.14} depthWrite={false} />
    </mesh>
    <mesh ref={halo} position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => {}}>
      <ringGeometry args={[0.52, 0.55, 32]} /><meshBasicMaterial color="#ffd76a" transparent depthWrite={false} />
    </mesh>
    <group ref={die} name={`die-${index}`} position={[0, DICE_REST_HEIGHT, 0]} visible={false}>
      <RoundedBox args={[0.82, 0.82, 0.82]} radius={0.11} smoothness={4} castShadow receiveShadow raycast={() => {}}>
        <meshPhysicalMaterial color="#fff0dc" roughness={0.24} metalness={0.04} clearcoat={0.45} />
      </RoundedBox>
      <instancedMesh ref={pips} args={[undefined, undefined, PIP_COUNT]} castShadow raycast={() => {}}>
        <sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#684329" metalness={0.45} roughness={0.38} />
      </instancedMesh>
      {trails && <instancedMesh ref={trail} args={[undefined, undefined, 8]} raycast={() => {}}>
        <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#ffd994" />
      </instancedMesh>}
    </group>
  </group>;
};

export const Dice3D: React.FC<{ quality?: string }> = ({ quality = 'balanced' }) => {
  const phase = useGameStore(s => s.turnPhase);
  const dice = useGameStore(s => s.dice);
  const speed = useGameStore(s => s.gameSpeed);
  const { reducedMotion, visible } = useMotionPreferences();
  return <group position={[0, 0, 4.2]} name="authoritative-dice">
    {dice.map((value, index) => <Die key={index} value={value} index={index} rolling={phase === 'ROLLING'}
      speed={speed} reduced={reducedMotion} visible={visible} trails={quality !== 'low'} />)}
  </group>;
};

export default Dice3D;
