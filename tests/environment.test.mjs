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

test('foreground apron is lower while the rear landscape height is preserved', () => {
  const original = (x, z) => -14 - Math.hypot(x, z) * .54 + Math.sin(x * .045) * Math.cos(z * .034) * 7 + Math.sin((x + z) * .07) * 3;
  for (const x of [-40, 0, 40]) {
    assert.ok(layout.terrainHeight(x, 64) < original(x, 64) - 13);
    for (const z of [-30, -80, -140]) assert.equal(layout.terrainHeight(x, z), original(x, z));
  }
});

test('terrain opens toward the foreground with a continuous, feathered inner rim', () => {
  assert.ok(layout.terrainInnerRadius(0) > 64);
  assert.ok(layout.terrainInnerRadius(Math.PI) < 36);
  for (let i = 0; i <= 128; i++) {
    const angle = i / 128 * Math.PI * 2, inner = layout.terrainInnerRadius(angle);
    const opacity = offset => layout.terrainOpacity(Math.sin(angle) * (inner + offset), Math.cos(angle) * (inner + offset));
    assert.ok(opacity(0) < 1e-10);
    assert.ok(opacity(4) < opacity(14) && opacity(14) < opacity(24));
    assert.ok(Math.abs(opacity(28) - 1) < 1e-10);
  }
});

test('clouds leave open air below the board in every quality tier', () => {
  const random = Math.random;
  Math.random = () => { throw new Error('Cloud layout consumed gameplay randomness'); };
  try {
    for (const quality of ['low', 'balanced', 'high']) {
      const clouds = layout.cloudLayout(quality);
      assert.deepEqual(clouds, layout.cloudLayout(quality));
      assert.equal(clouds.length, layout.ENVIRONMENT_BUDGETS[quality].clouds + layout.CASTLE_SITES.length);
      for (const { position: [x, y, z], size: [width, height] } of clouds) {
        assert.ok(Math.hypot(x, z) - width / 2 > 30, 'clouds must frame the board, not fill its underside');
        assert.ok(y + height / 2 < -23, 'cloud tops stay well below the board');
        assert.ok(height < 7.1, 'no tall, near-field cloud wall');
      }
    }
  } finally { Math.random = random; }
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
