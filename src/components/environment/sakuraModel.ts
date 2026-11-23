import * as THREE from 'three';
import { blossomMipmaps } from './sakuraAtlas';

type SakuraPart = 'bark' | 'sprays' | 'flowers';
type SprayCrop = { left: number; top: number; right: number; bottom: number };
const ATLAS_GRID = 4;

const models = new WeakMap<THREE.Group, ReturnType<typeof readModel>>();
const scenicGeometry = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const sprayGeometry = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const atlases = new WeakMap<THREE.Texture, ReturnType<typeof prepareAtlas>>();
const materials = new WeakMap<THREE.MeshStandardMaterial, Partial<Record<SakuraPart, THREE.MeshStandardMaterial>>>();

export function expandBlossomSprays(source: THREE.BufferGeometry, crops: readonly SprayCrop[]) {
  const positions = source.getAttribute('position');
  const uv = source.getAttribute('uv');
  const expanded = new Float32Array(positions.count * 3);
  const croppedUV = new Float32Array(uv.count * 2);
  const center = new THREE.Vector3(), point = new THREE.Vector3();
  const origin = new THREE.Vector3(), across = new THREE.Vector3(), up = new THREE.Vector3();
  // The four authored corners run from bottom left to top left. Map the
  // cropped UV rectangle back onto that plane before widening the spray.
  for (let first = 0; first < positions.count; first += 4) {
    origin.fromBufferAttribute(positions, first);
    across.fromBufferAttribute(positions, first + 1).sub(origin);
    up.fromBufferAttribute(positions, first + 3).sub(origin);
    center.copy(origin).addScaledVector(across, .5).addScaledVector(up, .5);
    const size = THREE.MathUtils.lerp(1.05, 1.14, THREE.MathUtils.smoothstep(center.y, 1.7, 3.4));
    const u0 = uv.getX(first), u1 = uv.getX(first + 1), v0 = uv.getY(first), v1 = uv.getY(first + 3);
    const column = Math.floor((u0 + u1) * ATLAS_GRID * .5);
    const row = Math.floor((v0 + v1) * ATLAS_GRID * .5);
    const crop = crops[row * ATLAS_GRID + column];
    const left = Math.max(crop.left, u0), right = Math.min(crop.right, u1);
    const top = Math.max(crop.top, v1), bottom = Math.min(crop.bottom, v0);
    for (let corner = 0; corner < 4; corner++) {
      const u = corner === 0 || corner === 3 ? left : right;
      const v = corner < 2 ? bottom : top;
      const i = first + corner;
      point.copy(origin).addScaledVector(across, (u - u0) / (u1 - u0)).addScaledVector(up, (v - v0) / (v1 - v0));
      point.sub(center).multiplyScalar(size).add(center).toArray(expanded, i * 3);
      croppedUV[i * 2] = u;
      croppedUV[i * 2 + 1] = v;
    }
  }
  const geometry = new THREE.BufferGeometry().setIndex(source.index);
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setAttribute('position', new THREE.BufferAttribute(expanded, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(croppedUV, 2));
  geometry.computeBoundingBox();
  return geometry;
}

function readModel(scene: THREE.Group) {
  scene.updateMatrixWorld(true);
  const mesh = (name: string) => {
    const object = scene.getObjectByName(name);
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) {
      throw new Error(`Missing Sakura mesh or material: ${name}`);
    }
    return { geometry: object.geometry, material: object.material, matrix: object.matrixWorld.clone() };
  };
  const bark = mesh('Bark_And_Branches');
  const sprays = mesh('Pink_Blossom_Sprays');
  const flowers = mesh(scene.getObjectByName('Five_Petal_Flowers') ? 'Five_Petal_Flowers' : 'Individual_Five_Petal_Flowers');
  bark.geometry.computeBoundingBox();
  const ground = bark.geometry.boundingBox!.min.y;
  const offset = new THREE.Matrix4().makeTranslation(0, -ground, 0);
  for (const part of [bark, sprays, flowers]) part.matrix.premultiply(offset);
  const bounds = new THREE.Box3().setFromObject(scene).translate(new THREE.Vector3(0, -ground, 0));
  return { bark, sprays, flowers, bounds };
}

function modelParts(scene: THREE.Group) {
  const existing = models.get(scene);
  if (existing) return existing;
  const model = readModel(scene);
  models.set(scene, model);
  return model;
}

function prepareAtlas(source: THREE.Texture) {
  const { width, height } = source.image as ImageBitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source.image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  const crops: SprayCrop[] = [];
  // The 4×4 spray atlas has black RGB under its transparent texels. Pad each
  // cell with its own blossom color so mip filtering keeps the fine edges pink.
  for (let cellY = 0; cellY < ATLAS_GRID; cellY++) {
    for (let cellX = 0; cellX < ATLAS_GRID; cellX++) {
      const left = cellX * width / ATLAS_GRID, right = left + width / ATLAS_GRID;
      const top = cellY * height / ATLAS_GRID, bottom = top + height / ATLAS_GRID;
      let red = 0, green = 0, blue = 0, coverage = 0;
      let minX = right, minY = bottom, maxX = left, maxY = top;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * width + x) * 4, alpha = data[i + 3];
          red += data[i] * alpha;
          green += data[i + 1] * alpha;
          blue += data[i + 2] * alpha;
          coverage += alpha;
          if (alpha > 8) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + 1);
            maxY = Math.max(maxY, y + 1);
          }
        }
      }
      // Preserve a transparent gutter for coarse mip sampling at the edge.
      const gutter = 12;
      crops.push(minX < maxX ? {
        left: Math.max(left, minX - gutter) / width,
        top: Math.max(top, minY - gutter) / height,
        right: Math.min(right, maxX + gutter) / width,
        bottom: Math.min(bottom, maxY + gutter) / height,
      } : { left: left / width, top: top / height, right: right / width, bottom: bottom / height });
      if (coverage === 0) continue;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] !== 0) continue;
          data[i] = red / coverage;
          data[i + 1] = green / coverage;
          data[i + 2] = blue / coverage;
        }
      }
    }
  }
  const pixels = new Uint8Array(data.buffer);
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat,
    THREE.UnsignedByteType, THREE.UVMapping, source.wrapS, source.wrapT, source.magFilter, source.minFilter,
    source.anisotropy, source.colorSpace);
  texture.name = 'Sakura blossom atlas';
  texture.flipY = source.flipY;
  texture.mipmaps = blossomMipmaps({ data: pixels, width, height });
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, crops };
}

function blossomAtlas(source: THREE.Texture) {
  const existing = atlases.get(source);
  if (existing) return existing;
  const atlas = prepareAtlas(source);
  atlases.set(source, atlas);
  return atlas;
}

function prepareMaterial(source: THREE.MeshStandardMaterial, part: SakuraPart) {
  const variants = materials.get(source) ?? {};
  const existing = variants[part];
  if (existing) return existing;
  const material = source.clone();
  if (part === 'sprays' && source.map) {
    material.map = blossomAtlas(source.map).texture;
    material.alphaTest = 0.18;
    material.color.multiply(new THREE.Color().setRGB(.98, .88, .93));
  } else {
    // The vertex-colored meshes inherit glTF's metallic default.
    material.metalness = 0;
    if (part === 'bark') {
      material.color.multiply(new THREE.Color().setRGB(.84, .67, .57));
      // A little warm fill keeps the shaded forks legible under the crown.
      material.emissive.setRGB(.012, .005, .003);
    }
  }
  variants[part] = material;
  materials.set(source, variants);
  return material;
}

function distantGeometry(source: THREE.BufferGeometry, renderGeometry: THREE.BufferGeometry, minExtent: number) {
  const existing = scenicGeometry.get(source);
  if (existing) return existing;
  const points = source.getAttribute('position');
  const indices = source.index!.array;
  const parents = Int32Array.from({ length: points.count }, (_, i) => i);
  const root = (vertex: number) => {
    while (parents[vertex] !== vertex) {
      parents[vertex] = parents[parents[vertex]];
      vertex = parents[vertex];
    }
    return vertex;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const parent = root(indices[i]);
    parents[root(indices[i + 1])] = parent;
    parents[root(indices[i + 2])] = parent;
  }
  const bounds = new Map<number, THREE.Box3>();
  const point = new THREE.Vector3();
  for (let i = 0; i < points.count; i++) {
    const parent = root(i);
    if (!bounds.has(parent)) bounds.set(parent, new THREE.Box3());
    bounds.get(parent)!.expandByPoint(point.fromBufferAttribute(points, i));
  }
  const keep = new Set<number>();
  for (const [parent, box] of bounds) {
    if (box.getSize(point).length() >= minExtent) keep.add(parent);
  }
  // Keep complete authored branches, sprays and petals. Only the index buffer
  // changes for the distant tier. Positions, colors and UVs stay shared.
  const index = Array.from(indices).filter(vertex => keep.has(root(vertex)));
  const geometry = new THREE.BufferGeometry().setIndex(index);
  for (const [name, attribute] of Object.entries(renderGeometry.attributes)) geometry.setAttribute(name, attribute);
  scenicGeometry.set(source, geometry);
  return geometry;
}

export function sakuraParts(liteScene: THREE.Group, scene: THREE.Group, distant: boolean) {
  const lite = modelParts(liteScene);
  const chosen = modelParts(scene);
  // Both files contain identical bark geometry and an identical blossom atlas.
  const { crops } = blossomAtlas(lite.sprays.material.map!);
  const originalSprays = chosen.sprays.geometry;
  let expanded = sprayGeometry.get(originalSprays);
  if (!expanded) {
    expanded = expandBlossomSprays(originalSprays, crops);
    sprayGeometry.set(originalSprays, expanded);
  }
  const bounds = chosen.bounds.clone().union(expanded.boundingBox!.clone().applyMatrix4(chosen.sprays.matrix));
  const parts = [
    { ...lite.bark, name: 'bark', source: lite.bark.geometry, minExtent: 1.4 },
    { ...chosen.sprays, name: 'sprays', geometry: expanded, source: originalSprays, material: lite.sprays.material, minExtent: 0.54 },
    { ...chosen.flowers, name: 'flowers', source: chosen.flowers.geometry, material: lite.flowers.material, minExtent: 0.11 },
  ] as const;
  return { parts: parts.map(part => ({
    ...part,
    material: prepareMaterial(part.material, part.name),
    // Select the same distant primitives from the source extents so widening
    // a spray cannot increase the number of triangles submitted by the LOD.
    geometry: distant ? distantGeometry(part.source, part.geometry, part.minExtent) : part.geometry,
  })), bounds: bounds.getBoundingSphere(new THREE.Sphere()) };
}
