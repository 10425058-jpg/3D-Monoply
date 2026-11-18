import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/environment/waterfallProfile.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}});
const {waterfallProfile} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('waterfall cross-sections keep both authored anchor planes and meet the river at the crest', () => {
  for (const width of [.7, 1.2, 2.1]) for (const u of [0, .25, .5, .75, 1]) {
    for (const end of [0, 1]) {
      const profile = waterfallProfile(end, u, width);
      assert.ok(Math.abs(profile.bulge) < 1e-10, 'no detached bulge at a source/end anchor');
      assert.ok(Math.abs(profile.vertical) < 1e-10, 'anchor cross-sections stay on their authored plane');
    }
    const crest = waterfallProfile(0, u, width);
    assert.ok(Math.abs(crest.sideways - (u - .5) * width * .86) < 1e-10, 'crest meets the .85-width river without a broad ledge');
  }
});

test('waterfall relief is deterministic, finite and stays inside its existing scenic footprint', () => {
  const random = Math.random;
  Math.random = () => {throw Error('Waterfall geometry consumed gameplay randomness');};
  try {
    for (let row = 0; row <= 100; row++) for (let col = 0; col <= 100; col++) {
      const t = row / 100, u = col / 100, width = 1.2;
      const profile = waterfallProfile(t, u, width);
      assert.deepEqual(profile, waterfallProfile(t, u, width));
      assert.ok(Object.values(profile).every(Number.isFinite));
      assert.ok(Math.abs(profile.sideways) <= width * .94);
      assert.ok(profile.bulge >= 0 && profile.bulge <= width * .37);
      assert.ok(Math.abs(profile.vertical) <= width * .018 + 1e-10);
    }
    assert.ok(waterfallProfile(.5, .5, 1.2).bulge > .35, 'curtain retains a convex volume from oblique views');
  } finally {Math.random = random;}
});
