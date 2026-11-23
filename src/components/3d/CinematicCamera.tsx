import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useSceneState as useGameStore } from '../../presentation/SceneStore';
import { getSpaceTransform } from '../../data/boardData';
import { overviewCamera } from './overviewCamera';

export type CameraPreset = 'overview' | 'player' | 'property' | 'dice' | 'movement' | 'event';
export const CAMERA_PRESETS: Record<CameraPreset, string> = {
  overview: 'Board overview', player: 'Current player', property: 'Selected property',
  dice: 'Dice roll', movement: 'Focus player (once)', event: 'Castle & special event',
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Presentation only: never advances a turn or writes a gameplay result. */
export function CinematicCamera({ request, reducedMotion, propertyPanel }: {
  request: { preset: CameraPreset; sequence: number }; reducedMotion: boolean; propertyPanel: boolean;
}) {
  const { size, camera } = useThree();
  const mode = useGameStore(s => s.cameraMode);
  const selected = useGameStore(s => s.selectedSpaceId);
  const position = useGameStore(s => s.players[s.currentPlayerIndex]?.position ?? 0);
  const controls = useRef<OrbitControlsImpl>(null);
  const active = useRef(true);
  const preset = useRef<CameraPreset | 'manual'>('overview');
  const destination = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const outward = useRef(new THREE.Vector3());
  // Preserve the player's viewing angle for user-requested, one-time focus presets.
  const followOffset = useRef(new THREE.Vector3(0, 20, 27));
  // Snapshot the requested target so turn changes cannot retarget a transition.
  const focusedPlayerSpace = useRef(position);
  const focusedPropertySpace = useRef<number | null>(null);
  const fit = useMemo(() => overviewCamera(size.width, size.height, mode === 'top'), [size.width, size.height, mode]);
  const captureFollowAngle = () => {
    const orbit = controls.current;
    if (!orbit) return;
    followOffset.current.copy(camera.position).sub(orbit.target);
    if (followOffset.current.lengthSq() < 1) followOffset.current.set(0, 20, 27);
    followOffset.current.setLength(THREE.MathUtils.clamp(followOffset.current.length(), 26, 42));
  };

  useEffect(() => {
    if (request.preset === 'player' || request.preset === 'movement') {
      captureFollowAngle();
      focusedPlayerSpace.current = position;
    }
    if (request.preset === 'property') focusedPropertySpace.current = selected;
    preset.current = request.preset;
    active.current = true;
  }, [request]);
  useEffect(() => {
    if (mode === 'follow') {
      captureFollowAngle();
      focusedPlayerSpace.current = position;
    }
    preset.current = mode === 'follow' ? 'player' : mode === 'city' ? 'event' : 'overview';
    active.current = true;
  }, [mode]);
  // Property selection, dice, token movement and turn changes are gameplay events.
  // They must not override a camera angle chosen by the player. Only explicit
  // toolbar requests and camera-mode changes can initiate a new camera transition.
  useEffect(() => {
    if (preset.current === 'property' && selected !== focusedPropertySpace.current) {
      // Closing or changing a property cancels a pending focus without resetting the view.
      preset.current = 'manual';
      active.current = false;
    }
  }, [selected]);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = fit.fov;
    perspective.updateProjectionMatrix();
    if (preset.current === 'overview') active.current = true;
  }, [size.width, size.height, reducedMotion, camera, fit]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit || !active.current) return;
    const aim = target.current.fromArray(fit.target);
    const dest = destination.current;
    dest.fromArray(fit.position);
    const perspective = camera as THREE.PerspectiveCamera;
    if (preset.current === 'overview') {
      perspective.setViewOffset(size.width, size.height, ...fit.offset, size.width, size.height);
    } else if (preset.current === 'property' && propertyPanel && size.width > 760) {
      const offset = Math.min(size.width * .18, Math.max(0, (1640 - size.width) * .6));
      perspective.setViewOffset(size.width, size.height, offset, 0, size.width, size.height);
    } else {
      // Close views retain their existing centered composition and interactions.
      perspective.clearViewOffset();
    }
    if (preset.current === 'property' && focusedPropertySpace.current !== null) {
      const [x, , z] = getSpaceTransform(focusedPropertySpace.current).position;
      // Retain the existing unobstructed property detail composition.
      outward.current.set(x, 0, z).normalize();
      aim.set(x, 0.5, z);
      dest.set(x + outward.current.x * 10, 17, z + outward.current.z * 10 + 4);
    } else if (preset.current === 'player' || preset.current === 'movement') {
      const [x, , z] = getSpaceTransform(focusedPlayerSpace.current).position;
      aim.set(x, 0.6, z);
      // A manually selected player preset is a one-time focus, never a tracking mode.
      dest.copy(aim).add(followOffset.current);
    } else if (preset.current === 'dice') {
      aim.set(0, 0.8, 4.2); dest.set(0, 18, 22);
    } else if (preset.current === 'event') {
      aim.set(0, 2.3, -1.8); dest.set(14, 17, 24);
    }
    const blend = reducedMotion ? 1 : 1 - Math.exp(-3.2 * Math.min(delta, 0.1));
    camera.position.lerp(dest, blend);
    orbit.target.lerp(aim, blend);
    orbit.update();
    // Release control once the requested pose settles, including player presets.
    // Changes in board state cannot start a second camera movement.
    if (camera.position.distanceToSquared(dest) < 0.0001 &&
      orbit.target.distanceToSquared(aim) < 0.0001) active.current = false;
  });

  // Orbit around the board only when the player drags/pinches; do not pan away from it.
  return <OrbitControls ref={controls} makeDefault enablePan={false}
    enableDamping={!reducedMotion} dampingFactor={0.09} rotateSpeed={0.55} zoomSpeed={0.7}
    minPolarAngle={0.04} maxPolarAngle={Math.PI / 2.65} minDistance={16} maxDistance={Math.max(85, fit.distance * 1.3)}
    onStart={() => { active.current = false; preset.current = 'manual'; }} />;
}
