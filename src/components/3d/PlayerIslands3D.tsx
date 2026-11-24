import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneState } from '../../presentation/SceneStore';
import { EnvironmentAssetBoundary } from '../environment/EnvironmentAssetBoundary';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { formatIslandMoney, IslandPlaque } from './IslandPlaque';
import { IslandTreasury } from './IslandTreasury';
import { PlayerIslandMoney } from './PlayerIslandMoney';
import { makeIslandChain, makePlayerIsland } from './playerIslandGeometry';
import { ISLAND_SCALE, islandPosition, PLAYER_ISLANDS, STATUE_PLINTH_TOP, type PlayerIslandSite } from './playerIslandLayout';
import { makeRoyalCoins } from './royalCoinMeshes';
import { useIslandTreasuryMotion, type TreasuryBalance } from './useIslandTreasuryMotion';

const noRaycast = () => {};
const fallbackColor = '#4564a2';

/** The silhouette floor sample bakes a soft contact decal without a shadow pass for each GLB. */
function statueContact(scene: THREE.Object3D) {
  scene.updateWorldMatrix(true, true);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const broad = ctx.createRadialGradient(64, 64, 7, 64, 64, 45);
  broad.addColorStop(0, '#2720316b'); broad.addColorStop(.58, '#211b3d24'); broad.addColorStop(1, '#211b3d00');
  ctx.fillStyle = broad;
  ctx.save(); ctx.translate(0, 10); ctx.scale(1, .84); ctx.fillRect(0, 0, 128, 128); ctx.restore();
  const grid = new Uint8Array(24 * 24);
  const position = new THREE.Vector3();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const vertices = object.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      position.fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
      if (position.y > .055) continue;
      const x = Math.floor(12 + position.x * 7.65), z = Math.floor(12 + position.z * 7.65);
      if (x >= 0 && x < 24 && z >= 0 && z < 24) grid[z * 24 + x] = 1;
    }
  });
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue;
    const x = ((i % 24 + .5) / 24) * 128, y = ((Math.floor(i / 24) + .5) / 24) * 128;
    const shade = ctx.createRadialGradient(x, y, 0, x, y, 7.4);
    shade.addColorStop(0, '#241c2670'); shade.addColorStop(1, '#241c2600');
    ctx.fillStyle = shade;
    ctx.fillRect(x - 8, y - 8, 16, 16);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'Statue contact occlusion';
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function StatueSculpture({ url, name }: { url: string; name: string }) {
  const { scene } = useGLTF(url, false, false);
  const sculpture = useMemo(() => {
    const copy = scene.clone();
    copy.traverse(object => { if (object instanceof THREE.Mesh) object.raycast = noRaycast; });
    return copy;
  }, [scene]);
  const contact = useMemo(() => statueContact(scene), [scene]);
  useEffect(() => () => { contact.dispose(); }, [contact]);
  return <>
    <mesh name="statue-contact-shadow" position-y={.006} rotation-x={-Math.PI / 2} raycast={noRaycast}>
      <planeGeometry args={[3.14, 3.14]} />
      <meshBasicMaterial map={contact} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
    <primitive name={name} object={sculpture} dispose={null} />
  </>;
}

function IslandStatue({ statue, facing }: PlayerIslandSite) {
  const url = new URL(`assets/models/player-islands/${statue}Statue.glb`, document.baseURI).href;
  const crest = <mesh name="island-statue-loading-crest" position={[0, .66, 0]} raycast={noRaycast}>
    <octahedronGeometry args={[.53, 0]} />
    <meshStandardMaterial color="#c59a50" roughness={.48} metalness={.45} />
  </mesh>;
  return <group name="player-island-statue" position={[0, STATUE_PLINTH_TOP, 0]} rotation-y={facing} scale={ISLAND_SCALE}>
    <EnvironmentAssetBoundary label={`${statue} statue`} fallback={crest}>
      <Suspense fallback={crest}><StatueSculpture name={statue} url={url} /></Suspense>
    </EnvironmentAssetBoundary>
  </group>;
}

type Resources = ReturnType<typeof islandResources>;

function islandResources() {
  const islands = PLAYER_ISLANDS.map(site => makePlayerIsland(site.seat));
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .83, side: THREE.DoubleSide,
    emissive: '#4b4158', emissiveIntensity: .12 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .52, roughness: .33, side: THREE.DoubleSide });
  const chainMetal = new THREE.MeshStandardMaterial({ color: '#e4aa53', metalness: .54, roughness: .29 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  return { islands, paint, metal, chainMetal, glow, chain: makeIslandChain(), coins: makeRoyalCoins() };
}

const IslandChain = memo(function IslandChain({ assets, site, accent }: { assets: Resources; site: PlayerIslandSite; accent: THREE.MeshStandardMaterial }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { chain } = assets;
  const [x, z] = site.direction;
  useLayoutEffect(() => {
    const links = ref.current;
    if (!links) return;
    chain.matrices.forEach((matrix, index) => links.setMatrixAt(index, matrix));
    links.instanceMatrix.needsUpdate = true;
    links.computeBoundingBox(); links.computeBoundingSphere();
    return () => releaseInstanceBuffers(links);
  }, [chain]);
  return <group name="player-island-chain" userData={{ links: chain.matrices.length }} rotation-y={Math.atan2(x, z)} dispose={null}>
    <mesh geometry={chain.mounts} material={assets.metal} raycast={noRaycast} />
    <mesh geometry={chain.jewels} material={accent} raycast={noRaycast} />
    <instancedMesh ref={ref} name="player-island-chain-links" args={[chain.link, assets.chainMetal, chain.matrices.length]} raycast={noRaycast} />
  </group>;
});

const IslandLandmark = memo(function IslandLandmark({ site, assets, balance, flash, reduced }: {
  site: PlayerIslandSite; assets: Resources; balance?: TreasuryBalance; flash?: number; reduced: boolean;
}) {
  const player = useSceneState(scene => scene.players.find(candidate => candidate.id === site.seat));
  const name = player?.name;
  const color = player?.color ?? fallbackColor;
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .39,
    metalness: .18, side: THREE.DoubleSide }), []);
  useLayoutEffect(() => {
    accent.color.set(color).multiplyScalar(.79);
    accent.emissive.set(color);
    accent.emissiveIntensity = .04;
  }, [accent, color]);
  useEffect(() => () => accent.dispose(), [accent]);
  useFrame(() => {
    const age = flash === undefined ? Infinity : performance.now() - flash;
    accent.emissiveIntensity = age >= 0 && age < 580 ? (reduced ? .14 : .48 * Math.sin(Math.PI * age / 580)) + .04 : .04;
  });
  const meshes = assets.islands[site.seat];
  return <group name={`player-island-${site.edge}`} userData={{ seat: site.seat, edge: site.edge, statue: site.statue, color }} position={islandPosition(site)}>
    <group scale={[ISLAND_SCALE, 1, ISLAND_SCALE]}>
      <mesh name="player-island-landscape" geometry={meshes.painted} material={assets.paint} raycast={noRaycast} dispose={null} />
      <mesh geometry={meshes.metal} material={assets.metal} raycast={noRaycast} dispose={null} />
      <mesh geometry={meshes.light} material={assets.glow} raycast={noRaycast} dispose={null} />
      <mesh name="player-island-enamel" geometry={meshes.accent} material={accent} raycast={noRaycast} dispose={null} />
    </group>
    <IslandChain assets={assets} site={site} accent={accent} />
    <IslandStatue {...site} />
    <group name="player-island-balance" userData={{ player: name, balance: player?.money }}>
      <IslandPlaque title={player ? formatIslandMoney(player.money) : 'Open seat'} detail={name} accent={color} balance={balance}
        position={[0, .49, 2.05 * ISLAND_SCALE]} size={[3.4, 1.21]} />
    </group>
  </group>;
});

export function PlayerIslands3D({ reducedMotion, quality }: { reducedMotion: boolean; quality: string }) {
  const low = quality === 'low';
  const { balances, flights } = useIslandTreasuryMotion(reducedMotion, low);
  const assets = useMemo(islandResources, []);
  const flashes = new Map<number, number>();
  for (const flight of flights) if (flight.toId !== null) {
    flashes.set(flight.toId, Math.max(flashes.get(flight.toId) ?? 0, flight.arrivesAt));
  }
  useEffect(() => () => {
    const { islands, paint, metal, chainMetal, glow, chain, coins } = assets;
    islands.forEach(island => Object.values(island).forEach(geometry => geometry.dispose()));
    [paint, metal, chainMetal, glow, chain.mounts, chain.jewels, chain.link].forEach(resource => resource.dispose());
    coins.dispose();
  }, [assets]);

  return <group name="player-islands">
    {PLAYER_ISLANDS.map(site => <IslandLandmark key={site.seat} site={site} assets={assets} reduced={reducedMotion}
      balance={balances.get(site.seat)} flash={flashes.get(site.seat)} />)}
    <IslandTreasury coins={assets.coins} balances={balances} />
    <PlayerIslandMoney coins={assets.coins} flights={flights} reduced={reducedMotion} low={low} />
  </group>;
}
