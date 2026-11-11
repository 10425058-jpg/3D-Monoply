import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { atmosphereCloudLayout } from './atmosphereLayout';
import { mayAnimateEnvironment } from './environmentMotion';
import { SKY_SUN_DIRECTION } from './sunConfig';

export function FloatingClouds({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSun: { value: new THREE.Vector3(...SKY_SUN_DIRECTION) } }), []);
  const clouds = useMemo(() => atmosphereCloudLayout(quality), [quality]);
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
      vertexShader={`uniform float uTime; uniform vec3 uSun; varying vec2 vUv; varying float vSunGlow; varying float vSeed; varying float vOpacity;
        void main(){vUv=uv;
          vec4 center=instanceMatrix*vec4(0.,0.,0.,1.);
          float phase=center.x*.07+center.z*.03;
          vSeed=fract(sin(phase*13.17)*43758.5453);
          vOpacity=mix(.58,.40,smoothstep(55.,180.,length(center.xz)));
          center.x+=sin(uTime*.025+phase)*1.2;
          vec3 skyDirection=normalize((modelMatrix*center).xyz-cameraPosition);
          vSunGlow=pow(max(0.,dot(skyDirection,uSun)),24.);
          vec4 mv=modelViewMatrix*center;
          vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
          mv.xy+=position.xy*size;
          gl_Position=projectionMatrix*mv;
        }`}
      fragmentShader={`varying vec2 vUv; varying float vSunGlow; varying float vSeed; varying float vOpacity;
        float puff(vec2 p,vec2 center,vec2 size){vec2 q=(p-center)/size;float r=max(0.,1.-dot(q,q)*.65);return r*r*r;}
        float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
        void main(){
          vec2 p=vUv; p.y+=(vSeed-.5)*.10;
          float shape=puff(p,vec2(.13,.36),vec2(.17,.29))*.63+
            puff(p,vec2(.31,.50),vec2(.23,.36))*.88+
            puff(p,vec2(.52,.57),vec2(.26,.40))+
            puff(p,vec2(.72,.47),vec2(.22,.33))*.86+
            puff(p,vec2(.88,.34),vec2(.16,.26))*.57+
            puff(p,vec2(.48,.27),vec2(.43,.21))*.68;
          float detail=noise(p*vec2(9.,6.)+vSeed*17.)*.7+noise(p*vec2(20.,13.)-vSeed*11.)*.3;
          shape+=(detail-.5)*.13;
          float alpha=smoothstep(.09,.64,shape)*vOpacity;
          if(alpha<.002)discard;
          float rim=smoothstep(.35,.85,p.y)*(.72+detail*.28);
          vec3 shade=mix(vec3(.36,.29,.52),vec3(.91,.70,.75),rim);
          shade=mix(shade,vec3(1.,.73,.48),vSunGlow*(.23+rim*.30));
          gl_FragColor=vec4(shade,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </instancedMesh>;
}
