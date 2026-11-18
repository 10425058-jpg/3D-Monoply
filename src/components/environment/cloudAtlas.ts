import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';

export const CLOUD_ATLAS_GRID=[4,2] as const;
/** The optical bake's dense-body light occupies a narrow range. Expand that
 * range once, preserving hue, so alpha compositing retains billow relief. Both
 * the static sky and world cards use this same bounded cloud-only response. */
export const CLOUD_LIGHT_RESPONSE=`
vec3 cloudDisplayLight(vec3 optical){
  float luminance=dot(optical,vec3(.2126,.7152,.0722));
  float light=.28+.80*smoothstep(.64,.82,luminance);
  return clamp(optical/max(luminance,.01)*light,vec3(0.),vec3(1.05));
}`;
export const cloudAtlasUrl=(quality:EnvironmentQuality)=>
  new URL(`assets/textures/environment/cloud-volume-v3-${quality}.png`,document.baseURI).href;

/** GPU allocation belongs to the mounted layer; the loader retains the small
 * CPU image for remounts and WebGL restoration, with no repeat download. */
export function cloudAtlasTexture(source:THREE.Texture,quality:EnvironmentQuality){
  const texture=source.clone();
  texture.name=`Offline cloud density atlas ${quality}`;
  texture.colorSpace=THREE.NoColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
