import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

import { Board3D } from './Board3D';
import { CenterCity3D } from './CenterCity3D';
import { TokensAndBuildings } from './TokensAndBuildings';
import { Dice3D } from './Dice3D';

import { useGameStore } from '../../store/useGameStore';
import { getSpaceTransform } from '../../data/boardData';

const CameraRig: React.FC = () => {
  const cameraMode = useGameStore((s) => s.cameraMode);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const controlsRef = useRef<any>(null);

  useFrame(({ camera }, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;

    if (cameraMode === 'top') {
      camera.position.lerp(new THREE.Vector3(0, 27, 0.01), 1 - Math.exp(-3 * delta));
      controls.target.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-4 * delta));
    } else if (cameraMode === 'follow') {
      const activePlayer = players[currentPlayerIndex];
      if (!activePlayer) return;

      const transform = getSpaceTransform(activePlayer.position);
      const targetPosition = new THREE.Vector3(
        transform.position[0] * 1.45,
        11.5,
        transform.position[2] * 1.45
      );

      camera.position.lerp(targetPosition, 1 - Math.exp(-2.5 * delta));
      controls.target.lerp(
        new THREE.Vector3(
          transform.position[0] * 0.5,
          0.5,
          transform.position[2] * 0.5
        ),
        1 - Math.exp(-4 * delta)
      );
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
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#10182b']} />
      <fog attach="fog" args={['#10182b', 34, 86]} />

      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#a8ceef', '#302235', 0.82]} />
      <directionalLight
        position={[-13, 24, 14]}
        intensity={1.55}
        color="#d7e7ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <directionalLight position={[10, 12, -12]} intensity={0.72} color="#f2b979" />
      <pointLight position={[0, 11, 0]} intensity={2.2} color="#6b9edb" distance={34} decay={2} />
      <pointLight position={[-5, 7, 4]} intensity={1.2} color="#f1ae72" distance={20} decay={2} />

      <Stars radius={90} depth={45} count={1100} factor={2.6} saturation={0.12} fade speed={0.25} />
      <Sparkles count={95} scale={[17, 5, 17]} size={1.7} speed={0.22} opacity={0.25} color="#86c9f1" />

      <CameraRig />
      <Board3D />
      <CenterCity3D />
      <TokensAndBuildings />
      <Dice3D />
    </Canvas>
  </div>
);

export default Scene3D;
