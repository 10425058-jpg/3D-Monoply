import { variation } from './environmentLayout';
import type { EnvironmentQuality, CloudLayout, Vec3 } from './environmentLayout';

export const CLOUD_DECK_CENTER: Vec3 = [0, -77, 0];
export const CLOUD_DECK_RADII: Vec3 = [151, 28, 150];
export const CLOUD_DECK_STEPS = { low: 2, balanced: 3, high: 5 } as const;

export const MOUNTAIN_LAYERS = [
  { radius: 272, base: -157, amplitude: 124, color: '#a49ac5', opacity: .46 },
  { radius: 232, base: -148, amplitude: 112, color: '#8b8fba', opacity: .57 },
  { radius: 191, base: -141, amplitude: 98, color: '#7585b0', opacity: .67 },
  { radius: 151, base: -132, amplitude: 84, color: '#596d98', opacity: .76 },
] as const;

// Small, uninhabited fragments continue the archipelago beyond the landmarks.
// The lower group is visible between them from the steep opening camera.
export const DISTANT_ISLETS = [
  { position: [-33, -74, -86], size: 4.7 },
  { position: [-23, -84, -83], size: 2.5 },
  { position: [62, -77, -28], size: 4.4 },
  { position: [73, -87, -25], size: 2.3 },
  { position: [38, -94, 8], size: 4.2 },
  { position: [-31, -93, -2], size: 3.2 },
  { position: [35, -86, 69], size: 4.0 },
  { position: [-59, -82, 55], size: 3.5 },
  { position: [-88, -49, -122], size: 6.6 },
  { position: [-26, -45, -153], size: 3.5 },
  { position: [79, -54, -135], size: 5.1 },
  { position: [122, -66, -54], size: 5.9 },
  { position: [18, -56, 151], size: 5.6 },
  { position: [-91, -58, 125], size: 5.3 },
  { position: [-133, -62, 51], size: 6.0 },
] as const;

export interface MountainPatch { layer:number;seed:number;angle:number;radius:number;width:number;depth:number;base:number;height:number }
export function mountainPatches():MountainPatch[]{
  const patches:MountainPatch[]=[];
  MOUNTAIN_LAYERS.forEach((layer,index)=>{
    const count=index<2?7:8;
    for(let i=0;i<count;i++){
      const seed=1400+index*73+i*17;
      const angle=(i+.15+variation(i,seed)*.55)*Math.PI*2/count+index*.27;
      const distance=Math.atan2(Math.sin(angle-Math.PI+.03),Math.cos(angle-Math.PI+.03));
      patches.push({layer:index,seed,angle,radius:layer.radius+variation(i,seed+1)*9,
        width:65+layer.radius*.17+variation(i,seed+2)*42,depth:38+variation(i,seed+3)*25,
        base:layer.base-8+variation(i,seed+4)*9,
        height:layer.amplitude*(.63+variation(i,seed+5)*.25)*(1-.31*Math.exp(-Math.pow(distance/.33,2)))});
    }
  });
  return patches;
}

/** A massif has several asymmetric summits, shoulders and eroded spurs.
 * Local coordinates span [-1,1]; all patch edges taper into distant haze. */
export function massifHeight(u:number,v:number,patch:MountainPatch){
  let peakSum=0;
  for(let i=0;i<7;i++){
    // A connected, winding spine makes several differently sized summits,
    // instead of stacking identical conical peaks at a random common centre.
    const x=-.75+i*.25+(variation(i,patch.seed+11)-.5)*.15;
    const z=Math.sin(i*1.7+patch.seed)*.23+(variation(i,patch.seed+12)-.5)*.20;
    const wx=.19+variation(i,patch.seed+13)*.19,wz=.25+variation(i,patch.seed+14)*.39;
    const dx=(u-x+Math.sin(v*4.7+i)*.04)/wx,dz=(v-z)/wz;
    const summit=Math.exp(-Math.pow(Math.abs(dx),1.75)-Math.pow(Math.abs(dz),1.55))*(.49+variation(i,patch.seed+15)*.51);
    peakSum+=Math.pow(summit,4.);
  }
  const envelope=Math.pow(Math.max(0,(1-u*u)*(1-v*v)),.65);
  const shoulders=.18*Math.exp(-u*u*1.3-v*v*2.1);
  const spine=Math.sin(u*8+patch.seed)*.16;
  const erosion=(Math.sin((v-spine)*25+Math.sin(u*12)*1.7)+Math.sin(u*37+v*13+patch.seed)*.36)*.024;
  return patch.base+patch.height*Math.min(1.08,Math.max(0,Math.pow(peakSum,.25)+shoulders+erosion))*envelope;
}

/** Square impostors preserve the authored cloud proportions at every orbit.
 * Cradles sit below existing cliff tips; deeper beds and distant banks provide
 * separate parallax layers. None of these positions follows the camera. */
export type AtmosphereCloud=CloudLayout&{variant:number;opacity:number;layer:number;role:'cradle'|'bed'|'mid'|'far';island?:string};
// The omitted atlas gutter has zero alpha. Cropping the quad to the same UV
// rectangle reduces transparent overdraw without changing any cloud's shape.
export const CLOUD_CARD_EXTENT=[.90,.76] as const;
export function atmosphereCloudLayout(quality: EnvironmentQuality): AtmosphereCloud[] {
  const count = quality === 'low' ? 24 : quality === 'balanced' ? 32 : 40;
  const clouds: AtmosphereCloud[] = [];
  const cradles = [
    [-41,-38,-22,44,'royal-left'],[40,-38,-22,43,'royal-right'],
    [42,-41,8,34,'garden-near-right'],[-46,-43,12,34,'garden-near-left'],
    [-44,-37,-67,38,'citadel-north'],[46,-40,-70,38,'garden-north'],
    [-81,-32,21,34,'windmill-west'],[-57,-40,68,34,'garden-south'],
  ] as const;
  cradles.forEach(([x,y,z,size,island],i)=>clouds.push({position:[x,y-4,z],size:[size,size],
    variant:i%8,opacity:.79,layer:1,role:'cradle',island}));
  // Quiet interleaved beds below the islands. Offset centres, unequal heights
  // and broad rounded silhouettes avoid a circular spoke arrangement.
  const beds = [[-59,-70,-40,46],[40,-74,-39,48],[-30,-76,42,44],[54,-72,34,43],
    [-76,-80,80,48],[72,-82,-100,47],[-42,-79,-119,50],[30,-84,119,46]] as const;
  beds.forEach(([x,y,z,size],i)=>clouds.push({position:[x,y,z],size:[size,size],
    variant:(i*3+2)%8,opacity:.31+variation(i,58)*.1,layer:0,role:'bed'}));
  for(let i=16;i<count;i++){
    const far=i>=24,angle=i*2.399963+.42;
    const radius=far?143+variation(i,74)*28:72+variation(i,73)*26;
    const size=far?34+variation(i,97)*13:24+variation(i,95)*9;
    clouds.push({position:[Math.sin(angle)*radius,far?-33-variation(i,84)*24:-43-variation(i,83)*13,Math.cos(angle)*radius],
      size:[size,size],variant:(i*5+1)%8,opacity:far?.25:.31,layer:far?3:2,role:far?'far':'mid'});
  }
  return clouds;
}
