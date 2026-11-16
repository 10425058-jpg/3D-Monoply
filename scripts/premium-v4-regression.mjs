import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Explicit local preview endpoints and bounded existing regression programs.
// Do not run this alongside GPU frame sampling.
const scripts={graphics:'graphics-regression.mjs',motion:'environment-regression.mjs',
  resilience:'premium-world-resilience.mjs',context:'atmosphere-context.mjs'};
const selected=process.argv[2]||'all';
assert.ok(selected==='all'||Object.hasOwn(scripts,selected),'unknown regression group');
const out='docs/premium-environment-v4/evidence/regression';
for(const [name,file] of Object.entries(scripts)){
  if(selected!=='all'&&selected!==name)continue;
  const result=spawnSync(process.execPath,[`scripts/${file}`],{stdio:'inherit',env:{...process.env,
    AUDIT_URL:'http://127.0.0.1:4187',PREFIX_URL:'http://127.0.0.1:4188/3D-Monoply',
    GRAPHICS_REGRESSION_OUT:out,ENVIRONMENT_REGRESSION_OUT:out}});
  assert.equal(result.status,0,`${name} regression failed: ${result.error?.message||result.signal||result.status}`);
}
