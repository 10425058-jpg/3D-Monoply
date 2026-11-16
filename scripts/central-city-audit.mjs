import assert from 'node:assert/strict';
const label=process.argv[2]||'after';assert.ok(['before','after'].includes(label));
process.env.AUDIT_URL=`http://127.0.0.1:${label==='before'?4189:4190}`;
process.env.AUDIT_EVIDENCE_ROOT='docs/premium-central-city/evidence';
process.env.AUDIT_CAMERAS='overview,reference,wide';
process.env.AUDIT_WAIT_CITY=label==='before'?'0':'1';
await import('./atmosphere-audit.mjs');
