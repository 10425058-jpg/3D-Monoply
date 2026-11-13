import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Production preview, fixed seed, viewport, DPR, warmup and sampling window.
// Override CHROME_PATH for another machine; never infer laptop performance from CI.
const label = process.argv[2] || 'candidate';
const origin = process.env.AUDIT_URL || 'http://127.0.0.1:4175';
const out = path.resolve('docs/graphics-phase-1/evidence', label);
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
});
try {
  for (const quality of ['low', 'balanced', 'high']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(tier => {
      let seed = 10425058;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      localStorage.setItem('monopoly-graphics-quality', tier);
    }, quality);
    await page.goto(`${origin}/?graphicsAudit#solo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__graphicsAudit, { timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 4000));
    const defaultCamera = await page.evaluate(() => window.__graphicsAudit.metadata().camera);
    await page.screenshot({ path: path.join(out, `${quality}-default-overview.png`) });
    // Identical comparison pose, kept separate from the improved default overview.
    await page.evaluate(() => window.__graphicsAudit.camera([0, 32, 30], [0, 0.5, 0]));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.evaluate(() => window.__graphicsAudit.start());
    await new Promise(resolve => setTimeout(resolve, 10000));
    const result = await page.evaluate(() => window.__graphicsAudit.stop());
    result.defaultCamera = defaultCamera;
    result.errors = errors;
    const sorted = key => result.samples.map(s => s[key]).filter(v => v !== null).sort((a, b) => a - b);
    const median = key => { const v = sorted(key); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const meanFrame = result.samples.reduce((sum, s) => sum + s.frameMs, 0) / result.samples.length;
    result.summary = { fps: 1000 / meanFrame, frameP50: median('frameMs'),
      frameP95: sorted('frameMs')[Math.floor(result.samples.length * .95)],
      renderCpuP50: median('renderCpuMs'), gpuP50: median('gpuMs'),
      calls: median('calls'), triangles: median('triangles'), textures: median('textures'),
      geometries: median('geometries'), samples: result.samples.length };
    await page.screenshot({ path: path.join(out, `${quality}-same-camera.png`) });
    await writeFile(path.join(out, `${quality}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ label, quality, ...result.summary, renderer: result.metadata.renderer, errors }));
    await page.close();
  }
} finally { await browser.close(); }
