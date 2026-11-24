import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TreasuryBalance } from './useIslandTreasuryMotion';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const formatIslandMoney = (amount: number) => currency.format(amount);
type Tone = 'balance' | 'gain' | 'loss';

function plaqueArt(ctx: CanvasRenderingContext2D, detail: string | undefined, accent: string | undefined, tone: Tone) {
  const shape = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(54 + inset, 14 + inset); ctx.lineTo(458 - inset, 14 + inset);
    ctx.lineTo(505 - inset, 95); ctx.lineTo(458 - inset, 177 - inset);
    ctx.lineTo(54 + inset, 177 - inset); ctx.lineTo(7 + inset, 95); ctx.closePath();
  };
  ctx.clearRect(0, 0, 512, 192);
  const frame = ctx.createLinearGradient(0, 14, 16, 177);
  frame.addColorStop(0, tone === 'loss' ? '#ffc7a7' : '#fff1a9');
  frame.addColorStop(.32, tone === 'loss' ? '#ce856a' : '#d49338');
  frame.addColorStop(.55, tone === 'loss' ? '#854a4f' : '#945319');
  frame.addColorStop(.77, tone === 'loss' ? '#d69b80' : '#f6c269');
  frame.addColorStop(1, tone === 'loss' ? '#7d4552' : '#9b622c');
  shape(0); ctx.fillStyle = '#4c2c33'; ctx.fill();
  shape(3); ctx.fillStyle = frame; ctx.fill();

  const hue = new THREE.Color(accent ?? '#395793');
  const enamel = ctx.createLinearGradient(0, 22, 0, 167);
  enamel.addColorStop(0, tone === 'loss' ? '#5e3040' : hue.clone().lerp(new THREE.Color('#16192f'), .80).getStyle());
  enamel.addColorStop(.62, tone === 'loss' ? '#382031' : hue.clone().lerp(new THREE.Color('#101324'), .92).getStyle());
  enamel.addColorStop(1, tone === 'loss' ? '#542738' : hue.clone().lerp(new THREE.Color('#15182c'), .82).getStyle());
  shape(13); ctx.fillStyle = enamel; ctx.fill();
  shape(18); ctx.strokeStyle = tone === 'loss' ? '#aa6b64' : '#c7a66e'; ctx.lineWidth = 1.5; ctx.stroke();

  for (const x of [50, 462]) {
    ctx.beginPath(); ctx.moveTo(x, 76); ctx.lineTo(x + 13, 95); ctx.lineTo(x, 114); ctx.lineTo(x - 13, 95); ctx.closePath();
    ctx.fillStyle = '#f6d68d'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, 82); ctx.lineTo(x + 8, 95); ctx.lineTo(x, 108); ctx.lineTo(x - 8, 95); ctx.closePath();
    ctx.fillStyle = tone === 'loss' ? '#bd654e' : hue.getStyle(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, 82); ctx.lineTo(x - 8, 95); ctx.lineTo(x, 95); ctx.closePath();
    ctx.fillStyle = '#fff7cd9a'; ctx.fill();
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (detail) {
    for (const side of [-1, 1]) {
      const x = 256 + side * 155;
      ctx.fillStyle = '#dcbd7c';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(x + side * i * 8, 52 - i * 4, 6, 2.5, -side * .43, 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillStyle = '#faebcc';
    const characters = Array.from(detail);
    const length = characters.length;
    while (characters.length && ctx.measureText(characters.join('') + '…').width > 292) characters.pop();
    ctx.fillText(characters.length < length ? characters.join('') + '…' : detail, 256, 54, 296);
  }
}

function plaqueTitle(ctx: CanvasRenderingContext2D, title: string, named: boolean, tone: Tone) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `bold ${named ? 75 : 84}px Georgia, serif`;
  ctx.shadowColor = '#0009'; ctx.shadowOffsetY = 3;
  ctx.fillStyle = tone === 'loss' ? '#ffd4bd' : '#fff6d4';
  ctx.fillText(title, 256, named ? 119 : 98, 361);
  ctx.shadowOffsetY = 0;
}

export function IslandPlaque({ title, detail, accent, size, position, tone = 'balance', balance }: {
  title: string; detail?: string; accent?: string; size: [number, number]; position?: [number, number, number];
  tone?: Tone; balance?: TreasuryBalance;
}) {
  const sprite = useRef<THREE.Sprite>(null);
  const counter = useRef({ value: balance?.value, from: balance?.value, to: balance?.value, at: 0, drawnAt: 0 });
  const liveBalance = tone === 'balance';
  const { ctx, engraving, texture, material } = useMemo(() => {
    const resolution = liveBalance ? .75 : 1;
    const canvas = document.createElement('canvas');
    canvas.width = 512 * resolution; canvas.height = 192 * resolution;
    const stationary = document.createElement('canvas');
    stationary.width = canvas.width; stationary.height = canvas.height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = 'Royal island plaque';
    texture.colorSpace = THREE.SRGBColorSpace;
    if (liveBalance) { texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; }
    const material = new THREE.SpriteMaterial({ map: texture, toneMapped: false, depthWrite: false });
    const ctx = canvas.getContext('2d')!, engraving = stationary.getContext('2d')!;
    ctx.scale(resolution, resolution); engraving.scale(resolution, resolution);
    return { ctx, engraving, texture, material };
  }, [liveBalance]);

  const paint = (value?: number) => {
    ctx.clearRect(0, 0, 512, 192);
    ctx.drawImage(engraving.canvas, 0, 0, 512, 192);
    plaqueTitle(ctx, value === undefined ? title : formatIslandMoney(value), !!detail, tone);
    texture.needsUpdate = true;
    if (sprite.current) sprite.current.userData.displayedBalance = value;
  };
  useLayoutEffect(() => { plaqueArt(engraving, detail, accent, tone); }, [engraving, detail, accent, tone]);
  useLayoutEffect(() => {
    const motion = counter.current;
    if (!balance?.animate || motion.value === undefined) {
      motion.value = balance?.value; motion.from = balance?.value; motion.to = balance?.value;
    } else if (motion.to !== balance.value) {
      motion.from = motion.value; motion.to = balance.value; motion.at = performance.now();
    }
    paint(motion.value);
  }, [ctx, texture, title, detail, accent, tone, balance?.animate, balance?.value]);

  useFrame(() => {
    const motion = counter.current;
    if (motion.from === undefined || motion.to === undefined || motion.value === motion.to) return;
    const now = performance.now();
    if (now - motion.drawnAt < 1000 / 20) return;
    const t = Math.min(1, (now - motion.at) / 420);
    const tween = motion.from + (motion.to - motion.from) * (1 - (1 - t) ** 3);
    const value = t === 1 ? motion.to : Math.round(tween);
    if (value === motion.value) return;
    motion.value = value;
    motion.drawnAt = now;
    paint(value);
  });
  useEffect(() => () => { material.dispose(); texture.dispose(); }, [material, texture]);
  return <sprite ref={sprite} position={position} scale={[...size, 1]} material={material} raycast={() => {}} />;
}
