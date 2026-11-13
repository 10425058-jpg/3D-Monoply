import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/environment/archipelagoLayout.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { ARCHIPELAGO } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const receipt = JSON.parse(readFileSync(new URL('../public/assets/models/environment/archipelago-manifest.json', import.meta.url), 'utf8'));

test('actual exported landmark bounds stay below gameplay and outside its column at every tier', () => {
  let instances = 0;
  for (const [kind, sites] of Object.entries(ARCHIPELAGO)) {
    instances += sites.length;
    for (const site of sites) for (const tier of ['high', 'balanced', 'low']) {
      const asset = receipt.assets.find(asset => asset.id === `sky-${kind}` && asset.tier === tier);
      assert.ok(asset);
      const { min, max } = asset.bounds;
      assert.ok(site.position[1] + max[1] * site.scale < -6, `${kind} highest architecture stays below the tiles`);
      const radius = Math.hypot(Math.max(Math.abs(min[0]), Math.abs(max[0])), Math.max(Math.abs(min[2]), Math.abs(max[2]))) * site.scale;
      assert.ok(Math.hypot(site.position[0], site.position[2]) - radius > 15, `${kind} clears the board column`);
    }
  }
  assert.equal(instances, 10);
  const directions = Object.values(ARCHIPELAGO).flat().map(site => Math.atan2(site.position[0], site.position[2])).sort((a,b) => a-b);
  const gaps = directions.map((a,i) => ((directions[(i+1)%directions.length]-a)+Math.PI*2)%(Math.PI*2));
  assert.ok(Math.max(...gaps) < Math.PI, 'an orbit never exposes a completely unpopulated hemisphere');
});
