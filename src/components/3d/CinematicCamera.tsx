import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getSpaceTransform } from '../../data/boardData';
import { overviewCamera } from './overviewCamera';

export type CameraPreset = 'overview' | 'player' | 'property' | 'dice' | 'movement' | 'event';
export const CAMERA_PRESETS: Record<CameraPreset, string> = {
  overview: 'Board overview', player: 'Current player', property: 'Selected property',
  dice: 'Dice roll', movement: 'Player movement', event: 'Castle & special event',
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
export function CinematicCamera({ request, reducedMotion }: {
  request: { preset: CameraPreset; sequence: number }; reducedMotion: boolean;
}) {
  const { size, camera } = useThree();
  const mode = useGameStore(s => s.cameraMode);
  const selected = useGameStore(s => s.selectedSpaceId);
  const phase = useGameStore(s => s.turnPhase);
  const position = useGameStore(s => s.players[s.currentPlayerIndex]?.position ?? 0);
  const controls = useRef<OrbitControlsImpl>(null);
  const active = useRef(true);
  const preset = useRef<CameraPreset>('overview');
  const destination = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const outward = useRef(new THREE.Vector3());
  const fit = useMemo(() => overviewCamera(size.width, size.height, mode === 'top'), [size.width, size.height, mode]);

  useEffect(() => {
    preset.current = request.preset;
    active.current = true;
  }, [request]);
  useEffect(() => {
    preset.current = mode === 'follow' ? 'player' : mode === 'city' ? 'event' : 'overview';
    active.current = true;
  }, [mode]);
  useEffect(() => {
    preset.current = selected === null ? 'overview' : 'property';
    active.current = true;
  }, [selected]);
  useEffect(() => {
    if (phase === 'MOVING' && mode === 'follow') {
      preset.current = 'movement'; active.current = true;
    } else if (phase !== 'MOVING' && preset.current === 'movement') {
      preset.current = 'overview'; active.current = true;
    }
  }, [phase, mode]);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = fit.fov;
    perspective.updateProjectionMatrix();
    active.current = true;
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
    } else {
      // Close views retain their existing centered composition and interactions.
      perspective.clearViewOffset();
    }
    if (preset.current === 'property' || preset.current === 'player' || preset.current === 'movement') {
      const id = preset.current === 'property' ? selected : position;
      if (id !== null) {
        const [x, , z] = getSpaceTransform(id).position;
        // Approach from outside the board so the castle cannot hide the subject.
        outward.current.set(x, 0, z).normalize();
        aim.set(x, 0.5, z);
        dest.set(x + outward.current.x * 10, 17, z + outward.current.z * 10 + 4);
      }
    } else if (preset.current === 'dice') {
      aim.set(0, 0.8, 4.2); dest.set(0, 18, 22);
    } else if (preset.current === 'event') {
      aim.set(0, 2.3, -1.8); dest.set(14, 17, 24);
    }
    const blend = reducedMotion ? 1 : 1 - Math.exp(-3.2 * Math.min(delta, 0.1));
    camera.position.lerp(dest, blend);
    orbit.target.lerp(aim, blend);
    orbit.update();
    if (camera.position.distanceToSquared(dest) < 0.0001 && orbit.target.distanceToSquared(aim) < 0.0001
      && preset.current !== 'movement' && preset.current !== 'player') active.current = false;
  });

  return <OrbitControls ref={controls} makeDefault enablePan={false}
    enableDamping={!reducedMotion} dampingFactor={0.09} rotateSpeed={0.55} zoomSpeed={0.7}
    minPolarAngle={0.04} maxPolarAngle={Math.PI / 2.65} minDistance={16} maxDistance={Math.max(85, fit.distance * 1.3)}
    onStart={() => { active.current = false; }} />;
}
