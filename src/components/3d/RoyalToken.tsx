import { Suspense, useLayoutEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, Object3D, Vector3 } from 'three';
import type { RoyalTokenAsset } from '../../data/royalTokenAssets';
import { EnvironmentAssetBoundary } from '../environment/EnvironmentAssetBoundary';
import { useInvalidateBoardShadow } from './BoardShadowLight';

const standRadius = .35;
const standHeight = .86;
const tokenBounds = new WeakMap<Object3D, { center: Vector3; scale: number }>();

/** Fit the actual silhouette to the same clearance at every movement heading. */
function fitToken(scene: Object3D) {
  const cached = tokenBounds.get(scene);
  if (cached) return cached;
  const bounds = new Box3().setFromObject(scene, true);
  const center = bounds.getCenter(new Vector3());
  center.y = bounds.min.y;
  const point = new Vector3();
  let radiusSquared = 0;
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).sub(center);
      radiusSquared = Math.max(radiusSquared, point.x ** 2 + point.z ** 2);
    }
  });
  const height = bounds.max.y - bounds.min.y;
  const scale = Math.min(standRadius / Math.sqrt(radiusSquared), standHeight / height);
  const fit = { center, scale };
  tokenBounds.set(scene, fit);
  return fit;
}

function TokenScene({ url, file, shadows }: { url: string; file: string; shadows: boolean }) {
  const { scene } = useGLTF(url, false, false);
  const invalidateShadow = useInvalidateBoardShadow();
  const actors = useMemo(() => {
    const { center, scale } = fitToken(scene);
    const instance = scene.clone();
    instance.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const structural = material.name === 'Ivory porcelain' || material.name === 'Satin enamel';
      object.castShadow = shadows && structural;
      object.receiveShadow = structural;
      object.raycast = () => {};
    });
    return { instance, scale, offset: center.clone().multiplyScalar(-1) };
  }, [scene, shadows]);
  useLayoutEffect(() => {
    if (!shadows) return;
    invalidateShadow();
    return invalidateShadow;
  }, [actors, invalidateShadow, shadows]);
  // Token movement already uses +Z forward. The GLB authoring rig exports that heading.
  return <group name={file} scale={actors.scale} dispose={null}>
    <primitive object={actors.instance} position={actors.offset} />
  </group>;
}

export function RoyalToken({ asset, fallback, shadows }: {
  asset: RoyalTokenAsset; fallback: ReactNode; shadows: boolean;
}) {
  const url = new URL(`assets/models/player-tokens/${asset.file}`, document.baseURI).href;
  return <EnvironmentAssetBoundary key={url} label={asset.name} fallback={fallback}>
    <Suspense fallback={fallback}>
      <TokenScene url={url} file={asset.file} shadows={shadows} />
    </Suspense>
  </EnvironmentAssetBoundary>;
}
