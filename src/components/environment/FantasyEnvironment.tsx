import React, { Suspense } from 'react';
import { FantasySky } from './FantasySky';
import { FantasySun } from './FantasySun';
import { DistantMountains } from './DistantMountains';
import { PremiumFantasyWorld } from './PremiumFantasyWorld';
import { AtmosphericClouds } from './AtmosphericClouds';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import type { EnvironmentQuality } from './environmentLayout';

/** Background and its subtle sunlight accent; no gameplay, UI, or board geometry. */
export function FantasyEnvironment({ quality = 'balanced' }: { quality?: EnvironmentQuality }) {
  const { reducedMotion, visible } = useMotionPreferences();
  const animate = visible && !reducedMotion;
  return <group name="fantasy-outer-environment">
    <FantasySky animate={animate} quality={quality} />
    <FantasySun />
    <DistantMountains quality={quality} />
    <Suspense fallback={null}><PremiumFantasyWorld quality={quality} animate={animate} /></Suspense>
    <AtmosphericClouds quality={quality} animate={animate} />
  </group>;
}
