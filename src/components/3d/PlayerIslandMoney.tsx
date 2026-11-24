import { useCallback, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneState } from '../../presentation/SceneStore';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { IslandPlaque, formatIslandMoney } from './IslandPlaque';
import { coinFlightPath, COIN_STAGGER_MS, MAX_FLIGHT_COINS, MAX_ISLAND_TRANSFERS, type IslandFlight } from './islandMoneyMotion';
import { ISLAND_SCALE, PLAYER_ISLANDS, STATUE_PLINTH_TOP, islandPosition } from './playerIslandLayout';
import { RoyalCoinInstances, useCoinInstances } from './RoyalCoinInstances';
import type { makeRoyalCoins } from './royalCoinMeshes';

const capacity = MAX_ISLAND_TRANSFERS * MAX_FLIGHT_COINS;
const trailArgs: [undefined, undefined, number] = [undefined, undefined, capacity];
type Signal = { playerId: number; amount: number; from: number; emphasisAt: number; until: number };

function MoneySignal({ cue, reduced, paired }: { cue: Signal; reduced: boolean; paired: boolean }) {
  const label = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null);
  const color = useSceneState(state => state.players.find(player => player.id === cue.playerId)?.color ?? '#f5cb69');
  const gain = cue.amount > 0;
  const magnitude = Math.min(1, Math.log10(Math.abs(cue.amount) + 1) / 3);
  const restY = paired ? 1.11 : 1.23;
  const labelX = paired ? (gain ? 1.36 : -1.36) : 0;
  const labelDepth = paired ? 1.17 : 1.09;
  const text = `${gain ? '+' : '−'}${formatIslandMoney(Math.abs(cue.amount))}`;
  useFrame(() => {
    const now = performance.now();
    const t = THREE.MathUtils.clamp((now - cue.from) / (cue.until - cue.from), 0, 1);
    if (label.current) {
      label.current.visible = now >= cue.from;
      if (!reduced) label.current.position.y = restY + .51 * (1 - (1 - t) ** 3);
    }
    if (!ring.current) return;
    const wave = THREE.MathUtils.clamp((now - cue.emphasisAt) / (gain ? 630 : 370), 0, 1);
    ring.current.scale.setScalar(ISLAND_SCALE * (1.04 + wave * (gain ? .30 : .17)));
    ring.current.material.opacity = (gain ? .47 : .25) * (.5 + magnitude * .5) * (reduced ? .44 : 4 * wave * (1 - wave));
  });
  return <group position={islandPosition(PLAYER_ISLANDS[cue.playerId])} name="island-money-signal"
    userData={{ seat: cue.playerId, amount: cue.amount, label: text }}>
    <group ref={label} position={[labelX, restY, labelDepth * ISLAND_SCALE]} visible={false}>
      <IslandPlaque title={text} accent={gain ? color : undefined} tone={gain ? 'gain' : 'loss'}
        size={[paired ? 2.03 + magnitude * .18 : 2.62 + magnitude * .31, paired ? .83 : .93]} />
    </group>
    <mesh ref={ring} position={[0, STATUE_PLINTH_TOP + .019, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[1.01, 1.13, 32]} />
      <meshBasicMaterial color={gain ? color : '#ff9c79'} transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>;
}

function CoinFlights({ flights, coins, low }: { flights: IslandFlight[]; coins: ReturnType<typeof makeRoyalCoins>; low: boolean }) {
  const pool = useCoinInstances();
  const trails = useRef<THREE.InstancedMesh | null>(null);
  const wasActive = useRef(false);
  const setTrails = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (trails.current && !mesh) releaseInstanceBuffers(trails.current);
    trails.current = mesh;
    if (mesh) { mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  }, []);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const vectors = useMemo(() => ({ point: new THREE.Vector3(), tail: new THREE.Vector3(), direction: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const active = useMemo(() => flights.flatMap(flight => flight.pieces.map((value, index) => ({
    value, index, starts: flight.startedAt + index * COIN_STAGGER_MS, duration: flight.duration,
    path: coinFlightPath(flight.fromId, flight.toId, value, index + (flight.id % 3) * .5),
  }))), [flights]);

  useFrame(({ camera }) => {
    const meshes = pool.meshes.current;
    const streaks = trails.current;
    if (!active.length && !wasActive.current) return;
    wasActive.current = active.length > 0;
    for (const mesh of meshes.values()) mesh.count = 0;
    if (streaks) streaks.count = 0;
    const now = performance.now();
    for (const item of active) {
      const t = (now - item.starts) / item.duration;
      if (t <= 0 || t >= 1) continue;
      const { point, tail, up, direction } = vectors;
      item.path(t, point);
      if (point.distanceToSquared(camera.position) > 163 ** 2) continue;
      const mesh = meshes.get(item.value);
      if (!mesh) continue;
      const reveal = Math.min(1, t * 13, (1 - t) * 12);
      transform.position.copy(point);
      transform.rotation.set(.85 + 8.6 * t + .61 * item.index, t * 9 + .8 * item.index, .32 + .22 * Math.sin(t * Math.PI));
      transform.scale.setScalar((item.value >= 500 ? .43 : item.value >= 20 ? .37 : .31) * reveal);
      transform.updateMatrix();
      mesh.setMatrixAt(mesh.count++, transform.matrix);
      if (!streaks || t < .045) continue;
      item.path(t - .036, tail);
      direction.subVectors(point, tail);
      const length = direction.length();
      if (length < .04) continue;
      transform.quaternion.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
      transform.position.copy(point).addScaledVector(direction, -length / 2);
      transform.scale.set(reveal, length, reveal);
      transform.updateMatrix();
      streaks.setMatrixAt(streaks.count++, transform.matrix);
    }
    for (const mesh of meshes.values()) {
      mesh.visible = mesh.count > 0;
      if (mesh.visible) mesh.instanceMatrix.needsUpdate = true;
    }
    if (streaks) {
      streaks.visible = streaks.count > 0;
      if (streaks.visible) streaks.instanceMatrix.needsUpdate = true;
    }
  });

  return <group name="island-coin-flights" userData={{ routes: flights.map(({ fromId, toId, amount, pieces, arrivesAt }) =>
    ({ fromId, toId, amount, pieces, arrivesAt })) }}>
    <RoyalCoinInstances pool={pool} coins={coins} capacity={capacity} prefix="island-flying-coin" moving />
    {!low && <instancedMesh ref={setTrails} name="island-coin-streaks" args={trailArgs} frustumCulled={false} visible={false} raycast={() => {}}>
      <cylinderGeometry args={[.039, .004, 1, 5, 1, true]} />
      <meshBasicMaterial color="#ffd887" transparent opacity={.35} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>}
  </group>;
}

export function PlayerIslandMoney({ coins, flights, reduced, low }: {
  coins: ReturnType<typeof makeRoyalCoins>; flights: IslandFlight[]; reduced: boolean; low: boolean;
}) {
  const signals = useMemo(() => {
    const combined = new Map<string, Signal>();
    for (const flight of flights) for (const [playerId, sign, when] of [
      [flight.fromId, -1, flight.startedAt], [flight.toId, 1, flight.arrivesAt],
    ] as const) {
      if (playerId === null) continue;
      const key = `${playerId}-${sign}`;
      const before = combined.get(key);
      combined.set(key, { playerId, amount: (before?.amount ?? 0) + sign * flight.amount,
        from: before?.from ?? flight.startedAt, emphasisAt: Math.max(before?.emphasisAt ?? 0, when), until: Math.max(before?.until ?? 0, flight.expiresAt) });
    }
    return [...combined.entries()];
  }, [flights]);
  return <group name="player-island-money" userData={{ transactions: flights.map(({ id, fromId, toId, amount, pieces }) => ({ id, fromId, toId, amount, pieces })) }}>
    {signals.map(([key, cue]) => <MoneySignal key={key} cue={cue} reduced={reduced}
      paired={signals.some(([, other]) => other !== cue && other.playerId === cue.playerId)} />)}
    {!reduced && <CoinFlights flights={flights} coins={coins} low={low} />}
  </group>;
}
