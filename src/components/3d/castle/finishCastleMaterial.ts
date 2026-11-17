import * as THREE from 'three';

/** Finish the existing baked district without copying its shared atlas or
 * altering cached GLTF materials. Matte stone, satin slate and warm glazing
 * remain distinct under the same daylight used by the playing surface. */
export function finishCastleMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;

  switch (source.name) {
    case 'Ivory limestone':
    case 'Royal district cream.001':
      material.roughness = 0.82;
      material.metalness = 0;
      break;
    case 'Carved sandstone':
      material.roughness = 0.9;
      material.metalness = 0;
      break;
    case 'Royal blue glazed slate':
      material.roughness = 0.38;
      material.metalness = 0.04;
      break;
    case 'Brushed antique gold':
      material.roughness = 0.4;
      material.metalness = 0.62;
      break;
    case 'Warm lit glass':
      // The authored 1.65 emission flattened the small window mullions.
      // Keep warm interior light while retaining their baked detail in daylight.
      material.emissiveIntensity = 0.8;
      material.roughness = 0.3;
      break;
  }
  return material;
}
