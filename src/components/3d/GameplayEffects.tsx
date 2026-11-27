import React, { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { usePresentationEvents } from '../../presentation/PresentationProvider';
import { PresentationEvent, tilePulseEvents } from '../../presentation/effectEvents';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import { getSpaceTransform } from '../../data/boardData';
import { useSceneStore } from '../../presentation/SceneStore';
import { smoothStep, tileActorHeight } from '../../presentation/animationMath';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { islandSeat } from './islandMoneyMotion';
import { islandPosition, PLAYER_ISLANDS, STATUE_PLINTH_TOP } from './playerIslandLayout';

const NO_RAYCAST = () => {};
const CUE_CAPACITY = 40;
const isSalary = (event: PresentationEvent) => event.cash?.category === 'salary';
const cueDuration = (event: PresentationEvent) => event.kind === 'jail' ? 1150 : isSalary(event) ? 1000 : 850;
const cueColor = (event: PresentationEvent) => event.kind === 'jail' ? '#ceaffa' :
  event.kind === 'mortgage' ? '#aca0cc' : event.cash?.category === 'rent' ? '#ffb27d' :
  event.kind === 'shutdown' && event.damaged ? '#eb805e' : '#ffd271';

function cueAnchor(event: PresentationEvent) {
  if (event.kind === 'shutdown') {
    const seat = islandSeat(event.playerId ?? null);
    if (seat === null) return;
    const [x, y, z] = islandPosition(PLAYER_ISLANDS[seat]);
    return { position: [x, y + STATUE_PLINTH_TOP + .035, z] as const, tile: undefined, rotationY: 0 };
  }
  if (event.spaceId === undefined) return;
  const tile = getSpaceTransform(event.spaceId);
  return { position: tile.position, tile, rotationY: tile.rotationY };
}

class MoneyLabelBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){console.warn('[Game effects] Optional 3D money labels unavailable; HUD receipts remain active.');}
  render(){return this.state.failed?null:this.props.children;}
}

function Pulse({ event, reduced }: { event: PresentationEvent; reduced: boolean }) {
  const store = useSceneStore();
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const tileWash = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);
  const lock = useRef<THREE.Group>(null);
  const anchor = cueAnchor(event)!;
  const owner = store.getState().players.find(player => player.id === event.playerId);
  const width = anchor.tile?.width ?? 2.45;
  const depth = anchor.tile?.depth ?? 2.45;
  const framed = !!anchor.tile;
  const color = cueColor(event);
  const purchase = event.kind === 'ownership';
  const ground = purchase ? owner?.color : isSalary(event) ? color : undefined;
  useFrame(() => {
    if (!root.current) return;
    const t = (performance.now() - event.createdAt) / cueDuration(event);
    root.current.visible = t < 1;
    if (t >= 1) return;
    const state = store.getState();
    if (event.spaceId !== undefined) {
      root.current.position.y = tileActorHeight(event.spaceId, state.hoveredSpaceId, state.selectedSpaceId) + .028;
    }
    const swell = reduced ? 1 : .82 + smoothStep(t * 1.6) * .21;
    const opacity = reduced ? .65 : Math.min(1, .48 + t * 5) * (1 - smoothStep((t - .22) / .78));
    if (ring.current) {
      ring.current.scale.set(width * .66 * swell, depth * .66 * swell, 1);
      ring.current.material.opacity = .85 * opacity;
    }
    if (tileWash.current) tileWash.current.material.opacity = .23 * opacity;
    if (lock.current) {
      lock.current.position.y = reduced ? .85 : .85 + .48 * (1 - smoothStep(t * 4.8));
      lock.current.scale.setScalar(reduced ? 1 : .84 + .16 * smoothStep(t * 6));
      lock.current.visible = t < .82;
    }
  });
  return <group ref={root} position={[...anchor.position]} rotation-y={anchor.rotationY}
    name={`effect-${event.kind}-${event.spaceId ?? event.playerId}`}>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
      <ringGeometry args={[.91, 1, framed ? 4 : 32, 1, framed ? Math.PI / 4 : 0]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
    {ground && <mesh ref={tileWash} position-y={-.006} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
      <planeGeometry args={[width * .88, depth * .88]} />
      <meshBasicMaterial color={ground} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>}
    {event.kind === 'jail' && <group ref={lock} name="jail-lock" position-y={1.1}>
      <Billboard>
        <mesh position-y={.092} raycast={NO_RAYCAST}>
          <ringGeometry args={[.11, .16, 20, 1, 0, Math.PI]} /><meshBasicMaterial color="#d6c6ff" toneMapped={false} />
        </mesh>
        <mesh raycast={NO_RAYCAST}>
          <planeGeometry args={[.38, .25]} /><meshBasicMaterial color="#e7d5ff" toneMapped={false} />
        </mesh>
        <mesh position-z={.006} raycast={NO_RAYCAST}>
          <circleGeometry args={[.046, 12]} /><meshBasicMaterial color="#432756" toneMapped={false} />
        </mesh>
      </Billboard>
    </group>}
  </group>;
}

function CueSparks({ events, quality }: { events: PresentationEvent[]; quality: string }) {
  const store = useSceneStore();
  const sparks = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const emitters = useMemo(() => events.flatMap(event => {
    const anchor = cueAnchor(event);
    if (!anchor || event.kind === 'mortgage' || event.cash?.category === 'rent') return [];
    return [{ event, anchor, color: new THREE.Color(cueColor(event)) }];
  }), [events]);
  useLayoutEffect(() => {
    const mesh = sparks.current!;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(CUE_CAPACITY - 1, color);
    mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    return () => releaseInstanceBuffers(mesh);
  }, [color]);
  useFrame(() => {
    const mesh = sparks.current;
    if (!mesh || (!emitters.length && !mesh.visible)) return;
    const now = performance.now();
    const { hoveredSpaceId, selectedSpaceId } = store.getState();
    mesh.count = 0;
    for (const { event, anchor, color: tint } of emitters) {
      const t = (now - event.createdAt) / cueDuration(event);
      if (t < 0 || t >= 1) continue;
      const y = event.spaceId === undefined ? anchor.position[1] : tileActorHeight(event.spaceId, hoveredSpaceId, selectedSpaceId);
      const count = quality === 'high' ? 10 : 7;
      const sweep = Math.sin(t * Math.PI);
      const scatter = event.kind === 'shutdown' && event.damaged ? 1.45 : 1;
      for (let index = 0; index < count; index++) {
        const angle = index * Math.PI * 2 / count + t * .8;
        const radius = (.35 + t * .84) * scatter;
        transform.position.set(anchor.position[0] + Math.cos(angle) * radius,
          y + .06 + sweep * (.65 + index % 3 * .17), anchor.position[2] + Math.sin(angle) * radius);
        transform.rotation.set(t + index, angle, 0);
        transform.scale.setScalar((.058 + index % 3 * .018) * sweep);
        transform.updateMatrix();
        mesh.setMatrixAt(mesh.count, transform.matrix);
        mesh.setColorAt(mesh.count++, color.copy(tint).multiplyScalar(.5 + sweep * .5));
      }
    }
    mesh.visible = mesh.count > 0;
    if (mesh.visible) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
  });
  return <instancedMesh ref={sparks} name="board-cue-sparks" args={[undefined, undefined, CUE_CAPACITY]}
    visible={false} frustumCulled={false} raycast={NO_RAYCAST}>
    <octahedronGeometry args={[1, 0]} /><meshBasicMaterial toneMapped={false} />
  </instancedMesh>;
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
  const pulses = useMemo(() => [...tilePulseEvents(events),
    ...events.filter(event => event.kind === 'shutdown' && cueAnchor(event))].slice(-4), [events]);
  if (!visible) return null;
  return <group name="presentation-effects">
    {pulses.map(event => <Pulse key={event.id} event={event} reduced={reducedMotion} />)}
    {!reducedMotion && quality !== 'low' && <CueSparks events={pulses} quality={quality} />}
    <MoneyLabelBoundary><Suspense fallback={null}>
      {events.filter(e => e.kind === 'money' && e.spaceId !== undefined && islandSeat(e.playerId ?? null) === null)
        .slice(-4).map(event => <MoneyLabel key={event.id} event={event} reduced={reducedMotion} />)}
    </Suspense></MoneyLabelBoundary>
  </group>;
}
