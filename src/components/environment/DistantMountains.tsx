import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';
import { MOUNTAIN_LAYERS, mountainHeight } from './atmosphereLayout';

/** Four independent distant ridge curtains, batched into one unlit draw.
 * No annular ground connects them to each other or to the gameplay board. */
export function DistantMountains({ quality }: { quality: EnvironmentQuality }) {
  const geometry = useMemo(() => {
    const segments = quality === 'low' ? 96 : quality === 'balanced' ? 144 : 192;
    const positions: number[] = [], colors: number[] = [], opacity: number[] = [], indices: number[] = [];
    MOUNTAIN_LAYERS.forEach((layer,layerIndex) => {
      const offset = positions.length/3;
      const baseColor = new THREE.Color(layer.color), warm = new THREE.Color('#e7b5b8');
      for (let row=0;row<3;row++) for (let i=0;i<=segments;i++) {
        const angle = i/segments*Math.PI*2;
        const height = mountainHeight(angle,layerIndex);
        const radius = layer.radius+row*2;
        const drop = row === 0 ? 0 : row === 1 ? 13+layerIndex*2 : 45;
        positions.push(Math.sin(angle)*radius,height-drop,Math.cos(angle)*radius);
        const slope = (mountainHeight(angle+.012,layerIndex)-mountainHeight(angle-.012,layerIndex))/.024;
        const illumination = .90+Math.max(-.12,Math.min(.10,-slope*.003));
        const color = baseColor.clone().lerp(warm,Math.max(0,Math.cos(angle-2.75))*.10)
          .multiplyScalar(illumination*(row === 1 ? .94 : 1));
        colors.push(color.r,color.g,color.b);
        opacity.push(row === 2 ? 0 : layer.opacity);
        if (row<2 && i<segments) {
          const a=offset+row*(segments+1)+i,b=a+segments+1;
          indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
    });
    const result = new THREE.BufferGeometry();
    result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    result.setAttribute('ridgeOpacity',new THREE.Float32BufferAttribute(opacity,1));
    result.setIndex(indices); result.computeBoundingSphere();
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
