import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { checkBoardMotion } from './board-v5-motion.mjs';

const origin = process.env.ROYAL_TEST_URL ?? 'http://127.0.0.1:5199';
const baseline = process.env.ROYAL_BASELINE_URL;
const out = process.env.ROYAL_EVIDENCE_DIR ?? 'docs/royal-player-tokens/browser';
const tokenFiles = ['RoyalGriffin.glb', 'RoyalUnicorn.glb', 'RoyalCarriage.glb', 'RoyalPegasus.glb'];
const identity = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: process.env.CI ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'] : [],
});
await mkdir(out, { recursive: true });
const page = await browser.newPage();
const responses = new Map();
const pageErrors = [];
page.on('response', response => {
  if (response.url().includes('/assets/models/player-tokens/')) {
    responses.set(new URL(response.url()).pathname.split('/').at(-1), response.status());
  }
});
page.on('pageerror', error => pageErrors.push(error.message));
page.setDefaultTimeout(45_000);

await page.evaluateOnNewDocument(() => localStorage.setItem('monopoly-graphics-quality', 'balanced'));
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });

async function game(url, fixture) {
  await page.goto(`${url}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__soloTest?.fixture && window.__graphicsAudit?.actors);
  return page.evaluate(name => window.__soloTest.fixture(name), fixture);
}

const readTokens = () => page.evaluate(() => window.__graphicsAudit.royalTokens());
const waitForTokens = tile => page.waitForFunction(value => {
  const tokens = window.__graphicsAudit.royalTokens();
  return tokens.length === 4 && tokens.every(token => token.asset && token.tile === value &&
    Math.abs(token.bounds.min[1] - token.position[1]) < .002);
}, {}, tile);
async function screenshot(name) {
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 90 });
}

async function closeView(x, z) {
  await page.mouse.move(7, 7);
  await page.evaluate(([x, z]) => window.__graphicsAudit.camera([x+4.8, 3.7, z+5.8], [x, .34, z]), [x, z]);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function checkPlacement(tokens, { x, z, width, depth, tile, axis }) {
  assert.equal(tokens.length, 4);
  assert.deepEqual(tokens.map(token => token.asset), tokenFiles);
  assert.deepEqual(tokens.map(token => token.identityColor), identity);
  assert.deepEqual(tokens.map(token => token.ai), [false,true,true,true]);
  assert.equal(new Set(tokens.map(token => token.position.join(','))).size, 4);
  for (const { asset, position, bounds, tile: actual, triangles, drawMeshes, shadowCasters, textures } of tokens) {
    assert.equal(actual, tile);
    assert.ok(Math.abs(bounds.min[1] - position[1]) < .002, `${asset} is grounded`);
    assert.ok(triangles > 0 && triangles < 44_000 && drawMeshes <= 12 && shadowCasters > 0);
    assert.equal(textures, 1, 'the embedded atlas was decoded by GLTFLoader');
    const halfX = (axis === 'z' ? depth : width) / 2;
    const halfZ = (axis === 'z' ? width : depth) / 2;
    assert.ok(bounds.min[0] >= x-halfX && bounds.max[0] <= x+halfX, `${asset} stays within tile X`);
    assert.ok(bounds.min[2] >= z-halfZ && bounds.max[2] <= z+halfZ, `${asset} stays within tile Z`);
  }
  tokens.forEach((first, index) => tokens.slice(index+1).forEach(second => {
    const a = first.bounds, b = second.bounds;
    const overlapX = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const overlapZ = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    assert.ok(overlapX < .04 || overlapZ < .04, `${first.asset} overlaps ${second.asset}`);
  }));
}

async function measure() {
  return page.evaluate(async () => {
    const audit = window.__graphicsAudit;
    await new Promise(resolve => setTimeout(resolve, 1000));
    audit.start();
    await new Promise(resolve => setTimeout(resolve, 3500));
    const { samples, metadata } = audit.stop();
    const percentile = (key, p) => {
      const values = samples.map(sample => sample[key]).filter(Number.isFinite).sort((a,b) => a-b);
      return values.length ? Number(values[Math.floor((values.length-1)*p)].toFixed(2)) : null;
    };
    return { renderer: metadata.renderer, frames: samples.length,
      medianMs: percentile('frameMs', .5), p95Ms: percentile('frameMs', .95),
      medianCalls: percentile('calls', .5), medianTriangles: percentile('triangles', .5) };
  });
}

async function checkMissingModel() {
  const tab = await browser.newPage();
  const warnings = [];
  const errors = [];
  tab.on('console', message => { if (message.type() === 'warn') warnings.push(message.text()); });
  tab.on('pageerror', error => errors.push(error.message));
  try {
    await tab.setCacheEnabled(false);
    await tab.setRequestInterception(true);
    tab.on('request', request => {
      if (new URL(request.url()).pathname.endsWith('/RoyalPegasus.glb')) {
        return request.respond({ status: 404, body: '' });
      }
      return request.continue();
    });
    await tab.goto(`${origin}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded' });
    await tab.waitForFunction(() => window.__soloTest?.fixture && window.__graphicsAudit?.royalTokens);
    await tab.evaluate(() => window.__soloTest.fixture('royal-tokens'));
    await tab.waitForNetworkIdle();
    await tab.waitForFunction(() => window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 3 &&
      document.querySelector('[aria-label="Roll dice"]:enabled'));
    assert.ok(warnings.some(message => message.includes('Royal Pegasus could not load')));
    const missing = await tab.evaluate(() => window.__graphicsAudit.royalTokens().find(token => token.token === 'top_hat'));
    assert.equal(missing.asset, undefined);
    assert.equal(missing.identityColor, '#10b981');
    assert.deepEqual(errors, []);
    return { blocked: 'RoyalPegasus.glb', ring: missing.identityColor, boardPlayable: true };
  } finally {
    await tab.close();
  }
}

try {
  const evidence = {};
  if (baseline) {
    await game(baseline, 'arcade-gallery-empty');
    await page.waitForFunction(() => window.__centralCityAudit?.ready);
    await closeView(9.55,9.55);
    evidence.baseline = await measure();
    await screenshot('baseline-shared-corner');
  }
  await game(origin, 'arcade-gallery-empty');
  await page.waitForFunction(() => window.__centralCityAudit?.ready &&
    window.__graphicsAudit.royalTokens().filter(token => token.asset).length === 3);
  await closeView(9.55,9.55);
  evidence.shippedLineup = await measure();
  await screenshot('updated-shared-corner');

  await game(origin, 'royal-tokens');
  await waitForTokens(0);
  evidence.corner = await readTokens();
  checkPlacement(evidence.corner, { x: 9.55, z: 9.55, width: 2.9, depth: 2.9, tile: 0 });
  await screenshot('desktop-board-overview');
  await closeView(9.55,9.55);
  await screenshot('all-four-at-go');
  evidence.allFour = await measure();
  const motion = await checkBoardMotion(page, { out, name: 'royal-griffin', speed: 2, motion: 'no-preference' });
  const moved = (await readTokens())[0];
  assert.ok(Math.abs(moved.heading + Math.PI/2) < .002, 'the Griffin faces the final direction of travel');
  evidence.movement = { from: motion.trace.ready.tile, to: motion.trace.landing.tile,
    hopHeight: motion.trace.hop.token[1], finalHeading: moved.heading };

  await page.setViewport({ width: 414, height: 780, deviceScaleFactor: 1 });
  await game(origin, 'royal-tokens-property');
  await waitForTokens(18);
  evidence.property = await readTokens();
  checkPlacement(evidence.property, { x: -9.55, z: -5.4, width: 1.8, depth: 2.9, tile: 18, axis: 'z' });
  await screenshot('small-viewport');
  await closeView(-9.55,-5.4);
  await screenshot('small-viewport-shared-property');
  for (const file of tokenFiles) assert.equal(responses.get(file), 200, `${file} served by the production build`);
  evidence.responses = Object.fromEntries(responses);
  assert.deepEqual(pageErrors, []);
  assert.ok(evidence.shippedLineup.frames >= 5 && evidence.allFour.frames >= 5);
  evidence.missingAsset = await checkMissingModel();
  await writeFile(join(out, 'runtime.json'), JSON.stringify(evidence, null, 2)+'\n');
  console.log('Verified four production GLBs, shared tiles, player colors, desktop/mobile views and a rendered move.');
} catch (error) {
  await screenshot('failure').catch(() => {});
  console.error('Browser errors', pageErrors);
  throw error;
} finally {
  await browser.close();
}
