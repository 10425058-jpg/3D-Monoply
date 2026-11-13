import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
function staticGraph(entry) {
  const files = new Set(); const packages = new Set();
  function visit(filename) {
    if (files.has(filename)) return;
    files.add(filename);
    const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || node.isTypeOnly || node.importClause?.isTypeOnly) continue;
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
        !node.importClause.name && node.importClause.namedBindings.elements.every(item => item.isTypeOnly)) continue;
      const specifier = node.moduleSpecifier.text;
      if (!specifier.startsWith('.')) { packages.add(specifier); continue; }
      const candidate = path.resolve(path.dirname(filename), specifier);
      if (candidate.endsWith('.css')) continue;
      const resolved = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'].map(ext => candidate + ext).find(existsSync);
      assert.ok(resolved, `Resolve ${specifier} from ${filename}`);
      visit(resolved);
    }
  }
  visit(path.join(root, entry));
  return { files: [...files].map(file => path.relative(root, file).replaceAll('\\', '/')), packages: [...packages] };
}
test('the menu entry graph excludes all gameplay renderers, assets, rules and WebGL packages', () => {
  const graph = staticGraph('src/main.tsx');
  assert.deepEqual(graph.files.filter(file => /src\/(App\.tsx|game\/|components\/3d\/|components\/environment\/|store\/useGameStore|presentation\/SceneStore)/.test(file)), []);
  assert.deepEqual(graph.packages.filter(name => /^(three|@react-three\/|canvas-confetti|socket\.io-client)/.test(name)), []);
  assert.ok(graph.files.includes('src/menu/MainMenu.tsx'));
});
test('explicit Solo and verified-match modules retain the existing real 3D engine', () => {
  for (const entry of ['src/game/SoloGame.tsx', 'src/online/OnlineMatchScreen.tsx']) {
    const graph = staticGraph(entry);
    assert.ok(graph.files.includes('src/components/3d/Scene3D.tsx'));
    assert.ok(graph.packages.includes('@react-three/fiber'));
    assert.ok(graph.packages.includes('three'));
  }
});
test('the decorative menu image is a compact local JPEG, independent of game assets', () => {
  const bytes = readFileSync(path.join(root, 'public/assets/menu/fantasy-city-menu.jpg'));
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  assert.ok(bytes.length < 650000, 'Keep the menu artwork below 650 KB');
});
