type Direction = readonly [number, number, number];
export interface SkyCloudMass { direction: Direction; radius: number; variant: number; roll: number }

/** Irregular spherical placements, including the lower pole. Radius is angular
 * extent of the square texture, not a longitude/latitude width. */
export const SKY_CLOUD_MASSES: readonly SkyCloudMass[] = [
  {direction:[-.78,.36,-.57],radius:.32,variant:1,roll:-.10},
  {direction:[.22,.40,-.89],radius:.34,variant:3,roll:.08},
  {direction:[.85,.18,.49],radius:.28,variant:4,roll:-.06},
  {direction:[-.32,.24,.92],radius:.31,variant:0,roll:.12},
  {direction:[.72,-.28,-.58],radius:.33,variant:2,roll:-.12},
  {direction:[-.83,-.36,-.35],radius:.38,variant:5,roll:.06},
  {direction:[.33,-.54,-.78],radius:.38,variant:6,roll:.10},
  {direction:[.80,-.57,.17],radius:.39,variant:0,roll:-.08},
  {direction:[-.65,-.61,.44],radius:.34,variant:1,roll:.16},
  {direction:[-.12,-.65,.75],radius:.38,variant:7,roll:-.14},
  {direction:[-.39,-.86,-.32],radius:.35,variant:2,roll:.09},
  {direction:[.42,-.84,-.34],radius:.35,variant:3,roll:-.13},
  {direction:[.32,-.88,.34],radius:.35,variant:4,roll:.12},
  {direction:[-.30,-.92,.22],radius:.35,variant:5,roll:-.05},
  {direction:[.17,-.98,.04],radius:.23,variant:7,roll:.18},
  {direction:[.10,-.10,-.99],radius:.24,variant:4,roll:-.10},
];

const normalize=(v:Direction):[number,number,number]=>{
  const length=Math.hypot(...v);
  return [v[0]/length,v[1]/length,v[2]/length];
};
const dot=(a:Direction,b:Direction)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Direction,b:Direction):[number,number,number]=>
  [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Used to compile the actual bake shader constants. A stable orthonormal
 * tangent frame preserves cloud proportions at the nadir and the sky seam. */
export function skyCloudFrame(direction:Direction,roll=0){
  const center=normalize(direction);
  const base=normalize(cross(Math.abs(center[1])>.98?[0,0,1]:[0,1,0],center));
  const vertical=cross(center,base);
  const c=Math.cos(roll),s=Math.sin(roll);
  const right=base.map((v,i)=>v*c+vertical[i]*s) as [number,number,number];
  const up=base.map((v,i)=>vertical[i]*c-v*s) as [number,number,number];
  return {center,right,up};
}

/** Renderer-free projection for validation; exactly the frame used by GLSL. */
export function projectSkyCloud(direction:Direction,mass:SkyCloudMass){
  const d=normalize(direction),frame=skyCloudFrame(mass.direction,mass.roll);
  const facing=dot(d,frame.center);
  return {facing,uv:[.5+dot(d,frame.right)/Math.max(.001,2*mass.radius*facing),
    .5+dot(d,frame.up)/Math.max(.001,2*mass.radius*facing)] as const};
}
