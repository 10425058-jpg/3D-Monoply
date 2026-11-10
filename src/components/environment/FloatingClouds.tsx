import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cloudLayout, EnvironmentQuality } from './environmentLayout';
import { mayAnimateEnvironment } from './environmentMotion';
import { SUN_DIRECTION } from './sunConfig';

export function FloatingClouds({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSun: { value: new THREE.Vector3(...SUN_DIRECTION) } }), []);
  const clouds = useMemo(() => cloudLayout(quality), [quality]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    clouds.forEach((cloud, i) => {
      dummy.position.set(...cloud.position); dummy.scale.set(cloud.size[0], cloud.size[1], 1);
      dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere();
  }, [clouds]);
  useFrame((_, delta) => { if (mayAnimateEnvironment(animate)) uniforms.uTime.value += Math.min(delta, .1); });
  return <instancedMesh ref={ref} name="kingdom-cloud-layers" args={[undefined, undefined, clouds.length]} renderOrder={2} raycast={() => {}}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`uniform float uTime; uniform vec3 uSun; varying vec2 vUv; varying float vSunGlow;
        void main(){vUv=uv;
          vec4 center=instanceMatrix*vec4(0.,0.,0.,1.);
          float phase=center.x*.07+center.z*.03;
          center.x+=sin(uTime*.025+phase)*1.2;
          vec3 skyDirection=normalize((modelMatrix*center).xyz-cameraPosition);
          vSunGlow=pow(max(0.,dot(skyDirection,uSun)),24.);
          vec4 mv=modelViewMatrix*center;
          vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
          mv.xy+=position.xy*size;
          gl_Position=projectionMatrix*mv;
        }`}
      fragmentShader={`varying vec2 vUv; varying float vSunGlow;
        float puff(vec2 p,vec2 center,vec2 size){vec2 q=(p-center)/size;return exp(-dot(q,q)*2.4);}
        void main(){
          float shape=puff(vUv,vec2(.28,.43),vec2(.25,.32))*.8+
            puff(vUv,vec2(.53,.58),vec2(.30,.37))+
            puff(vUv,vec2(.76,.41),vec2(.23,.29))*.8;
          float alpha=smoothstep(.10,.52,shape)*.72;
          vec3 shade=mix(vec3(.31,.26,.49),vec3(.88,.65,.72),smoothstep(.15,.85,vUv.y));
          shade=mix(shade,vec3(1.,.63,.34),vSunGlow*smoothstep(.35,.9,vUv.y)*.25);
          gl_FragColor=vec4(shade,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </instancedMesh>;
}
