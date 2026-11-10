import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/environment/environmentLayout.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const layout = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('background layout is deterministic and does not consume gameplay randomness', () => {
  const random = Math.random;
  Math.random = () => { throw new Error('Environment consumed random game stream'); };
  try {
    for (let i = 0; i < 1000; i++) {
      const value = layout.variation(i, 9);
      assert.equal(value, layout.variation(i, 9));
      assert.ok(value >= 0 && value < 1);
    }
  } finally { Math.random = random; }
});
test('valley surface stays well below the board across its whole footprint', () => {
  for (let radius = 30; radius <= 178; radius += 4) for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2;
    const y = layout.terrainHeight(Math.sin(angle) * radius, Math.cos(angle) * radius);
    assert.ok(Number.isFinite(y)); assert.ok(y < -15);
  }
});
test('castles, villages and waterways remain outside the playable board', () => {
  for (const site of layout.CASTLE_SITES) {
    assert.ok(Math.hypot(site.x, site.z) - 10 * site.size > 30);
    assert.ok(layout.terrainHeight(site.x, site.z) + site.rise + 19 * site.size < 0);
  }
  for (const [x, z] of [...layout.VILLAGE_SITES, ...layout.RIVER_POINTS]) assert.ok(Math.hypot(x, z) > 30);
});
test('quality tiers have explicit bounded budgets and retain scenery at low quality', () => {
  const { low, balanced, high } = layout.ENVIRONMENT_BUDGETS;
  for (const key of ['trees', 'houses', 'peaks', 'clouds']) {
    assert.ok(low[key] > 0); assert.ok(low[key] < balanced[key]); assert.ok(balanced[key] < high[key]);
  }
  assert.ok(high.trees <= 1200); assert.ok(high.clouds <= 48);
});
test('live reduced-motion and visibility changes stop even an already queued frame', async () => {
  let reduced = false;
  globalThis.window = { matchMedia: () => ({ get matches() { return reduced; } }) };
  globalThis.document = { hidden: false };
  try {
    const text = readFileSync(new URL('../src/components/environment/environmentMotion.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
    const { mayAnimateEnvironment } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
    assert.equal(mayAnimateEnvironment(true), true);
    reduced = true; assert.equal(mayAnimateEnvironment(true), false);
    reduced = false; document.hidden = true; assert.equal(mayAnimateEnvironment(true), false);
    document.hidden = false; assert.equal(mayAnimateEnvironment(false), false);
  } finally { delete globalThis.window; delete globalThis.document; }
});
