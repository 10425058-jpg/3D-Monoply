import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PerspectiveCamera, Vector3 } from 'three';

const source = readFileSync(new URL('../src/components/3d/overviewCamera.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { overviewCamera } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [360, 640]]) {
  for (const top of [false, true]) test(`${width}x${height} ${top ? 'top' : 'overview'} fits the board in HUD safe space`, () => {
    const fit = overviewCamera(width, height, top);
    const camera = new PerspectiveCamera(fit.fov, width / height, .5, 400);
    camera.position.fromArray(fit.position); camera.lookAt(new Vector3(...fit.target));
    camera.setViewOffset(width, height, ...fit.offset, width, height); camera.updateMatrixWorld();
    const points = [];
    for (const x of [-13, 13]) for (const y of [-2.1, .7]) for (const z of [-13, 13]) points.push(new Vector3(x, y, z));
    for (const x of [-6, 6]) for (const z of [-5, 5]) points.push(new Vector3(x, 11, z));
    const projected = points.map(point => {
      point.project(camera); return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, z: point.z };
    });
    for (const p of projected) {
      assert.ok(p.x >= fit.insets.left && p.x <= width - fit.insets.right, `horizontal: ${JSON.stringify(p)}`);
      assert.ok(p.y >= fit.insets.top && p.y <= height - fit.insets.bottom, `vertical: ${JSON.stringify(p)}`);
      assert.ok(p.z > -1 && p.z < 1);
    }
    const spanX = Math.max(...projected.map(p => p.x)) - Math.min(...projected.map(p => p.x));
    const spanY = Math.max(...projected.map(p => p.y)) - Math.min(...projected.map(p => p.y));
    assert.ok(Math.max(spanX / (width - fit.insets.left - fit.insets.right), spanY / (height - fit.insets.top - fit.insets.bottom)) > .9,
      'the board should use the available space rather than becoming a small distant object');
  });
}
