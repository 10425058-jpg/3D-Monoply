import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

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
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const result: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (Array.isArray(object.material)) throw new Error(`Unsplit GLB material group: ${file}`);
      const material = object.material.clone();
      // Atmospheric separation is supplied by the sky/cloud layers. Avoid the
      // scene's near gameplay fog bleaching these already distant PBR assets.
      material.fog = false;
      if (atmosphere && material instanceof THREE.MeshStandardMaterial) {
        material.color.lerp(new THREE.Color('#c1b4d9'), atmosphere);
        material.emissive.lerp(new THREE.Color('#81789d'), atmosphere);
        material.emissiveIntensity = Math.max(material.emissiveIntensity, atmosphere);
        material.metalness *= 1-atmosphere;
      }
      result.push({ geometry: object.geometry, material, matrix: object.matrixWorld.clone() });
    });
    return result;
  }, [scene, file, atmosphere]);
  useEffect(() => () => { parts.forEach(part => part.material.dispose()); }, [parts]);
  return <group name={name}>{parts.map((part, index) => <ModelPart key={index} {...part} placements={placements} />)}</group>;
}

function ModelPart({ geometry, material, matrix, placements }: {
  geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4; placements: readonly EnvironmentPlacement[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    placements.forEach((placement, index) => {
      transform.position.fromArray(placement.position);
      transform.rotation.set(0, placement.rotation ?? 0, 0);
      transform.scale.setScalar(placement.scale); transform.updateMatrix();
      ref.current!.setMatrixAt(index, transform.matrix.clone().multiply(matrix));
    });
    const instance = ref.current!;
    instance.instanceMatrix.needsUpdate = true; instance.computeBoundingSphere();
    // Instance buffers belong to this component; cached geometry/atlas do not.
    return () => { instance.dispose(); };
  }, [placements, matrix]);
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} dispose={null} raycast={() => {}}
    castShadow={false} receiveShadow={false} />;
}
