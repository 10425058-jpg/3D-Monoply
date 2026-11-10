import * as THREE from 'three';

/** Tiny deterministic walnut grain. No network texture or gameplay RNG. */
export function createWalnutGrain() {
  const width = 128, height = 32;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const wave = Math.sin(y * 2.4 + Math.sin(x * .09) * .65) * .035
      + Math.sin(y * 7.2 + x * .025) * .018;
    const i = (y * width + x) * 4;
    data[i] = 123 + wave * 255; data[i + 1] = 78 + wave * 190; data[i + 2] = 48 + wave * 120; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = 'Walnut grain 128x32'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1); texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
