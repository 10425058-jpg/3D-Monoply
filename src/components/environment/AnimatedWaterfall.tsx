import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { mayAnimateEnvironment } from './environmentMotion';

function ribbon(points: THREE.Vector3[], width: number, across?: THREE.Vector3) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  points.forEach((point, i) => {
    const fraction = i / (points.length - 1);
    const tangent = points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]);
    const sideways = across ?? new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    const spread = sideways.clone().multiplyScalar(width * (1 + fraction * .18) / 2);
    positions.push(point.x-spread.x, point.y, point.z-spread.z, point.x+spread.x, point.y, point.z+spread.z);
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
    const anchorObject = (prefix: string) => {
      let found: THREE.Object3D | undefined;
      scene.traverse(object => { if (object.name.startsWith(prefix)) found = object; });
      if (!found) throw new Error(`Missing GLB effect anchor ${prefix}: ${file}`);
      return found;
    };
    const origin = anchorObject(`waterfall_origin_${variant}`);
    const source = origin.getWorldPosition(new THREE.Vector3());
    const end = anchorObject(`waterfall_end_${variant}`).getWorldPosition(new THREE.Vector3());
    const outward = new THREE.Vector3(source.x,0,source.z).normalize();
    const lip = source.clone().addScaledVector(outward,.42).add(new THREE.Vector3(0,-.45,0));
    const middle = source.clone().lerp(end,.48).addScaledVector(outward,.65);
    const curve = new THREE.CatmullRomCurve3([source,lip,middle,end]);
    const sign = Math.sign(source.x);
    const riverPoints: THREE.Vector3[] = [];
    scene.traverse(object => {
      if (object.name.startsWith('watercourse_') && object.name.includes(`_${variant}`)) {
        const index = Number(object.name.match(/^watercourse_(\d+)/)?.[1]);
        riverPoints[index] = object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.025,0));
      }
    });
    if (riverPoints.length < 2) riverPoints.push(...[[sign*2.7,.11,1.5],[sign*3.6,.1,2.5],[sign*4.6,.09,3.4],source.toArray()]
      .map(point => new THREE.Vector3(...point as [number,number,number])));
    const fallAxis = new THREE.Vector3(-(end.z-source.z),0,end.x-source.x).normalize();
    const width = Number(origin.userData.width) || 1.2;
    return { end, geometry: ribbon(curve.getPoints(low ? 12 : 24), width, fallAxis), river: ribbon(riverPoints, width*.72) };
  }, [scene, file, variant, low]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, delta) => { if (mayAnimateEnvironment(animate)) uniforms.uTime.value += Math.min(delta,.1); });
  useEffect(() => () => { geometry.dispose(); river.dispose(); }, [geometry, river]);
  const fragment = `uniform float uTime; uniform float uCascade; varying vec2 vUv;
    void main(){
      float stripe=sin(vUv.x*31.+sin(vUv.y*15.-uTime*2.)*.65)*.5+.5;
      float flow=pow(sin(vUv.y*62.-uTime*7.2+vUv.x*12.)*.5+.5,9.);
      float edges=smoothstep(0.,.09,vUv.x)*smoothstep(0.,.09,1.-vUv.x);
      float foam=pow(abs(vUv.x-.5)*2.,5.)*.5+flow*.55;
      vec3 color=mix(vec3(.12,.39,.53),vec3(.86,.95,1.),stripe*.3+foam);
      float tail=1.-smoothstep(.84,1.,vUv.y)*uCascade;
      gl_FragColor=vec4(color,edges*tail*.95);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  return <group name={`waterfall-${variant}`}>
    {[geometry,river].map((part,index) => <mesh key={index} geometry={part} raycast={() => {}}>
      <shaderMaterial uniforms={{...uniforms,uCascade:{value:index === 0 ? 1 : 0}}} transparent depthWrite={false} side={THREE.DoubleSide}
        vertexShader="varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={fragment} />
    </mesh>)}
    {!low && <mesh position={end} scale={[4.5,2.2,1]} raycast={() => {}}>
      <planeGeometry args={[1,1]} />
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv; vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);
          mv.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`uniform float uTime; varying vec2 vUv; void main(){vec2 q=(vUv-.5)*2.;
          float mist=exp(-dot(q,q)*3.5)*(.24+.025*sin(uTime*.7+vUv.x*5.));
          gl_FragColor=vec4(.88,.82,.91,mist);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
    </mesh>}
  </group>;
}
