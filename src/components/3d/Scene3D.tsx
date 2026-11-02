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
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const controlsRef = useRef<any>(null);

  useFrame(({ camera, clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!controlsRef.current) return;

    if (cameraMode === 'top') {
      camera.position.lerp(new THREE.Vector3(0, 27, 0.01), delta * 3);
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), delta * 4);
    } else if (cameraMode === 'follow') {
      const activePlayer = players[currentPlayerIndex];

      if (!activePlayer) return;

      const tf = getSpaceTransform(activePlayer.position);

      const targetPos = new THREE.Vector3(
        tf.position[0] * 1.45,
        11.5,
        tf.position[2] * 1.45
      );

      camera.position.lerp(targetPos, delta * 2.5);

      controlsRef.current.target.lerp(
        new THREE.Vector3(
          tf.position[0] * 0.5,
          0.5,
          tf.position[2] * 0.5
        ),
        delta * 4
      );
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={10}
      maxDistance={60}
    />
  );
};
