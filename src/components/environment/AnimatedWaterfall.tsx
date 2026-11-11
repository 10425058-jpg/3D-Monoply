import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { mayAnimateEnvironment } from './environmentMotion';

function ribbon(points: THREE.Vector3[], width: number) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  points.forEach((point, i) => {
    const fraction = i / (points.length - 1), spread = width * (1 + fraction * .35) / 2;
    positions.push(point.x-spread, point.y, point.z, point.x+spread, point.y, point.z);
    uv.push(0, fraction, 1, fraction);
    if (i) { const n = i * 2; indices.push(n-2,n-1,n,n-1,n+1,n); }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Water attaches to actual exported cliff anchors, in glTF Y-up metres.
 * No fluid simulation, refraction, shadow maps or extra post-processing passes. */
export function AnimatedWaterfall({ file, variant, animate, low }: {
  file: string; variant: 'left' | 'right'; animate: boolean; low: boolean;
}) {
  const { scene } = useGLTF(environmentModelUrl(file));
  const { end, geometry, river } = useMemo(() => {
    scene.updateMatrixWorld(true);
    const anchor = (prefix: string) => {
      let found: THREE.Object3D | undefined;
      scene.traverse(object => { if (object.name.startsWith(prefix)) found = object; });
      if (!found) throw new Error(`Missing GLB effect anchor ${prefix}: ${file}`);
      return found.getWorldPosition(new THREE.Vector3());
    };
    const source = anchor(`waterfall_origin_${variant}`), end = anchor(`waterfall_end_${variant}`);
    const curve = new THREE.CatmullRomCurve3([source, source.clone().add(new THREE.Vector3(0,-.45,.28)),
      new THREE.Vector3((source.x+end.x)/2, end.y*.48, end.z), end]);
    const sign = Math.sign(source.x);
    const riverPoints = [[sign*2.7,.11,1.5],[sign*3.6,.1,2.5],[sign*4.6,.09,3.4],source.toArray()]
      .map(point => new THREE.Vector3(...point as [number,number,number]));
    return { end, geometry: ribbon(curve.getPoints(low ? 10 : 20), .82), river: ribbon(riverPoints, .56) };
  }, [scene, file, variant, low]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, delta) => { if (mayAnimateEnvironment(animate)) uniforms.uTime.value += Math.min(delta,.1); });
  useEffect(() => () => { geometry.dispose(); river.dispose(); }, [geometry, river]);
  const fragment = `uniform float uTime; varying vec2 vUv;
    void main(){
      float stripe=sin(vUv.x*43.+sin(vUv.y*11.-uTime*2.)*.8)*.5+.5;
      float flow=pow(sin(vUv.y*48.-uTime*5.8+vUv.x*9.)*.5+.5,9.);
      float edges=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);
      vec3 color=mix(vec3(.19,.55,.69),vec3(.75,.96,1.),stripe*.45+flow*.3);
      float tail=1.-smoothstep(.82,1.,vUv.y);
      gl_FragColor=vec4(color,edges*tail*.87);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  return <group name={`waterfall-${variant}`}>
    {[geometry,river].map((part,index) => <mesh key={index} geometry={part} raycast={() => {}}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide}
        vertexShader="varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={fragment} />
    </mesh>)}
    {!low && <mesh position={end} scale={[3,1.5,1]} raycast={() => {}}>
      <planeGeometry args={[1,1]} />
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv; vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);
          mv.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`uniform float uTime; varying vec2 vUv; void main(){vec2 q=(vUv-.5)*2.;
          float mist=exp(-dot(q,q)*3.5)*(.15+.025*sin(uTime*.7+vUv.x*5.));
          gl_FragColor=vec4(.76,.82,1.,mist);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
    </mesh>}
  </group>;
}
