import React, { Suspense } from 'react';
import { FantasySky } from './FantasySky';
import { FantasySun } from './FantasySun';
import { DistantMountains } from './DistantMountains';
import { PremiumFantasyWorld } from './PremiumFantasyWorld';
import { AtmosphericClouds } from './AtmosphericClouds';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';
import type { EnvironmentQuality } from './environmentLayout';
import { EnvironmentAssetBoundary, LandmarkFallback } from './EnvironmentAssetBoundary';
import { LEFT_ISLAND, RIGHT_ISLAND } from './PremiumFantasyWorld';
import { CameraAtmosphere } from './CameraAtmosphere';

/** Background and its subtle sunlight accent; no gameplay, UI, or board geometry. */
export function FantasyEnvironment({ quality = 'balanced' }: { quality?: EnvironmentQuality }) {
  const { reducedMotion, visible } = useMotionPreferences();
  const animate = visible && !reducedMotion;
  return <group name="fantasy-outer-environment">
    <CameraAtmosphere />
    <FantasySky animate={animate} quality={quality} />
    <FantasySun />
    <DistantMountains quality={quality} />
    <EnvironmentAssetBoundary key={quality} label="royal islands" fallback={<LandmarkFallback placements={[LEFT_ISLAND, RIGHT_ISLAND]} />}>
      <Suspense fallback={<LandmarkFallback placements={[LEFT_ISLAND, RIGHT_ISLAND]} />}>
        <PremiumFantasyWorld quality={quality} animate={animate} />
      </Suspense>
    </EnvironmentAssetBoundary>
    <AtmosphericClouds quality={quality} animate={animate} />
  </group>;
}
