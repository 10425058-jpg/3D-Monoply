import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const origin = process.env.ARCADE_URL || 'http://127.0.0.1:5198';
const output = process.env.ARCADE_GRAPHICS_OUT || 'docs/arcade-v8/evidence';
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const gallery = [
  { spaceId: 6, level: 0, rotation: 0 },
  { spaceId: 16, level: 1, rotation: -Math.PI / 2 },
  { spaceId: 26, level: 2, rotation: Math.PI },
  { spaceId: 37, level: 3, rotation: Math.PI / 2 },
];
const browser = await puppeteer.launch({
  executablePath, headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader'],
});

async function checkGallery(quality, failHotel = false) {
  const page = await browser.newPage();
  const errors = [];
  let hotelRequestFailed = false;
  const isHotel = url => new URL(url).pathname.endsWith('/arcade-properties/hotel.glb');
  page.on('pageerror', error => errors.push(error.message));
  if (failHotel) {
    await page.setRequestInterception(true);
    page.on('requestfailed', request => { if (isHotel(request.url())) hotelRequestFailed = true; });
    page.on('request', request => {
      if (request.isInterceptResolutionHandled()) return;
      void (isHotel(request.url()) ? request.abort() : request.continue());
    });
  }
  try {
    await page.setViewport({ width: 1360, height: 820, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(tier => localStorage.setItem('monopoly-graphics-quality', tier), quality);
    await page.goto(`${origin}/?soloTest&graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction(() => window.__soloTest && window.__graphicsAudit?.arcade, { timeout: 90_000 });
    await page.evaluate(() => window.__soloTest.fixture('arcade-gallery'));
    await page.waitForFunction(expected => {
      const audit = window.__graphicsAudit?.arcade();
      return audit?.buildings.length === 4 && audit.buildings.filter(model => model.source === 'gltf').length === expected;
    }, { timeout: 90_000 }, failHotel ? 3 : 4);
    const result = await page.evaluate(() => ({
      renderer: window.__graphicsAudit.metadata().renderer,
      quality: window.__graphicsAudit.quality,
      players: window.__soloTest.state().players.map(({ id, color }) => ({ id, color })),
      ...window.__graphicsAudit.arcade(),
    }));
    assert.equal(result.quality, quality);
    assert.equal(hotelRequestFailed, failHotel);
    assert.deepEqual(result.construction, [], 'fixture restoration and reduced motion are quiet');
    assert.equal(result.atlasTextures, 1, 'loaded stages share the cached atlas');
    assert.equal(result.drawMeshes, failHotel ? 13 : 18);
    assert.equal(result.shadowCasters, quality === 'high' ? 7 : 0);
    for (const { spaceId, level, rotation } of gallery) {
      const model = result.buildings.find(model => model.spaceId === spaceId);
      assert.ok(model, `plot on tile ${spaceId}`);
      assert.equal(model.level, level);
      assert.equal(model.source, failHotel && level === 3 ? 'fallback' : 'gltf');
      assert.equal(model.color, result.players.find(owner => owner.id === model.ownerId).color.toLowerCase());
      assert.ok(Math.abs(Math.sin(model.rotationY) - Math.sin(rotation)) < .0001 &&
        Math.abs(Math.cos(model.rotationY) - Math.cos(rotation)) < .0001);
      assert.ok(model.scale.every(value => Math.abs(value - 1) < .0001));
    }
    if (quality === 'balanced' && !failHotel) {
      // Capture the public board, with all four street sides and levels present.
      const screenshot = path.join(output, 'four-sided-property-gallery.png');
      await page.screenshot({ path: screenshot });
      result.screenshot = path.basename(screenshot);
    }
    assert.deepEqual(errors, []);
    return { failedHotelRequest: hotelRequestFailed, ...result };
  } finally {
    await page.close();
  }
}

try {
  await mkdir(output, { recursive: true });
  const results = [];
  for (const quality of ['low', 'balanced', 'high']) {
    const report = await checkGallery(quality);
    results.push(report);
    console.log(`${quality}: ${report.buildings.length} real Blender models, ${report.drawMeshes} batched draw meshes, ${report.triangles} triangles`);
  }
  results.push(await checkGallery('balanced', true));
  console.log('Blocked hotel GLB: fallback retained its level, owner color, rotation and position');
  await writeFile(path.join(output, 'property-graphics.json'), JSON.stringify(results, null, 2) + '\n');
} finally {
  await browser.close();
}
