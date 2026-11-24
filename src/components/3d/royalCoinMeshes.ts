import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COIN_VALUES, coinTier, type CoinValue } from './royalCoinValues';

const cell = 256, atlasSize = 1024, segments = 28;
const materialFamilies = {
  copper: { rim: '#ffd2a0', highlights: '#e39457', face: '#ab5431', shadow: '#5f2c22', engraving: '#ffe1b4' },
  silver: { rim: '#fbf9ff', highlights: '#ccd8ef', face: '#8996af', shadow: '#454d67', engraving: '#f9f4e9' },
  gold: { rim: '#fff6b2', highlights: '#ffd15c', face: '#ba7623', shadow: '#714119', engraving: '#fff1ac' },
};
const reliefColors = { rim: '#e8e8e8', highlights: '#bcbcbc', face: '#777777', shadow: '#585858', engraving: '#dedede' };
const atlasCell = (index: number) => [(index % 4) * cell, Math.floor(index / 4) * cell];

function jewel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, relief: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(.72, 0); ctx.lineTo(0, 1); ctx.lineTo(-.72, 0); ctx.closePath();
  ctx.fillStyle = relief ? '#d0d0d0' : '#edbc66'; ctx.fill();
  ctx.scale(.76, .76);
  for (const [cx, cy, ex, ey, color] of [[0, -1, .72, 0, '#589ef5'], [.72, 0, 0, 1, '#164994'],
    [0, 1, -.72, 0, '#092c70'], [-.72, 0, 0, -1, '#9cddff']] as const) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cx, cy); ctx.lineTo(ex, ey); ctx.closePath();
    ctx.fillStyle = relief ? '#f0f0f0' : color; ctx.fill();
  }
  ctx.restore();
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.beginPath(); ctx.moveTo(-29, -6); ctx.quadraticCurveTo(-12, 12, -8, -9); ctx.lineTo(0, -18);
  ctx.lineTo(8, -9); ctx.quadraticCurveTo(12, 12, 29, -6); ctx.lineTo(20, 16);
  ctx.quadraticCurveTo(0, 11, -20, 16); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 19, 20, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  for (const [px, py, r] of [[-29, -8, 4.2], [0, -20, 5], [29, -8, 4.2]]) {
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function shield(ctx: CanvasRenderingContext2D, y: number, size: number) {
  ctx.save(); ctx.translate(0, y); ctx.scale(size, size);
  ctx.beginPath(); ctx.moveTo(0, -17); ctx.quadraticCurveTo(7, -12, 18, -13); ctx.lineTo(17, 2);
  ctx.quadraticCurveTo(14, 14, 0, 20); ctx.quadraticCurveTo(-14, 14, -17, 2); ctx.lineTo(-18, -13); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function castle(ctx: CanvasRenderingContext2D, y: number, scale: number, shade: string) {
  ctx.save(); ctx.translate(0, y); ctx.scale(scale, scale);
  ctx.fillRect(-37, 10, 74, 5);
  for (const [x, h] of [[-25, 16], [0, 29], [25, 16]]) {
    ctx.fillRect(x - 9, 9 - h, 18, h + 2);
    ctx.beginPath(); ctx.moveTo(x - 12, 10 - h); ctx.lineTo(x, -4 - h); ctx.lineTo(x + 12, 10 - h); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 1, -12 - h, 2, 13);
    ctx.beginPath(); ctx.moveTo(x, -11 - h); ctx.lineTo(x + 11, -8 - h); ctx.lineTo(x, -5 - h); ctx.closePath(); ctx.fill();
  }
  ctx.fillRect(-24, -1, 48, 13);
  const finish = ctx.fillStyle;
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.roundRect(-4, -1, 8, 14, [4, 4, 0, 0]); ctx.fill();
  ctx.fillRect(-27, -3, 4, 7); ctx.fillRect(23, -3, 4, 7); ctx.fillRect(-2, -16, 4, 7);
  ctx.fillStyle = finish;
  ctx.restore();
}

function laurel(ctx: CanvasRenderingContext2D, arc = 0) {
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1);
    ctx.beginPath(); ctx.moveTo(12, 71 - arc); ctx.bezierCurveTo(45, 68 - arc, 71, 53 - arc, 77, 12 - arc);
    ctx.lineWidth = 2.2; ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const theta = (.35 + i * .13) * Math.PI;
      const x = 82 * Math.sin(theta), y = 67 * -Math.cos(theta) - arc;
      ctx.beginPath(); ctx.ellipse(x, y, 8.8, 3.2, -theta + .53, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - 6.8, y - 6.5, 7.1, 2.6, .66 - theta * .32, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function mintFace(ctx: CanvasRenderingContext2D, value: CoinValue, back: boolean, relief = false) {
  const colors = relief ? reliefColors : materialFamilies[coinTier(value)];
  const face = ctx.createLinearGradient(44, 25, 194, 221);
  face.addColorStop(0, colors.highlights); face.addColorStop(.29, colors.face);
  face.addColorStop(.70, colors.shadow); face.addColorStop(1, colors.face);
  ctx.fillStyle = face; ctx.fillRect(0, 0, cell, 229);
  ctx.save(); ctx.translate(128, 117);
  // A bright lip and a darker interior groove sit inside the sculpted 3D rim.
  for (const [radius, width, shade] of [[99, 5, colors.rim], [94, 2.5, colors.shadow], [92, 1.4, colors.highlights]] as const) {
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.lineWidth = width; ctx.strokeStyle = shade; ctx.stroke();
  }
  ctx.fillStyle = colors.engraving;
  for (let i = 0; i < 64; i++) {
    const theta = i * Math.PI / 32;
    ctx.beginPath(); ctx.arc(87.1 * Math.cos(theta), 87.1 * Math.sin(theta), i % 8 === 0 ? 1.85 : 1.22, 0, Math.PI * 2); ctx.fill();
  }
  if (value === 10 || value === 500 || back) {
    ctx.beginPath();
    for (let i = 0; i < 128; i++) {
      const theta = i * Math.PI / 64, r = 81.5 + 2.1 * Math.cos(theta * 8);
      if (i === 0) ctx.moveTo(r * Math.cos(theta), r * Math.sin(theta));
      else ctx.lineTo(r * Math.cos(theta), r * Math.sin(theta));
    }
    ctx.closePath(); ctx.lineWidth = 1.45; ctx.strokeStyle = colors.highlights; ctx.stroke();
  }
  const ink = ctx.createLinearGradient(0, -84, 0, 84);
  ink.addColorStop(0, colors.rim); ink.addColorStop(.45, colors.engraving); ink.addColorStop(1, colors.highlights);
  ctx.fillStyle = ink; ctx.strokeStyle = colors.engraving;
  if (!relief) { ctx.shadowColor = colors.shadow; ctx.shadowOffsetY = 2.8; ctx.shadowBlur = 1.7; }
  if (back) {
    crown(ctx, 0, -59, .63);
    if (value >= 100) castle(ctx, -4, .97, colors.shadow);
    else shield(ctx, -10, 1.36);
    if (value >= 20 && value < 100) jewel(ctx, 0, -8, 14, relief);
    ctx.save(); ctx.scale(.92, .82); ctx.translate(0, -7); laurel(ctx, 30); ctx.restore();
  } else {
    crown(ctx, 0, value === 20 ? -47 : -55, value === 1000 ? .98 : .82);
    if (value === 20) jewel(ctx, 0, -77, 8.5, relief);
    if (value >= 500) jewel(ctx, 0, -52, 9, relief);
    laurel(ctx);
    if (value === 100 || value === 1000) castle(ctx, 61, .64, colors.shadow);
    else if (value >= 50) { shield(ctx, 55, .88); jewel(ctx, 0, 56, 13, relief); }
    else if (value === 20) jewel(ctx, 0, 60, 10, relief);
    else {
      ctx.save(); ctx.translate(0, 59);
      ctx.beginPath(); ctx.ellipse(0, -3, 3.8, 10, 0, 0, Math.PI * 2); ctx.fill();
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(side * 7, -1, 4.7, 3.8, side * .45, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillRect(-5, 4, 10, 2.9); ctx.restore();
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const textSize = back ? (value === 1000 ? 39 : 46) : value === 1000 ? 44 : value >= 100 ? 53 : 64;
  ctx.font = `bold ${textSize}px Georgia, serif`;
  ctx.fillText(`$${value.toLocaleString('en-US')}`, 0, back ? 51 : 2, value >= 500 ? 136 : 149);
  ctx.restore();

  const edge = ctx.createLinearGradient(0, 228, 0, 255);
  edge.addColorStop(0, colors.rim); edge.addColorStop(.26, colors.highlights); edge.addColorStop(.55, colors.face);
  edge.addColorStop(.75, colors.shadow); edge.addColorStop(1, colors.highlights);
  ctx.fillStyle = edge; ctx.fillRect(0, 229, cell, 27);
  for (let i = 0; i < segments * 2; i++) {
    const x = 4 + i * (cell - 8) / (segments * 2);
    ctx.globalAlpha = .53;
    ctx.fillStyle = colors.shadow; ctx.fillRect(x, 236, 1.15, 15);
    ctx.fillStyle = colors.rim; ctx.fillRect(x + 1.2, 236, .78, 15);
  }
  ctx.globalAlpha = 1;
}

function cap(index: number, front: boolean) {
  const [x, y] = atlasCell(index);
  const geometry = new THREE.CircleGeometry(.886, segments);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i,
    (x + 128 + (uv.getX(i) - .5) * 202) / atlasSize,
    1 - (y + 117 - (uv.getY(i) - .5) * 202) / atlasSize);
  return geometry.rotateX((front ? -1 : 1) * Math.PI / 2).translate(0, front ? .099 : -.099, 0);
}

function coinGeometry(index: number) {
  const [x, y] = atlasCell(index);
  // Recessed die faces, two proud beveled lips and a milled central edge.
  const rim = [[.884, -.099, 231], [.918, -.122, 233], [.96, -.119, 236], [1, -.082, 239],
    [1, .082, 247], [.96, .119, 250], [.918, .122, 253], [.884, .099, 255]];
  const positions: number[] = [], uvs: number[] = [], faces: number[] = [];
  rim.forEach(([radius, height, row], band) => {
    for (let i = 0; i <= segments; i++) {
      const theta = i * Math.PI * 2 / segments;
      positions.push(radius * Math.cos(theta), height, radius * Math.sin(theta));
      uvs.push((x + 4 + i * (cell - 8) / segments) / atlasSize, 1 - (y + row) / atlasSize);
      if (band === rim.length - 1 || i === segments) continue;
      const a = band * (segments + 1) + i, b = a + segments + 1;
      faces.push(a, b, a + 1, a + 1, b, b + 1);
    }
  });
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  body.setIndex(faces); body.computeVertexNormals();
  const sides = [body, cap(index, true), cap(index + COIN_VALUES.length, false)];
  const mesh = mergeGeometries(sides);
  sides.forEach(geometry => geometry.dispose());
  return mesh;
}

function mintCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = atlasSize;
  return canvas.getContext('2d', { willReadFrequently: true })!;
}

export function makeRoyalCoins() {
  const albedo = mintCanvas(), height = mintCanvas();
  const geometries = new Map<CoinValue, THREE.BufferGeometry>();
  COIN_VALUES.forEach((value, index) => {
    for (const back of [false, true]) {
      const [x, y] = atlasCell(index + (back ? COIN_VALUES.length : 0));
      for (const [ctx, emboss] of [[albedo, false], [height, true]] as const) {
        ctx.save(); ctx.translate(x, y); mintFace(ctx, value, back, emboss); ctx.restore();
      }
    }
    geometries.set(value, coinGeometry(index));
  });
  const atlas = new THREE.CanvasTexture(albedo.canvas);
  atlas.name = 'Royal currency | obverse, reverse and edge';
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  const { data } = height.getImageData(0, 0, atlasSize, atlasSize);
  const emboss = new Uint8Array(atlasSize * atlasSize);
  for (let y = 0; y < atlasSize; y++) for (let x = 0; x < atlasSize; x++) {
    emboss[(atlasSize - y - 1) * atlasSize + x] = data[(y * atlasSize + x) * 4];
  }
  const bump = new THREE.DataTexture(emboss, atlasSize, atlasSize, THREE.RedFormat);
  bump.name = 'Royal currency | struck relief';
  bump.magFilter = THREE.LinearFilter; bump.minFilter = THREE.LinearMipmapLinearFilter;
  bump.generateMipmaps = true; bump.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: atlas, bumpMap: bump, bumpScale: .011, metalness: .59, roughness: .31 });
  return { geometries, material, dispose: () => {
    geometries.forEach(geometry => geometry.dispose());
    material.dispose(); atlas.dispose(); bump.dispose();
  } };
}
