import React, { useMemo } from 'react';
import { InstanceBatch } from './InstanceBatch';
import { CASTLE_SITES, EnvironmentQuality, ENVIRONMENT_BUDGETS, Instance, VILLAGE_SITES, terrainHeight, terrainOpacity, variation } from './environmentLayout';

export function FantasyKingdom({ quality }: { quality: EnvironmentQuality }) {
  const batches = useMemo(() => {
    const walls: Instance[] = [], towers: Instance[] = [], roofs: Instance[] = [], windows: Instance[] = [],
      gold: Instance[] = [], rocks: Instance[] = [], terraces: Instance[] = [], cottages: Instance[] = [];
    for (const site of CASTLE_SITES) {
      const ground = terrainHeight(site.x, site.z) + site.rise, s = site.size;
      const put = (batch: Instance[], p: [number, number, number], scale: [number, number, number], color: string, rotation?: [number, number, number]) =>
        batch.push({ position: [site.x + p[0] * s, ground + p[1] * s, site.z + p[2] * s], scale: scale.map(n => n * s) as [number, number, number], color, rotation });
      rocks.push({ position: [site.x, ground - 10 * s, site.z], scale: [9.5 * s, 20 * s, 8 * s], rotation: [Math.PI, .3, 0], color: '#77718e' });
      terraces.push({ position: [site.x, ground - .2, site.z], scale: [9.5 * s, .8, 8.1 * s], color: '#798c76' });
      put(walls, [0, 4.3, 0], [6.5, 7.8, 4.5], '#ddd0b8');
      for (const y of [1.2, 3.5, 6.2, 8.1]) put(walls, [0, y, 0], [6.8, .18, 4.8], '#b7a998');
      put(walls, [0, 9.4, -1], [3.4, 3.3, 3], '#e9d4b6');
      put(roofs, [0, 12.3, -1], [3, 3.4, 2.6], '#5a5791', [0, Math.PI / 4, 0]);
      const turretSites = [[-4, 2.3, 9], [4, 2.3, 10], [-3.5, -2.5, 11], [3.5, -2.5, 9], [0, -1.4, 15]];
      turretSites.forEach(([x, z, h], index) => {
        const r = index === 4 ? 1.25 : .95;
        put(towers, [x, h / 2, z], [r, h, r], '#e5d6bf');
        put(towers, [x, h - .3, z], [r * 1.23, .7, r * 1.23], '#c7b89e');
        put(roofs, [x, h + 1.75, z], [r * 1.55, 3.8, r * 1.55], index % 2 ? '#465c90' : '#5e5491');
        put(gold, [x, h + 3.85, z], [.14, .2, .14], '#e9bd74');
        for (const y of [h * .45, h * .75]) {
          put(windows, [x, y, z + r + .02], [.35, .8, .04], '#ffdc99');
          put(windows, [x, y, z - r - .02], [.35, .8, .04], '#eec48d');
        }
      });
      for (let column = -2; column <= 2; column++) for (const y of [2.8, 5.6])
        put(windows, [column * 1.05, y, 2.27], [.38, .85, .05], '#ffe1a0');
      put(walls, [0, 1.4, 2.29], [1.65, 2.7, .1], '#9b8678');
      put(windows, [0, 1.4, 2.36], [1.25, 2.4, .08], '#efbc76');
      for (let i = 0; i < 13; i++) {
        const x = -6 + i;
        put(walls, [x, 1, 5.3], [.6, 2, .6], '#b4ad9b');
        put(walls, [x, 2.15, 5.3], [.8, .4, .8], '#e2cda8');
      }
      put(walls, [0, .35, 4.6], [11.5, .65, 2.6], '#cbbd9e');
    }
    for (let i = 0; i < ENVIRONMENT_BUDGETS[quality].houses; i++) {
      const [vx, vz] = VILLAGE_SITES[i % VILLAGE_SITES.length];
      const angle = i * 2.39996, radius = 3 + variation(i, 12) * 11;
      const x = vx + Math.sin(angle) * radius, z = vz + Math.cos(angle) * radius;
      if (terrainOpacity(x, z) < .65) continue;
      if (CASTLE_SITES.some(site => Math.hypot(x - site.x, z - site.z) < 15)) continue;
      const y = terrainHeight(x, z), h = 1.7 + variation(i, 13) * 1.1;
      cottages.push({ position: [x, y + h / 2, z], scale: [2.2, h, 1.8], color: '#d5c6b2' });
      roofs.push({ position: [x, y + h + .7, z], scale: [1.9, 1.5, 1.6], rotation: [0, Math.PI / 4, 0], color: ['#8e647d', '#655b88', '#9c717f'][i % 3] });
      windows.push({ position: [x - .55, y + 1.1, z + .91], scale: [.4, .55, .05], color: '#ffd59b' });
      windows.push({ position: [x + .55, y + 1.1, z - .91], scale: [.4, .55, .05], color: '#f7ce90' });
    }
    // Small floating landforms are deliberately outside the playable board footprint.
    for (const [i, x, z] of [[0, -48, -29], [1, 46, 31], [2, -60, 51]]) {
      const y = terrainHeight(x, z) + 21;
      rocks.push({ position: [x, y - 5, z], scale: [5, 10, 4.3], rotation: [Math.PI, i, 0], color: '#756c91' });
      terraces.push({ position: [x, y, z], scale: [5.1, .5, 4.4], color: '#7d947c' });
      towers.push({ position: [x, y + 2, z], scale: [.65, 4, .65], color: '#cfc6c4' });
      roofs.push({ position: [x, y + 4.9, z], scale: [1.1, 2, 1.1], color: '#61699c' });
      windows.push({ position: [x, y + 2.6, z + .66], scale: [.22, .55, .04], color: '#ffda9d' });
    }
    return { walls, towers, roofs, windows, gold, rocks, terraces, cottages };
  }, [quality]);
  return <group name="distant-fantasy-kingdom">
    <InstanceBatch name="kingdom-cliffs" items={batches.rocks} shape="cone" />
    <InstanceBatch items={batches.terraces} shape="cylinder" />
    <InstanceBatch items={batches.walls} />
    <InstanceBatch items={batches.towers} shape="cylinder" />
    <InstanceBatch items={batches.roofs} shape="cone" />
    <InstanceBatch items={batches.cottages} />
    <InstanceBatch name="kingdom-lit-windows" items={batches.windows} unlit />
    <InstanceBatch items={batches.gold} shape="sphere" unlit />
  </group>;
}
