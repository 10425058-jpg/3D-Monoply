import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '../../types/game';
import { getSpaceTransform } from '../../data/boardData';
import { useSceneStore } from '../../presentation/SceneStore';
import { isGameReset } from '../../presentation/effectEvents';
import { hopPose, isAdjacentTile, movementDuration } from '../../presentation/animationMath';

type Step = { from: number; to: number; at: number; duration: number; teleport: boolean };

export function AnimatedToken({ player, index, reduced, visible, trails, children }: {
  player: Player; index: number; reduced: boolean; visible: boolean; trails: boolean; children: React.ReactNode;
}) {
  const store = useSceneStore();
  const root = useRef<THREE.Group>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const steps = useRef<Step[]>([]);
  const landedAt = useRef(-Infinity);
  const offset = (index * Math.PI) / 2 + Math.PI / 4;
  const ox = Math.cos(offset) * 0.38, oz = Math.sin(offset) * 0.38;
  const initial = getSpaceTransform(player.position).position;
  useLayoutEffect(() => {
    if (!trail.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 3; i++) {
      dummy.position.set(0, 0.02, -0.55 - i * 0.16);
      dummy.scale.setScalar(0.055 - i * 0.012);
      dummy.updateMatrix(); trail.current.setMatrixAt(i, dummy.matrix);
    }
    trail.current.instanceMatrix.needsUpdate = true;
  }, [trails]);
  useEffect(() => {
    const reset = () => { steps.current = []; landedAt.current = -Infinity; };
    const unsubscribe = store.subscribe((next, previous) => {
      if (isGameReset(previous, next)) { reset(); return; }
      const before = previous.players.find(p => p.id === player.id);
      const after = next.players.find(p => p.id === player.id);
      if (!before || !after || before.position === after.position) return;
      const teleport = !isAdjacentTile(before.position, after.position) || (!before.inJail && after.inJail);
      if (teleport) { steps.current = []; landedAt.current = -Infinity; }
      steps.current.push({ from: before.position, to: after.position, at: performance.now(), duration: movementDuration(next.gameSpeed) * 1000, teleport });
      steps.current = steps.current.slice(-16);
    });
    document.addEventListener('visibilitychange', reset);
    return () => { unsubscribe(); reset(); document.removeEventListener('visibilitychange', reset); };
  }, [player.id, store]);

  useFrame(() => {
    const group = root.current;
    if (!group || !visible) return;
    const actual = store.getState().players.find(p => p.id === player.id);
    if (!actual) return;
    const now = performance.now();
    // Consume expired segments without ever drawing a chord across a corner.
    while (steps.current.length && now >= steps.current[0].at + steps.current[0].duration) {
      const finished = steps.current.shift()!;
      if (!finished.teleport) landedAt.current = finished.at + finished.duration;
    }
    const step = steps.current[0];
    const destination = getSpaceTransform(actual.position);
    const baseScale = destination.isCorner ? 1.2 : 1.06;
    const moving = step && !step.teleport && !reduced;
    if (moving) {
      const from = getSpaceTransform(step.from).position;
      const to = getSpaceTransform(step.to).position;
      const pose = hopPose((now - step.at) / step.duration);
      group.position.set(THREE.MathUtils.lerp(from[0], to[0], pose.blend) + ox, 0.22 + pose.height, THREE.MathUtils.lerp(from[2], to[2], pose.blend) + oz);
      group.rotation.set(0, Math.atan2(to[0] - from[0], to[2] - from[2]), pose.tilt);
      group.scale.set(baseScale * (1 - pose.height * 0.05), baseScale * (1 + pose.height * 0.1), baseScale);
    } else {
      const landingAge = (now - landedAt.current) / 180;
      const landing = !reduced && landingAge >= 0 && landingAge < 1 ? Math.sin(landingAge * Math.PI) : 0;
      group.position.set(destination.position[0] + ox, 0.22 + landing * 0.025, destination.position[2] + oz);
      group.rotation.z = 0;
      group.scale.set(baseScale * (1 + landing * 0.03), baseScale * (1 - landing * 0.04), baseScale);
    }
    if (trail.current) trail.current.visible = !!moving && trails;
  });

  return <group ref={root} name={`token-${player.id}`} position={[initial[0] + ox, 0.22, initial[2] + oz]}>
    {children}
    {trails && <instancedMesh ref={trail} args={[undefined, undefined, 3]} visible={false} name={`token-trail-${player.id}`} raycast={() => {}}>
      <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#ffd994" />
    </instancedMesh>}
  </group>;
}
