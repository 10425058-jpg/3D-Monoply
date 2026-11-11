import React from 'react';
import { SUN_DIRECTION, SUN_LIGHT_INTENSITY } from './sunConfig';

const lightPosition: [number, number, number] = [
  SUN_DIRECTION[0] * 100, SUN_DIRECTION[1] * 100, SUN_DIRECTION[2] * 100,
];

/** Preserve the prior scene's tiny shadow-free accent and all board illumination.
 * The visible sunset is art-directed separately in the sky pass; environment
 * meshes receive their own isolated key rather than changing gameplay lights. */
export function FantasySun() {
  return <directionalLight name="kingdom-sunset-light" position={lightPosition}
    color="#ffd292" intensity={SUN_LIGHT_INTENSITY} castShadow={false} />;
}
