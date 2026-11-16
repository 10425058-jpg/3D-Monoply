import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {releaseInstanceBuffers} from '../../environment/instanceResources';
import {mayAnimateEnvironment} from '../../environment/environmentMotion';

type Anchor={name:string;role:string;position:THREE.Vector3;scale:number;level:number;radius:number};
type Quality='low'|'balanced'|'high';

function fountainGeometry(quality:Quality){
  const pieces:{geometry:THREE.BufferGeometry;jet:number}[]=[];
  for(const [radius,y] of [[1.075,.445],[.55,1.165],[.32,1.74]]){
    const geometry=new THREE.CircleGeometry(radius,quality==='low'?28:48);geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);pieces.push({geometry,jet:0});
  }
  const count=quality==='low'?6:8;
  for(let i=0;i<count;i++){
    const a=i*Math.PI*2/count;
    const curve=new THREE.CatmullRomCurve3(Array.from({length:17},(_,j)=>{
      const t=j/16,r=.09+t*1.0;return new THREE.Vector3(Math.cos(a)*r,1.62+Math.sin(t*Math.PI)*.76-t*1.12,Math.sin(a)*r);
    }));
    pieces.push({geometry:new THREE.TubeGeometry(curve,quality==='low'?16:26,.022,quality==='low'?4:6,false),jet:1});
  }
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],jets:number[]=[],indices:number[]=[];
  for(const {geometry,jet} of pieces){
    const offset=positions.length/3;positions.push(...geometry.getAttribute('position').array);normals.push(...geometry.getAttribute('normal').array);uvs.push(...geometry.getAttribute('uv').array);
    jets.push(...Array(geometry.getAttribute('position').count).fill(jet));indices.push(...Array.from(geometry.index!.array,i=>i+offset));geometry.dispose();
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.setAttribute('waterJet',new THREE.Float32BufferAttribute(jets,1));result.setIndex(indices);result.computeBoundingSphere();return result;
}

/** Four small shared-program draws: actual water surfaces/jets, spray points,
 * warm lantern halos and waving flags. No local lights or refraction passes. */
export function RoyalCityEffects({anchors,level,quality,animate}:{anchors:Anchor[];level:number;quality:Quality;animate:boolean}){
  const flags=useRef<THREE.InstancedMesh>(null),lamps=useRef<THREE.InstancedMesh>(null);
  const fountain=anchors.find(a=>a.role==='fountain')?.position||new THREE.Vector3(0,.3,2.85);
  const visibleFlags=useMemo(()=>anchors.filter(a=>a.role==='flag'&&a.level<=level),[anchors,level]);
  const lights=useMemo(()=>anchors.filter(a=>a.role==='lantern'),[anchors]);
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  const water=useMemo(()=>fountainGeometry(quality),[quality]);
  const spray=useMemo(()=>{
    const count=quality==='low'?28:quality==='balanced'?52:80;
    const data=new Float32Array(count*3);
    for(let i=0;i<count;i++)data.set([i*.618033%1,i*.381966%1,i*.71931%1],i*3);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data,3));return geometry;
  },[quality]);
  useEffect(()=>()=>{water.dispose();spray.dispose();},[water,spray]);
  useLayoutEffect(()=>{
    const instance=flags.current;if(!instance)return;
    const dummy=new THREE.Object3D();
    visibleFlags.forEach((flag,i)=>{
      dummy.position.copy(flag.position);dummy.scale.setScalar(flag.scale);dummy.rotation.set(0,0,0);dummy.updateMatrix();instance.setMatrixAt(i,dummy.matrix);
      instance.setColorAt(i,new THREE.Color(i%3===0?'#244da5':'#ac2448'));
    });
    instance.instanceMatrix.needsUpdate=true;if(instance.instanceColor)instance.instanceColor.needsUpdate=true;instance.computeBoundingSphere();instance.boundingSphere!.radius+=.6;
    return()=>releaseInstanceBuffers(instance);
  },[visibleFlags]);
  useLayoutEffect(()=>{
    const instance=lamps.current;if(!instance)return;const dummy=new THREE.Object3D();
    lights.forEach((light,i)=>{dummy.position.copy(light.position);dummy.scale.setScalar(light.radius*1.8);dummy.updateMatrix();instance.setMatrixAt(i,dummy.matrix);});
    instance.instanceMatrix.needsUpdate=true;instance.computeBoundingSphere();instance.boundingSphere!.radius+=.4;
    return()=>releaseInstanceBuffers(instance);
  },[lights]);
  useFrame((_,delta)=>{if(mayAnimateEnvironment(animate))uniforms.uTime.value+=Math.min(delta,.1);});
  return <group name="royal-city-animated-details">
    <mesh geometry={water} position={fountain} name="royal-fountain-water" raycast={()=>{}}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide} forceSinglePass
        vertexShader={`attribute float waterJet;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying float vJet;
          void main(){vUv=uv;vJet=waterJet;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`}
        fragmentShader={`uniform float uTime;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying float vJet;
          void main(){vec3 n=normalize(vNormal),view=normalize(cameraPosition-vWorld),sun=normalize(vec3(-12.,28.,16.));
            float wave=sin(vWorld.x*18.+vWorld.z*13.-uTime*2.6)*sin(vWorld.z*12.-vWorld.x*7.+uTime*1.4);
            float fresnel=pow(clamp(1.-abs(dot(n,view)),0.,1.),3.);
            float highlight=pow(max(0.,dot(n,normalize(sun+view))),36.);
            vec3 color=mix(vec3(.018,.22,.29),vec3(.12,.65,.74),.35+wave*.12+fresnel*.24);
            color+=vec3(.50,.77,.80)*highlight*.55;
            float foam=smoothstep(.82,1.,length(vUv-.5)*2.)*(.28+wave*.13)*(1.-vJet);
            float flow=.5+.5*sin(vUv.x*32.-uTime*8.);
            color=mix(color,vec3(.76,1.,1.08),clamp(foam+vJet*(.43+flow*.16),0.,.8));
            gl_FragColor=vec4(color,.88-vJet*.10);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`}/>
    </mesh>
    <points geometry={spray} position={fountain} name="royal-fountain-spray" raycast={()=>{}} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms} transparent depthWrite={false}
        vertexShader={`uniform float uTime;varying float vAlpha;void main(){float t=fract(position.x+uTime*.29),a=position.y*6.283185;
          vec3 p=vec3(cos(a)*(.13+t*.98),1.63+sin(t*3.14159)*.79-t*1.15,sin(a)*(.13+t*.98));
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((1.5+position.z*1.1)*45./max(4.,-mv.z),1.,4.);vAlpha=sin(t*3.14159)*.46;}`}
        fragmentShader={`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
          gl_FragColor=vec4(.66,.92,1.,vAlpha*(1.-r*r));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>
    </points>
    <instancedMesh ref={flags} key={visibleFlags.length} args={[undefined,undefined,visibleFlags.length]} name="royal-city-flags" raycast={()=>{}}>
      <planeGeometry args={[.43,.23,6,1]}/>
      <shaderMaterial uniforms={uniforms} side={THREE.DoubleSide} forceSinglePass vertexColors
        vertexShader={`uniform float uTime;varying vec2 vUv;varying vec3 vColor;void main(){vUv=uv;vColor=instanceColor;
          vec3 p=position;p.x+=.215;p.y+=.25;p.z+=sin(p.x*14.-uTime*3.+instanceMatrix[3].x)*.055*uv.x;
          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`}
        fragmentShader={`varying vec2 vUv;varying vec3 vColor;void main(){if(vUv.x>.70&&abs(vUv.y-.5)<(vUv.x-.70)*.60)discard;
          float border=step(vUv.y,.055)+step(.945,vUv.y)+step(vUv.x,.025);
          gl_FragColor=vec4(mix(vColor*(.8+vUv.y*.45),vec3(.85,.48,.09),min(1.,border)),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>
    </instancedMesh>
    <instancedMesh ref={lamps} args={[undefined,undefined,lights.length]} name="royal-city-lantern-glow" raycast={()=>{}}>
      <planeGeometry args={[2,2]}/>
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
        vertexShader={`varying vec2 vUv;void main(){vUv=uv*2.-1.;vec4 mv=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
          mv.xy+=position.xy*length(instanceMatrix[0].xyz);gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`varying vec2 vUv;void main(){float r=dot(vUv,vUv);gl_FragColor=vec4(1.,.48,.08,exp(-r*8.)*.29+exp(-r*32.)*.25);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>
    </instancedMesh>
  </group>;
}
