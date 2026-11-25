import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnvironmentAssetBoundary } from './EnvironmentAssetBoundary';
import type { EnvironmentPlacement } from './GltfEnvironmentModel';
import { releaseInstanceBuffers } from './instanceResources';
import { createInstanceVisibility } from './instanceVisibility';
import { sakuraParts } from './sakuraModel';
import { useInvalidateBoardShadow } from '../3d/BoardShadowLight';

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
  const lean = site.id ? .025 + (seed >>> 24) / 255 * .05 : 0;
  const direction = ((seed >>> 10) % 1024) / 1024 * Math.PI * 2;
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    Math.cos(direction) * lean, rotation, Math.sin(direction) * lean, 'YXZ',
  ));
  const ground = new THREE.Vector3(...site.position);
  // Seat the slightly tilted root in the same lawn at every angle.
  ground.y -= .18 * lean * scale;
  return new THREE.Matrix4().compose(ground, orientation, new THREE.Vector3(scale, scale, scale));
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
  const invalidateShadow = useInvalidateBoardShadow();
  const model = useMemo(() => {
    const { parts, bounds } = sakuraParts(liteScene, scene, detail === 'scenic');
    const transforms = placements.map(siteMatrix);
    return {
      parts: parts.map(part => ({ ...part, matrices: transforms.map(matrix => matrix.clone().multiply(part.matrix)) })),
      culling: createInstanceVisibility(transforms.map(matrix => bounds.clone().applyMatrix4(matrix))),
    };
  }, [liteScene, scene, detail, placements]);
  useLayoutEffect(() => {
    const meshes = [...root.current!.children] as THREE.InstancedMesh[];
    model.parts.forEach(({ matrices }, part) => {
      const mesh = meshes[part];
      mesh.count = matrices.length;
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    model.culling.reset();
    if (shadows) invalidateShadow();
    return () => {
      meshes.forEach(releaseInstanceBuffers);
      if (shadows) invalidateShadow();
    };
  }, [model, cullInstances, invalidateShadow, shadows]);

  useFrame(({ camera }) => {
    const group = root.current;
    if (!cullInstances || !group) return;
    const visible = model.culling.update(camera, group);
    if (!visible) return;
    model.parts.forEach(({ matrices }, part) => {
      const mesh = group.children[part] as THREE.InstancedMesh;
      mesh.count = visible.length;
      visible.forEach((index, slot) => mesh.setMatrixAt(slot, matrices[index]));
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (shadows) invalidateShadow();
  });

  return <group ref={root} name={name}>{model.parts.map(part => (
    <instancedMesh key={part.name} name={`sakura-${part.name}`} args={[part.geometry, part.material, placements.length]} matrixAutoUpdate={false}
      castShadow={shadows && part.name === 'bark'} receiveShadow={shadows} dispose={null}
      frustumCulled={!cullInstances} raycast={() => {}} />
  ))}</group>;
}
