import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '../../types/game';
import { BOARD_SPACES, getSpaceTransform } from '../../data/boardData';
import { useSceneStore } from '../../presentation/SceneStore';
import { didEndGame, isGameReset } from '../../presentation/effectEvents';
import { createHopPose, hopPose, isAdjacentTile, movementDuration, smoothStep, tileActorHeight,
  tokenOffset, tokenRenderScale, tokenRingScale, turnAngle } from '../../presentation/animationMath';
import { sounds } from '../../utils/audio';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { useInvalidateBoardShadow, watchShadowPose } from './BoardShadowLight';

type Step = { from: number; to: number; at: number; duration: number; yaw: number; turn: number };
type Landing = { tile: number; at: number; arrival: boolean };
type ColorFade = { material: THREE.MeshStandardMaterial; originalColor: THREE.Color; gray: THREE.Color };
export type TokenEffectGeometry = { identity: THREE.RingGeometry; ripple: THREE.RingGeometry; trail: THREE.OctahedronGeometry };
const tiles = BOARD_SPACES.map(space => getSpaceTransform(space.id));
const NO_RAYCAST = () => {};
const TRAIL_LENGTH = 4;
const ELIMINATION_MS = 820;
const lerp = THREE.MathUtils.lerp;

function sharedTile(players: Player[], tile: number, playerId: number) {
  return players.some(player => player.id !== playerId && !player.isBankrupt && player.position === tile);
}

export function AnimatedToken({ player, index, reduced, visible, trails, eliminatedAt, geometry, children }: {
  player: Player; index: number; reduced: boolean; visible: boolean; trails: boolean;
  eliminatedAt?: number; geometry: TokenEffectGeometry; children: React.ReactNode;
}) {
  const store = useSceneStore();
  const invalidateShadow = useInvalidateBoardShadow();
  const updateShadowPose = useMemo(watchShadowPose, []);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshPhysicalMaterial>>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const ripple = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const steps = useRef<Step[]>([]);
  const landing = useRef<Landing>({ at: -Infinity, tile: player.position, arrival: false });
  const arrival = useRef<number | null>(null);
  const facing = useRef(0);
  const highlight = useRef({ active: false, at: -Infinity });
  const fade = useRef<ColorFade[]>([]);
  const pose = useMemo(createHopPose, []);
  const trailPose = useMemo(createHopPose, []);
  const trailTransform = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => ({ corner: tokenOffset(index, 4, true), street: tokenOffset(index, 4),
    crowded: tokenOffset(index, 5) }), [index]);
  const initialTile = tiles[player.position];
  const initialPlayers = store.getState().players;
  const initialOffset = initialPlayers.length > 4 ? offsets.crowded : initialTile.isCorner ? offsets.corner : offsets.street;
  const initialScale = tokenRenderScale(initialPlayers.length, initialTile.isCorner, sharedTile(initialPlayers, player.position, player.id));
  const initial = initialTile.position;

  useLayoutEffect(() => {
    invalidateShadow();
    return invalidateShadow;
  }, [invalidateShadow]);
  useLayoutEffect(() => {
    const mesh = trail.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => releaseInstanceBuffers(mesh);
  }, [trails]);
  useLayoutEffect(() => {
    if (eliminatedAt === undefined || reduced) return;
    const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
    const colors = new Map<THREE.MeshStandardMaterial, ColorFade>();
    body.current?.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      const original = object.material;
      let entry = colors.get(original);
      if (!entry) {
        const color = original.color;
        const gray = color.r * .2126 + color.g * .7152 + color.b * .0722;
        entry = { material: original.clone(), originalColor: color, gray: new THREE.Color(gray, gray, gray) };
        colors.set(original, entry);
      }
      originalMaterials.set(object, original);
      object.material = entry.material;
    });
    fade.current = [...colors.values()];
    return () => {
      originalMaterials.forEach((original, mesh) => { mesh.material = original; });
      colors.forEach(({ material }) => material.dispose());
      fade.current = [];
    };
  }, [eliminatedAt, reduced]);

  useEffect(() => {
    const reset = () => {
      steps.current.length = 0;
      landing.current.at = -Infinity;
      arrival.current = null;
      facing.current = 0;
      highlight.current = { active: false, at: -Infinity };
      if (trail.current) trail.current.visible = false;
      if (ripple.current) ripple.current.visible = false;
    };
    const onHide = () => { if (document.hidden) reset(); };
    const unsubscribe = store.subscribe((next, previous) => {
      if (isGameReset(previous, next) || didEndGame(previous, next)) { reset(); return; }
      if (document.hidden) return;
      const before = previous.players.find(p => p.id === player.id);
      const after = next.players.find(p => p.id === player.id);
      if (!before || !after || after.isBankrupt) return;
      if (previous.turnPhase === 'MOVING' && next.turnPhase !== 'MOVING' && !after.inJail &&
        previous.players[previous.currentPlayerIndex]?.id === player.id) arrival.current = after.position;
      if (before.position === after.position || reduced) return;
      if (!isAdjacentTile(before.position, after.position) || (!before.inJail && after.inJail)) {
        reset();
        if (!after.inJail) arrival.current = after.position;
        return;
      }
      const now = performance.now();
      const from = tiles[before.position].position;
      const to = tiles[after.position].position;
      const last = steps.current.at(-1);
      const startYaw = last?.yaw ?? facing.current;
      const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
      steps.current.push({ from: before.position, to: after.position, at: last ? Math.max(now, last.at + last.duration) : now,
        duration: movementDuration(next.gameSpeed) * 1000, yaw, turn: turnAngle(startYaw, yaw) });
    });
    document.addEventListener('visibilitychange', onHide);
    return () => { unsubscribe(); reset(); document.removeEventListener('visibilitychange', onHide); };
  }, [player.id, reduced, store]);

  useFrame(({ gl }, delta) => {
    const group = root.current;
    const model = body.current;
    if (!group || !model || !visible) return;
    const state = store.getState();
    const seat = state.players[index];
    const actual = seat?.id === player.id ? seat : state.players.find(p => p.id === player.id);
    if (!actual) return;
    const now = performance.now();
    const defeat = eliminatedAt === undefined ? Infinity : (now - eliminatedAt) / ELIMINATION_MS;
    group.visible = !actual.isBankrupt || (!reduced && defeat < 1);
    if (actual.isBankrupt) {
      if (trail.current) trail.current.visible = false;
      if (ripple.current) ripple.current.visible = false;
      if (group.visible) {
        for (const { material, originalColor, gray } of fade.current) {
          material.color.lerpColors(originalColor, gray, smoothStep(defeat * 1.5));
        }
        if (ring.current) ring.current.material.emissiveIntensity = .08 * Math.max(0, 1 - defeat);
      }
      updateShadowPose(gl, group);
      return;
    }

    // Every segment comes from an adjacent committed step, including backwards card moves.
    let finished: Step | undefined;
    while (steps.current.length && now >= steps.current[0].at + steps.current[0].duration) {
      finished = steps.current.shift()!;
      facing.current = finished.yaw;
    }
    const step = steps.current[0];
    if (!step && arrival.current === actual.position) {
      landing.current = { tile: actual.position, at: now, arrival: true };
      arrival.current = null;
      sounds.playStep(true);
    } else if (finished && now - finished.at - finished.duration < 90) {
      landing.current = { tile: finished.to, at: finished.at + finished.duration, arrival: false };
      sounds.playStep();
    }
    const destinationId = step?.to ?? actual.position;
    const destination = tiles[destinationId];
    const count = state.players.length;
    const offset = count > 4 ? offsets.crowded : destination.isCorner ? offsets.corner : offsets.street;
    const baseScale = tokenRenderScale(count, destination.isCorner, sharedTile(state.players, destinationId, player.id));
    const endHeight = tileActorHeight(destinationId, state.hoveredSpaceId, state.selectedSpaceId);
    const age = now - landing.current.at;
    const moving = !!step && !reduced;
    const streaks = trail.current;
    const priorTilt = model.rotation.x;
    if (streaks) streaks.visible = moving;

    if (moving) {
      const origin = tiles[step.from];
      const fromOffset = count > 4 ? offsets.crowded : origin.isCorner ? offsets.corner : offsets.street;
      const fromScale = tokenRenderScale(count, origin.isCorner, sharedTile(state.players, step.from, player.id));
      const startHeight = tileActorHeight(step.from, state.hoveredSpaceId, state.selectedSpaceId);
      const t = (now - step.at) / step.duration;
      const startX = origin.position[0] + fromOffset.x, endX = destination.position[0] + offset.x;
      const startZ = origin.position[2] + fromOffset.z, endZ = destination.position[2] + offset.z;
      hopPose(t, pose);
      group.position.set(lerp(startX, endX, pose.blend),
        lerp(startHeight, endHeight, pose.blend) + pose.height, lerp(startZ, endZ, pose.blend));
      group.rotation.y = step.yaw - step.turn * (1 - smoothStep(t / .62));
      group.scale.setScalar(lerp(fromScale, baseScale, pose.blend));
      model.rotation.x = pose.tilt;
      model.position.y = .37 * Math.abs(Math.sin(pose.tilt));
      if (streaks) {
        streaks.count = 0;
        for (let i = 0; i < TRAIL_LENGTH; i++) {
          const lag = t - .12 * (i + 1);
          if (lag <= .12) break;
          hopPose(lag, trailPose);
          trailTransform.position.set(lerp(startX, endX, trailPose.blend),
            lerp(startHeight, endHeight, trailPose.blend) + .11 + trailPose.height * .58,
            lerp(startZ, endZ, trailPose.blend));
          trailTransform.scale.setScalar(.105 - i * .018);
          trailTransform.updateMatrix();
          streaks.setMatrixAt(streaks.count++, trailTransform.matrix);
        }
        streaks.visible = streaks.count > 0;
        if (streaks.visible) streaks.instanceMatrix.needsUpdate = true;
      }
    } else {
      const recoil = !reduced && age < 120 ? -.09 * Math.sin(age / 120 * Math.PI) : 0;
      group.position.set(destination.position[0] + offset.x, endHeight, destination.position[2] + offset.z);
      group.rotation.y = facing.current;
      group.scale.setScalar(baseScale);
      model.rotation.x = recoil;
      model.position.y = .37 * Math.abs(Math.sin(recoil));
    }
    if (model.rotation.x !== priorTilt && gl.shadowMap.enabled) gl.shadowMap.needsUpdate = true;

    if (ripple.current) {
      const signal = landing.current;
      const t = age / (signal.arrival ? 520 : 145);
      ripple.current.visible = !reduced && t >= 0 && t < 1;
      if (ripple.current.visible) {
        const tile = tiles[signal.tile];
        const lane = count > 4 ? offsets.crowded : tile.isCorner ? offsets.corner : offsets.street;
        ripple.current.position.set(tile.position[0] + lane.x,
          tileActorHeight(signal.tile, state.hoveredSpaceId, state.selectedSpaceId) + .027, tile.position[2] + lane.z);
        ripple.current.scale.setScalar((signal.arrival ? .68 : .46) + (signal.arrival ? .68 : .28) * smoothStep(t));
        ripple.current.material.opacity = (signal.arrival ? .78 : .39) * (1 - t);
      }
    }
    const active = state.players[state.currentPlayerIndex]?.id === player.id && !state.winner;
    if (highlight.current.active !== active) {
      highlight.current.active = active;
      highlight.current.at = now;
    }
    if (ring.current) {
      const pulse = !reduced && active ? Math.max(0, 1 - (now - highlight.current.at) / 680) * .7 : 0;
      const intensity = active ? .58 + pulse : .08;
      ring.current.material.emissiveIntensity = reduced ? intensity :
        THREE.MathUtils.damp(ring.current.material.emissiveIntensity, intensity, 18, delta);
    }
    updateShadowPose(gl, group);
  });

  return <>
    <group ref={root} name={`token-${player.id}`} position={[initial[0] + initialOffset.x, .34, initial[2] + initialOffset.z]} scale={initialScale}>
      <group ref={body}>{children}</group>
      <mesh ref={ring} geometry={geometry.identity} name="player-identity-ring" position={[0, .02, 0]} rotation={[-Math.PI / 2, 0, 0]}
        scale={tokenRingScale(initialPlayers.length)} raycast={NO_RAYCAST}>
        <meshPhysicalMaterial color={player.color} emissive={player.color} emissiveIntensity={.08}
          metalness={.12} roughness={.38} clearcoat={.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
    <mesh ref={ripple} geometry={geometry.ripple} name={`token-ripple-${player.id}`} visible={false}
      rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
      <meshBasicMaterial color={player.color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
    {trails && <instancedMesh ref={trail} args={[geometry.trail, undefined, TRAIL_LENGTH]} visible={false}
      frustumCulled={false} name={`token-trail-${player.id}`} raycast={NO_RAYCAST}>
      <meshBasicMaterial color={player.color} toneMapped={false} />
    </instancedMesh>}
  </>;
}
