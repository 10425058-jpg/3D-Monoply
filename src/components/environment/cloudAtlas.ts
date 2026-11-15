import * as THREE from 'three';
import { variation } from './environmentLayout';
import type { EnvironmentQuality } from './environmentLayout';

/** Four shaded billowing volumes baked once on the CPU. Runtime clouds use one
 * texture lookup, with CPU-backed pixels that survive a WebGL context restore.
 * This is generated scenery, with no concept-image pixels or external texture. */
export function createCloudAtlas(quality: EnvironmentQuality) {
  const tile = quality === 'low' ? 96 : quality === 'high' ? 256 : 160;
  const width = tile * 2, bytes = new Uint8Array(width * width * 4);
  const smooth = (lo: number, hi: number, x: number) => {
    const t = THREE.MathUtils.clamp((x-lo)/(hi-lo),0,1); return t*t*(3-2*t);
  };
  for (let bank=0;bank<4;bank++) {
    const lobes = Array.from({length:16},(_,i)=>{
      const a=i*2.399963, outer=i<10;
      return { x: outer ? Math.cos(a)*(.48+variation(i,bank+30)*.12) : (variation(i,bank+41)-.5)*.6,
        y: outer ? Math.sin(a)*.25 : .05+variation(i,bank+50)*.25,
        rx: .25+variation(i,bank+71)*.17, ry: .28+variation(i,bank+80)*.18,
        depth: .12+variation(i,bank+90)*.18 };
    });
    for (let y=0;y<tile;y++) for (let x=0;x<tile;x++) {
      const px=(x+.5)/tile*2-1, py=(y+.5)/tile*2-1;
      let cover=0, front=-1, nx=0, ny=0, nz=1;
      for (const lobe of lobes) {
        const qx=(px-lobe.x)/lobe.rx, qy=(py-lobe.y)/lobe.ry, r=qx*qx+qy*qy;
        if(r>1.04)continue;
        cover=Math.max(cover,1-smooth(.73,1.04,r));
        const h=Math.sqrt(Math.max(0,1-r));
        if(h+lobe.depth>front) {front=h+lobe.depth;nx=qx;ny=qy;nz=h;}
      }
      const light=THREE.MathUtils.clamp(nx*.35+ny*.62+nz*.67,0,1);
      const rim=smooth(.0,.65,py)*.15;
      const amount=THREE.MathUtils.clamp(.12+light*.82+rim,0,1);
      const grain=1+Math.sin(px*74+Math.sin(py*57))*Math.cos(py*66)*.012;
      const offset=((Math.floor(bank/2)*tile+y)*width+(bank%2)*tile+x)*4;
      const shade=[.30,.19,.46], lit=[1,.81,.77];
      for(let c=0;c<3;c++)bytes[offset+c]=Math.min(255,Math.round(255*(shade[c]+(lit[c]-shade[c])*amount)*grain));
      bytes[offset+3]=Math.round(255*cover*.94);
    }
  }
  const texture=new THREE.DataTexture(bytes,width,width,THREE.RGBAFormat);
  texture.name=`Procedural cloud volumes ${width}`;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
