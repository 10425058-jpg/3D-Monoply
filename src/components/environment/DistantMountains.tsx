import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EnvironmentQuality, ENVIRONMENT_BUDGETS, terrainHeight } from './environmentLayout';

/** Three connected ridges, rather than isolated cone-shaped peaks. */
export function DistantMountains({ quality }: { quality: EnvironmentQuality }) {
  const geometry = useMemo(() => {
    const segments = ENVIRONMENT_BUDGETS[quality].peaks * 4;
    const radii = [108, 120, 131, 143, 153, 167, 178];
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const palettes = ['#657695', '#7984a5', '#8d8fb0', '#a395b6', '#b4a0ba', '#c3a9bd', '#c9b0c0'];
    for (let j = 0; j < radii.length; j++) for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const radius = radii[j], x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      const ridge = j % 2 ? 9 + Math.pow(Math.max(0, Math.sin(angle * 9 + j)), 1.7) * 11 + Math.sin(angle * 19 + j) * 2 : 0;
      positions.push(x, terrainHeight(x, z) + ridge + .15, z);
      const color = new THREE.Color(palettes[j]).multiplyScalar(.9 + .1 * Math.sin(angle + .5));
      colors.push(color.r, color.g, color.b);
      if (j < radii.length - 1 && i < segments) {
        const a = j * (segments + 1) + i, b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices); g.computeVertexNormals();
    const normals = g.getAttribute('normal'), tint = g.getAttribute('color');
    const light = new THREE.Vector3(-.6, 1, .4).normalize();
    for (let i = 0; i < tint.count; i++) {
      const illumination = .68 + .32 * Math.max(0, normals.getX(i) * light.x + normals.getY(i) * light.y + normals.getZ(i) * light.z);
      tint.setXYZ(i, tint.getX(i) * illumination, tint.getY(i) * illumination, tint.getZ(i) * illumination);
    }
    return g;
  }, [quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} name="mountain-ranges" raycast={() => {}}>
    <meshBasicMaterial vertexColors fog={false} side={THREE.DoubleSide} />
  </mesh>;
}
