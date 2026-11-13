import { variation } from './environmentLayout';
import type { EnvironmentQuality, CloudLayout } from './environmentLayout';

export const MOUNTAIN_LAYERS = [
  { radius: 218, base: -104, amplitude: 52, color: '#dcc4d8', opacity: .42 },
  { radius: 180, base: -109, amplitude: 50, color: '#c2b0ce', opacity: .52 },
  { radius: 144, base: -108, amplitude: 46, color: '#aa9cbd', opacity: .64 },
  { radius: 112, base: -98, amplitude: 42, color: '#9088ac', opacity: .76 },
] as const;

// Periodic seeded knot noise closes at 2π without repeating sine-wave summits.
function ridgeNoise(angle: number, count: number, seed: number) {
  const coordinate = ((angle / (Math.PI * 2)) % 1 + 1) % 1 * count;
  const index = Math.floor(coordinate), t = coordinate-index;
  const fraction = t*t*(3-2*t);
  return variation(index % count,seed)*(1-fraction) + variation((index+1)%count,seed)*fraction;
}

export function mountainHeight(angle: number, layer: number) {
  const profile = MOUNTAIN_LAYERS[layer];
  const broad = ridgeNoise(angle,9+layer*2,371+layer*19);
  const shoulders = ridgeNoise(angle,27+layer*4,612+layer*13);
  const spurs = ridgeNoise(angle,68+layer*9,981+layer*7);
  let massif = 0;
  for (let peak=0; peak<11+layer; peak++) {
    const center=(peak+variation(peak,511+layer)*.65)*Math.PI*2/(11+layer);
    const distance=Math.atan2(Math.sin(angle-center),Math.cos(angle-center));
    const width=(.07+variation(peak,715+layer)*.16)*(distance<0?1.5:.75);
    massif=Math.max(massif,Math.exp(-Math.pow(Math.abs(distance/width),1.4))*(.58+variation(peak,183+layer)*.42));
  }
  return profile.base + profile.amplitude*(massif*.72+broad*.15+shoulders*.09+spurs*.04);
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
