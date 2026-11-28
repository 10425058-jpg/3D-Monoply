import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { DISTANT_ISLETS } from './atmosphereLayout';
import { DistantTerrainMaterial } from './DistantTerrainMaterial';
import { variation } from './environmentLayout';

function createIslets() {
  const positions: number[] = [], colors: number[] = [], opacity: number[] = [], indices: number[] = [];
  const sides = 11;
  const strata = [
    { radius: .76, height: .17, color: '#8ca19c', alpha: .88 },
    { radius: 1, height: 0, color: '#818da7', alpha: .88 },
    { radius: .78, height: -.35, color: '#62688e', alpha: .71 },
    { radius: .33, height: -.83, color: '#77739e', alpha: .30 },
  ];
  const cap = new Color('#a1aaa8');
  const tint = new Color();
  DISTANT_ISLETS.forEach(({ position: [x, y, z], size }, i) => {
    const base = positions.length / 3;
    const seed = 571 + i * 11;
    const rotation = variation(i, 79) * Math.PI * 2;
    const stretch = .60 + variation(i, 81) * .33;
    strata.forEach(({ radius, height, color, alpha }, ring) => {
      for (let side = 0; side < sides; side++) {
        const angle = rotation + side / sides * Math.PI * 2;
        const rim = .75 + variation(side, seed) * .36 + variation(side, seed + ring) * .13;
        positions.push(x + (Math.cos(angle) * radius * rim + height * .24) * size,
          y + (height + (variation(side, seed + 1) - .5) * .17) * size,
          z + (Math.sin(angle) * radius * rim * stretch - height * .20) * size);
        tint.set(color).multiplyScalar(.86 + variation(side, seed + 2) * .29);
        colors.push(tint.r, tint.g, tint.b);
        opacity.push(alpha);

        const a = base + ring * sides + side;
        const b = base + ring * sides + (side + 1) % sides;
        if (ring < strata.length - 1) indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    });
    const top = positions.length / 3;
    positions.push(x - size * .16, y + size * (.27 + variation(i, 207) * .21), z + size * .11);
    colors.push(cap.r, cap.g, cap.b);
    opacity.push(.87);
    const tip = positions.length / 3;
    positions.push(x - size * .29, y - size * 1.07, z + size * .18);
    tint.set('#8f85b3');
    colors.push(tint.r, tint.g, tint.b);
    opacity.push(.06);
    const bottom = base + (strata.length - 1) * sides;
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      indices.push(top, base + next, base + side, bottom + side, bottom + next, tip);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('terrainOpacity', new Float32BufferAttribute(opacity, 1));
  geometry.setIndex(indices);
  return geometry;
}

export function DistantIslets() {
  const geometry = useMemo(createIslets, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} name="distant-islets" renderOrder={-1} raycast={() => {}}>
    <DistantTerrainMaterial />
  </mesh>;
}
