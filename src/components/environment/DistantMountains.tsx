import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { MOUNTAIN_LAYERS, mountainHeight } from './atmosphereLayout';
import { variation } from './environmentLayout';

/** Four distant ridges with actual crest/flank depth, batched into one draw.
 * Disconnected from gameplay; no land surface fills the board's open column. */
export function DistantMountains({ quality }: { quality: EnvironmentQuality }) {
  const geometry = useMemo(() => {
    const segments = quality === 'low' ? 80 : quality === 'balanced' ? 160 : 224;
    const rows = quality === 'low' ? 3 : quality === 'balanced' ? 5 : 7;
    const positions: number[] = [], colors: number[] = [], opacity: number[] = [], indices: number[] = [];
    MOUNTAIN_LAYERS.forEach((layer,layerIndex) => {
      const offset = positions.length/3;
      const baseColor = new THREE.Color(layer.color);
      for (let row=0;row<rows;row++) for (let i=0;i<=segments;i++) {
        const angle = i/segments*Math.PI*2;
        const height = mountainHeight(angle+Math.sin(row)*.018,layerIndex);
        const radius = layer.radius+row*5.5;
        const drop = Math.abs(row-(rows-1)*.30)*7.5 + variation(i%segments+row*31,layerIndex+915)*2.5;
        positions.push(Math.sin(angle)*radius,height-drop,Math.cos(angle)*radius);
        const color = baseColor.clone();
        colors.push(color.r,color.g,color.b);
        opacity.push(row === 0 || row === rows-1 ? 0 : layer.opacity);
        if (row<rows-1 && i<segments) {
          const a=offset+row*(segments+1)+i,b=a+segments+1;
          indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
    });
    let result = new THREE.BufferGeometry();
    result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    result.setAttribute('ridgeOpacity',new THREE.Float32BufferAttribute(opacity,1));
    result.setIndex(indices);
    const surface=result.toNonIndexed();result.dispose();result=surface;
    result.computeVertexNormals(); result.computeBoundingSphere();
    // Directional modelling is baked into vertex colour: real flanks read as
    // rock massifs without extra lights, shadows, textures or fragment noise.
    const normals=result.getAttribute('normal'), tint=result.getAttribute('color');
    const sun=new THREE.Vector3(.55,.72,-.65).normalize(), warm=new THREE.Color('#f2c4aa');
    for(let i=0;i<tint.count;i++) {
      const facing=Math.max(0,normals.getX(i)*sun.x+normals.getY(i)*sun.y+normals.getZ(i)*sun.z);
      const color=new THREE.Color(tint.getX(i),tint.getY(i),tint.getZ(i));
      color.lerp(warm,facing*.18).multiplyScalar(.54+facing*.46);
      tint.setXYZ(i,color.r,color.g,color.b);
    }
    return result;
  },[quality]);
  useEffect(() => () => geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} name="mountain-ranges" renderOrder={-2} raycast={() => {}}>
    <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} forceSinglePass vertexColors
      vertexShader={`attribute float ridgeOpacity; varying vec3 vTint; varying float vOpacity;
        void main(){vTint=color;vOpacity=ridgeOpacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`varying vec3 vTint; varying float vOpacity;
        void main(){gl_FragColor=vec4(vTint,vOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
