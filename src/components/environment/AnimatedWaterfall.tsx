import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { environmentModelUrl } from './GltfEnvironmentModel';
import { mayAnimateEnvironment } from './environmentMotion';
import { waterfallProfile } from './waterfallProfile';

function ribbon(points: THREE.Vector3[], width: number, cascade: boolean, across?: THREE.Vector3, strand = -1) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const columns = strand >= 0 ? 3 : cascade ? 14 : 4;
  points.forEach((point, i) => {
    const fraction = i / (points.length - 1);
    const tangent = points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]);
    const sideways = across ?? new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    const outward = new THREE.Vector3(sideways.z,0,-sideways.x);
    for (let j=0;j<columns;j++) {
      const localU=j/(columns-1);
      // Separate strands occupy unequal lanes of the same authored curtain.
      // They leave the exact crest together, then lift from its convex face.
      const taper=.62+.38*Math.sin(fraction*Math.PI);
      const centers=[.16,.48,.80],widths=[.17,.23,.18];
      const u=strand<0?localU:centers[strand]+(localU-.5)*widths[strand]*taper;
      const profile=cascade?waterfallProfile(fraction,u,width):{sideways:(u-.5)*width*.85,bulge:0,vertical:0};
      const lift=strand<0?0:Math.sin(fraction*Math.PI)*width*(.035+strand%2*.025);
      positions.push(point.x+sideways.x*profile.sideways+outward.x*(profile.bulge+lift),point.y+profile.vertical,
        point.z+sideways.z*profile.sideways+outward.z*(profile.bulge+lift));
      uv.push(strand<0?u:localU,fraction);
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
  geometry.setAttribute('flowLayer',new THREE.Float32BufferAttribute(Array(positions.length/3).fill(strand<0?0:1+strand*.17),1));
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
    const samples=curve.getPoints(low?16:32);
    const parts=[ribbon(samples,width,true,fallAxis),ribbon(riverPoints,width,false)];
    // Three broad folded sheets supply volume and silver flow highlights.
    // Merge them with the river/curtain, keeping one water draw at every LOD.
    for(let lane=0;lane<(low?2:3);lane++)parts.push(ribbon(samples,width,true,fallAxis,low?lane*2:lane));
    const geometry=new THREE.BufferGeometry();
    for(const key of ['position','uv','cascade','flowLayer']) {
      const arrays=parts.map(part=>part.getAttribute(key));
      geometry.setAttribute(key,new THREE.Float32BufferAttribute(arrays.flatMap(array=>Array.from(array.array)),arrays[0].itemSize));
    }
    let offset=0;const mergedIndices:number[]=[];
    for(const part of parts){mergedIndices.push(...Array.from(part.index!.array,index=>index+offset));offset+=part.getAttribute('position').count;}
    geometry.setIndex(mergedIndices);
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius+=.015; // Include the bounded vertex ripple when culling.
    parts.forEach(part=>part.dispose());
    const positions:number[]=[],corners:number[]=[],sizes:number[]=[],roles:number[]=[],seeds:number[]=[],indices:number[]=[];
    // A fixed lip and softly overlapping tail lobes retain the existing two
    // draws. No particle system, texture fetch or full-scene water pass.
    const mistSites=low?[source,curve.getPoint(.88),end]:[source,curve.getPoint(.80),curve.getPoint(.91),end,
      end.clone().addScaledVector(fallAxis,-width*.64).add(new THREE.Vector3(0,-.28,0)),
      end.clone().addScaledVector(fallAxis,width*.58).add(new THREE.Vector3(0,-.48,0))];
    mistSites.forEach((p,i)=>{
      for(const corner of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        positions.push(...p.toArray());corners.push(...corner);
        sizes.push(width*(i===0?.73:i<3?.95:1.72),width*(i===0?.24:i<3?.64:.92));
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
    spray.computeBoundingSphere();spray.boundingSphere!.radius+=width*2.1;
    return {geometry,spray};
  },[scene,file,variant,low]);
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  useFrame((_,delta)=>{if(mayAnimateEnvironment(animate))uniforms.uTime.value+=Math.min(delta,.1);});
  useEffect(()=>()=>{geometry.dispose();spray.dispose();},[geometry,spray]);
  return <group name={name??`waterfall-${variant}`}>
    <mesh geometry={geometry} raycast={()=>{}}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} forceSinglePass
        vertexShader={`uniform float uTime;attribute float cascade;attribute float flowLayer;varying float vCascade;varying float vLayer;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
          void main(){vUv=uv;vCascade=cascade;vLayer=flowLayer;vec3 p=position;
            p+=normal*sin(uv.y*12.-uTime*1.35+uv.x*9.+flowLayer)*.012*cascade*sin(uv.x*3.14159)*sin(uv.y*3.14159);
            vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*normal);
            gl_Position=projectionMatrix*viewMatrix*world;}`}
        fragmentShader={`uniform float uTime;varying float vCascade;varying float vLayer;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
          float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
          void main(){
            float flow=vUv.y-uTime*.25-vLayer*.11;
            float x=vUv.x+sin(vUv.y*8.-uTime*1.1)*.012;
            float sheets=noise(vec2(x*7.,flow*2.8));
            float ripples=noise(vec2(x*17.+sheets,flow*24.));
            // The sheet fields define the flow lanes and their traveling glints.
            float lanes=.5+.5*sin(x*48.+sheets*3.);
            float lanes2=lanes*lanes;
            float filaments=lanes2*lanes2*lanes2*lanes;
            float glints=smoothstep(.65,.91,ripples)*smoothstep(.51,.87,lanes);
            float feather=.055+vUv.y*.05;
            float edges=smoothstep(0.,feather,vUv.x)*smoothstep(0.,feather,1.-vUv.x);
            // The crest's exponential has faded below visible precision here.
            float crest=0.;
            if(vUv.y<.38)crest=exp(-vUv.y*23.)*(.72+noise(vec2(x*19.,uTime*.65))*.28);
            vec3 color;
            float body;
            if(vLayer>.5){
              float silver=pow(sin(vUv.x*3.14159),1.2);
              color=mix(vec3(.035,.49,.59),vec3(1.10,1.19,1.12),silver*(.35+ripples*.43));
              body=.18+ripples*.19;
            }else{
              vec3 normal=normalize(vNormal),view=normalize(cameraPosition-vWorld);
              float grazing=clamp(1.-abs(dot(normal,view)),0.,1.);
              float rim=grazing*grazing*grazing;
              float sun=.72+.28*abs(dot(normal,normalize(vec3(-.48,.72,.56))));
              color=mix(vec3(.006,.19,.24),vec3(.035,.61,.72),.22+sheets*.56+ripples*.16)*sun;
              color+=vec3(.07,.17,.20)*rim;
              float foam=clamp(crest*.96+glints*.31+filaments*mix(.12,.19,vCascade),0.,.96);
              color=mix(color,vec3(1.03,1.16,1.10),foam);
              body=mix(.88,.63+sheets*.14+filaments*.13,vCascade);
            }
            // Unequal lane lengths dissolve into the same cloud depth; they
            // avoid the hard rectangular end of a translucent cyan sheet.
            float tailStart=.73+.09*sin(x*18.+sheets*3.+vLayer);
            float tail=1.-smoothstep(tailStart,1.,vUv.y)*vCascade;
            gl_FragColor=vec4(color,edges*tail*min(.94,body+crest*.15+glints*.09));
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
            vec3 color=mix(vec3(.48,.69,.82),vec3(.99,1.07,1.08),smoothstep(-.55,.62,q.y));
            gl_FragColor=vec4(color,cloud*mix(.40,.25,vRole));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
  </group>;
}
