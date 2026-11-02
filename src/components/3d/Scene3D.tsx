import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import * as THREE from 'three';

import { Board3D } from './Board3D';
import { CenterCity3D } from './CenterCity3D';
import { TokensAndBuildings } from './TokensAndBuildings';
import { Dice3D } from './Dice3D';

import { useGameStore } from '../../store/useGameStore';
import { getSpaceTransform } from '../../data/boardData';

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
      cameraTarget.current.set(0, 27, 0.01);
      lookTarget.current.set(0, 0, 0);
      camera.position.lerp(cameraTarget.current, 1 - Math.exp(-3 * delta));
      controls.target.lerp(lookTarget.current, 1 - Math.exp(-4 * delta));
    } else if (cameraMode === 'follow') {
      const activePlayer = players[currentPlayerIndex];
      if (!activePlayer) return;

      const transform = getSpaceTransform(activePlayer.position);
      cameraTarget.current.set(
        transform.position[0] * 1.45,
        11.5,
        transform.position[2] * 1.45
      );
      lookTarget.current.set(
        transform.position[0] * 0.5,
        0.5,
        transform.position[2] * 0.5
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
      enablePan
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={10}
      maxDistance={60}
    />
  );
};

export const Scene3D: React.FC = () => (
  <div className="relative h-full w-full">
    <Canvas
      camera={{ position: [0, 24, 24], fov: 43, near: 0.1, far: 1000 }}
      shadows
      dpr={[1, 1.35]}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
      performance={{ min: 0.55, max: 1, debounce: 180 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <mesh position={[0, -1.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[27, 96]} />
        <meshStandardMaterial color="#58b8eb" roughness={0.98} metalness={0.02} />
      </mesh>
      <color attach="background" args={['#7768d2']} />
      <fog attach="fog" args={['#7768d2', 42, 96]} />

      <ambientLight intensity={0.92} />
      <hemisphereLight args={['#fff0fa', '#63b9a0', 1.05]} />
      <directionalLight
        position={[-13, 24, 14]}
        intensity={2.35}
        color="#fff0d8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-radius={5}
        shadow-bias={-0.00018}
        shadow-camera-left={-21}
        shadow-camera-right={21}
        shadow-camera-top={21}
        shadow-camera-bottom={-21}
      />
      <directionalLight position={[10, 12, -12]} intensity={0.9} color="#ffb9c9" />
      <pointLight position={[0, 9, 0]} intensity={0.55} color="#65d8ff" distance={30} decay={2} />

      
      <Sparkles count={46} scale={[23, 8, 23]} size={2.1} speed={0.2} opacity={0.32} color="#fff3d7" />

      <CameraRig />
      <Board3D />
      <CenterCity3D />
      <TokensAndBuildings />
      <Dice3D />

      <EffectComposer multisampling={0}>
        <N8AO aoRadius={0.72} distanceFalloff={1.12} intensity={0.95} halfRes />
        <Bloom luminanceThreshold={0.78} luminanceSmoothing={0.2} intensity={0.42} mipmapBlur />
      </EffectComposer>
    </Canvas>
  </div>
);

export default Scene3D;
