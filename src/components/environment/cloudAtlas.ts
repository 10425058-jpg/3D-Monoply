import * as THREE from 'three';
import type { EnvironmentQuality } from './environmentLayout';

export const CLOUD_ATLAS_GRID=[4,2] as const;
export const cloudAtlasUrl=(quality:EnvironmentQuality)=>
  new URL(`assets/textures/environment/cloud-volume-v2-${quality}.png`,document.baseURI).href;

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
