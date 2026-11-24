import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COIN_VALUES, coinTier, type CoinValue } from './royalCoinValues';

const cell = 256, atlasWidth = cell * 4, atlasHeight = cell * 2;
const radialSegments = 28;
const palette = {
  copper: { rim: '#ffc78d', light: '#d98c52', mid: '#ae562a', dark: '#713221', ink: '#ffd29f' },
  silver: { rim: '#f2f2ff', light: '#bcc8df', mid: '#838fa8', dark: '#465169', ink: '#f4f3ff' },
  gold: { rim: '#fff0aa', light: '#ffc84f', mid: '#d08a26', dark: '#8c4911', ink: '#fff2bc' },
};

const atlasCell = (index: number) => [(index % 4) * cell, Math.floor(index / 4) * cell];

function drawCoinFace(ctx: CanvasRenderingContext2D, value: CoinValue) {
  const paint = palette[coinTier(value)];
  ctx.fillStyle = paint.mid;
  ctx.fillRect(0, 0, cell, cell);
  // The diagonally lit face leaves a separate texel strip for the ridged edge.
  const face = ctx.createLinearGradient(71, 23, 178, 211);
  face.addColorStop(0, paint.light);
  face.addColorStop(.54, paint.mid);
  face.addColorStop(1, paint.dark);
  ctx.fillStyle = face;
  ctx.fillRect(0, 0, cell, 230);
  ctx.save();
  ctx.translate(128, 120);
  ctx.strokeStyle = paint.dark;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 2, 91, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = paint.rim;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 91, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = paint.ink;
  for (let i = 0; i < 54; i++) {
    const angle = i * Math.PI / 27;
    ctx.beginPath(); ctx.arc(83 * Math.cos(angle), 83 * Math.sin(angle), 1.65, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowColor = paint.dark;
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(-24, -57); ctx.lineTo(-11, -51); ctx.lineTo(0, -66);
  ctx.lineTo(11, -51); ctx.lineTo(24, -57); ctx.lineTo(17, -39); ctx.lineTo(-17, -39); ctx.closePath(); ctx.fill();
  ctx.fillRect(-16, -35, 32, 3);
  for (const [x, y] of [[-24, -59], [0, -68], [24, -59]]) {
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${value >= 1000 ? 45 : value >= 100 ? 53 : 63}px Georgia, serif`;
  ctx.fillText(`$${value.toLocaleString('en-US')}`, 0, 3, 148);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath(); ctx.moveTo(22, 65); ctx.quadraticCurveTo(57, 64, 73, 21);
    ctx.strokeStyle = paint.ink; ctx.lineWidth = 2.3; ctx.stroke();
    for (let leaf = 0; leaf < 5; leaf++) {
      const x = 34 + 8.3 * leaf, y = 63 - 1.7 * leaf * leaf;
      ctx.beginPath(); ctx.ellipse(x, y, 10, 3.4, -.43 - leaf * .21, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - 3, y - 6, 7.4, 2.8, .79, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(0, 48); ctx.lineTo(10, 59); ctx.lineTo(0, 73); ctx.lineTo(-10, 59); ctx.closePath();
  ctx.fillStyle = value >= 20 ? '#1c429c' : paint.light; ctx.fill();
  ctx.strokeStyle = paint.ink; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  const edge = ctx.createLinearGradient(0, 232, 0, 255);
  edge.addColorStop(0, paint.rim);
  edge.addColorStop(.22, paint.light);
  edge.addColorStop(.56, paint.mid);
  edge.addColorStop(.83, paint.dark);
  edge.addColorStop(1, paint.light);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 230, cell, 26);
  for (let slot = 0; slot < radialSegments; slot++) {
    const x = 4 + slot * (cell - 8) / radialSegments;
    ctx.globalAlpha = .75;
    ctx.fillStyle = paint.dark; ctx.fillRect(x, 237, 2.5, 14);
    ctx.globalAlpha = .55;
    ctx.fillStyle = paint.rim; ctx.fillRect(x + 2.5, 237, 1.3, 14);
  }
  ctx.globalAlpha = 1;
}

function coinGeometry(index: number) {
  const [x, y] = atlasCell(index);
  const rim = [[.9, -.113, 233], [.968, -.105, 236], [1, -.075, 239],
    [1, .075, 249], [.968, .105, 252], [.9, .113, 254]];
  const positions: number[] = [], uvs: number[] = [], faces: number[] = [];
  rim.forEach(([radius, height, row], band) => {
    for (let step = 0; step <= radialSegments; step++) {
      const theta = step * Math.PI * 2 / radialSegments;
      positions.push(radius * Math.cos(theta), height, radius * Math.sin(theta));
      uvs.push((x + 4 + step * (cell - 8) / radialSegments) / atlasWidth, 1 - (y + row) / atlasHeight);
      if (band === rim.length - 1 || step === radialSegments) continue;
      const a = band * (radialSegments + 1) + step, b = a + radialSegments + 1;
      faces.push(a, b, a + 1, a + 1, b, b + 1);
    }
  });
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  body.setIndex(faces);
  body.computeVertexNormals();
  const face = new THREE.CircleGeometry(.901, radialSegments);
  const uv = face.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i,
    (x + 128 + (uv.getX(i) - .5) * 193) / atlasWidth,
    1 - (y + 120 - (uv.getY(i) - .5) * 193) / atlasHeight);
  const upper = face.clone().rotateX(-Math.PI / 2).translate(0, .113, 0);
  face.rotateX(Math.PI / 2).translate(0, -.113, 0);
  const result = mergeGeometries([body, upper, face]);
  [body, upper, face].forEach(geometry => geometry.dispose());
  return result;
}

export function makeRoyalCoins() {
  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d')!;
  const geometries = new Map<CoinValue, THREE.BufferGeometry>();
  COIN_VALUES.forEach((value, index) => {
    const [x, y] = atlasCell(index);
    ctx.save(); ctx.translate(x, y); drawCoinFace(ctx, value); ctx.restore();
    geometries.set(value, coinGeometry(index));
  });
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.name = 'Royal currency | eight denominations';
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ map: atlas, metalness: .47, roughness: .33 });
  return { geometries, material, dispose: () => {
    geometries.forEach(geometry => geometry.dispose());
    material.dispose();
    atlas.dispose();
  } };
}

const stacks: { value: CoinValue; count: number; x: number; z: number }[] = [
  { value: 500, count: 5, x: -1.74, z: 1.06 }, { value: 1000, count: 4, x: 1.75, z: 1.01 },
  { value: 50, count: 3, x: 1.33, z: 1.48 }, { value: 100, count: 2, x: -1.32, z: 1.53 },
  { value: 10, count: 2, x: 1.93, z: 1.43 }, { value: 20, count: 1, x: -1.72, z: 1.66 },
  { value: 5, count: 1, x: 1.49, z: 1.84 }, { value: 1, count: 1, x: -.98, z: 1.91 },
];

export function makeDisplayedCoins(geometries: Map<CoinValue, THREE.BufferGeometry>) {
  const props: THREE.BufferGeometry[] = [];
  stacks.forEach(({ value, x, z, count }) => {
    const radius = value < 20 ? .19 : value < 500 ? .223 : .277;
    const geometry = geometries.get(value)!;
    for (let i = 0; i < count; i++) {
      props.push(geometry.clone().scale(radius, radius, radius).rotateY(.53 * i)
        .translate(x + .018 * Math.sin(i * 2), .048 + (.234 * i) * radius, z + .016 * Math.cos(i * 3)));
    }
    if (value === 500 || value === 1000) {
      props.push(geometry.clone().scale(radius, radius, radius).rotateX(.92).rotateZ(x * .19)
        .translate(x + Math.sign(x) * .24, .245, z + .28));
    }
  });
  const batch = mergeGeometries(props);
  props.forEach(geometry => geometry.dispose());
  return batch;
}
