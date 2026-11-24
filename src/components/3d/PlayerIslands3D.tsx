import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneState } from '../../presentation/SceneStore';
import { EnvironmentAssetBoundary } from '../environment/EnvironmentAssetBoundary';
import { IslandPlaque } from './IslandPlaque';
import { formatIslandMoney, PlayerIslandMoney } from './PlayerIslandMoney';
import { makeIslandChain, makePlayerIsland } from './playerIslandGeometry';
import { ISLAND_SCALE, islandPosition, PLAYER_ISLANDS, STATUE_PLINTH_TOP, type PlayerIslandSite } from './playerIslandLayout';
import { makeDisplayedCoins, makeRoyalCoins } from './royalCoinMeshes';
import { COIN_VALUES } from './royalCoinValues';

const noRaycast = () => {};

function StatueSculpture({ url, name }: { url: string; name: string }) {
  const { scene } = useGLTF(url, false, false);
  const sculpture = useMemo(() => {
    const copy = scene.clone();
    copy.traverse(object => {
      if (object instanceof THREE.Mesh) object.raycast = noRaycast;
    });
    return copy;
  }, [scene]);
  return <primitive name={name} object={sculpture} dispose={null} />;
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

function BalancePlaque({ seat }: { seat: number }) {
  const player = useSceneState(state => state.players.find(candidate => candidate.id === seat));
  const title = player ? formatIslandMoney(player.money) : 'Open seat';
  return <group name="player-island-balance" userData={{ player: player?.name, balance: player?.money }}>
    <IslandPlaque title={title} detail={player?.name} accent={player?.color}
      position={[0, .49, 2.05 * ISLAND_SCALE]} size={[3.4, 1.21]} />
  </group>;
}

export function PlayerIslands3D({ reducedMotion, quality }: { reducedMotion: boolean; quality: string }) {
  const resources = useMemo(() => {
    const islands = PLAYER_ISLANDS.map(site => makePlayerIsland(site.seat));
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .47, roughness: .33, side: THREE.DoubleSide });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    const chain = makeIslandChain();
    const coins = makeRoyalCoins();
    const display = makeDisplayedCoins(coins.geometries);
    return { islands, paint, metal, glow, chain, coins, display };
  }, []);
  useEffect(() => () => {
    const { islands, paint, metal, glow, chain, coins, display } = resources;
    islands.forEach(island => Object.values(island).forEach(geometry => geometry.dispose()));
    [paint, metal, glow, chain, display].forEach(resource => resource.dispose());
    coins.dispose();
  }, [resources]);

  return <group name="player-islands">
    {PLAYER_ISLANDS.map(site => {
      const [x, z] = site.direction;
      const meshes = resources.islands[site.seat];
      return <group key={site.seat} name={`player-island-${site.edge}`} userData={{ seat: site.seat, edge: site.edge, statue: site.statue }}
        position={islandPosition(site)}>
        <group scale={[ISLAND_SCALE, 1, ISLAND_SCALE]}>
          <mesh name="player-island-landscape" geometry={meshes.painted} material={resources.paint} raycast={noRaycast} dispose={null} />
          <mesh geometry={meshes.metal} material={resources.metal} raycast={noRaycast} dispose={null} />
          <mesh geometry={meshes.light} material={resources.glow} raycast={noRaycast} dispose={null} />
          <mesh name="player-island-coins" userData={{ denominations: COIN_VALUES }}
            geometry={resources.display} material={resources.coins.material} raycast={noRaycast} dispose={null} />
        </group>
        <mesh name="player-island-chain" geometry={resources.chain} material={resources.metal}
          rotation-y={Math.atan2(x, z)} raycast={noRaycast} dispose={null} />
        <IslandStatue {...site} />
        <BalancePlaque seat={site.seat} />
      </group>;
    })}
    <PlayerIslandMoney coins={resources.coins} reducedMotion={reducedMotion} low={quality === 'low'} />
  </group>;
}
