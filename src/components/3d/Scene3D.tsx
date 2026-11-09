import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Board3D } from './Board3D';
import { CenterCity3D } from './CenterCity3D';
import { TokensAndBuildings } from './TokensAndBuildings';
import { Dice3D } from './Dice3D';
import { GameplayEffects } from './GameplayEffects';
import { FantasySkyBackground } from './FantasySkyBackground';
import { CAMERA_PRESETS, CameraPreset, CinematicCamera, useReducedMotion } from './CinematicCamera';
import { useGameStore } from '../../store/useGameStore';

type GraphicsQuality = 'low' | 'balanced' | 'high';

export const Scene3D: React.FC<{ quality?: GraphicsQuality }> = ({ quality = 'balanced' }) => {
  const reducedMotion = useReducedMotion();
  const selected = useGameStore(s => s.selectedSpaceId);
  const [request, setRequest] = useState<{ preset: CameraPreset; sequence: number }>({ preset: 'overview', sequence: 0 });
  const focus = (preset: CameraPreset) => setRequest(previous => ({ preset, sequence: previous.sequence + 1 }));
  return <div className="relative h-full w-full">
    <Canvas camera={{ position: [0, 29, 27], fov: 40, near: 0.5, far: 300 }}
      shadows={quality === 'low' ? false : 'soft'}
      dpr={quality === 'low' ? [0.75, 0.9] : quality === 'high' ? [1, 1.25] : [0.85, 1]}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
      gl={{ antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#35244f']} />
      <fog attach="fog" args={['#79668d', 48, 150]} />
      <FantasySkyBackground quality={quality} />
      <ambientLight intensity={0.32} color="#f3e9ff" />
      <hemisphereLight args={['#ddd9ff', '#716450', 0.65]} />
      <directionalLight position={[-12, 24, 14]} intensity={2.25} color="#ffe4ba"
        castShadow={quality !== 'low'} shadow-mapSize-width={quality === 'high' ? 2048 : 1024}
        shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
        shadow-bias={-0.00015} shadow-normalBias={0.035} shadow-radius={3}>
        <orthographicCamera attach="shadow-camera" args={[-18, 18, 18, -18, 1, 65]} />
      </directionalLight>
      <directionalLight position={[10, 12, -18]} intensity={1.25} color="#d5bdff" />
      <directionalLight position={[2, 10, 20]} intensity={0.65} color="#d9eaff" />
      {quality !== 'low' && <>
        <pointLight position={[0, 3, 0]} color="#ffc76c" intensity={9} distance={9} decay={2} />
        <pointLight position={[0, 1.5, 3]} color="#8de4ed" intensity={3} distance={5} decay={2} />
      </>}
      {!reducedMotion && quality !== 'low' && <Sparkles count={quality === 'high' ? 48 : 24}
        position={[0, 2.4, -0.5]} scale={[13, 4, 12]} size={2.2} speed={0.16}
        opacity={0.45} color="#ffe0a1" raycast={() => {}} />}
      <CinematicCamera request={request} reducedMotion={reducedMotion} />
      <Board3D />
      <CenterCity3D />
      <TokensAndBuildings quality={quality} />
      <Dice3D quality={quality} />
      <GameplayEffects quality={quality} />
    </Canvas>
    <nav className="camera-toolbar" aria-label="Board camera">
      <label><span className="sr-only">Camera view</span><select aria-label="Camera view"
        value={request.preset} onChange={event => focus(event.target.value as CameraPreset)}>
        {Object.entries(CAMERA_PRESETS).map(([value, label]) => <option key={value} value={value}
          disabled={value === 'property' && selected === null}>{label}</option>)}
      </select></label>
      <button type="button" onClick={() => focus('overview')}>Reset view</button>
    </nav>
  </div>;
};

export default Scene3D;
