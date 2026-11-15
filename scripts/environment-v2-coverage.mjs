import * as THREE from 'three';
import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const label=process.argv[2]||'after';
const root='docs/environment-visual-polish-v2/evidence';
const sourceModule=async filename=>{
  const text=await readFile(filename,'utf8');
  const js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const {ARCHIPELAGO}=await sourceModule('src/components/environment/archipelagoLayout.ts');
const {SUNSET_KINGDOM,LEFT_ISLAND,RIGHT_ISLAND}=await sourceModule('src/components/environment/sunsetKingdomLayout.ts');
const receipts=[];
for(const file of ['manifest.json','archipelago-manifest.json','sunset-manifest.json','polish-v2-manifest.json']){
  try{receipts.push(...JSON.parse(await readFile(`public/assets/models/environment/${file}`,'utf8')).assets);}catch(error){if(error.code!=='ENOENT')throw error;}
}
const placements=[{id:'royal-island-left',site:LEFT_ISLAND},{id:'royal-island-right',site:RIGHT_ISLAND}];
for(const [kind,sites] of Object.entries(ARCHIPELAGO))sites.forEach(site=>placements.push({id:`sky-${kind}`,site}));
for(const [id,sites] of Object.entries(SUNSET_KINGDOM))if(!['crown-foundation','royal-garden-dressing'].includes(id))sites.forEach(site=>placements.push({id,site}));
const improved=['royal-island-left','royal-island-right','royal-island-citadel'];
const world=placements.map(({id,site},i)=>{
  const modelId=label!=='before'&&improved.includes(id)?`${id}-v2`:id;
  const asset=receipts.find(a=>a.id===modelId&&a.tier==='balanced');
  if(!asset)throw new Error(`No bounds receipt for ${modelId}`);
  return {id:`${id}:${i}`,modelId,site,bounds:asset.bounds};
});
const width=1440,height=900,safe={x:244,y:138,w:1092,h:598};
const intersect=(a,b)=>({x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),w:Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h:Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))});
const area=r=>r.w*r.h;
function projectBounds(camera,bounds,site){
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...site.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),site.rotation||0),new THREE.Vector3().setScalar(site.scale));
  const points=[];
  for(let mask=0;mask<8;mask++){
    const p=new THREE.Vector3(...bounds.min.map((v,axis)=>mask&(1<<axis)?bounds.max[axis]:v)).applyMatrix4(matrix).project(camera);
    if(p.z>0&&p.z<1)points.push([(p.x+1)*width/2,(1-p.y)*height/2]);
  }
  if(!points.length)return null;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
const samples=[];
for(const elevation of [.55,1.18])for(const distance of [50,80])for(let orbit=0;orbit<8;orbit++){
  const azimuth=orbit*Math.PI/4,camera=new THREE.PerspectiveCamera(40,width/height,.5,500);
  camera.position.set(Math.sin(azimuth)*Math.cos(elevation)*distance,.7+Math.sin(elevation)*distance,Math.cos(azimuth)*Math.cos(elevation)*distance);
  camera.lookAt(0,.7,0);camera.updateMatrixWorld();
  const board=projectBounds(camera,{min:[-13,-2.1,-13],max:[13,.7,13]},{position:[0,0,0],scale:1});
  const castle=projectBounds(camera,{min:[-6,.7,-5],max:[6,11,5]},{position:[0,0,0],scale:1});
  const candidates=[];
  for(const item of world){
    const box=projectBounds(camera,item.bounds,item.site);if(!box)continue;
    const visible=intersect(box,safe),overBoard=intersect(visible,board),overCastle=intersect(visible,castle);
    const clearArea=Math.max(0,area(visible)-area(overBoard)-area(overCastle)+area(intersect(overBoard,overCastle)));
    if(clearArea<350||visible.w<14||visible.h<12)continue;
    candidates.push({id:item.id,clearArea:Math.round(clearArea),hudFraction:1-area(visible)/Math.max(1,area(box)),screen:[Math.round(visible.x+visible.w/2),Math.round(visible.y+visible.h/2)]});
  }
  samples.push({azimuthDegrees:orbit*45,elevationDegrees:elevation*180/Math.PI,distance,camera:camera.position.toArray(),readableLandmarks:candidates.length,
    left:candidates.filter(c=>c.screen[0]<width/2).length,right:candidates.filter(c=>c.screen[0]>=width/2).length,
    hudClipped:candidates.filter(c=>c.hudFraction>.45).length,candidates});
}
await mkdir(`${root}/${label}`,{recursive:true});
const worldBoxes=world.map(item=>({id:item.id,box:new THREE.Box3(new THREE.Vector3(...item.bounds.min),new THREE.Vector3(...item.bounds.max))
  .applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...item.site.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),item.site.rotation||0),new THREE.Vector3().setScalar(item.site.scale)))}));
const intersections=[];
for(let i=0;i<worldBoxes.length;i++)for(let j=i+1;j<worldBoxes.length;j++)if(worldBoxes[i].box.intersectsBox(worldBoxes[j].box))intersections.push([worldBoxes[i].id,worldBoxes[j].id]);
await writeFile(`${root}/${label}/coverage.json`,JSON.stringify({method:'Conservative projected exported AABBs; subtract HUD and board AABB. Proxy for framing, not a pixel visibility measurement.',
  viewport:[width,height],safeRect:safe,unchangedControls:{fov:40,minPolar:.04,maxPolar:Math.PI/2.65,minDistance:16,normalMaxDistance:85,azimuth:'unrestricted'},world,intersections,samples},null,2));
const colors={'royal-island-left':'#526dc0','royal-island-right':'#526dc0','royal-island-citadel':'#deaf45','sky-garden':'#d783ad','sky-windmill':'#7eae8f'};
const marks=world.map(item=>{
  const x=300+item.site.position[0]*2.1,y=320+item.site.position[2]*2.1,r=4+item.site.scale*3;
  const key=item.id.split(':')[0];
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[key]||'#aaa2c1'}" stroke="#fff" stroke-width="1"><title>${item.id}, altitude ${item.site.position[1]}m</title></circle>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="620" viewBox="0 0 600 620"><rect width="600" height="620" fill="#171b30"/><text x="24" y="35" fill="#fff" font-family="sans-serif" font-size="20">${label}: fixed-world landmark layout</text><g fill="none" stroke="#43465d"><circle cx="300" cy="320" r="168"/><circle cx="300" cy="320" r="105"/><circle cx="300" cy="320" r="32" stroke="#f3cc72" stroke-dasharray="5 4"/></g><rect x="273" y="293" width="54" height="54" fill="#4c5973" stroke="#f3cc72"/>${marks}<text x="24" y="590" fill="#c9cede" font-family="sans-serif" font-size="13">Plan view · inner dashed circle: 15m gameplay column · not to scale in height</text></svg>`;
await writeFile(`${root}/${label}/world-layout.svg`,svg);
console.log(JSON.stringify({label,landmarks:world.length,poses:samples.length,minReadable:Math.min(...samples.map(s=>s.readableLandmarks)),medianReadable:samples.map(s=>s.readableLandmarks).sort((a,b)=>a-b)[16],oneSidedPoses:samples.filter(s=>!s.left||!s.right).length,intersections}));
