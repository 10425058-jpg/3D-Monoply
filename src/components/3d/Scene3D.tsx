import React from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Board3D } from './Board3D';
import { CenterCity3D } from './CenterCity3D';
import { TokensAndBuildings } from './TokensAndBuildings';
import { Dice3D } from './Dice3D';
import { GameplayEffects } from './GameplayEffects';
import { PlayerIslands3D } from './PlayerIslands3D';
import { FantasySkyBackground } from './FantasySkyBackground';
import { CinematicCamera } from './CinematicCamera';
import { GraphicsAudit, graphicsAuditEnabled } from './GraphicsAudit';
import { BoardShadowLight } from './BoardShadowLight';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';

type GraphicsQuality = 'low' | 'balanced' | 'high';

// The opening camera settles once; players control rotation and zoom directly.
const INITIAL_CAMERA_REQUEST = { preset: 'overview' as const, sequence: 0 };

export const Scene3D = React.memo<{ quality?: GraphicsQuality; propertyPanel?: boolean }>(({ quality = 'balanced', propertyPanel = false }) => {
  const { reducedMotion } = useMotionPreferences();
  const root = React.useRef<RootState | null>(null);
  const [visible, setVisible] = React.useState(() => !document.hidden);

  React.useEffect(() => {
    const sync = () => {
      const next = !document.hidden;
      const state = root.current?.get();
      const frameloop = next ? 'always' : 'never';
      if (state && state.frameloop !== frameloop) {
        const { clock } = state;
        const { startTime, oldTime, elapsedTime } = clock;
        state.setFrameloop(frameloop);
        // Fiber resets the clock when changing loop modes. Preserve the elapsed
        // time for sparkles and the legacy city animations after the tab resumes.
        Object.assign(clock, { startTime, oldTime, elapsedTime });
      }
      setVisible(next);
    };
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return <div className="relative h-full w-full">
    <Canvas camera={{ position: [0, 29, 27], fov: 40, near: 0.5, far: 400 }}
      shadows={quality === 'low' ? false : 'soft'}
      frameloop={visible ? 'always' : 'never'}
      dpr={quality === 'low' ? [0.75, 0.9] : quality === 'high' ? [1, 1.25] : [0.85, 1]}
      onCreated={state => {
        root.current = state;
        const { gl } = state;
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
      <BoardShadowLight enabled={quality !== 'low'} size={quality === 'high' ? 2048 : 1024} />
      {/* The key sun owns all directional shadows; sky fill stays restrained. */}
      <directionalLight position={[10, 14, -16]} intensity={0.45} color="#d8e5ff" />
      {!reducedMotion && quality !== 'low' && <Sparkles count={quality === 'high' ? 48 : 24}
        position={[0, 2.4, -0.5]} scale={[13, 4, 12]} size={2.2} speed={0.16}
        opacity={0.45} color="#ffe0a1" raycast={() => {}} />}
      <CinematicCamera request={INITIAL_CAMERA_REQUEST} reducedMotion={reducedMotion} propertyPanel={propertyPanel} />
      <Board3D />
      <CenterCity3D quality={quality} />
      <TokensAndBuildings quality={quality} />
      <Dice3D quality={quality} />
      <GameplayEffects quality={quality} />
      <PlayerIslands3D reducedMotion={reducedMotion} quality={quality} />
      {graphicsAuditEnabled() && <GraphicsAudit quality={quality} />}
    </Canvas>
  </div>;
});

export default Scene3D;
