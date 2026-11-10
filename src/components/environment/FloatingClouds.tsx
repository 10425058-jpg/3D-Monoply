import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_SITES, EnvironmentQuality, ENVIRONMENT_BUDGETS, terrainHeight, variation } from './environmentLayout';
import { mayAnimateEnvironment } from './environmentMotion';
import { SUN_DIRECTION } from './sunConfig';

export function FloatingClouds({ quality, animate }: { quality: EnvironmentQuality; animate: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSun: { value: new THREE.Vector3(...SUN_DIRECTION) } }), []);
  const clouds = useMemo(() => {
    const entries: { position: [number, number, number]; size: [number, number] }[] = [];
    const count = ENVIRONMENT_BUDGETS[quality].clouds;
    for (let i = 0; i < count; i++) {
      const near = i < 12, angle = i * 2.399963;
      const radius = near ? 24 + variation(i, 21) * 10 : 48 + variation(i, 22) * 90;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      entries.push({ position: [x, near ? -10 - variation(i, 23) * 3 : terrainHeight(x, z) + 6, z],
        size: near ? [13 + variation(i, 24) * 6, 7 + variation(i, 25)] : [17 + variation(i, 26) * 9, 8 + variation(i, 27) * 4] });
    }
    for (const site of CASTLE_SITES) {
      const length = Math.hypot(site.x, site.z);
      const x = site.x - site.x / length * 8.5 * site.size, z = site.z - site.z / length * 8.5 * site.size;
      entries.push({ position: [x, terrainHeight(x, z) + .6, z], size: [6 * site.size, 2.6 * site.size] });
    }
    // Overlapping billboards fill the space under the board without a flat cloud disc.
    for (const [x, z] of [[0, 0], [12, 3], [-10, 5], [0, -12], [0, 14]])
      entries.push({ position: [x, -13, z], size: [20, 10] });
    return entries;
  }, [quality]);
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
