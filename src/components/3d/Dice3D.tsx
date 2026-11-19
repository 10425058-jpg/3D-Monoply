import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../presentation/SceneStore';
import { DICE_ROLL_MS, DIE_REST_ROTATIONS, diceResultScale, diceThrow } from '../../presentation/animationMath';
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


const Die: React.FC<{ index: number; reduced: boolean; visible: boolean; impact: boolean }> = ({ index, reduced, visible, impact }) => {
  const store = useSceneStore();
  const die = useRef<THREE.Group>(null);
  const pips = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const contact = useRef<THREE.Mesh>(null);
  const started = useRef(performance.now());
  const landed = useRef<number | null>(null);
  const hadRoll = useRef(store.getState().turnPhase === 'ROLLING');
  const duration = useRef(DICE_ROLL_MS / store.getState().gameSpeed);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rest = useMemo(() => new THREE.Quaternion(), []);
  const face = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    const setFace = (value: number) => rest.setFromEuler(face.set(...DIE_REST_ROTATIONS[value]));
    setFace(store.getState().dice[index]);
    return store.subscribe((next, previous) => {
      if (next.dice[index] !== previous.dice[index]) setFace(next.dice[index]);
      if (isGameReset(previous, next)) {
        hadRoll.current = false;
        landed.current = null;
        for (const object of [die.current, contact.current, halo.current]) if (object) object.visible = false;
        return;
      }
      if (previous.turnPhase !== 'ROLLING' && next.turnPhase === 'ROLLING') {
        started.current = performance.now();
        duration.current = DICE_ROLL_MS / next.gameSpeed;
        landed.current = null;
        hadRoll.current = true;
      } else if (previous.turnPhase === 'ROLLING' && next.turnPhase !== 'ROLLING' && hadRoll.current) {
        landed.current = performance.now();
        die.current?.quaternion.copy(rest);
      }
    });
  }, [face, index, rest, store]);

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
    if (!die.current.visible) {
      if (halo.current) halo.current.visible = false;
      return;
    }
    let height = 0;
    if (rollingNow && !reduced) {
      const pose = diceThrow((now - started.current) / duration.current, index);
      const rotation = DIE_REST_ROTATIONS[actual.dice[index]];
      height = pose.height;
      die.current.rotation.set(rotation[0] + pose.pitch, rotation[1] + pose.yaw, rotation[2] + pose.bank);
      die.current.position.set(pose.x, DICE_REST_HEIGHT + height, pose.z);
    } else {
      die.current.quaternion.copy(rest);
      die.current.position.set(0, DICE_REST_HEIGHT, 0);
    }
    const scale = diceResultScale(rollingNow, age, reduced);
    die.current.scale.setScalar(scale);
    if (contact.current) {
      contact.current.position.x = die.current.position.x;
      contact.current.position.z = die.current.position.z;
      contact.current.scale.setScalar(scale * (1 + height * .45));
      (contact.current.material as THREE.MeshBasicMaterial).opacity = scale * (.22 - height * .14);
    }
    if (halo.current) {
      halo.current.visible = impact && !reduced && age < .32;
      if (halo.current.visible) {
        halo.current.scale.setScalar(.9 + age * 1.4);
        (halo.current.material as THREE.MeshBasicMaterial).opacity = .25 * (1 - age / .32);
      }
    }
  });

  return <group position={[index === 0 ? -0.85 : 0.85, 0, 0]}>
    <mesh ref={contact} visible={false} position={[0, DICE_REST_HEIGHT - .41, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <circleGeometry args={[0.52, 24]} /><meshBasicMaterial color="#24162f" transparent opacity={.22} depthWrite={false} />
    </mesh>
    {impact && <mesh ref={halo} position={[0, DICE_REST_HEIGHT - .405, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => {}}>
      <ringGeometry args={[0.52, 0.55, 32]} /><meshBasicMaterial color="#ffd76a" transparent depthWrite={false} />
    </mesh>}
    <group ref={die} name={`die-${index}`} position={[0, DICE_REST_HEIGHT, 0]} visible={false}>
      <RoundedBox args={[0.82, 0.82, 0.82]} radius={0.11} smoothness={4} castShadow receiveShadow raycast={() => {}}>
        <meshPhysicalMaterial color={index === 0 ? '#fff0dc' : '#225886'} roughness={0.28} metalness={0.04} clearcoat={0.45} />
      </RoundedBox>
      <instancedMesh ref={pips} args={[undefined, undefined, PIP_COUNT]} castShadow raycast={() => {}}>
        <sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={index === 0 ? '#382737' : '#ffe5a6'} roughness={0.44} />
      </instancedMesh>
    </group>
  </group>;
};

export const Dice3D: React.FC<{ quality?: string }> = ({ quality = 'balanced' }) => {
  const { reducedMotion, visible } = useMotionPreferences();
  return <group position={[0, 0, 4.2]} name="authoritative-dice">
    {[0, 1].map(index => <Die key={index} index={index} reduced={reducedMotion} visible={visible} impact={quality !== 'low'} />)}
  </group>;
};

export default Dice3D;
