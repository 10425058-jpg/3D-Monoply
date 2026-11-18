import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { atmosphereCloudLayout, CLOUD_CARD_EXTENT } from './atmosphereLayout';
import { mayAnimateEnvironment } from './environmentMotion';
import { SKY_SUN_DIRECTION } from './sunConfig';
import { cloudAtlasTexture, cloudAtlasUrl, CLOUD_LIGHT_RESPONSE } from './cloudAtlas';
import { releaseInstanceBuffers } from './instanceResources';

/** Eight offline cumulus volumes, one instanced pass. Sort only when the camera
 * changes, preserving the actual world positions and each bank's identity. */
export function FloatingClouds({ quality, animate }: { quality:EnvironmentQuality;animate:boolean }){
  const ref=useRef<THREE.InstancedMesh>(null);
  const source=useTexture(cloudAtlasUrl(quality));
  const atlas=useMemo(()=>cloudAtlasTexture(source,quality),[source,quality]);
  useEffect(()=>()=>atlas.dispose(),[atlas]);
  const clouds=useMemo(()=>atmosphereCloudLayout(quality),[quality]);
  const uniforms=useMemo(()=>({uTime:{value:0},uSun:{value:new THREE.Vector3(...SKY_SUN_DIRECTION)},uCloud:{value:atlas}}),[atlas]);
  const sorting=useMemo(()=>({dummy:new THREE.Object3D(),previous:new THREE.Matrix4().makeScale(0,0,0),order:clouds.map((_,i)=>i),
    data:new THREE.InstancedBufferAttribute(new Float32Array(clouds.length*4),4)}),[clouds]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    const instance=ref.current;
    instance.geometry.setAttribute('cloudData',sorting.data);
    return()=>releaseInstanceBuffers(instance);
  },[sorting]);
  useFrame(({camera},delta)=>{
    if(mayAnimateEnvironment(animate))uniforms.uTime.value+=Math.min(delta,.1);
    const instance=ref.current;if(!instance||sorting.previous.equals(camera.matrixWorldInverse))return;
    sorting.previous.copy(camera.matrixWorldInverse);
    const view=camera.matrixWorldInverse.elements;
    const depth=(i:number)=>{const p=clouds[i].position;return view[2]*p[0]+view[6]*p[1]+view[10]*p[2]+view[14];};
    sorting.order.sort((a,b)=>depth(a)-depth(b));
    sorting.order.forEach((index,slot)=>{
      const cloud=clouds[index],dummy=sorting.dummy;
      dummy.position.fromArray(cloud.position);dummy.scale.set(cloud.size[0],cloud.size[1],1);dummy.updateMatrix();
      instance.setMatrixAt(slot,dummy.matrix);
      sorting.data.setXYZW(slot,cloud.variant,cloud.opacity,cloud.layer,index*.731);
    });
    instance.instanceMatrix.needsUpdate=true;sorting.data.needsUpdate=true;
    instance.computeBoundingSphere();instance.boundingSphere!.radius+=1.5;
  });
  return <instancedMesh ref={ref} name="kingdom-cloud-layers" args={[undefined,undefined,clouds.length]} renderOrder={2} raycast={()=>{}}>
    <planeGeometry args={[...CLOUD_CARD_EXTENT]} />
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms} toneMapped={false}
      vertexShader={`attribute vec4 cloudData;uniform float uTime;uniform vec3 uSun;
        varying vec2 vUv;varying vec4 vData;varying float vWarm;varying float vDistance;
        void main(){vUv=uv*vec2(${CLOUD_CARD_EXTENT.map(value=>value.toFixed(2)).join(',')})+
          vec2(${CLOUD_CARD_EXTENT.map(value=>((1-value)/2).toFixed(2)).join(',')});vData=cloudData;
          vec4 center=instanceMatrix*vec4(0.,0.,0.,1.);
          center.x+=sin(uTime*.018+cloudData.w)*.8;
          center.z+=cos(uTime*.012+cloudData.w)*.45;
          vec3 direction=normalize(center.xyz-cameraPosition);
          vDistance=length(center.xyz-cameraPosition);
          vWarm=pow(max(0.,dot(direction,uSun)),9.);
          vec4 mv=modelViewMatrix*center;
          mv.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
          gl_Position=projectionMatrix*mv;
        }`}
      fragmentShader={`uniform sampler2D uCloud;uniform float uTime;
        varying vec2 vUv;varying vec4 vData;varying float vWarm;varying float vDistance;
        ${CLOUD_LIGHT_RESPONSE}
        void main(){
          vec2 uv=vUv;
          uv.x+=sin(uv.y*5.+uTime*.045+vData.w)*.004;
          vec2 cell=vec2(mod(vData.x,4.),floor(vData.x/4.));
          vec4 cloud=texture2D(uCloud,(cell+clamp(uv,.008,.992))/vec2(4.,2.));
          float edge=smoothstep(0.,.025,uv.x)*smoothstep(0.,.025,1.-uv.x)*
            smoothstep(0.,.025,uv.y)*smoothstep(0.,.025,1.-uv.y);
          // Preserve the optical-density fringe and the connected body. Near
          // cradles are fuller; distant banks fade into the same lower sky.
          float density=mix(cloud.a,smoothstep(.06,.68,cloud.a)*.95,1.-step(.5,abs(vData.z-1.)));
          float alpha=density*vData.y*edge;
          if(alpha<.002)discard;
          // RGB contains actual offline self-shadowing. Restrained ambient
          // colour keeps that billow relief instead of clipping it to white.
          float top=smoothstep(.20,.80,uv.y);
          // The cloud light is authored offline. Its display response retains
          // the internal relief; the board's exposure remains untouched.
          vec3 color=cloudDisplayLight(cloud.rgb);
          color*=mix(vec3(.97,.94,1.04),vec3(1.04,1.,.98),top);
          color*=mix(vec3(1.),vec3(1.055,1.01,.97),vWarm*.6);
          float aerial=smoothstep(95.,230.,vDistance)*.27;
          color=mix(color,vec3(.74,.66,.82),aerial);
          alpha*=1.-smoothstep(180.,280.,vDistance)*.25;
          gl_FragColor=vec4(color,alpha);
          #include <colorspace_fragment>
        }`} />
  </instancedMesh>;
}
