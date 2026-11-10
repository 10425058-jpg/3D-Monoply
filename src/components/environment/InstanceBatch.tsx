import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Instance } from './environmentLayout';

/** One draw per material/primitive; background geometry never casts board shadows. */
export function InstanceBatch({ items, shape = 'box', unlit = false, name }: {
  items: Instance[]; shape?: 'box' | 'cone' | 'cylinder' | 'sphere'; unlit?: boolean; name?: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((item, index) => {
      dummy.position.set(...item.position); dummy.scale.set(...item.scale);
      dummy.rotation.set(...(item.rotation ?? [0, 0, 0])); dummy.updateMatrix();
      ref.current!.setMatrixAt(index, dummy.matrix);
      ref.current!.setColorAt(index, new THREE.Color(item.color ?? '#ffffff'));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, dummy]);
  return <instancedMesh ref={ref} name={name} args={[undefined, undefined, items.length]} raycast={() => {}}>
    {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
    {shape === 'cone' && <coneGeometry args={[1, 1, 7]} />}
    {shape === 'cylinder' && <cylinderGeometry args={[1, 1, 1, 10]} />}
    {shape === 'sphere' && <sphereGeometry args={[1, 12, 8]} />}
    {unlit ? <meshBasicMaterial fog={false} toneMapped={false} /> : <meshStandardMaterial fog={false} roughness={0.95} metalness={0} />}
  </instancedMesh>;
}
