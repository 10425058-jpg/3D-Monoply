import * as THREE from 'three';
import { OWNER_PENNANT_MATERIAL } from './arcadePropertyLayout';

/** All three developed Arcade GLBs use this same roof-only material. */
export const ARCADE_OWNER_ROOF_MATERIAL = 'Arcade Glazed slate';

export function isArcadeOwnerTintMaterial(name: string) {
  return name === OWNER_PENNANT_MATERIAL || name === ARCADE_OWNER_ROOF_MATERIAL;
}

/** The exported roof atlas is blue, which would multiply every player's
 * instance color into a dark blue tint. A neutral copy preserves the GLB
 * geometry and the original roughness/metalness while allowing each site's
 * owner color to show correctly. All other GLB materials keep their atlas. */
export function prepareArcadeRoofForOwnerTint(source: THREE.Material): THREE.Material {
  if (source.name !== ARCADE_OWNER_ROOF_MATERIAL || !(source instanceof THREE.MeshStandardMaterial)) return source;
  const roof = source.clone();
  roof.map = null;
  roof.color.set('#ffffff');
  roof.needsUpdate = true;
  return roof;
}
