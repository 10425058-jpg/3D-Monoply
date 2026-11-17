import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { mayAnimateEnvironment } from './environmentMotion';
import { waterfallProfile } from './waterfallProfile';

function ribbon(points: THREE.Vector3[], width: number, cascade: boolean, across?: THREE.Vector3) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns = cascade ? 8 : 2;
  points.forEach((point, i) => {
    const fraction = i / (points.length - 1);
    const tangent = points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]);
    const sideways = across ?? new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    const outward = new THREE.Vector3(sideways.z,0,-sideways.x);
    for (let j=0;j<columns;j++) {
      const u=j/(columns-1);
      const profile=cascade?waterfallProfile(fraction,u,width):{sideways:(u-.5)*width*.85,bulge:0,vertical:0};
      positions.push(point.x+sideways.x*profile.sideways+outward.x*profile.bulge,point.y+profile.vertical,
        point.z+sideways.z*profile.sideways+outward.z*profile.bulge);
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
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius+=.015; // Include the bounded vertex ripple when culling.
    parts.forEach(part=>part.dispose());
    const positions:number[]=[],corners:number[]=[],sizes:number[]=[],roles:number[]=[],seeds:number[]=[],indices:number[]=[];
    // A fixed lip and softly overlapping tail lobes retain the existing two
    // draws. No particle system, texture fetch or full-scene water pass.
    (low?[source,end]:[source,curve.getPoint(.86),end,end.clone().addScaledVector(fallAxis,width*.36).add(new THREE.Vector3(0,-.55,0))]).forEach((p,i)=>{
      for(const corner of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        positions.push(...p.toArray());corners.push(...corner);
        sizes.push(width*(i===0?.65:1.55),width*(i===0?.20:.78));
        roles.push(i===0?0:1);seeds.push(i*1.73+(variant==='left'?.8:2.1));
      }
      const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);
    });
    const spray=new THREE.BufferGeometry();
    spray.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    spray.setAttribute('corner',new THREE.Float32BufferAttribute(corners,2));
    spray.setAttribute('size',new THREE.Float32BufferAttribute(sizes,2));
    spray.setAttribute('mistRole',new THREE.Float32BufferAttribute(roles,1));
    spray.setAttribute('mistSeed',new THREE.Float32BufferAttribute(seeds,1));spray.setIndex(indices);
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
            p+=normal*sin(uv.y*12.-uTime*1.35+uv.x*9.)*.012*cascade*sin(uv.x*3.14159)*sin(uv.y*3.14159);
            vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);
            gl_Position=projectionMatrix*viewMatrix*world;}`}
        fragmentShader={`uniform float uTime;varying float vCascade;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
          float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
          void main(){
            float flow=vUv.y-uTime*.25;
            float x=vUv.x+sin(vUv.y*8.-uTime*1.1)*.012;
            float sheets=noise(vec2(x*7.,flow*2.8));
            float ripples=noise(vec2(x*17.+sheets,flow*24.));
            // Three noise fields replace four: softly separated flow lanes,
            // short traveling glints and a coherent crest, all in this pass.
            float lanes=.5+.5*sin(x*36.+sheets*3.);
            float glints=smoothstep(.73,.94,ripples)*smoothstep(.55,.88,lanes);
            float feather=.055+vUv.y*.05;
            float edges=smoothstep(0.,feather,vUv.x)*smoothstep(0.,feather,1.-vUv.x);
            float crest=exp(-vUv.y*32.)*(.72+noise(vec2(x*19.,uTime*.65))*.28);
            vec3 normal=normalize(vNormal),view=normalize(cameraPosition-vWorld);
            float rim=pow(clamp(1.-abs(dot(normal,view)),0.,1.),3.);
            float sun=.72+.28*abs(dot(normal,normalize(vec3(-.48,.72,.56))));
            vec3 color=mix(vec3(.025,.23,.29),vec3(.12,.52,.58),.25+sheets*.45+ripples*.12)*sun;
            color+=vec3(.065,.14,.15)*rim;
            float foam=clamp(crest*.78+glints*(.12+vCascade*.10),0.,.88);
            color=mix(color,vec3(.82,.94,.91),foam);
            // Unequal lane lengths dissolve into the same cloud depth; they
            // avoid the hard rectangular end of a translucent cyan sheet.
            float tailStart=.76+.075*sin(x*18.+sheets*3.);
            float tail=1.-smoothstep(tailStart,1.,vUv.y)*vCascade;
            float body=mix(.77,.47+sheets*.16+lanes*.07,vCascade);
            gl_FragColor=vec4(color,edges*tail*min(.88,body+crest*.15+glints*.07));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
    <mesh geometry={spray} raycast={()=>{}}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false}
        vertexShader={`uniform float uTime;attribute vec2 corner;attribute vec2 size;attribute float mistRole;attribute float mistSeed;
          varying vec2 vUv;varying float vRole;varying float vSeed;
          void main(){vUv=corner;vRole=mistRole;vSeed=mistSeed;vec4 mv=modelViewMatrix*vec4(position,1.);
            vec2 drift=vec2(sin(uTime*.22+mistSeed)*.055,sin(uTime*.17+mistSeed*1.7)*.045)*mistRole;
            mv.xy+=(corner+drift)*size*length(modelMatrix[0].xyz);gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`uniform float uTime;varying vec2 vUv;varying float vRole;varying float vSeed;
          void main(){vec2 q=vUv;
            q.x+=sin(q.y*3.+uTime*.35+vSeed)*.055*vRole;
            vec2 a=q-vec2(-.28,.04),b=q-vec2(.30,-.12);
            float cloud=(exp(-dot(a,a)*5.)*.55+exp(-dot(b,b)*7.)*.45);
            cloud*=1.-smoothstep(.38,1.,dot(q,q));
            gl_FragColor=vec4(.72,.90,.94,cloud*mix(.26,.17,vRole));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
  </group>;
}
