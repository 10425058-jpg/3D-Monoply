import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';

export function IslandPlaque({ title, detail, accent, size, position, tone = 'balance' }: {
  title: string; detail?: string; accent?: string; size: [number, number]; position?: [number, number, number];
  tone?: 'balance' | 'gain' | 'loss';
}) {
  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = 'Royal island plaque';
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, toneMapped: false, depthWrite: false });
    return { canvas, texture, material };
  }, []);
  useLayoutEffect(() => {
    const ctx = canvas.getContext('2d')!;
    const bevel = (inset: number) => {
      ctx.beginPath();
      ctx.moveTo(49 + inset, 17 + inset); ctx.lineTo(463 - inset, 17 + inset);
      ctx.lineTo(504 - inset, 96); ctx.lineTo(463 - inset, 175 - inset);
      ctx.lineTo(49 + inset, 175 - inset); ctx.lineTo(8 + inset, 96); ctx.closePath();
    };
    ctx.clearRect(0, 0, 512, 192);
    const frame = ctx.createLinearGradient(0, 16, 0, 176);
    frame.addColorStop(0, tone === 'loss' ? '#ffc6a5' : '#fff0a3');
    frame.addColorStop(.46, tone === 'loss' ? '#cf8469' : '#d79b43');
    frame.addColorStop(1, tone === 'loss' ? '#98524f' : '#9a5c23');
    bevel(0); ctx.fillStyle = frame; ctx.fill();
    bevel(8); ctx.fillStyle = tone === 'loss' ? '#492335' : '#121d3f'; ctx.fill();
    bevel(14); ctx.strokeStyle = tone === 'loss' ? '#85505d' : '#5e6289'; ctx.lineWidth = 2; ctx.stroke();

    for (const x of [48, 464]) {
      ctx.beginPath(); ctx.moveTo(x, 82); ctx.lineTo(x + 10, 96);
      ctx.lineTo(x, 110); ctx.lineTo(x - 10, 96); ctx.closePath();
      ctx.fillStyle = accent ?? (tone === 'loss' ? '#ffad99' : '#ffe39b'); ctx.fill();
      ctx.strokeStyle = '#fff0bb'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (detail) {
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillStyle = '#d4def8';
      const characters = Array.from(detail);
      if (ctx.measureText(detail).width > 354) {
        while (characters.length && ctx.measureText(characters.join('') + '…').width > 354) characters.pop();
      }
      ctx.fillText(characters.length < Array.from(detail).length ? characters.join('') + '…' : detail, 256, 62);
    }
    ctx.font = `bold ${detail ? 68 : 89}px Georgia, serif`;
    ctx.fillStyle = tone === 'loss' ? '#ffd6c4' : '#fff4c7';
    ctx.fillText(title, 256, detail ? 122 : 100, 363);
    texture.needsUpdate = true;
  }, [accent, canvas, detail, texture, title, tone]);
  useEffect(() => () => { material.dispose(); texture.dispose(); }, [material, texture]);
  return <sprite position={position} scale={[...size, 1]} material={material} raycast={() => {}} />;
}
