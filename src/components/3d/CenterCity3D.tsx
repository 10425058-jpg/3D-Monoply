import React,{Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import {useSceneState} from '../../presentation/SceneStore';
import {useMotionPreferences} from '../../presentation/useMotionPreferences';
import {CenterCity3D as ExistingCity} from './CenterCityLegacy';
import {RoyalCityEffects} from './castle/RoyalCityEffects';
import {finishCastleMaterial} from './castle/finishCastleMaterial';

type Quality='low'|'balanced'|'high';

/** The baked city GLBs share one red atlas swatch between the café mansard
 * and unrelated red accents. Remap only the café roof's UVs to the existing
 * royal-blue swatch; leave shared GLTF geometry and other accents untouched. */
function blueCafeMansard(object:THREE.Mesh):THREE.BufferGeometry|null{
  if(Array.isArray(object.material)||!/^Royal district red(?:\.\d{3})?$/.test(object.material.name))return null;
  const positions=object.geometry.getAttribute('position'),uv=object.geometry.getAttribute('uv');
  if(!positions||!uv)return null;
  const point=new THREE.Vector3();
  let recolored:THREE.BufferGeometry|null=null;
  for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
    // The left café mansard is at X≈-5.15 and Y≈2.5–3.5.
    // Exclude the lower shop awning and the central red stair runner.
    if(point.x< -6.5||point.x> -3.85||point.y<2.45||point.y>3.55)continue;
    const u=uv.getX(i),v=uv.getY(i);
    if(u<.5||u>.75)continue;
    // Atlas indices: red=10 (col 2, row 2), blue=2 (col 2, row 0).
    // The exporter may invert V relative to Blender's authored UVs.
    const shift=v>=.25&&v<.5 ? .5 : v>=.5&&v<.75 ? -.5 : null;
    if(shift===null)continue;
    if(!recolored)recolored=object.geometry.clone();
    recolored.getAttribute('uv').setY(i,v+shift);
  }
  if(recolored)recolored.getAttribute('uv').needsUpdate=true;
  return recolored;
}
export const centralCityUrl=(quality:Quality)=>new URL(`assets/models/central-city/central-royal-district${quality==='high'?'':`-${quality}`}.glb`,document.baseURI).href;

class CityAssetBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:Error){console.warn('[Central city] district asset unavailable; preserving the existing city.',error.message);}
  render(){return this.state.failed?<ExistingCity/>:this.props.children;}
}

/** Only the decorative city changes. The property ring and all game actors
 * retain their own components, positions, materials and input handlers. */
export function CenterCity3D({quality='balanced'}:{quality?:Quality}){
  const players=useSceneState(s=>s.players);
  const level=Math.min(5,Math.max(1,...players.map(p=>p.landmarkLevel||0)));
  const {reducedMotion,visible}=useMotionPreferences();
  return <CityAssetBoundary key={quality}><Suspense fallback={<ExistingCity/>}>
    <RoyalDistrict quality={quality} level={level} animate={visible&&!reducedMotion}/>
  </Suspense></CityAssetBoundary>;
}

function RoyalDistrict({quality,level,animate}:{quality:Quality;level:number;animate:boolean}){
  const url=centralCityUrl(quality),{scene}=useGLTF(url);
  const root=useRef<THREE.Group>(null);
  const [preview,setPreview]=useState<number|null>(null);
  const displayedLevel=preview??level;
  const model=useMemo(()=>{
    scene.updateMatrixWorld(true);
    const materials=new Map<THREE.Material,THREE.Material>();
    const recoloredGeometries:THREE.BufferGeometry[]=[];
    const parts:{geometry:THREE.BufferGeometry;material:THREE.Material;matrix:THREE.Matrix4;level:number;shadow:boolean;name:string}[]=[];
    const anchors:{name:string;position:THREE.Vector3;scale:number;level:number;radius:number;role:string}[]=[];
    scene.traverse(object=>{
      let required=1;for(let p:THREE.Object3D|null=object;p;p=p.parent)required=Math.max(required,Number(p.userData.unlock_level)||1);
      if(object.userData.city_effect&&object.name.startsWith('city_')&&!(object instanceof THREE.Mesh)){
        const scale=new THREE.Vector3();object.getWorldScale(scale);
        anchors.push({name:object.name,role:object.userData.city_effect,position:object.getWorldPosition(new THREE.Vector3()),scale:scale.x*(Number(object.userData.flag_scale)||1),level:required,radius:Number(object.userData.radius)||.2});
      }
      if(!(object instanceof THREE.Mesh))return;
      if(Array.isArray(object.material))throw new Error('Central GLB primitive must contain one material');
      const source=object.material as THREE.Material;
      const material=materials.get(source)??finishCastleMaterial(source);
      if(!materials.has(source)){material.name=source.name;materials.set(source,material);}
      const shadow=['Ivory limestone','Carved sandstone','Royal blue glazed slate','Warm carved timber','Brushed antique gold'].includes(material.name);
      const roofGeometry=blueCafeMansard(object);
      if(roofGeometry)recoloredGeometries.push(roofGeometry);
      parts.push({geometry:roofGeometry??object.geometry,material,matrix:object.matrixWorld.clone(),level:required,shadow,name:object.name});
    });
    return {parts,anchors,materials:[...materials.values()],recoloredGeometries};
  },[scene]);
  useEffect(()=>()=>{model.materials.forEach(material=>material.dispose());model.recoloredGeometries.forEach(geometry=>geometry.dispose());},[model]);
  useEffect(()=>{
    if(!new URLSearchParams(location.search).has('graphicsAudit'))return;
    const audit={ready:true,quality,url,previewLevel(value:number|null){setPreview(value===null?null:Math.max(1,Math.min(5,Math.floor(value))));},
      snapshot(){
        let triangles=0,meshes=0,casters=0,lights=0;const motion:Record<string,number>={};
        root.current?.traverseVisible(object=>{
          if(object instanceof THREE.Light)lights++;
          if((object instanceof THREE.Mesh||object instanceof THREE.Points)&&object.material instanceof THREE.ShaderMaterial&&object.material.uniforms.uTime)motion[object.name]=object.material.uniforms.uTime.value;
          if(!(object instanceof THREE.Mesh))return;
          meshes++;casters+=Number(object.castShadow);triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object instanceof THREE.InstancedMesh?object.count:1);
        });
        const bounds=new THREE.Box3().setFromObject(root.current!);
        return {level:displayedLevel,quality,url,triangles,meshes,casters,lights,motion,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
      }};
    (window as any).__centralCityAudit=audit;
    return()=>{if((window as any).__centralCityAudit===audit)delete (window as any).__centralCityAudit;};
  },[quality,url,displayedLevel]);
  return <group ref={root} name="center-city">
    {model.parts.map((part,index)=><mesh key={index} name={`royal-city-${part.name}`} geometry={part.geometry} material={part.material}
      matrix={part.matrix} matrixAutoUpdate={false} visible={part.level<=displayedLevel} dispose={null}
      castShadow={part.shadow} receiveShadow raycast={()=>{}}/>) }
    <RoyalCityEffects anchors={model.anchors} level={displayedLevel} quality={quality} animate={animate}/>
  </group>;
}

export default CenterCity3D;
