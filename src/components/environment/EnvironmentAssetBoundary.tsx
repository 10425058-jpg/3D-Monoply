import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { EnvironmentPlacement } from './GltfEnvironmentModel';

/** A failed decorative download must never take down the playable Canvas. */
export class EnvironmentAssetBoundary extends React.Component<{
  label: string; fallback: React.ReactNode; children: React.ReactNode;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.warn(`[Fantasy environment] ${this.props.label} could not load; using its scenic fallback.`, error.message);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Small local silhouette only while a GLB is loading or unavailable. The
 * shipped scene uses the authored Blender assets, never this emergency mesh. */
export function LandmarkFallback({ placements }: { placements: readonly EnvironmentPlacement[] }) {
  const geometry = useMemo(() => {
    const vertices: number[] = [], indices: number[] = [];
    const count = 14;
    for (const [radius, height] of [[1, 0], [.92, -1.2], [.08, -6]]) {
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2, r = radius * (1 + .13 * Math.sin(a * 3));
        vertices.push(Math.cos(a) * 5.7 * r, height, Math.sin(a) * 4.2 * r);
        if (height === 0 && i > 1) indices.push(0, i, i - 1);
        if (height !== -6) {
          const n = vertices.length / 3 - 1, next = Math.floor(n / count) * count + (i + 1) % count;
          indices.push(n, next, n + count, next, next + count, n + count);
        }
      }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    result.setIndex(indices); result.computeVertexNormals();
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="environment-landmark-fallback">{placements.map((site, i) =>
    <group key={i} position={site.position} scale={site.scale} rotation={[0, site.rotation ?? 0, 0]}>
      <mesh geometry={geometry} raycast={() => {}}><meshStandardMaterial color="#92859d" side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <circleGeometry args={[3.8, 14]} /><meshStandardMaterial color="#88a879" />
      </mesh>
      <mesh position={[0, 1.6, 0]} raycast={() => {}}><cylinderGeometry args={[.8, 1, 3.2, 8]} /><meshStandardMaterial color="#e5d7c0" /></mesh>
      <mesh position={[0, 3.65, 0]} raycast={() => {}}><coneGeometry args={[1.25, 1.7, 8]} /><meshStandardMaterial color="#315b9c" /></mesh>
    </group>)}</group>;
}
