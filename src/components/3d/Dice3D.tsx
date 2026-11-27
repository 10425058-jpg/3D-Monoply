import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../presentation/SceneStore';
import { createDicePose, DICE_IMPACTS, DICE_ROLL_MS, DIE_REST_ROTATIONS, diceRestYaw, diceResultScale, diceThrow } from '../../presentation/animationMath';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import { didEndGame, isGameReset } from '../../presentation/effectEvents';
import { sounds } from '../../utils/audio';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { useInvalidateBoardShadow, watchShadowPose } from './BoardShadowLight';

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
const HALF_DIE = .41;
const EDGE_RADIUS = .11;
const ROLL_SURFACE = .54;
const DICE_REST_HEIGHT = ROLL_SURFACE + HALF_DIE;
const PIP_COUNT = 21;
const PIP_POSITIONS = DICE_FACES.flatMap(face => PIP_LAYOUTS[face.value].map(([x, y]) =>
  new THREE.Vector3(...face.normal).multiplyScalar(0.391)
    .addScaledVector(new THREE.Vector3(...face.right), x * 0.18)
    .addScaledVector(new THREE.Vector3(...face.up), y * 0.18)
));
const UP = new THREE.Vector3(0, 1, 0);
const NO_RAYCAST = () => {};
type DiceGeometry = {
  pips: THREE.SphereGeometry;
  contact: THREE.CircleGeometry;
  halo: THREE.RingGeometry;
  dust: THREE.OctahedronGeometry;
  face: THREE.RingGeometry;
};

const Die: React.FC<{ index: number; reduced: boolean; visible: boolean; impact: boolean; geometry: DiceGeometry }> =
  ({ index, reduced, visible, impact, geometry }) => {
  const store = useSceneStore();
  const die = useRef<THREE.Group>(null);
  const pips = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const contact = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const faceMark = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const started = useRef(performance.now());
  const landed = useRef<number | null>(null);
  const hadRoll = useRef(!document.hidden && store.getState().turnPhase === 'ROLLING');
  const duration = useRef(DICE_ROLL_MS / store.getState().gameSpeed);
  const sequence = useRef(0);
  const impactIndex = useRef(0);
  const impactAt = useRef(-Infinity);
  const impactCenter = useMemo(() => new THREE.Vector2(), []);
  const pose = useMemo(createDicePose, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rest = useMemo(() => new THREE.Quaternion(), []);
  const spin = useMemo(() => new THREE.Quaternion(), []);
  const face = useMemo(() => new THREE.Euler(), []);
  const updateShadowPose = useMemo(watchShadowPose, []);
  const invalidateShadow = useInvalidateBoardShadow();

  useEffect(() => {
    const setFace = (value: number) => {
      const yaw = diceRestYaw(sequence.current, index);
      rest.setFromEuler(face.set(...DIE_REST_ROTATIONS[value]));
      rest.premultiply(spin.setFromAxisAngle(UP, yaw));
      if (faceMark.current) faceMark.current.rotation.set(-Math.PI / 2, 0, yaw, 'YXZ');
    };
    const clear = () => {
      hadRoll.current = false;
      landed.current = null;
      impactAt.current = -Infinity;
    };
    const syncVisibility = () => { if (document.hidden) clear(); };
    setFace(store.getState().dice[index]);
    const unsubscribe = store.subscribe((next, previous) => {
      if (isGameReset(previous, next) || didEndGame(previous, next)) {
        clear();
        sequence.current = 0;
        return;
      }
      if (document.hidden) return;
      const begins = previous.turnPhase !== 'ROLLING' && next.turnPhase === 'ROLLING';
      if (begins) {
        sequence.current++;
        started.current = performance.now();
        duration.current = DICE_ROLL_MS / next.gameSpeed;
        landed.current = null;
        hadRoll.current = true;
        impactIndex.current = 0;
        impactAt.current = -Infinity;
      }
      if (begins || next.dice[index] !== previous.dice[index]) setFace(next.dice[index]);
      if (previous.turnPhase === 'ROLLING' && next.turnPhase !== 'ROLLING' && hadRoll.current) {
        landed.current = performance.now();
        die.current?.quaternion.copy(rest);
      }
    });
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [face, index, rest, spin, store]);

  useLayoutEffect(() => {
    PIP_POSITIONS.forEach((point, i) => {
      dummy.position.copy(point); dummy.scale.setScalar(0.058); dummy.updateMatrix();
      pips.current?.setMatrixAt(i, dummy.matrix);
    });
    const mesh = pips.current;
    if (mesh) mesh.instanceMatrix.needsUpdate = true;
    return () => {
      if (mesh) releaseInstanceBuffers(mesh);
      invalidateShadow();
    };
  }, [dummy, invalidateShadow]);
  useLayoutEffect(() => {
    const mesh = dust.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => releaseInstanceBuffers(mesh);
  }, [impact]);

  useFrame(({ gl }) => {
    if (!die.current || !visible) return;
    const now = performance.now();
    const actual = store.getState();
    const rollingNow = hadRoll.current && actual.turnPhase === 'ROLLING';
    const age = landed.current === null ? Infinity : (now - landed.current) / 1000;
    die.current.visible = rollingNow || age < 2.2;
    if (contact.current) contact.current.visible = die.current.visible;
    if (!die.current.visible) {
      if (halo.current) halo.current.visible = false;
      if (faceMark.current) faceMark.current.visible = false;
      if (dust.current) dust.current.visible = false;
      updateShadowPose(gl, die.current);
      return;
    }
    const scale = diceResultScale(rollingNow, age, reduced);
    let height = 0;
    if (rollingNow && !reduced) {
      const progress = (now - started.current) / duration.current;
      diceThrow(progress, index, sequence.current, pose);
      height = pose.height;
      die.current.quaternion.copy(rest).premultiply(spin.setFromEuler(face.set(pose.pitch, pose.yaw, pose.bank, 'XYZ')));
      const { x, y, z, w } = die.current.quaternion;
      const support = EDGE_RADIUS + (HALF_DIE - EDGE_RADIUS) *
        (Math.abs(2 * (x * y + z * w)) + Math.abs(1 - 2 * (x * x + z * z)) + Math.abs(2 * (y * z - x * w)));
      die.current.position.set(pose.x, ROLL_SURFACE + support + height, pose.z);
      const beats = DICE_IMPACTS[index === 0 ? 0 : 1];
      let hit = -1;
      while (impactIndex.current < beats.length && progress >= beats[impactIndex.current]) hit = impactIndex.current++;
      if (hit >= 0 && progress - beats[hit] < .18) {
        impactAt.current = now;
        impactCenter.set(pose.x, pose.z);
        sounds.playDiceImpact(hit);
      }
    } else {
      die.current.quaternion.copy(rest);
      die.current.position.set(0, ROLL_SURFACE + HALF_DIE * scale, 0);
    }
    die.current.scale.setScalar(scale);
    updateShadowPose(gl, die.current);
    if (contact.current) {
      contact.current.position.x = die.current.position.x;
      contact.current.position.z = die.current.position.z;
      contact.current.scale.setScalar(scale * (1 + height * .42));
      contact.current.material.opacity = scale * (.31 - height * .21);
    }
    const doubles = actual.dice[0] === actual.dice[1];
    const impactAge = (now - impactAt.current) / 245;
    if (halo.current) {
      halo.current.visible = !reduced && (impactAge < 1 || (doubles && age < .55));
      if (halo.current.visible) {
        const celebration = doubles && age < .55;
        const t = celebration ? age / .55 : impactAge;
        halo.current.position.set(celebration ? 0 : impactCenter.x, ROLL_SURFACE + .01, celebration ? 0 : impactCenter.y);
        halo.current.scale.setScalar(1 + t * (celebration ? 1.22 : .68));
        halo.current.material.opacity = (celebration ? .62 : .42) * (1 - t);
      }
    }
    if (dust.current) {
      dust.current.visible = !reduced && impactAge < 1;
      if (dust.current.visible) {
        for (let i = 0; i < dust.current.count; i++) {
          const angle = i * Math.PI * 2 / dust.current.count + sequence.current * .8;
          const radius = .38 + impactAge * .43;
          dummy.position.set(impactCenter.x + Math.cos(angle) * radius,
            ROLL_SURFACE + .025 + Math.sin(impactAge * Math.PI) * (.15 + i % 3 * .055),
            impactCenter.y + Math.sin(angle) * radius);
          dummy.scale.setScalar(.05 * (1 - impactAge));
          dummy.updateMatrix();
          dust.current.setMatrixAt(i, dummy.matrix);
        }
        dust.current.instanceMatrix.needsUpdate = true;
      }
    }
    if (faceMark.current) {
      faceMark.current.visible = !rollingNow && age < 1.9;
      if (faceMark.current.visible) {
        faceMark.current.material.color.set(doubles ? '#ffd064' : index ? '#b7e8ff' : '#d8a65a');
        faceMark.current.material.opacity = reduced ? .8 : .72 + .23 * Math.max(0, 1 - age / .4);
      }
    }
  });

  return <group position={[index === 0 ? -0.85 : 0.85, 0, 0]}>
    <mesh ref={contact} geometry={geometry.contact} visible={false} position={[0, ROLL_SURFACE, 0]}
      rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
      <meshBasicMaterial color="#24162f" transparent opacity={.22} depthWrite={false} />
    </mesh>
    {impact && <>
      <mesh ref={halo} geometry={geometry.halo} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={NO_RAYCAST}>
        <meshBasicMaterial color="#ffd76a" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <instancedMesh ref={dust} args={[geometry.dust, undefined, 6]} visible={false} frustumCulled={false} raycast={NO_RAYCAST}>
        <meshBasicMaterial color="#ffe8b5" toneMapped={false} />
      </instancedMesh>
    </>}
    <mesh ref={faceMark} geometry={geometry.face} name={`die-face-highlight-${index}`} visible={false}
      position={[0, DICE_REST_HEIGHT + HALF_DIE + .006, 0]} raycast={NO_RAYCAST}>
      <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
    </mesh>
    <group ref={die} name={`die-${index}`} position={[0, DICE_REST_HEIGHT, 0]} visible={false}>
      <RoundedBox args={[0.82, 0.82, 0.82]} radius={EDGE_RADIUS} smoothness={4} castShadow receiveShadow raycast={NO_RAYCAST}>
        <meshPhysicalMaterial color={index === 0 ? '#fff0dc' : '#225886'} roughness={0.28} metalness={0.04} clearcoat={0.45} />
      </RoundedBox>
      <instancedMesh ref={pips} args={[geometry.pips, undefined, PIP_COUNT]} matrixAutoUpdate={false} castShadow raycast={NO_RAYCAST}>
        <meshStandardMaterial color={index === 0 ? '#382737' : '#ffe5a6'} roughness={0.44} />
      </instancedMesh>
    </group>
  </group>;
};

export const Dice3D: React.FC<{ quality?: string }> = ({ quality = 'balanced' }) => {
  const { reducedMotion, visible } = useMotionPreferences();
  const geometry = useMemo<DiceGeometry>(() => ({
    pips: new THREE.SphereGeometry(1, 10, 8),
    contact: new THREE.CircleGeometry(.52, 24),
    halo: new THREE.RingGeometry(.48, .55, 28),
    dust: new THREE.OctahedronGeometry(1, 0),
    face: new THREE.RingGeometry(.435, .485, 4, 1, Math.PI / 4),
  }), []);
  useEffect(() => () => Object.values(geometry).forEach(shape => shape.dispose()), [geometry]);
  return <group position={[0, 0, 4.2]} name="authoritative-dice">
    {[0, 1].map(index => <Die key={index} index={index} reduced={reducedMotion} visible={visible} impact={quality !== 'low'} geometry={geometry} />)}
  </group>;
};

export default Dice3D;
