import { variation } from './environmentLayout';
import type { EnvironmentQuality, CloudLayout } from './environmentLayout';

export const MOUNTAIN_LAYERS = [
  { radius: 218, base: -103, amplitude: 66, color: '#c4b7ed', opacity: .34 },
  { radius: 180, base: -108, amplitude: 59, color: '#b0a2db', opacity: .43 },
  { radius: 144, base: -107, amplitude: 51, color: '#9788c7', opacity: .54 },
  { radius: 112, base: -101, amplitude: 46, color: '#8276b2', opacity: .65 },
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
  return profile.base + profile.amplitude*(massif*.58+broad*.13+shoulders*.17+spurs*.12);
}

/** High cumulus, mid-distance banks and lower side wisps. Their fixed positions
 * provide parallax; all remain outside the playable board's vertical column. */
export function atmosphereCloudLayout(quality: EnvironmentQuality): CloudLayout[] {
  const count = quality === 'low' ? 28 : quality === 'balanced' ? 44 : 60;
  const clouds: CloudLayout[] = [];
  for (let i=0;i<count;i++) {
    if(i<8) {
      const angle=i*Math.PI/4+.22, radius=145+variation(i,71)*25;
      clouds.push({position:[Math.sin(angle)*radius,-9-variation(i,72)*18,Math.cos(angle)*radius],
        size:[47+variation(i,73)*13,30+variation(i,74)*9]});
    } else if (i<20) {
      const side = i%2 ? 1 : -1;
      clouds.push({ position: [side*(47+variation(i,81)*30),-32-variation(i,82)*21,-52+Math.floor((i-8)/2)*23],
        size: [24+variation(i,83)*12,14+variation(i,84)*7] });
    } else {
      const angle = (i-20)*2.399963+.45;
      const radius = 85+variation(i,85)*92;
      clouds.push({ position: [Math.sin(angle)*radius,-24-radius*.32-variation(i,86)*19,Math.cos(angle)*radius],
        size: [29+variation(i,87)*18,15+variation(i,88)*8] });
    }
  }
  return clouds;
}
