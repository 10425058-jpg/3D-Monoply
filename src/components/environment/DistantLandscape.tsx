import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { InstanceBatch } from './InstanceBatch';
import { EnvironmentQuality, ENVIRONMENT_BUDGETS, Instance, VILLAGE_SITES, terrainHeight, variation } from './environmentLayout';
import { DistantMountains } from './DistantMountains';

function createValley() {
  const segments = 128, rings = 18;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const green = new THREE.Color('#4c796e'), haze = new THREE.Color('#8c83ab'), rocky = new THREE.Color('#79788f');
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const inner = 30 + Math.sin(angle * 3) * 3 + Math.cos(angle * 7) * 2;
    const radius = inner + j / rings * (178 - inner);
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    positions.push(x, terrainHeight(x, z), z);
    const shade = green.clone().lerp(rocky, Math.max(0, Math.sin(x * .07) * Math.cos(z * .06)) * .6)
      .lerp(haze, j / rings * .67);
    colors.push(shade.r, shade.g, shade.b);
    if (i < segments && j < rings) {
      const a = j * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function DistantLandscape({ quality }: { quality: EnvironmentQuality }) {
  const geometry = useMemo(createValley, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const forest = useMemo(() => {
    const trees: Instance[] = [];
    for (let i = 0; i < ENVIRONMENT_BUDGETS[quality].trees; i++) {
      const cluster = i % 14;
      const angle = cluster * Math.PI * 2 / 14 + (variation(i, 7) - .5) * .35;
      const radius = 48 + variation(cluster, 8) * 64 + (variation(i, 10) - .5) * 18;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      if (VILLAGE_SITES.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < 8)) continue;
      const height = 1.7 + variation(i, 9) * 2.8;
      trees.push({ position: [x, terrainHeight(x, z) + height / 2, z], scale: [height * .32, height, height * .32],
        color: ['#386a62', '#4f7f72', '#638980', '#577c75'][i % 4] });
    }
    return trees;
  }, [quality]);
  return <group name="kingdom-landscape">
    <mesh geometry={geometry} name="kingdom-valley" raycast={() => {}}>
      <meshStandardMaterial vertexColors roughness={1} fog={false} side={THREE.DoubleSide} />
    </mesh>
    <DistantMountains quality={quality} />
    <InstanceBatch name="valley-forest" items={forest} shape="cone" />
  </group>;
}
