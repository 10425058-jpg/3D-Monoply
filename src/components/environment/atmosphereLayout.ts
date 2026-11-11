import { variation } from './environmentLayout';
import type { EnvironmentQuality, CloudLayout } from './environmentLayout';

export const MOUNTAIN_LAYERS = [
  { radius: 218, base: -128, amplitude: 42, color: '#d5b9ce', opacity: .49 },
  { radius: 180, base: -130, amplitude: 46, color: '#bba8c9', opacity: .61 },
  { radius: 144, base: -124, amplitude: 44, color: '#a89bbc', opacity: .72 },
  { radius: 112, base: -111, amplitude: 44, color: '#8983a8', opacity: .82 },
] as const;

// Periodic seeded knot noise closes at 2π without repeating sine-wave summits.
function ridgeNoise(angle: number, count: number, seed: number) {
  const coordinate = ((angle / (Math.PI * 2)) % 1 + 1) % 1 * count;
  const index = Math.floor(coordinate), fraction = coordinate-index;
  return variation(index % count,seed)*(1-fraction) + variation((index+1)%count,seed)*fraction;
}

export function mountainHeight(angle: number, layer: number) {
  const profile = MOUNTAIN_LAYERS[layer];
  const broad = ridgeNoise(angle,11+layer*2,371+layer*19);
  const shoulders = ridgeNoise(angle,61+layer*7,612+layer*13);
  const spurs = ridgeNoise(angle,137+layer*11,981+layer*7);
  return profile.base + profile.amplitude*(broad*.32+shoulders*.48+spurs*.20);
}

/** Separate distant banks and sparse side wisps; never a filled cloud floor. */
export function atmosphereCloudLayout(quality: EnvironmentQuality): CloudLayout[] {
  const count = quality === 'low' ? 20 : quality === 'balanced' ? 32 : 44;
  const clouds: CloudLayout[] = [];
  for (let i=0;i<count;i++) {
    if (i<8) {
      const side = i%2 ? 1 : -1;
      clouds.push({ position: [side*(48+variation(i,81)*36),-46-variation(i,82)*12,-35+Math.floor(i/2)*22],
        size: [23+variation(i,83)*10,8+variation(i,84)*3] });
    } else {
      const angle = (i-8)*2.399963+.45;
      const radius = 115+variation(i,85)*73;
      clouds.push({ position: [Math.sin(angle)*radius,-38-radius*.36-variation(i,86)*11,Math.cos(angle)*radius],
        size: [27+variation(i,87)*17,8+variation(i,88)*5] });
    }
  }
  return clouds;
}
