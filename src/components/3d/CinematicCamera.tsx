import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { getSpaceTransform } from '../../data/boardData';
import { useSceneState, useSceneStore } from '../../presentation/SceneStore';
import type { CameraMode } from '../../types/game';
import { BoardOrbitControls } from './BoardOrbitControls';
import { overviewCamera } from './overviewCamera';
import { PLAYER_ISLAND_OVERVIEW_POINTS } from './playerIslandLayout';

export function CinematicCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const { width, height } = useThree(state => state.size);
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const domElement = useThree(state => state.events.connected || state.gl.domElement);
  const set = useThree(state => state.set);
  const get = useThree(state => state.get);
  const store = useSceneStore();
  const mode = useSceneState(state => state.cameraMode);
  const orbit = useMemo(() => new BoardOrbitControls(camera), [camera]);
  const previousView = useRef<{ orbit: BoardOrbitControls; mode: CameraMode }>();
  const fit = useMemo(() => overviewCamera(width, height, mode === 'top', PLAYER_ISLAND_OVERVIEW_POINTS),
    [width, height, mode]);

  useLayoutEffect(() => {
    const previous = get().controls;
    const controls = orbit as unknown as RootState['controls'];
    set({ controls });
    return () => { if (get().controls === controls) set({ controls: previous }); };
  }, [orbit, get, set]);

  useEffect(() => {
    orbit.connect(domElement);
    return () => orbit.dispose();
  }, [orbit, domElement]);

  useLayoutEffect(() => {
    // A smaller viewport must not clamp a distance already chosen by the player.
    orbit.maxDistance = Math.max(85, fit.distance * 1.3, orbit.getDistance());
  }, [orbit, fit.distance]);

  useLayoutEffect(() => {
    const initializing = previousView.current?.orbit !== orbit;
    if (!initializing && previousView.current?.mode === mode) return;
    previousView.current = { orbit, mode };

    const position = new Vector3().fromArray(fit.position);
    const target = new Vector3().fromArray(fit.target);
    camera.fov = fit.fov;
    if (mode === 'follow') {
      // Snapshot the target only for a requested view. Turn updates cannot move it.
      const state = store.getState();
      const space = state.players[state.currentPlayerIndex]?.position ?? 0;
      const [x, , z] = getSpaceTransform(space).position;
      position.copy(camera.position).sub(orbit.target);
      if (position.lengthSq() < 1) position.set(0, 20, 27);
      position.setLength(MathUtils.clamp(position.length(), 26, 42));
      target.set(x, .6, z);
      position.add(target);
      camera.clearViewOffset();
    } else if (mode === 'city') {
      target.set(0, 2.3, -1.8);
      position.set(14, 17, 24);
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(width, height, ...fit.offset, width, height);
    }

    // The responsive opening composition is set before the first frame. Only
    // a deliberate camera mode change can request a transition afterwards.
    if (initializing) orbit.setPose(position, target);
    else orbit.focusOn(position, target);
  }, [orbit, camera, mode, store, width, height, fit]);

  useFrame((_, delta) => orbit.step(delta, reducedMotion), -1);
  return null;
}
