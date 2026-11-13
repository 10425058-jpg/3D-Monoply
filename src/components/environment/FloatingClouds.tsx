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
        void puff(vec2 p,vec2 center,vec2 size,inout vec3 normal,inout float cover){
          vec2 q=(p-center)/size;float r=dot(q,q),h=sqrt(max(0.,1.-r));
          float weight=h*h*h;normal+=vec3(q*.78,h)*weight;
          cover=max(cover,1.-smoothstep(.60,1.02,r));
        }
        float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
        void main(){
          vec2 p=vUv; p.y+=(vSeed-.5)*.09;
          vec3 normal=vec3(0.);float cover=0.;
          puff(p,vec2(.13,.38),vec2(.17,.23),normal,cover);
          puff(p,vec2(.30,.52+vSeed*.04),vec2(.21,.31),normal,cover);
          puff(p,vec2(.52,.57),vec2(.24,.37),normal,cover);
          puff(p,vec2(.73,.49-vSeed*.05),vec2(.22,.29),normal,cover);
          puff(p,vec2(.88,.36),vec2(.15,.20),normal,cover);
          puff(p,vec2(.49,.31),vec2(.42,.22),normal,cover);
          float detail=noise(p*vec2(18.,11.)+vSeed*17.);
          float feather=smoothstep(0.,.055,vUv.x)*smoothstep(0.,.055,1.-vUv.x)*
            smoothstep(0.,.055,vUv.y)*smoothstep(0.,.055,1.-vUv.y);
          float alpha=cover*vOpacity*feather;
          if(alpha<.002)discard;
          normal=normalize(normal+vec3(0.,0.,.015));
          float lit=max(0.,dot(normal,normalize(vec3(.45,.82,.54))));
          float rim=smoothstep(.27,.85,p.y);
          vec3 shade=mix(vec3(.34,.27,.48),vec3(1.,.85,.78),.16+lit*.68+rim*.10);
          shade*=.97+detail*.035;
          shade=mix(shade,vec3(1.,.78,.53),vSunGlow*(.15+rim*.20));
          gl_FragColor=vec4(shade,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </instancedMesh>;
}
