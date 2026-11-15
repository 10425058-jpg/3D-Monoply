import { variation } from './environmentLayout';
import type { EnvironmentQuality, CloudLayout } from './environmentLayout';

export const MOUNTAIN_LAYERS = [
  { radius: 230, base: -122, amplitude: 82, color: '#b3b5dc', opacity: .32 },
  { radius: 204, base: -120, amplitude: 76, color: '#9c9eca', opacity: .40 },
  { radius: 178, base: -118, amplitude: 70, color: '#8489b9', opacity: .50 },
  { radius: 152, base: -120, amplitude: 61, color: '#6d79ab', opacity: .61 },
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
        width:62+variation(i,seed+2)*37,depth:38+variation(i,seed+3)*25,
        base:layer.base-8+variation(i,seed+4)*9,
        height:layer.amplitude*(.58+variation(i,seed+5)*.20)*(1-.40*Math.exp(-Math.pow(distance/.33,2)))});
    }
  });
  return patches;
}

/** A massif has several asymmetric summits, shoulders and eroded spurs.
 * Local coordinates span [-1,1]; all patch edges taper into distant haze. */
export function massifHeight(u:number,v:number,patch:MountainPatch){
  let peaks=0;
  for(let i=0;i<6;i++){
    const x=(variation(i,patch.seed+11)-.5)*1.36,z=(variation(i,patch.seed+12)-.5)*1.24;
    const wx=.19+variation(i,patch.seed+13)*.31,wz=.25+variation(i,patch.seed+14)*.32;
    const dx=(u-x+Math.sin(v*5+i)*.055)/wx,dz=(v-z)/wz;
    peaks=Math.max(peaks,Math.exp(-Math.pow(Math.abs(dx),1.45)-Math.pow(Math.abs(dz),1.7))*(.54+variation(i,patch.seed+15)*.46));
  }
  const envelope=Math.pow(Math.max(0,(1-u*u)*(1-v*v)),.48);
  const shoulders=.17*Math.exp(-u*u*2-v*v*1.4);
  const erosion=(Math.sin(u*27+v*8+patch.seed)*Math.sin(v*19-u*4)+Math.sin(u*49-v*13)*.35)*.025;
  return patch.base+patch.height*Math.max(0,peaks+shoulders+erosion)*envelope;
}

/** High cumulus, mid-distance banks and lower side wisps. Their fixed positions
 * provide parallax; all remain outside the playable board's vertical column. */
export type AtmosphereCloud=CloudLayout&{variant:number;opacity:number;layer:number};
export function atmosphereCloudLayout(quality: EnvironmentQuality): AtmosphereCloud[] {
  const count = quality === 'low' ? 24 : quality === 'balanced' ? 32 : 40;
  const clouds: AtmosphereCloud[] = [];
  for (let i=0;i<count;i++) {
    const layer=Math.floor(i/8),angle=i*2.399963+.42;
    const radius=layer===0?116+variation(i,71)*42:layer===1?64+variation(i,72)*23:
      layer===2?34+variation(i,73)*17:layer===3?143+variation(i,74)*22:83+variation(i,75)*31;
    const y=layer===0?-53-variation(i,81)*15:layer===1?-33-variation(i,82)*14:
      layer===2?-28-variation(i,83)*10:layer===3?-9-variation(i,84)*18:-48-variation(i,85)*15;
    const size:[number,number]=layer===0?[58+variation(i,91)*14,23+variation(i,92)*8]:
      layer===1?[33+variation(i,93)*8,16+variation(i,94)*5]:layer===2?[23+variation(i,95)*5,12+variation(i,96)*4]:
      layer===3?[54+variation(i,97)*12,27+variation(i,98)*6]:[42+variation(i,99)*10,18+variation(i,100)*6];
    clouds.push({position:[Math.sin(angle)*radius,y,Math.cos(angle)*radius],size,
      variant:i%8,opacity:layer===0?.52:layer===1?.61:layer===2?.53:layer===3?.42:.47,layer});
  }
  return clouds;
}
