import { useLayoutEffect, useMemo } from 'react';
import { Object3D } from 'three';
import { TREASURY_LAYOUT } from './islandMoneyMotion';
import { ISLAND_SCALE, PLAYER_ISLANDS, islandPosition } from './playerIslandLayout';
import { RoyalCoinInstances, useCoinInstances } from './RoyalCoinInstances';
import type { makeRoyalCoins } from './royalCoinMeshes';
import { COIN_VALUES, treasuryStacks } from './royalCoinValues';
import type { TreasuryBalance } from './useIslandTreasuryMotion';

export function IslandTreasury({ coins, balances }: {
  coins: ReturnType<typeof makeRoyalCoins>; balances: ReadonlyMap<number, TreasuryBalance>;
}) {
  const pool = useCoinInstances();
  const layouts = useMemo(() => PLAYER_ISLANDS.map(site => ({ seat: site.seat, center: islandPosition(site),
    stacks: treasuryStacks(balances.get(site.seat)?.value ?? 0) })), [balances]);
  useLayoutEffect(() => {
    const model = new Object3D();
    const meshes = pool.meshes.current;
    meshes.forEach(mesh => { mesh.count = 0; });
    for (const { center: [x, y, z], stacks } of layouts) for (const stack of stacks) {
      const mesh = meshes.get(stack.value);
      if (!mesh || !stack.visible) continue;
      const spot = TREASURY_LAYOUT[stack.value];
      const radius = spot.radius * ISLAND_SCALE;
      for (let i = 0; i < stack.visible; i++) {
        // Tilt the single coins on their edge. Stacked coins read as small, neat piles.
        const single = stack.visible === 1;
        const spacing = .237 * radius * (stack.count > stack.visible ? 1 + Math.min(.45, Math.log10(stack.count) * .12) : 1);
        const tilt = single ? .57 : 0;
        model.position.set(x + spot.x * ISLAND_SCALE + .009 * Math.sin(i * 2),
          y + .059 + radius * (.119 + Math.sin(tilt) * .93) + i * spacing,
          z + spot.z * ISLAND_SCALE + .01 * Math.cos(i * 2));
        model.rotation.set(tilt, .12 * i + .22 * Math.sin(stack.value), single ? .08 : .013 * Math.cos(i));
        model.scale.setScalar(radius);
        model.updateMatrix();
        mesh.setMatrixAt(mesh.count++, model.matrix);
      }
    }
    meshes.forEach(mesh => {
      mesh.visible = mesh.count > 0;
      if (mesh.visible) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
    });
  }, [layouts, pool.meshes]);
  return <group name="island-treasuries" userData={{ denominations: COIN_VALUES,
    treasuries: layouts.map(({ seat, stacks }) => ({ seat, stacks: stacks.filter(stack => stack.count > 0) })) }}>
    <RoyalCoinInstances pool={pool} coins={coins} capacity={PLAYER_ISLANDS.length * 5} prefix="island-minted-coin" />
  </group>;
}
