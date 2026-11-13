import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(readFileSync(path.resolve('dist/.vite/manifest.json'), 'utf8'));
function imports(key, visited = new Set()) {
  if (visited.has(key)) return visited;
  visited.add(key);
  for (const dependency of manifest[key]?.imports ?? []) imports(dependency, visited);
  return visited;
}
const initial = imports('index.html');
export const initialJavaScript = [...initial].map(key => manifest[key].file).filter(file => file.endsWith('.js'));
const gameKeys = new Set([...imports('src/game/SoloGame.tsx'), ...imports('src/online/OnlineMatchScreen.tsx')]);
export const gameplayJavaScript = [...gameKeys].filter(key => !initial.has(key)).map(key => manifest[key].file);

export async function observeCanvasCreation(page) {
  await page.evaluateOnNewDocument(() => {
    window.__webglContextRequests = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/^(webgl2?|experimental-webgl)$/.test(type)) window.__webglContextRequests.push(type);
      return original.call(this, type, ...args);
    };
  });
}
export async function assertNoGameplay(page, requests, label) {
  const state = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    contexts: window.__webglContextRequests,
    hud: !!document.querySelector('.monopoly-app,.city-match,.fantasy-dock,.camera-toolbar'),
  }));
  assert.equal(state.canvases, 0, `${label}: no Canvas may be mounted`);
  assert.deepEqual(state.contexts, [], `${label}: no WebGL context may be requested`);
  assert.equal(state.hud, false, `${label}: gameplay HUD must be absent`);
  const forbidden = requests.filter(url => gameplayJavaScript.some(file => url.includes(file)) || /\.(glb|gltf|ktx2?|hdr|exr)(?:$|\?)/i.test(url) || /\/assets\/models\//.test(url));
  assert.deepEqual(forbidden, [], `${label}: no gameplay JavaScript or heavy 3D assets may be loaded`);
}
