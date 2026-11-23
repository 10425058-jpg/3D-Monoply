type AtlasLevel = { data: Uint8Array; width: number; height: number };

function downsample({ data, width, height }: AtlasLevel): AtlasLevel {
  const nextWidth = Math.max(1, width >> 1);
  const nextHeight = Math.max(1, height >> 1);
  const result = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y++) {
    const top = y * 2 * width;
    const bottom = Math.min(y * 2 + 1, height - 1) * width;
    for (let x = 0; x < nextWidth; x++) {
      const left = x * 2;
      const right = Math.min(left + 1, width - 1);
      const a = (top + left) * 4, b = (top + right) * 4;
      const c = (bottom + left) * 4, d = (bottom + right) * 4;
      const aa = data[a + 3], ab = data[b + 3], ac = data[c + 3], ad = data[d + 3];
      const alpha = aa + ab + ac + ad;
      const output = (y * nextWidth + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        // Normalize covered colors before filtering through the cutout. Empty
        // texels retain the RGB padding without diluting the petals' color.
        result[output + channel] = Math.round(alpha > 0
          ? (data[a + channel] * aa + data[b + channel] * ab + data[c + channel] * ac + data[d + channel] * ad) / alpha
          : (data[a + channel] + data[b + channel] + data[c + channel] + data[d + channel]) / 4);
      }
      result[output + 3] = Math.round(alpha / 4);
    }
  }
  return { data: result, width: nextWidth, height: nextHeight };
}

export function blossomMipmaps(atlas: AtlasLevel): AtlasLevel[] {
  const levels = [atlas];
  let raw = atlas;
  for (let level = 1; raw.width > 1 || raw.height > 1; level++) {
    raw = downsample(raw);
    // Small sprays lose coverage at the alpha cutoff. Recover it gradually
    // across mip levels and keep each resample independent of earlier gains.
    const gain = 1 + Math.min(.24, Math.max(0, (level - 2) * .07));
    const data = gain === 1 ? raw.data : raw.data.slice();
    if (gain > 1) {
      for (let i = 3; i < data.length; i += 4) data[i] = Math.min(255, Math.round(data[i] * gain));
    }
    levels.push({ ...raw, data });
  }
  return levels;
}
