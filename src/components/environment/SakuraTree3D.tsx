import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnvironmentAssetBoundary } from './EnvironmentAssetBoundary';
import type { EnvironmentPlacement } from './GltfEnvironmentModel';
import { releaseInstanceBuffers } from './instanceResources';
import { sakuraParts } from './sakuraModel';

type SakuraDetail = 'full' | 'lite' | 'scenic';

export interface SakuraPlacement extends EnvironmentPlacement {
  id?: string;
}

export const sakuraModelUrl = (detail: SakuraDetail) => new URL(
  `assets/models/sakura/Sakura_Cherry_Blossom_Tree${detail === 'full' ? '' : '_Lite'}.glb`, document.baseURI,
).href;

function siteMatrix(site: SakuraPlacement) {
  let hash = 2166136261;
  for (const char of site.id ?? '') hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const seed = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  const scale = site.scale * (site.id ? 0.92 + ((seed >>> 8) % 1024) / 1023 * 0.16 : 1);
  const rotation = (site.rotation ?? 0) + (site.id ? (seed % 1024) / 1024 * Math.PI * 2 : 0);
  return new THREE.Matrix4().makeRotationY(rotation).scale(new THREE.Vector3(scale, scale, scale))
    .setPosition(...site.position);
}

interface SakuraTreeProps {
  name: string;
  placements: readonly SakuraPlacement[];
  detail?: SakuraDetail;
  shadows?: boolean;
  cullInstances?: boolean;
}

/** A single tree or a grove, with one instanced draw per part. */
export function SakuraTree3D({ name, detail = 'lite', placements, ...options }: SakuraTreeProps) {
  if (!placements.length) return null;
  const url = sakuraModelUrl(detail);
  return <EnvironmentAssetBoundary key={url} label={url} fallback={null}>
    <Suspense fallback={null}>
      <SakuraInstances name={name} detail={detail} placements={placements} {...options} />
    </Suspense>
  </EnvironmentAssetBoundary>;
}

function SakuraInstances({ name, placements, detail = 'lite', shadows = false, cullInstances = false }: SakuraTreeProps) {
  const { scene: liteScene } = useGLTF(sakuraModelUrl('lite'));
  const { scene } = useGLTF(sakuraModelUrl(detail));
  const root = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const { parts, bounds } = sakuraParts(liteScene, scene, detail === 'scenic');
    const transforms = placements.map(siteMatrix);
    return {
      parts: parts.map(part => ({ ...part, matrices: transforms.map(matrix => matrix.clone().multiply(part.matrix)) })),
      spheres: transforms.map(matrix => bounds.clone().applyMatrix4(matrix)),
      frustum: new THREE.Frustum(),
      projection: new THREE.Matrix4(),
      sphere: new THREE.Sphere(),
    };
  }, [liteScene, scene, detail, placements]);
  const lastVisible = useRef<string | null>(null);

  useLayoutEffect(() => {
    const meshes = [...root.current!.children] as THREE.InstancedMesh[];
    model.parts.forEach(({ matrices }, part) => {
      const mesh = meshes[part];
      mesh.count = matrices.length;
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    lastVisible.current = null;
    return () => meshes.forEach(releaseInstanceBuffers);
  }, [model]);

  useFrame(({ camera }) => {
    const group = root.current;
    if (!cullInstances || !group) return;
    group.updateWorldMatrix(true, false);
    model.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    model.frustum.setFromProjectionMatrix(model.projection);
    const visible: number[] = [];
    model.spheres.forEach((sphere, index) => {
      if (model.frustum.intersectsSphere(model.sphere.copy(sphere).applyMatrix4(group.matrixWorld))) visible.push(index);
    });
    const signature = visible.join(',');
    if (lastVisible.current === signature) return;
    lastVisible.current = signature;
    model.parts.forEach(({ matrices }, part) => {
      const mesh = group.children[part] as THREE.InstancedMesh;
      mesh.count = visible.length;
      visible.forEach((index, slot) => mesh.setMatrixAt(slot, matrices[index]));
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return <group ref={root} name={name}>{model.parts.map(part => (
    <instancedMesh key={part.name} name={`sakura-${part.name}`} args={[part.geometry, part.material, placements.length]}
      castShadow={shadows && part.name === 'bark'} receiveShadow={shadows} dispose={null}
      frustumCulled={!cullInstances} raycast={() => {}} />
  ))}</group>;
}
