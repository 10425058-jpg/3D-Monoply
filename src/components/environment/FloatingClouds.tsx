import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { atmosphereCloudLayout } from './atmosphereLayout';
import { mayAnimateEnvironment } from './environmentMotion';
import { SKY_SUN_DIRECTION } from './sunConfig';
import { createCloudAtlas } from './cloudAtlas';
import { releaseInstanceBuffers } from './instanceResources';

export function FloatingClouds({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const atlas=useMemo(()=>createCloudAtlas(quality),[quality]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSun: { value: new THREE.Vector3(...SKY_SUN_DIRECTION) }, uCloud: {value:atlas} }), [atlas]);
  useEffect(()=>()=>atlas.dispose(),[atlas]);
  const clouds = useMemo(() => atmosphereCloudLayout(quality), [quality]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    clouds.forEach((cloud, i) => {
      dummy.position.set(...cloud.position); dummy.scale.set(cloud.size[0], cloud.size[1], 1);
      dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
    });
    const instance=ref.current;
    instance.instanceMatrix.needsUpdate = true; instance.computeBoundingSphere();
    return()=>releaseInstanceBuffers(instance);
  }, [clouds]);
  useFrame((_, delta) => { if (mayAnimateEnvironment(animate)) uniforms.uTime.value += Math.min(delta, .1); });
  return <instancedMesh ref={ref} name="kingdom-cloud-layers" args={[undefined, undefined, clouds.length]} renderOrder={2} raycast={() => {}}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`uniform float uTime; uniform vec3 uSun; varying vec2 vUv; varying float vSunGlow; varying float vSeed; varying float vOpacity;
        void main(){vUv=uv;
          vec4 center=instanceMatrix*vec4(0.,0.,0.,1.);
          float phase=center.x*.07+center.z*.03;
          vSeed=fract(sin(phase*13.17)*43758.5453);
          vOpacity=mix(.87,.66,smoothstep(55.,180.,length(center.xz)));
          center.x+=sin(uTime*.025+phase)*1.2;
          vec3 skyDirection=normalize((modelMatrix*center).xyz-cameraPosition);
          vSunGlow=pow(max(0.,dot(skyDirection,uSun)),24.);
          vec4 mv=modelViewMatrix*center;
          vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
          mv.xy+=position.xy*size;
          gl_Position=projectionMatrix*mv;
        }`}
      fragmentShader={`uniform sampler2D uCloud;varying vec2 vUv; varying float vSunGlow; varying float vSeed; varying float vOpacity;
        void main(){
          float index=floor(vSeed*3.99);
          vec2 cell=vec2(mod(index,2.),floor(index/2.));
          vec4 cloud=texture2D(uCloud,(cell+clamp(vUv,.004,.996))*.5);
          float alpha=cloud.a*vOpacity;
          if(alpha<.002)discard;
          vec3 shade=cloud.rgb*1.22;
          shade=mix(shade,shade*vec3(1.3,1.04,.79),vSunGlow*.6);
          gl_FragColor=vec4(shade,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </instancedMesh>;
}
