import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '../../types/game';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useSceneStore } from '../../presentation/SceneStore';
import { isGameReset } from '../../presentation/effectEvents';
import { hopPose, isAdjacentTile, movementDuration,tokenOffset,tokenRenderScale,tileActorHeight } from '../../presentation/animationMath';

type Step = { from: number; to: number; at: number; duration: number };
const tiles = BOARD_SPACES.map(space => getSpaceTransform(space.id));

export function AnimatedToken({ player, index, reduced, visible, trails, children }: {
  player: Player; index: number; reduced: boolean; visible: boolean; trails: boolean; children: React.ReactNode;
}) {
  const store = useSceneStore();
  const root = useRef<THREE.Group>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const landingRing = useRef<THREE.Mesh>(null);
  const steps = useRef<Step[]>([]);
  const landedAt = useRef(-Infinity);
  const initialTile = tiles[player.position];
  const initialPlayers = store.getState().players;
  const initialOffset = tokenOffset(index, initialPlayers.length, initialTile.isCorner);
  const initialScale = tokenRenderScale(initialPlayers.length, initialTile.isCorner,
    initialPlayers.some(p => p.id !== player.id && !p.isBankrupt && p.position === player.position));
  const initial = initialTile.position;
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
    const reset = () => {
      steps.current = []; landedAt.current = -Infinity;
      root.current?.rotation.set(0, 0, 0);
      if (trail.current) trail.current.visible = false;
      if (landingRing.current) landingRing.current.visible = false;
    };
    const unsubscribe = store.subscribe((next, previous) => {
      if (isGameReset(previous, next)) { reset(); return; }
      const before = previous.players.find(p => p.id === player.id);
      const after = next.players.find(p => p.id === player.id);
      if (!before || !after || before.position === after.position) return;
      const now = performance.now();
      if (!isAdjacentTile(before.position, after.position) || (!before.inJail && after.inJail)) {
        reset();
        landedAt.current = now;
        return;
      }
      if (reduced || document.hidden) return;
      const last = steps.current[steps.current.length - 1];
      if (last && last.at + last.duration <= now) steps.current = [];
      if (steps.current.length >= 8) steps.current = [];
      const queued = steps.current[steps.current.length - 1];
      steps.current.push({ from: before.position, to: after.position,
        at: queued ? Math.max(now, queued.at + queued.duration) : now, duration: movementDuration(next.gameSpeed) * 1000 });
    });
    document.addEventListener('visibilitychange', reset);
    return () => { unsubscribe(); reset(); document.removeEventListener('visibilitychange', reset); };
  }, [player.id, reduced, store]);

  useFrame(() => {
    const group = root.current;
    if (!group || !visible) return;
    const state=store.getState();
    const actual = state.players.find(p => p.id === player.id);
    if (!actual) return;
    const now = performance.now();
    // Consume expired segments without ever drawing a chord across a corner.
    while (steps.current.length && now >= steps.current[0].at + steps.current[0].duration) {
      const finished = steps.current.shift()!;
      landedAt.current = finished.at + finished.duration;
    }
    const step = steps.current[0];
    const destination = tiles[step?.to ?? actual.position];
    const count = state.players.length;
    const shared = (tile: number) => state.players.some(p => p.id !== player.id && !p.isBankrupt && p.position === tile);
    const offset = tokenOffset(index, count, destination.isCorner);
    const baseScale = tokenRenderScale(count, destination.isCorner, shared(step?.to ?? actual.position));
    const actorHeight=tileActorHeight(actual.position,state.hoveredSpaceId,state.selectedSpaceId);
    const moving = step && !reduced;
    if (moving) {
      const from = tiles[step.from].position;
      const to = tiles[step.to].position;
      const pose = hopPose((now - step.at) / step.duration);
      const fromOffset = tokenOffset(index, count, tiles[step.from].isCorner);
      const fromScale = tokenRenderScale(count, tiles[step.from].isCorner, shared(step.from));
      const movingScale = THREE.MathUtils.lerp(fromScale, baseScale, pose.blend);
      const startHeight = tileActorHeight(step.from, state.hoveredSpaceId, state.selectedSpaceId);
      const endHeight = tileActorHeight(step.to, state.hoveredSpaceId, state.selectedSpaceId);
      const hopHeight = pose.height * (1 - (index % 3) * .09);
      group.position.set(THREE.MathUtils.lerp(from[0] + fromOffset.x, to[0] + offset.x, pose.blend),
        THREE.MathUtils.lerp(startHeight, endHeight, pose.blend) + hopHeight,
        THREE.MathUtils.lerp(from[2] + fromOffset.z, to[2] + offset.z, pose.blend));
      group.rotation.set(0, Math.atan2(to[0] - from[0], to[2] - from[2]), pose.tilt);
      group.scale.set(movingScale * (1 - hopHeight * .10), movingScale * (1 + hopHeight * .18), movingScale);
    } else {
      const landingAge = (now - landedAt.current) / 180;
      const landing = !reduced && landingAge >= 0 && landingAge < 1 ? (1 - landingAge) ** 2 : 0;
      group.position.set(destination.position[0] + offset.x, actorHeight + landing * 0.025, destination.position[2] + offset.z);
      group.rotation.z = 0;
      group.scale.set(baseScale * (1 + landing * .05), baseScale * (1 - landing * .075), baseScale * (1 + landing * .05));
      if (landingRing.current) {
        landingRing.current.visible = !reduced && landing > 0;
        if (landing > 0) {
          landingRing.current.scale.setScalar(1 + landingAge * .65);
          (landingRing.current.material as THREE.MeshBasicMaterial).opacity = landing * .55;
        }
      }
    }
    if (moving && landingRing.current) landingRing.current.visible = false;
    if (trail.current) trail.current.visible = !!moving && trails;
  });

  return <group ref={root} name={`token-${player.id}`} position={[initial[0] + initialOffset.x, .34, initial[2] + initialOffset.z]} scale={initialScale}>
    {children}
    {trails && <mesh ref={landingRing} visible={false} position={[0, .015, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[.37, .395, 24]} /><meshBasicMaterial color={player.color} transparent depthWrite={false} />
    </mesh>}
    {trails && <instancedMesh ref={trail} args={[undefined, undefined, 3]} visible={false} name={`token-trail-${player.id}`} raycast={() => {}}>
      <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color={player.color} />
    </instancedMesh>}
  </group>;
}
