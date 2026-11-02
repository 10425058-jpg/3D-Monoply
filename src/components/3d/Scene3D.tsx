
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
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
  const currentPlayerIndex = useGameStore(
    (s) => s.currentPlayerIndex
  );

  const controlsRef = useRef<any>(null);

  useFrame(({ camera }, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;

    if (cameraMode === 'top') {
      camera.position.lerp(
        new THREE.Vector3(0, 27, 0.01),
        1 - Math.exp(-3 * delta)
      );

      controls.target.lerp(
        new THREE.Vector3(0, 0, 0),
        1 - Math.exp(-4 * delta)
      );
    } 
    
    else if (cameraMode === 'follow') {
      const activePlayer = players[currentPlayerIndex];

      if (!activePlayer) return;

      const tf = getSpaceTransform(activePlayer.position);

      const targetPos = new THREE.Vector3(
        tf.position[0] * 1.45,
        11.5,
        tf.position[2] * 1.45
      );

      camera.position.lerp(
        targetPos,
        1 - Math.exp(-2.5 * delta)
      );

      controls.target.lerp(
        new THREE.Vector3(
          tf.position[0] * 0.5,
          0.5,
          tf.position[2] * 0.5
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
      maxPolarAngle={Math.PI / 2.1}
      minDistance={10}
      maxDistance={60}
    />
  );
};

export const Scene3D: React.FC = () => {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: [0, 22, 22],
          fov: 45,
          near: 0.1,
          far: 1000
        }}
        shadows
        gl={{
          antialias: true,
          alpha: false
        }}
      >
        <color attach="background" args={['#0b0f19']} />

        <ambientLight intensity={0.7} />

        <directionalLight
          position={[15, 25, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <Sky
          sunPosition={[100, 20, 100]}
          turbidity={0.1}
          rayleigh={0.5}
        />

        <CameraRig />

        <Board3D />
        <CenterCity3D />
        <TokensAndBuildings />
        <Dice3D />
      </Canvas>
    </div>
  );
};

export default Scene3D;
