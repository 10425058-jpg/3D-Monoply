import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../presentation/SceneStore';
import { isGameReset } from '../../presentation/effectEvents';
import { collectIslandMoneyChanges, type IslandMoneyChange } from '../../presentation/islandMoney';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { IslandPlaque } from './IslandPlaque';
import { ISLAND_SCALE, PLAYER_ISLANDS, STATUE_PLINTH_TOP, islandPosition } from './playerIslandLayout';
import { COIN_VALUES, coinPieces, type CoinValue } from './royalCoinValues';
import type { makeRoyalCoins } from './royalCoinMeshes';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const formatIslandMoney = (amount: number) => currency.format(amount);
const duration = 2100;
const maxCoins = 7;
type Cue = IslandMoneyChange & { key: string; at: number };

function useMoneyCues() {
  const store = useSceneStore();
  const [cues, setCues] = useState<Cue[]>([]);
  useEffect(() => {
    let active: Cue[] = [];
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    let scheduled = false;
    const queued = new Map<string, IslandMoneyChange>();
    const publish = () => {
      clearTimeout(timer);
      const now = performance.now();
      active = active.filter(cue => cue.at + duration > now);
      setCues(active);
      if (active.length) timer = setTimeout(publish, Math.max(16, Math.min(...active.map(cue => cue.at + duration)) - now));
    };
    const clear = () => { queued.clear(); active = []; publish(); };
    const hide = () => { if (document.hidden) clear(); };
    const flush = () => {
      scheduled = false;
      if (disposed || document.hidden || !queued.size) return;
      const at = performance.now();
      active = active.filter(cue => !queued.has(cue.key));
      queued.forEach((change, key) => active.push({ ...change, key, at }));
      queued.clear();
      publish();
    };
    const unsubscribe = store.subscribe((next, previous) => {
      if (isGameReset(previous, next)) { clear(); return; }
      if (document.hidden) return;
      for (const change of collectIslandMoneyChanges(previous, next)) {
        if (!PLAYER_ISLANDS.some(site => site.seat === change.playerId)) continue;
        const key = `${change.playerId}-${change.amount > 0 ? 'credit' : 'debit'}`;
        const amount = (queued.get(key)?.amount ?? 0) + change.amount;
        queued.set(key, { ...change, amount });
      }
      if (!scheduled && queued.size) { scheduled = true; queueMicrotask(flush); }
    });
    document.addEventListener('visibilitychange', hide);
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [store]);
  return cues;
}

function MoneySignal({ cue, reducedMotion, paired }: { cue: Cue; reducedMotion: boolean; paired: boolean }) {
  const label = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const credits = cue.amount > 0;
  const magnitude = Math.min(1, Math.log10(Math.abs(cue.amount) + 1) / 3);
  const restY = paired ? (credits ? 1.42 : .8) : 1.16;
  const labelDepth = paired ? (credits ? 1.03 : 2.24) : 1.96;
  useFrame(() => {
    const t = THREE.MathUtils.clamp((performance.now() - cue.at) / duration, 0, 1);
    if (label.current && !reducedMotion) label.current.position.y = restY + .46 * (1 - (1 - t) ** 3);
    if (!ring.current) return;
    const wave = reducedMotion ? .65 : Math.min(1, t * 1.8);
    ring.current.scale.setScalar(ISLAND_SCALE * ((credits ? .86 : 1) + wave * (credits ? .34 : .17)));
    ring.current.material.opacity = (credits ? .47 : .29) * (.48 + magnitude * .52) * (reducedMotion ? .75 : Math.sin(Math.PI * wave));
  });
  const site = PLAYER_ISLANDS[cue.playerId];
  const text = `${credits ? '+' : '−'}${formatIslandMoney(Math.abs(cue.amount))}`;
  return <group position={islandPosition(site)} name="island-money-signal"
    userData={{ seat: cue.playerId, amount: cue.amount, label: text }}>
    <group ref={label} position={[0, restY, labelDepth * ISLAND_SCALE]}>
      <IslandPlaque title={text} tone={credits ? 'gain' : 'loss'} size={[2.42 + magnitude * .31, paired ? .81 : .92]} />
    </group>
    <mesh ref={ring} position={[0, STATUE_PLINTH_TOP + .024, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[1.035, 1.15, 40]} />
      <meshBasicMaterial color={credits ? '#ffd781' : '#fa8e80'} transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>;
}

/** One reusable, denomination-batched pool for all four islands. */
function CoinFlights({ cues, coins, low }: { cues: Cue[]; coins: ReturnType<typeof makeRoyalCoins>; low: boolean }) {
  const meshes = useRef(new Map<CoinValue, THREE.InstancedMesh>());
  const transform = useMemo(() => new THREE.Object3D(), []);
  const attach = useMemo(() => COIN_VALUES.map(value => (mesh: THREE.InstancedMesh | null) => {
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      meshes.current.set(value, mesh);
    } else {
      const previous = meshes.current.get(value);
      if (previous) releaseInstanceBuffers(previous);
      meshes.current.delete(value);
    }
  }), []);
  const flights = useMemo(() => cues.map(cue => ({ ...cue, center: islandPosition(PLAYER_ISLANDS[cue.playerId]),
    pieces: coinPieces(cue.amount, low ? 4 : maxCoins), spread: Math.min(1, Math.log10(Math.abs(cue.amount) + 1) / 3),
  })), [cues, low]);
  useFrame(({ camera }) => {
    for (const mesh of meshes.current.values()) mesh.count = 0;
    if (flights.length) {
      const now = performance.now();
      for (const { center: [x, y, z], at, amount, pieces, spread } of flights) {
        if ((x - camera.position.x) ** 2 + (y - camera.position.y) ** 2 + (z - camera.position.z) ** 2 > 155 ** 2) continue;
        const gain = amount > 0;
        for (let i = 0; i < pieces.length; i++) {
          const t = (now - at - i * 55) / 1100;
          if (t <= 0 || t >= 1) continue;
          const mesh = meshes.current.get(pieces[i]);
          if (!mesh) continue;
          const angle = i * 2.399 + .7;
          const radius = gain ? 1.75 * (1 - t) ** 2 : .38 + (1.23 + .36 * spread) * t;
          const arc = (.7 + spread * .72) * Math.sin(Math.PI * t);
          transform.position.set(x + radius * Math.cos(angle), y + .44 + arc - (gain ? 0 : .5 * t),
            z + radius * Math.sin(angle) + .28);
          transform.rotation.set(.4 + t * 5 + i, angle + t * 6, angle * .4);
          transform.scale.setScalar((pieces[i] >= 500 ? .39 : pieces[i] >= 20 ? .32 : .27) * Math.min(1, t * 8, (1 - t) * 7));
          transform.updateMatrix();
          mesh.setMatrixAt(mesh.count++, transform.matrix);
        }
      }
    }
    for (const mesh of meshes.current.values()) {
      mesh.visible = mesh.count > 0;
      if (mesh.visible) mesh.instanceMatrix.needsUpdate = true;
    }
  });
  return <group name="island-coin-flights" dispose={null}>
    {COIN_VALUES.map((value, index) => <instancedMesh key={value} name={`island-flying-coin-${value}`} ref={attach[index]}
      args={[coins.geometries.get(value), coins.material, 2 * PLAYER_ISLANDS.length * maxCoins]}
      frustumCulled={false} visible={false} raycast={() => {}} />)}
  </group>;
}

export function PlayerIslandMoney({ coins, reducedMotion, low }: {
  coins: ReturnType<typeof makeRoyalCoins>; reducedMotion: boolean; low: boolean;
}) {
  const cues = useMoneyCues();
  return <group name="player-island-money">
    {cues.map(cue => <MoneySignal key={cue.key} cue={cue} reducedMotion={reducedMotion}
      paired={cues.some(other => other !== cue && other.playerId === cue.playerId)} />)}
    {!reducedMotion && <CoinFlights cues={cues} coins={coins} low={low} />}
  </group>;
}
