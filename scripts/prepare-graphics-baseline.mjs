import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Run against a detached checkout of the pinned baseline, never the candidate.
const target = path.resolve(process.argv[2] || '.graphics-baseline');
const revision = execFileSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== '44c383b340b97b1039c5e8c78bf2dfb05bc6c481') throw Error(`Wrong baseline revision: ${revision}`);
const sceneFile = path.join(target, 'src/components/3d/Scene3D.tsx');
let source = await readFile(sceneFile, 'utf8');
if (source.includes('GraphicsAudit')) throw Error('Baseline is already instrumented; use a clean checkout.');
await mkdir(path.join(target, 'scripts'), { recursive: true });
await copyFile(new URL('../src/components/3d/GraphicsAudit.tsx', import.meta.url), path.join(target, 'src/components/3d/GraphicsAudit.tsx'));
await copyFile(new URL('./graphics-audit.mjs', import.meta.url), path.join(target, 'scripts/graphics-audit.mjs'));
source = source.replace("import { useGameStore }", "import { GraphicsAudit, graphicsAuditEnabled } from './GraphicsAudit';\nimport { useGameStore }")
  .replace('      <GameplayEffects quality={quality} />', '      <GameplayEffects quality={quality} />\n      {graphicsAuditEnabled() && <GraphicsAudit quality={quality} />}');
await writeFile(sceneFile, source);
console.log(`Instrumented ${revision} at ${target}; rendering settings are unchanged.`);
