import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const code=ts.transpileModule(readFileSync(new URL('../src/components/environment/cloudSkyLayout.ts',import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext},
}).outputText;
const {SKY_CLOUD_MASSES,skyCloudFrame,projectSkyCloud}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const offset=(center,axis,angle)=>center.map((v,i)=>v*Math.cos(angle)+axis[i]*Math.sin(angle));

test('actual sky bake frames remain orthonormal at both poles and every authored cloud centre',()=>{
  const directions=[[0,-1,0],[0,1,0],[1e-12,-1,1e-12],...SKY_CLOUD_MASSES.map(m=>m.direction)];
  for(const direction of directions){
    const {center,right,up}=skyCloudFrame(direction,.17);
    for(const vector of [center,right,up]){
      assert.ok(vector.every(Number.isFinite));near(Math.hypot(...vector),1);
    }
    near(dot(center,right),0);near(dot(center,up),0);near(dot(right,up),0);
  }
});

test('the baked silhouettes retain equal angular scale horizontally and vertically, including beneath the board',()=>{
  for(const mass of [...SKY_CLOUD_MASSES,{direction:[0,-1,0],radius:.4,variant:0,roll:.2}]){
    const {center,right,up}=skyCloudFrame(mass.direction,mass.roll);
    const midpoint=projectSkyCloud(center,mass);
    near(midpoint.uv[0],.5);near(midpoint.uv[1],.5);
    for(const angle of [.02,.08,.16]){
      const horizontal=projectSkyCloud(offset(center,right,angle),mass);
      const vertical=projectSkyCloud(offset(center,up,angle),mass);
      near(horizontal.uv[0]-.5,vertical.uv[1]-.5);
      near(horizontal.uv[1],.5);near(vertical.uv[0],.5);
      near(horizontal.uv[0]-.5,Math.tan(angle)/(2*mass.radius));
    }
  }
});

test('sky seam directions project continuously instead of resetting to repeated azimuth slots',()=>{
  for(const mass of SKY_CLOUD_MASSES){
    for(const y of [-.98,-.7,-.1,.3]){
      const x=-Math.sqrt(1-y*y);
      const left=projectSkyCloud([x,y,-1e-7],mass),right=projectSkyCloud([x,y,1e-7],mass);
      if(left.facing>.45){
        near(left.uv[0],right.uv[0],1e-5);near(left.uv[1],right.uv[1],1e-5);
      }
    }
  }
});
