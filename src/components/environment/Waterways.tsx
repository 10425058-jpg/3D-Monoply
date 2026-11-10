import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CASTLE_SITES, RIVER_POINTS, terrainHeight } from './environmentLayout';
import { mayAnimateEnvironment } from './environmentMotion';

const riverCurve = () => new THREE.CatmullRomCurve3(RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, terrainHeight(x, z) + .35, z)));
function createRiver() {
  const curve = riverCurve(), positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 180; i++) {
    const t = i / 180, point = curve.getPoint(t), tangent = curve.getTangent(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const width = 3 + Math.sin(t * Math.PI) * 2.8;
    for (const side of [-1, 1]) {
      const x = point.x + normal.x * width * side, z = point.z + normal.z * width * side;
      positions.push(x, terrainHeight(x, z) + .38, z); uv.push((side + 1) / 2, t);
    }
    if (i < 180) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

const waterVertex = `varying vec2 vUv; varying float vDepth; void main(){vUv=uv;
  vec4 p=modelViewMatrix*vec4(position,1.0); vDepth=-p.z; gl_Position=projectionMatrix*p;}`;
const waterFragment = `uniform float uTime; varying vec2 vUv; varying float vDepth;
  void main(){float ripple=sin(vUv.y*250.+uTime*.8+sin(vUv.x*18.))*sin(vUv.x*39.-uTime*.4);
    vec3 color=mix(vec3(.01,.06,.12),vec3(.08,.22,.31),ripple*.16+.35);
    float reflection=pow(max(0.,sin(vUv.y*80.+sin(vUv.x*18.)*.4)),14.)*.25;
    color=mix(color,vec3(.94,.68,.43),reflection);
    color=mix(color,vec3(.22,.22,.36),smoothstep(100.,240.,vDepth)*.55);
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function StoneBridges() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-9, -2); shape.lineTo(9, -2); shape.lineTo(9, 3.5); shape.lineTo(-9, 3.5); shape.closePath();
    for (const x of [-5.7, 0, 5.7]) {
      const hole = new THREE.Path();
      hole.moveTo(x - 2, -1.9); hole.lineTo(x + 2, -1.9); hole.lineTo(x + 2, .5);
      hole.absarc(x, .5, 2, 0, Math.PI, false); hole.lineTo(x - 2, -1.9); hole.closePath();
      shape.holes.push(hole);
    }
    return new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false, steps: 1 });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="ancient-stone-bridges">{[.31, .68].map(t => {
    const curve = riverCurve(), p = curve.getPoint(t), tangent = curve.getTangent(t);
    return <group key={t} position={[p.x, terrainHeight(p.x, p.z) + .6, p.z]} rotation={[0, Math.atan2(tangent.x, tangent.z), 0]}>
      <mesh geometry={geometry} raycast={() => {}}><meshStandardMaterial color="#c4b29d" roughness={.95} fog={false} /></mesh>
      {[-.25, 1.65].map(z => <mesh key={z} position={[0, 3.8, z]} raycast={() => {}}>
        <boxGeometry args={[18.6, .6, .45]} /><meshStandardMaterial color="#dfcaaa" roughness={.9} fog={false} />
      </mesh>)}
    </group>;
  })}</group>;
}

export function Waterways({ animate }: { animate: boolean }) {
  const geometry = useMemo(createRiver, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => { if (mayAnimateEnvironment(animate)) uniforms.uTime.value += Math.min(delta, .1); });
  return <group name="kingdom-waterways">
    <mesh geometry={geometry} name="winding-kingdom-river" raycast={() => {}}>
      <shaderMaterial uniforms={uniforms} vertexShader={waterVertex} fragmentShader={waterFragment} side={THREE.DoubleSide} />
    </mesh>
    {CASTLE_SITES.map((site, index) => {
      const radius = Math.hypot(site.x, site.z), nx = -site.x / radius, nz = -site.z / radius;
      const x = site.x + nx * 8.5 * site.size, z = site.z + nz * 8.5 * site.size;
      const top = terrainHeight(site.x, site.z) + site.rise;
      const bottom = terrainHeight(x, z) - .25, height = top - bottom;
      return <group key={index} name={`distant-waterfall-${index}`} position={[x, (top + bottom) / 2, z]} rotation={[0, Math.atan2(nx, nz), 0]}>
        <mesh raycast={() => {}}>
          <planeGeometry args={[2.8 * site.size, height, 1, 1]} />
          <shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} vertexShader={waterVertex}
            fragmentShader={`uniform float uTime; varying vec2 vUv; varying float vDepth;
              void main(){float strands=sin(vUv.x*37.+sin(vUv.y*12.+uTime*2.4))*.5+.5;
                float flow=sin(vUv.y*65.+uTime*4.)*.5+.5;
                vec3 c=mix(vec3(.29,.57,.72),vec3(.83,.91,.93),strands*.65+flow*.2);
                float edge=smoothstep(0.,.15,vUv.x)*smoothstep(0.,.15,1.-vUv.x);
                gl_FragColor=vec4(c,edge*.8);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
              }`} />
        </mesh>
      </group>;
    })}
    <StoneBridges />
  </group>;
}
