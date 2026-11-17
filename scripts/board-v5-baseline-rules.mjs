import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

// Reproduce the original nineteen store regressions against immutable main
// source. Extraction is confined to ignored QA storage; no checkout is changed.
const ref='0ba0a2f',directory=path.resolve('.online-test/v5-rules-baseline');
await mkdir(path.join(directory,'tests'),{recursive:true});
const archive=execFileSync('git',['archive',ref,'src'],{maxBuffer:10*1024*1024});
execFileSync('tar',['-xf','-','-C',directory],{input:archive});
let tests=await readFile('tests/solo-rules.test.ts','utf8');
tests=tests.slice(0,tests.indexOf("test('unmortgage convention"));
tests=tests.replace(/^import .*from '\.\.\/src\/game\/(soloAi|soloRules)';\r?\n/gm,'');
assert.equal((tests.match(/^test\(/gm)||[]).length,19);
const filename=path.join(directory,'tests/solo-rules.test.ts');await writeFile(filename,tests);
const result=spawnSync(process.execPath,['--import','tsx','--test',filename],{encoding:'utf8',timeout:60000});
assert.equal(result.error,undefined);assert.notEqual(result.status,0,'baseline must reproduce the repaired defects');
assert.match(result.stdout,/\btests 19\b/);assert.match(result.stdout,/\bpass 8\b/);assert.match(result.stdout,/\bfail 11\b/);
const receipt=`Archived source: ${ref}\nIsolated first 19 store regression cases; expected failing baseline.\n\n${result.stdout}${result.stderr}`.replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'');
await mkdir('docs/board-rules-v5/evidence/validation',{recursive:true});
await writeFile('docs/board-rules-v5/evidence/validation/baseline-first19.txt',receipt);
console.log(receipt);
