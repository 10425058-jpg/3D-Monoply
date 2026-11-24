import { useMemo, useRef } from 'react';
import { DynamicDrawUsage, type InstancedMesh } from 'three';
import { releaseInstanceBuffers } from '../environment/instanceResources';
import { COIN_VALUES, type CoinValue } from './royalCoinValues';
import type { makeRoyalCoins } from './royalCoinMeshes';

export function useCoinInstances() {
  const meshes = useRef(new Map<CoinValue, InstancedMesh>());
  const attach = useMemo(() => COIN_VALUES.map(value => (mesh: InstancedMesh | null) => {
    if (mesh) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      meshes.current.set(value, mesh);
    } else {
      const previous = meshes.current.get(value);
      if (previous) releaseInstanceBuffers(previous);
      meshes.current.delete(value);
    }
  }), []);
  return { meshes, attach };
}

export function RoyalCoinInstances({ coins, pool, capacity, prefix, moving = false }: {
  coins: ReturnType<typeof makeRoyalCoins>; pool: ReturnType<typeof useCoinInstances>;
  capacity: number; prefix: string; moving?: boolean;
}) {
  return <group dispose={null}>
    {COIN_VALUES.map((value, index) => <instancedMesh key={value} name={`${prefix}-${value}`} ref={pool.attach[index]}
      args={[coins.geometries.get(value), coins.material, capacity]} frustumCulled={!moving} visible={false} raycast={() => {}} />)}
  </group>;
}
