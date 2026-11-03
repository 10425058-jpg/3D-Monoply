import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { Board3D } from './Board3D';
import { CenterCity3D } from './CenterCity3D';
import { TokensAndBuildings } from './TokensAndBuildings';
import { Dice3D } from './Dice3D';
import { FantasySkyBackground } from './FantasySkyBackground';

import { useGameStore } from '../../store/useGameStore';
import { getSpaceTransform } from '../../data/boardData';

const ResponsiveCamera: React.FC = () => {
  const { size, camera } = useThree();

  useEffect(() => {
    const aspect = size.width / size.height;
    const persCamera = camera as THREE.PerspectiveCamera;

    if (aspect < 0.7) {
      persCamera.fov = 58;
      persCamera.position.set(0, 22.5, 30.5);
    } else if (aspect < 1.0) {
      persCamera.fov = 50;
      persCamera.position.set(0, 19.5, 27.5);
    } else {
      persCamera.fov = 40;
      persCamera.position.set(0, 16.5, 25.5);
    }
    persCamera.updateProjectionMatrix();
  }, [size.width, size.height, camera]);

  return null;
};

const CameraRig: React.FC = () => {
  const cameraMode = useGameStore((state) => state.cameraMode);
  const players = useGameStore((state) => state.players);
  const currentPlayerIndex = useGameStore((state) => state.currentPlayerIndex);
  const controlsRef = useRef<any>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;

    if (cameraMode === 'top') {
      cameraTarget.current.set(0, 30, 0.01);
      lookTarget.current.set(0, 0, 0);
      camera.position.lerp(cameraTarget.current, 1 - Math.exp(-3 * delta));
      controls.target.lerp(lookTarget.current, 1 - Math.exp(-4 * delta));
    } else if (cameraMode === 'follow') {
      const activePlayer = players[currentPlayerIndex];
      if (!activePlayer) return;

      const transform = getSpaceTransform(activePlayer.position);
      cameraTarget.current.set(
        transform.position[0] * 1.35,
        12.5,
        transform.position[2] * 1.35 + 8
      );
      lookTarget.current.set(
        transform.position[0] * 0.4,
        1.2,
        transform.position[2] * 0.4
      );

      camera.position.lerp(cameraTarget.current, 1 - Math.exp(-2.5 * delta));
      controls.target.lerp(lookTarget.current, 1 - Math.exp(-4 * delta));
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 1.8, -0.5]}
      enablePan={false}
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.22}
      minDistance={16}
      maxDistance={48}
    />
  );
};

type GraphicsQuality = 'low' | 'balanced' | 'high';

export const Scene3D: React.FC<{ quality?: GraphicsQuality }> = ({ quality = 'balanced' }) => (
  <div className="relative h-full w-full">
    <Canvas
      camera={{ position: [0, 16.5, 25.5], fov: 40, near: 0.1, far: 1000 }}
      shadows={quality !== 'low'}
      dpr={quality === 'low' ? ([0.75, 0.9] as [number, number]) : quality === 'high' ? ([1, 1.25] as [number, number]) : ([0.85, 1.0] as [number, number])}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      performance={{ min: 0.6, max: 1, debounce: 180 }}
      gl={{ antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' }}
    >
      <ResponsiveCamera />
      <color attach="background" args={['#433068']} />
      <fog attach="fog" args={['#58427e', 65, 220]} />
      <FantasySkyBackground quality={quality} />

      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#fff4fb', '#5ca843', 0.95]} />
      <directionalLight
        position={[-12, 26, 16]}
        intensity={2.3}
        color="#fff4e0"
        castShadow
        shadow-mapSize-width={quality === 'high' ? 2048 : 1024}
        shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
        shadow-bias={-0.0003}
      >
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 0.5, 75]} />
      </directionalLight>

      <directionalLight position={[8, 12, -25]} intensity={1.1} color="#fed194" />
      <directionalLight position={[0, 6, 22]} intensity={0.5} color="#dbeafe" />

      <CameraRig />
      <Board3D />
      <CenterCity3D />
      <TokensAndBuildings />
      <Dice3D />
    </Canvas>
  </div>
);

export default Scene3D;
