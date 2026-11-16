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
    const spread = width * (cascade ? 1+opening*opening*(3-2*opening)*.26+Math.sin(fraction*Math.PI*.88)*.43 : .85);
    for (let j=0;j<columns;j++) {
      const u=j/(columns-1), x=(u-.5)*spread;
      // Convex, scalloped curtain retains a silhouette at oblique angles.
      const depth=cascade ? Math.sin(u*Math.PI)*width*.38 + Math.sin(u*13+fraction*8)*width*.045 : 0;
      const drift=cascade?Math.sin(fraction*4.8)*width*.13+Math.pow(fraction,3)*width*.17:0;
      const scallop=cascade?Math.sin(u*10.5+fraction*7)*width*.028*Math.sin(fraction*Math.PI):0;
      positions.push(point.x+sideways.x*(x+drift)+outward.x*depth,point.y+scallop,point.z+sideways.z*(x+drift)+outward.z*depth);
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
    const middle=source.clone().lerp(end,.48).addScaledVector(outward,.92);
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
    geometry.computeVertexNormals();geometry.computeBoundingSphere();parts.forEach(part=>part.dispose());
    const positions:number[]=[],corners:number[]=[],sizes:number[]=[],indices:number[]=[];
    // Lip foam and three dissipating spray puffs share one billboard draw.
    (low?[source,end]:[source,curve.getPoint(.88),end,end.clone().add(new THREE.Vector3(width*.45,-.8,0))]).forEach((p,i)=>{
      for(const corner of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        positions.push(...p.toArray());corners.push(...corner);
        sizes.push(width*(i===0?.78:1.7),width*(i===0?.23:.72));
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
        vertexShader={`uniform float uTime;attribute float cascade;varying float vCascade;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
          void main(){vUv=uv;vCascade=cascade;vec3 p=position;
            p.x+=sin(uv.y*14.-uTime*1.25+position.z)*.018*cascade*sin(uv.x*3.14159);
            vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);
            gl_Position=projectionMatrix*viewMatrix*world;}`}
        fragmentShader={`uniform float uTime;varying float vCascade;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
          float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
          void main(){
            float flow=vUv.y-uTime*.28;
            float x=vUv.x+sin(vUv.y*9.-uTime*1.8)*.014;
            float sheets=noise(vec2(x*7.,flow*2.6));
            float ripples=noise(vec2(x*16.+sheets,flow*18.));
            // Short, connected foam patches follow the flow. Long narrow
            // anisotropic noise made bright hairlines across the whole fall.
            float whitewater=smoothstep(.64,.88,noise(vec2(x*14.+sheets*1.6,flow*20.)));
            float edges=smoothstep(0.,.10,vUv.x)*smoothstep(0.,.10,1.-vUv.x);
            float crest=exp(-vUv.y*31.)*(.7+noise(vec2(x*21.,uTime*.8))*.3);
            vec3 normal=normalize(vNormal),view=normalize(cameraPosition-vWorld);
            float rim=pow(clamp(1.-abs(dot(normal,view)),0.,1.),3.);
            float sun=.5+.5*abs(dot(normal,normalize(vec3(-.48,.72,.56))));
            vec3 color=mix(vec3(.006,.18,.24),vec3(.09,.62,.72),.25+sheets*.54+ripples*.14)*sun;
            color+=vec3(.12,.35,.36)*rim;
            float foam=clamp(crest*.94+whitewater*(.07+vCascade*.08)+smoothstep(.76,1.,vUv.y)*whitewater*.08,0.,.96);
            color=mix(color,vec3(.91,1.12,1.08),foam);
            float tail=1.-smoothstep(.81,1.,vUv.y)*vCascade;
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
            float cloud=exp(-dot(q,q)*3.2)*(.19+.025*sin(q.x*9.+uTime));
            cloud*=1.-smoothstep(.38,1.,dot(q,q));
            gl_FragColor=vec4(.67,.94,1.04,cloud);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
  </group>;
}
