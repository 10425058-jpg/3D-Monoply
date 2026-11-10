import React from 'react';
import { FantasySky } from './FantasySky';
import { FantasySun } from './FantasySun';
import { DistantLandscape } from './DistantLandscape';
import { FantasyKingdom } from './FantasyKingdom';
import { Waterways } from './Waterways';
import { FloatingClouds } from './FloatingClouds';
import { FantasyAirship } from './FantasyAirship';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import type { EnvironmentQuality } from './environmentLayout';

/** Background and its subtle sunlight accent; no gameplay, UI, or board geometry. */
export function FantasyEnvironment({ quality = 'balanced' }: { quality?: EnvironmentQuality }) {
  const { reducedMotion, visible } = useMotionPreferences();
  const animate = visible && !reducedMotion;
  return <group name="fantasy-outer-environment">
    <FantasySky animate={animate} />
    <FantasySun />
    <DistantLandscape quality={quality} />
    <FantasyKingdom quality={quality} />
    <Waterways animate={animate} />
    <FantasyAirship animate={animate} />
    <FloatingClouds quality={quality} animate={animate} />
  </group>;
}
