import React, { Suspense,useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { usePresentationEvents } from '../../presentation/PresentationProvider';
import { PresentationEvent, tilePulseEvents } from '../../presentation/effectEvents';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import { getSpaceTransform } from '../../data/boardData';
import { useSceneState } from '../../presentation/SceneStore';
import { tileActorHeight } from '../../presentation/animationMath';

class MoneyLabelBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){console.warn('[Game effects] Optional 3D money labels unavailable; HUD receipts remain active.');}
  render(){return this.state.failed?null:this.props.children;}
}

function Pulse({ event, particles }: { event: PresentationEvent; particles: number }) {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = getSpaceTransform(event.spaceId!).position;
  const playerColor = useSceneState(s => s.players.find(p => p.id === event.playerId)?.color);
  const hovered = useSceneState(s => s.hoveredSpaceId), selected = useSceneState(s => s.selectedSpaceId);
  const color = event.kind === 'money' ? '#eac879' : event.kind === 'mortgage' ? '#b8a0d0' : playerColor ?? '#eac879';
  useFrame(() => {
    if (!root.current || document.hidden) return;
    const t = Math.min(1, (performance.now() - event.createdAt) / 1100);
    root.current.visible = t < 1;
    if (ring.current) {
      ring.current.scale.setScalar(0.6 + t * 0.65);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.65;
    }
    if (stars.current) {
      for (let i = 0; i < particles; i++) {
        const angle = i * Math.PI * 2 / particles + t;
        const radius = 0.35 + t * 0.65;
        dummy.position.set(Math.cos(angle) * radius, Math.sin(t * Math.PI) * (0.5 + (i % 3) * 0.12), Math.sin(angle) * radius);
        dummy.scale.setScalar(0.045 * Math.sin(t * Math.PI));
        dummy.updateMatrix(); stars.current.setMatrixAt(i, dummy.matrix);
      }
      stars.current.instanceMatrix.needsUpdate = true;
    }
  });
  return <group ref={root} position={[position[0], tileActorHeight(event.spaceId!, hovered, selected) + .045, position[2]]} name={`effect-${event.kind}-${event.spaceId}`}>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[0.7, 0.74, 32]} /><meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
    </mesh>
    {particles > 0 && <instancedMesh ref={stars} args={[undefined, undefined, particles]} raycast={() => {}}>
      <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color={color} />
    </instancedMesh>}
  </group>;
}

function MoneyLabel({ event, reduced }: { event: PresentationEvent; reduced: boolean }) {
  const root = useRef<THREE.Group>(null);
  const text = useRef<any>(null);
  const position = getSpaceTransform(event.spaceId!).position;
  useFrame(() => {
    if (!root.current || document.hidden) return;
    const t = Math.min(1, (performance.now() - event.createdAt) / 1200);
    root.current.position.y = 1.3 + (reduced ? 0 : t * 0.8);
    if (text.current) text.current.fillOpacity = reduced ? 1 : Math.min(1, (1 - t) * 4);
  });
  const amount = event.amount!;
  const offset = (event.playerId ?? 0) * Math.PI / 2;
  return <group ref={root} position={[position[0] + Math.cos(offset) * 0.35, 1.3, position[2] + Math.sin(offset) * 0.35]} name={`effect-money-${event.playerId}`}>
    <Billboard><Text ref={text} fontSize={0.36} color={amount > 0 ? '#9df0b4' : '#ffb0bc'} outlineWidth={0.025}
      outlineColor="#24132f" anchorX="center" anchorY="middle" raycast={() => {}}>
      {`${amount > 0 ? '+' : '−'}$${Math.abs(amount).toLocaleString('en-US')}`}
    </Text></Billboard>
  </group>;
}

export function GameplayEffects({ quality }: { quality: string }) {
  const events = usePresentationEvents();
  const { reducedMotion, visible } = useMotionPreferences();
  if (!visible) return null;
  const pulses = tilePulseEvents(events);
  return <group name="presentation-effects">
    {!reducedMotion && pulses.map(event => <Pulse key={event.id} event={event} particles={quality === 'low' ? 0 : quality === 'high' ? 12 : 8} />)}
    <MoneyLabelBoundary><Suspense fallback={null}>
      {events.filter(e => e.kind === 'money' && e.spaceId !== undefined).slice(-4).map(event => <MoneyLabel key={event.id} event={event} reduced={reducedMotion} />)}
    </Suspense></MoneyLabelBoundary>
  </group>;
}
