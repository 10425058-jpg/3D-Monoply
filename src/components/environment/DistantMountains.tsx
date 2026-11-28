import { useEffect,useMemo } from 'react';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { MOUNTAIN_LAYERS,mountainPatches,massifHeight } from './atmosphereLayout';
import { DistantTerrainMaterial } from './DistantTerrainMaterial';

/** Separate broad 3D massifs, each with multiple peaks and real front/back
 * slopes, merged into one draw. Distant terrain never enters the board column. */
export function DistantMountains({quality}:{quality:EnvironmentQuality}){
  const geometry=useMemo(()=>{
    const columns=quality==='low'?18:quality==='balanced'?30:42;
    const rows=quality==='low'?12:quality==='balanced'?20:28;
    const positions:number[]=[],colors:number[]=[],opacity:number[]=[],indices:number[]=[];
    const patches=mountainPatches();
    const highRidge=new THREE.Color('#ddbcce'),tint=new THREE.Color();
    patches.forEach(patch=>{
      const offset=positions.length/3,layer=MOUNTAIN_LAYERS[patch.layer];
      const baseColor=new THREE.Color(layer.color);
      for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
        const u=col/columns*2-1,v=row/rows*2-1;
        const height=massifHeight(u,v,patch),radius=patch.radius+v*patch.depth/2;
        positions.push(Math.sin(patch.angle)*radius+Math.cos(patch.angle)*u*patch.width/2,height,
          Math.cos(patch.angle)*radius-Math.sin(patch.angle)*u*patch.width/2);
        const relief=Math.max(0,(height-patch.base)/patch.height);
        const ravine=Math.pow(.5+.5*Math.sin(u*23+v*8+Math.sin(v*11+patch.seed)*1.3),5);
        const sediment=1.01-ravine*.065*(1-relief*.55);
        tint.copy(baseColor).lerp(highRidge,Math.pow(relief,2)*.30).multiplyScalar(sediment);
        colors.push(tint.r,tint.g,tint.b);
        const feather=Math.min(1,(1-Math.abs(u))*5,(1-Math.abs(v))*5);
        // Saddles and foothills dissolve into the air below the ridgeline.
        const lowMist=THREE.MathUtils.smoothstep(relief,.04,.47);
        opacity.push(layer.opacity*Math.max(0,feather)*(.23+lowMist*.77));
        if(row<rows&&col<columns){const a=offset+row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
      }
    });
    const result=new THREE.BufferGeometry();
    result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    result.setAttribute('terrainOpacity',new THREE.Float32BufferAttribute(opacity,1));
    result.setIndex(indices);
    result.computeVertexNormals();result.computeBoundingSphere();
    const normals=result.getAttribute('normal'),colorAttribute=result.getAttribute('color');
    const sun=new THREE.Vector3(-.48,.72,.56).normalize(),warm=new THREE.Color('#dfb3ad');
    const snow=new THREE.Color('#e6d4e8');
    const normal=new THREE.Vector3();
    const verticesPerPatch=(columns+1)*(rows+1);
    for(let i=0;i<colorAttribute.count;i++){
      normal.fromBufferAttribute(normals,i);
      const facing=Math.max(0,normal.dot(sun));
      tint.setRGB(colorAttribute.getX(i),colorAttribute.getY(i),colorAttribute.getZ(i));
      const patch=patches[Math.floor(i/verticesPerPatch)];
      const relief=Math.max(0,(positions[i*3+1]-patch.base)/patch.height);
      // Cool broad shadow faces, peach shoulders and a restrained pale summit
      // separate the existing ridges without adding terrain or texture passes.
      tint.multiplyScalar(.66+facing*.48).lerp(warm,Math.pow(facing,3)*.16);
      // Broken snow/limestone shoulders follow the summit's fold, avoiding a
      // uniform white cap on each repeated patch of distant terrain.
      const snowline=.66+Math.sin(positions[i*3]*.17+positions[i*3+2]*.11)*.055;
      tint.lerp(snow,THREE.MathUtils.smoothstep(relief,snowline,.98)*Math.max(0,normal.y)*.29);
      colorAttribute.setXYZ(i,tint.r,tint.g,tint.b);
    }
    result.deleteAttribute('normal');
    return result;
  },[quality]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} name="mountain-ranges" renderOrder={-2} raycast={()=>{}}>
    <DistantTerrainMaterial doubleSided />
  </mesh>;
}
