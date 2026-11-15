import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { finishEnvironmentMaterial } from './environmentMaterial';
import { releaseInstanceBuffers } from './instanceResources';

export interface EnvironmentPlacement {
  position: [number, number, number];
  scale: number;
  rotation?: number;
}
export const environmentModelUrl = (file: string) => new URL(`assets/models/environment/${file}`, document.baseURI).href;

/** Each exported material is one instanced draw, even for several distant copies.
 * GLB geometry/atlas stay in Drei's URL cache; background models never intercept
 * board input or join the board's real-time shadow pass.
 */
export function GltfEnvironmentModel({ file, placements, name, atmosphere = 0 }: {
  file: string; placements: readonly EnvironmentPlacement[]; name: string; atmosphere?: number;
}) {
  const { scene } = useGLTF(environmentModelUrl(file));
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const result: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (Array.isArray(object.material)) throw new Error(`Unsplit GLB material group: ${file}`);
      const fabric=file.startsWith('fantasy-airship') && object.material.name==='Ivory limestone' ? '#4979db' : undefined;
      const material = finishEnvironmentMaterial(object.material, atmosphere, fabric);
      result.push({ geometry: object.geometry, material, matrix: object.matrixWorld.clone() });
    });
    return result;
  }, [scene, file, atmosphere]);
  const culling = useMemo(() => {
    const bounds=new THREE.Box3().setFromObject(scene).getBoundingSphere(new THREE.Sphere());
    const transform=new THREE.Object3D();
    const spheres=placements.map(site=>{
      transform.position.fromArray(site.position);transform.rotation.set(0,site.rotation??0,0);
      transform.scale.setScalar(site.scale);transform.updateMatrix();
      return bounds.clone().applyMatrix4(transform.matrix);
    });
    return {spheres,frustum:new THREE.Frustum(),projection:new THREE.Matrix4(),sphere:new THREE.Sphere(),previous:'#'};
  },[scene,placements]);
  useFrame(({camera})=>{
    if(!group.current)return;
    group.current.updateWorldMatrix(true,false);
    culling.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    culling.frustum.setFromProjectionMatrix(culling.projection);
    const visible:number[]=[];
    culling.spheres.forEach((sphere,index)=>{
      culling.sphere.copy(sphere).applyMatrix4(group.current!.matrixWorld);
      if(culling.frustum.intersectsSphere(culling.sphere))visible.push(index);
    });
    const signature=visible.join(',');
    if(signature===culling.previous)return;
    culling.previous=signature;
    group.current.children.forEach(object=>{
      if(!(object instanceof THREE.InstancedMesh))return;
      const matrices=object.userData.placementMatrices as THREE.Matrix4[]|undefined;
      if(!matrices)return;
      visible.forEach((index,slot)=>object.setMatrixAt(slot,matrices[index]));
      object.count=visible.length;object.instanceMatrix.needsUpdate=true;
      object.computeBoundingSphere();
    });
  });
  useEffect(() => () => { parts.forEach(part => part.material.dispose()); }, [parts]);
  return <group ref={group} name={name}>{parts.map((part, index) => <ModelPart key={index} {...part} placements={placements} />)}</group>;
}

function ModelPart({ geometry, material, matrix, placements }: {
  geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4; placements: readonly EnvironmentPlacement[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    const matrices:THREE.Matrix4[]=[];
    placements.forEach((placement, index) => {
      transform.position.fromArray(placement.position);
      transform.rotation.set(0, placement.rotation ?? 0, 0);
      transform.scale.setScalar(placement.scale); transform.updateMatrix();
      const placed=transform.matrix.clone().multiply(matrix);
      matrices.push(placed);ref.current!.setMatrixAt(index, placed);
    });
    const instance = ref.current!;
    instance.userData.placementMatrices=matrices;
    instance.instanceMatrix.needsUpdate = true; instance.computeBoundingSphere();
    // Instance buffers belong to this component; cached geometry/atlas do not.
    return () => { releaseInstanceBuffers(instance); };
  }, [placements, matrix]);
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} dispose={null} raycast={() => {}}
    castShadow={false} receiveShadow={false} />;
}
