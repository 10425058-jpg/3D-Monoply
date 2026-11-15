import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { mayAnimateEnvironment } from './environmentMotion';

function ribbon(points: THREE.Vector3[], width: number, cascade: boolean, across?: THREE.Vector3) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns = cascade ? 8 : 2;
  points.forEach((point, i) => {
    const fraction = i / (points.length - 1);
    const tangent = points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]);
    const sideways = across ?? new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    const outward = new THREE.Vector3(sideways.z,0,-sideways.x);
    const opening=Math.min(1,fraction/.20);
    const spread = width * (cascade ? 1+opening*opening*(3-2*opening)*.34+Math.sin(fraction*Math.PI*.82)*.55 : .85);
    for (let j=0;j<columns;j++) {
      const u=j/(columns-1), x=(u-.5)*spread;
      // Convex, scalloped curtain retains a silhouette at oblique angles.
      const depth=cascade ? Math.sin(u*Math.PI)*width*.28 + Math.sin(u*13+fraction*8)*width*.035 : 0;
      positions.push(point.x+sideways.x*x+outward.x*depth,point.y,point.z+sideways.z*x+outward.z*depth);
      uv.push(u,fraction);
      if (i && j) {
        const n=i*columns+j;
        indices.push(n-columns-1,n-columns,n-1,n-columns,n,n-1);
      }
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('cascade',new THREE.Float32BufferAttribute(Array(positions.length/3).fill(cascade?1:0),1));
  geometry.setIndex(indices);
  return geometry;
}

/** Anchor-driven curved curtains, river and dissipating mist. Two draws per
 * waterfall at every quality, no refraction, fluid simulation or shadow pass. */
export function AnimatedWaterfall({ file, variant, animate, low, name }: {
  file: string; variant: 'left' | 'right'; animate: boolean; low: boolean; name?: string;
}) {
  const { scene }=useGLTF(environmentModelUrl(file));
  const { geometry, spray }=useMemo(()=>{
    scene.updateMatrixWorld(true);
    const anchorObject=(prefix:string)=>{
      let found:THREE.Object3D|undefined;
      scene.traverse(object=>{if(object.name.startsWith(prefix))found=object;});
      if(!found)throw new Error(`Missing GLB effect anchor ${prefix}: ${file}`);
      return found;
    };
    const origin=anchorObject(`waterfall_origin_${variant}`);
    const source=origin.getWorldPosition(new THREE.Vector3());
    const end=anchorObject(`waterfall_end_${variant}`).getWorldPosition(new THREE.Vector3());
    const outward=new THREE.Vector3(source.x,0,source.z).normalize();
    const lip=source.clone().addScaledVector(outward,.42).add(new THREE.Vector3(0,-.45,0));
    const middle=source.clone().lerp(end,.48).addScaledVector(outward,.65);
    const curve=new THREE.CatmullRomCurve3([source,lip,middle,end]);
    const sign=Math.sign(source.x);
    const riverPoints:THREE.Vector3[]=[];
    scene.traverse(object=>{
      if(object.name.startsWith('watercourse_') && object.name.includes(`_${variant}`)) {
        const index=Number(object.name.match(/^watercourse_(\d+)/)?.[1]);
        riverPoints[index]=object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.025,0));
      }
    });
    if(riverPoints.length<2)riverPoints.push(...[[sign*2.7,.11,1.5],[sign*3.6,.1,2.5],[sign*4.6,.09,3.4],source.toArray()]
      .map(point=>new THREE.Vector3(...point as [number,number,number])));
    const fallAxis=new THREE.Vector3(-(end.z-source.z),0,end.x-source.x).normalize();
    const width=Number(origin.userData.width)||1.2;
    const parts=[ribbon(curve.getPoints(low?12:24),width,true,fallAxis),ribbon(riverPoints,width,false)];
    const geometry=new THREE.BufferGeometry();
    for(const key of ['position','uv','cascade']) {
      const arrays=parts.map(part=>part.getAttribute(key));
      geometry.setAttribute(key,new THREE.Float32BufferAttribute([...arrays[0].array,...arrays[1].array],arrays[0].itemSize));
    }
    const offset=parts[0].getAttribute('position').count;
    geometry.setIndex([...parts[0].index!.array,...Array.from(parts[1].index!.array,index=>index+offset)]);
    geometry.computeBoundingSphere();parts.forEach(part=>part.dispose());
    const positions:number[]=[],corners:number[]=[],sizes:number[]=[],indices:number[]=[];
    // Lip foam and three dissipating spray puffs share one billboard draw.
    [source,curve.getPoint(.84),end,end.clone().add(new THREE.Vector3(width*.45,-.8,0))].slice(0,low?1:4).forEach((p,i)=>{
      for(const corner of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        positions.push(...p.toArray());corners.push(...corner);
        sizes.push(width*(i===0?.75:1.5),width*(i===0?.24:.68));
      }
      const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);
    });
    const spray=new THREE.BufferGeometry();
    spray.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    spray.setAttribute('corner',new THREE.Float32BufferAttribute(corners,2));
    spray.setAttribute('size',new THREE.Float32BufferAttribute(sizes,2));spray.setIndex(indices);
    spray.computeBoundingSphere();spray.boundingSphere!.radius+=width*2;
    return {geometry,spray};
  },[scene,file,variant,low]);
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  useFrame((_,delta)=>{if(mayAnimateEnvironment(animate))uniforms.uTime.value+=Math.min(delta,.1);});
  useEffect(()=>()=>{geometry.dispose();spray.dispose();},[geometry,spray]);
  return <group name={name??`waterfall-${variant}`}>
    <mesh geometry={geometry} raycast={()=>{}}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} forceSinglePass
        vertexShader={`attribute float cascade;varying float vCascade;varying vec2 vUv;
          void main(){vUv=uv;vCascade=cascade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`uniform float uTime;varying float vCascade;varying vec2 vUv;
          float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
          void main(){
            float x=vUv.x+sin(vUv.y*7.-uTime*1.5)*.012;
            float sheets=noise(vec2(x*8.,vUv.y*1.7-uTime*.42));
            float ripples=noise(vec2(x*17.,vUv.y*16.-uTime*3.1));
            float glints=pow(.5+.5*sin(x*64.+sin(vUv.y*4.-uTime)*.45),12.)*.12;
            float edges=smoothstep(0.,.13,vUv.x)*smoothstep(0.,.13,1.-vUv.x);
            float crest=exp(-vUv.y*29.)*(.65+noise(vec2(x*23.,uTime*.8))*.35);
            vec3 color=mix(vec3(.015,.21,.33),vec3(.50,.85,1.),.21+sheets*.40+ripples*.08+glints);
            color=mix(color,vec3(.93,.98,1.),crest*.78);
            float tail=1.-smoothstep(.62,1.,vUv.y)*vCascade;
            gl_FragColor=vec4(color,edges*tail*(.84+sheets*.12));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
    <mesh geometry={spray} raycast={()=>{}}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false}
        vertexShader={`attribute vec2 corner;attribute vec2 size;varying vec2 vUv;
          void main(){vUv=corner;vec4 mv=modelViewMatrix*vec4(position,1.);
            mv.xy+=corner*size*length(modelMatrix[0].xyz);gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`uniform float uTime;varying vec2 vUv;
          void main(){vec2 q=vUv;
            q.x+=sin(q.y*4.+uTime*.4)*.08;
            float cloud=exp(-dot(q,q)*2.7)*(.25+.025*sin(q.x*9.+uTime));
            gl_FragColor=vec4(.76,.92,1.,cloud);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
  </group>;
}
