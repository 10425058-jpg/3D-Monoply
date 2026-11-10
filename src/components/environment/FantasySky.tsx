import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mayAnimateEnvironment } from './environmentMotion';
import { SUN_DIRECTION, SUN_ANGULAR_RADIUS } from './sunConfig';

export function FantasySky({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSun: { value: new THREE.Vector3(...SUN_DIRECTION) },
    uSunRadius: { value: SUN_ANGULAR_RADIUS },
  }), []);
  useFrame(({ camera }, delta) => {
    ref.current?.position.copy(camera.position);
    if (mayAnimateEnvironment(animate)) uniforms.uTime.value += Math.min(delta, 0.1);
  });
  return <mesh ref={ref} name="kingdom-sky" scale={245} frustumCulled={false} renderOrder={-1000} raycast={() => {}}>
    <sphereGeometry args={[1, 48, 24]} />
    <shaderMaterial side={THREE.BackSide} depthWrite={false} depthTest={false} uniforms={uniforms}
      vertexShader={`varying vec3 vDirection;
        void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
      fragmentShader={`
        uniform float uTime; uniform vec3 uSun; uniform float uSunRadius; varying vec3 vDirection;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
        void main(){
          vec3 d=normalize(vDirection);
          float h=smoothstep(-0.88,0.25,d.y);
          vec3 lavender=vec3(0.13,0.10,0.32),pink=vec3(0.69,0.21,0.39),gold=vec3(0.98,0.48,0.20);
          vec3 sky=mix(lavender,vec3(0.055,0.08,0.27),h);
          float band=exp(-pow((d.y+0.42)*3.5,2.0));
          sky=mix(sky,pink,band*0.78);
          float sunDot=max(0.,dot(d,uSun));
          sky=mix(sky,gold,pow(sunDot,12.0)*0.70);
          vec2 uv=d.xz/(abs(d.y)+0.35)*4.0+vec2(uTime*0.003,0.0);
          float n=noise(uv)*0.57+noise(uv*2.1)*0.28+noise(uv*4.2)*0.15;
          float clouds=smoothstep(0.43,0.72,n)*band;
          sky=mix(sky,mix(vec3(0.37,0.20,0.51),vec3(1.,0.59,0.46),pow(sunDot,5.0)),clouds*0.65);
          sky=pow(max(sky,vec3(0.)),vec3(1.4));
          // Angular distance keeps a circular, world-fixed sun at infinity.
          // Two analytic falloffs in this existing pass need no transparent quads/bloom.
          float distanceSq=max(0.,2.*(1.-sunDot));
          float radiusSq=uSunRadius*uSunRadius;
          float halo=exp(-distanceSq/(radiusSq*7.));
          float haze=exp(-distanceSq/(radiusSq*42.));
          sky+=vec3(1.,.32,.055)*(halo*.65+haze*.10);
          float edge=max(fwidth(sunDot),0.000001);
          float disc=smoothstep(cos(uSunRadius)-edge,cos(uSunRadius)+edge,sunDot);
          float center=1.-clamp(distanceSq/radiusSq,0.,1.);
          vec3 sunlight=mix(vec3(2.4,1.25,.04),vec3(3.2,2.10,.18),center*.65);
          sky=mix(sky,sunlight,disc);
          gl_FragColor=vec4(sky,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
