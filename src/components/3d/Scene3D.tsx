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
import { GraphicsAudit, graphicsAuditEnabled } from './GraphicsAudit';
import { useGameStore } from '../../store/useGameStore';

type GraphicsQuality = 'low' | 'balanced' | 'high';

export const Scene3D: React.FC<{ quality?: GraphicsQuality }> = ({ quality = 'balanced' }) => {
  const reducedMotion = useReducedMotion();
  const selected = useGameStore(s => s.selectedSpaceId);
  const [request, setRequest] = useState<{ preset: CameraPreset; sequence: number }>({ preset: 'overview', sequence: 0 });
  const focus = (preset: CameraPreset) => setRequest(previous => ({ preset, sequence: previous.sequence + 1 }));
  return <div className="relative h-full w-full">
    <Canvas camera={{ position: [0, 29, 27], fov: 40, near: 0.5, far: 400 }}
      shadows={quality === 'low' ? false : 'soft'}
      dpr={quality === 'low' ? [0.75, 0.9] : quality === 'high' ? [1, 1.25] : [0.85, 1]}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      gl={{ antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#35244f']} />
      <fog attach="fog" args={['#79668d', 48, 150]} />
      <FantasySkyBackground quality={quality} />
      <ambientLight intensity={0.18} color="#f2ecdf" />
      <hemisphereLight args={['#dce6fa', '#716556', 0.55]} />
      <directionalLight position={[-12, 28, 16]} intensity={2.6} color="#fff0d9"
        castShadow={quality !== 'low'} shadow-mapSize-width={quality === 'high' ? 2048 : 1024}
        shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
        shadow-bias={-0.00012} shadow-normalBias={0.018}>
        <orthographicCamera attach="shadow-camera" args={[-18, 18, 18, -18, 8, 62]} />
      </directionalLight>
      {/* The key sun owns all directional shadows; sky fill stays restrained. */}
      <directionalLight position={[10, 14, -16]} intensity={0.45} color="#d8e5ff" />
      {!reducedMotion && quality !== 'low' && <Sparkles count={quality === 'high' ? 48 : 24}
        position={[0, 2.4, -0.5]} scale={[13, 4, 12]} size={2.2} speed={0.16}
        opacity={0.45} color="#ffe0a1" raycast={() => {}} />}
      <CinematicCamera request={request} reducedMotion={reducedMotion} />
      <Board3D />
      <CenterCity3D />
      <TokensAndBuildings quality={quality} />
      <Dice3D quality={quality} />
      <GameplayEffects quality={quality} />
      {graphicsAuditEnabled() && <GraphicsAudit quality={quality} />}
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
