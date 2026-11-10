import React from 'react';
import { SUN_DIRECTION, SUN_LIGHT_INTENSITY } from './sunConfig';

const lightPosition: [number, number, number] = [
  SUN_DIRECTION[0] * 100, SUN_DIRECTION[1] * 100, SUN_DIRECTION[2] * 100,
];

/** The visible disc/halo live in FantasySky's existing draw call at sky distance.
 * This restrained, shadow-free accent shares that exact world-space direction.
 * Keep the existing key/fill lights and their shadow budget unchanged. */
export function FantasySun() {
  return <directionalLight name="kingdom-sunset-light" position={lightPosition}
    color="#ffd292" intensity={SUN_LIGHT_INTENSITY} castShadow={false} />;
}
