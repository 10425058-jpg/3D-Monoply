import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve('docs/graphics-phase-1/evidence');
const rows = [];
for (const quality of ['low', 'balanced', 'high']) {
  const before = JSON.parse(await readFile(path.join(root, 'baseline', `${quality}.json`)));
  const after = JSON.parse(await readFile(path.join(root, 'candidate', `${quality}.json`)));
  rows.push({ quality, before: before.summary, after: after.summary,
    fpsChangePercent: (after.summary.fps / before.summary.fps - 1) * 100,
    callsChangePercent: (after.summary.calls / before.summary.calls - 1) * 100 });
}
await writeFile(path.join(root, 'comparison.json'), JSON.stringify(rows, null, 2));
const hashes = {};
for (const directory of ['baseline', 'candidate', 'regression']) for (const name of await readdir(path.join(root, directory))) {
  if (name === 'failure.png') continue;
  const relative = `${directory}/${name}`;
  hashes[relative] = createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
}
await writeFile(path.join(root, 'sha256.json'), JSON.stringify(hashes, null, 2));
console.log(JSON.stringify(rows, null, 2));
