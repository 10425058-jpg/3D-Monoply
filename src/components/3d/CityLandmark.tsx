import React from 'react';
import { CentralCastle } from './castle/CentralCastle';

export interface CityLandmarkProps {
  level: number;
}

export const CityLandmark: React.FC<CityLandmarkProps> = ({ level }) => {
  return <CentralCastle level={level} />;
};

export default CityLandmark;
