import { useMemo } from 'react';
import { Color, DoubleSide, FrontSide, Vector3 } from 'three';
import { SKY_SUN_DIRECTION } from './sunConfig';

/** Aerial perspective for the ridgelines and islets. The hue follows the
 * sunset and fades toward cool lavender on the far side of the world. */
export function DistantTerrainMaterial({ doubleSided = false }: { doubleSided?: boolean }) {
  const uniforms = useMemo(() => ({
    uSun: { value: new Vector3(...SKY_SUN_DIRECTION) },
    uCoolMist: { value: new Color('#aea5ce') },
    uWarmMist: { value: new Color('#e5b9c4') },
  }), []);
  return <shaderMaterial vertexColors transparent depthWrite={false} toneMapped={false}
    side={doubleSided ? DoubleSide : FrontSide} forceSinglePass uniforms={uniforms}
    vertexShader={`attribute float terrainOpacity;
      uniform vec3 uSun,uCoolMist,uWarmMist;
      varying vec3 vTint;
      varying float vOpacity;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vec3 offset=world.xyz-cameraPosition;
        float distance=length(offset);
        float sunset=pow(max(0.,dot(offset/max(distance,.001),uSun)),6.);
        float relativeDistance=distance-max(0.,length(cameraPosition)-60.);
        float aerial=smoothstep(100.,340.,relativeDistance);
        float lowMist=1.-smoothstep(-140.,-55.,world.y);
        vec3 mist=mix(uCoolMist,uWarmMist,sunset*.75);
        vTint=mix(color,mist,.14+aerial*.38+lowMist*.19);
        vOpacity=terrainOpacity*(1.-aerial*.20);
        gl_Position=projectionMatrix*viewMatrix*world;
        // Keep the farthest ridges at clear-depth precision while the shared
        // camera keeps its tighter depth range for the board.
        gl_Position.z=min(gl_Position.z,gl_Position.w);
      }`}
    fragmentShader={`varying vec3 vTint;
      varying float vOpacity;
      void main(){
        gl_FragColor=vec4(vTint,vOpacity);
        #include <colorspace_fragment>
      }`} />
}
