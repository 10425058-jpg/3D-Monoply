import { useEffect,useMemo } from 'react';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { MOUNTAIN_LAYERS,mountainPatches,massifHeight } from './atmosphereLayout';

/** Separate broad 3D massifs, each with multiple peaks and real front/back
 * slopes, merged into one draw. Distant terrain never enters the board column. */
export function DistantMountains({quality}:{quality:EnvironmentQuality}){
  const geometry=useMemo(()=>{
    const columns=quality==='low'?18:quality==='balanced'?30:42;
    const rows=quality==='low'?12:quality==='balanced'?20:28;
    const positions:number[]=[],colors:number[]=[],opacity:number[]=[],indices:number[]=[];
    const patches=mountainPatches();
    patches.forEach(patch=>{
      const offset=positions.length/3,layer=MOUNTAIN_LAYERS[patch.layer];
      const baseColor=new THREE.Color(layer.color),summit=new THREE.Color('#b4bfdb');
      for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
        const u=col/columns*2-1,v=row/rows*2-1;
        const height=massifHeight(u,v,patch),radius=patch.radius+v*patch.depth/2;
        positions.push(Math.sin(patch.angle)*radius+Math.cos(patch.angle)*u*patch.width/2,height,
          Math.cos(patch.angle)*radius-Math.sin(patch.angle)*u*patch.width/2);
        const relief=Math.max(0,(height-patch.base)/patch.height);
        const sediment=.96+Math.sin(u*22+v*7+patch.seed)*.025;
        const tint=baseColor.clone().lerp(summit,Math.pow(relief,2)*.23).multiplyScalar(sediment);
        colors.push(tint.r,tint.g,tint.b);
        const feather=Math.min(1,(1-Math.abs(u))*5,(1-Math.abs(v))*5);
        opacity.push(layer.opacity*Math.max(0,feather));
        if(row<rows&&col<columns){const a=offset+row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
      }
    });
    const result=new THREE.BufferGeometry();
    result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    result.setAttribute('ridgeOpacity',new THREE.Float32BufferAttribute(opacity,1));result.setIndex(indices);
    result.computeVertexNormals();result.computeBoundingSphere();
    const normals=result.getAttribute('normal'),tint=result.getAttribute('color');
    const sun=new THREE.Vector3(-.48,.72,.56).normalize(),warm=new THREE.Color('#e8b8a1');
    for(let i=0;i<tint.count;i++){
      const normal=new THREE.Vector3().fromBufferAttribute(normals,i);
      const facing=Math.max(0,normal.dot(sun));
      const color=new THREE.Color(tint.getX(i),tint.getY(i),tint.getZ(i));
      color.multiplyScalar(.37+facing*.69).lerp(warm,Math.pow(facing,5)*.085);
      tint.setXYZ(i,color.r,color.g,color.b);
    }
    return result;
  },[quality]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} name="mountain-ranges" renderOrder={-2} raycast={()=>{}}>
    <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} forceSinglePass vertexColors
      vertexShader={`attribute float ridgeOpacity;varying vec3 vTint;varying float vOpacity;
        void main(){vTint=color;vOpacity=ridgeOpacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`varying vec3 vTint;varying float vOpacity;
        void main(){gl_FragColor=vec4(vTint,vOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
