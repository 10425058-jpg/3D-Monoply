import React from 'react';
import { FantasyEnvironment } from '../environment/FantasyEnvironment';
import type { EnvironmentQuality } from '../environment/environmentLayout';

// Preserve the existing scene integration; only the outer environment changes.
export const FantasySkyBackground: React.FC<{ quality?: EnvironmentQuality }> = ({ quality = 'balanced' }) => (
  <FantasyEnvironment quality={quality} />
);

export default FantasySkyBackground;
