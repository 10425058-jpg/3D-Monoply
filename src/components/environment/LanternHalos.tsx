import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { environmentModelUrl, EnvironmentPlacement } from './GltfEnvironmentModel';
import { releaseInstanceBuffers } from './instanceResources';

/** Emissive-looking lantern bloom without extra lights or a fullscreen pass.
 * Anchors are authored with the lamps; depth testing hides halos behind masonry. */
export function LanternHalos({ file, placements }: { file: string; placements: readonly EnvironmentPlacement[] }) {
  const { scene }=useGLTF(environmentModelUrl(file));
  const ref=useRef<THREE.InstancedMesh>(null);
  const halos=useMemo(()=>{
    scene.updateMatrixWorld(true);
    const result:{position:THREE.Vector3;radius:number}[]=[];
    scene.traverse(object=>{
      if(!object.name.startsWith('sunset_glow_'))return;
      const center=object.getWorldPosition(new THREE.Vector3());
      placements.forEach(site=>{
        const p=center.clone().multiplyScalar(site.scale).applyAxisAngle(new THREE.Vector3(0,1,0),site.rotation??0).add(new THREE.Vector3(...site.position));
        result.push({position:p,radius:Number(object.userData.radius)*site.scale});
      });
    });
    return result;
  },[scene,placements]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const transform=new THREE.Object3D();
    halos.forEach((halo,i)=>{
      transform.position.copy(halo.position);transform.scale.setScalar(halo.radius);transform.updateMatrix();
      ref.current!.setMatrixAt(i,transform.matrix);
    });
    const instance=ref.current;
    instance.instanceMatrix.needsUpdate=true;instance.computeBoundingSphere();
    return()=>releaseInstanceBuffers(instance);
  },[halos]);
  if(!halos.length)return null;
  return <instancedMesh ref={ref} args={[undefined,undefined,halos.length]} name="sunset-lantern-halos" raycast={()=>{}}>
    <planeGeometry args={[2,2]} />
    <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
      vertexShader={`varying vec2 vUv;void main(){vUv=uv*2.-1.;vec4 mv=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        mv.xy+=position.xy*length(instanceMatrix[0].xyz);gl_Position=projectionMatrix*mv;}`}
      fragmentShader={`varying vec2 vUv;void main(){float r=dot(vUv,vUv);
        float glow=exp(-r*7.)*.37+exp(-r*34.)*.42;
        gl_FragColor=vec4(1.,.49,.095,glow);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`} />
  </instancedMesh>;
}
