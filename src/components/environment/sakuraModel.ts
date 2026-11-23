import * as THREE from 'three';

const models = new WeakMap<THREE.Group, ReturnType<typeof readModel>>();
const scenicGeometry = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const materials = new WeakMap<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();

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
  return { bark, sprays, flowers, bounds: bounds.getBoundingSphere(new THREE.Sphere()) };
}

function modelParts(scene: THREE.Group) {
  const existing = models.get(scene);
  if (existing) return existing;
  const model = readModel(scene);
  models.set(scene, model);
  return model;
}

function paddedAtlas(source: THREE.Texture) {
  const { width, height } = source.image as ImageBitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source.image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  // The 4×4 spray atlas has black RGB under its transparent texels. Pad each
  // cell with its own blossom color so mip filtering keeps the fine edges pink.
  for (let cellY = 0; cellY < 4; cellY++) {
    for (let cellX = 0; cellX < 4; cellX++) {
      const left = cellX * width / 4, right = left + width / 4;
      const top = cellY * height / 4, bottom = top + height / 4;
      let red = 0, green = 0, blue = 0, coverage = 0;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const i = (y * width + x) * 4, alpha = data[i + 3];
          red += data[i] * alpha;
          green += data[i + 1] * alpha;
          blue += data[i + 2] * alpha;
          coverage += alpha;
        }
      }
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
  const texture = new THREE.DataTexture(new Uint8Array(data.buffer), width, height, THREE.RGBAFormat,
    THREE.UnsignedByteType, THREE.UVMapping, source.wrapS, source.wrapT, source.magFilter, source.minFilter,
    source.anisotropy, source.colorSpace);
  texture.name = 'Sakura blossom atlas';
  texture.flipY = source.flipY;
  texture.generateMipmaps = source.generateMipmaps;
  texture.needsUpdate = true;
  return texture;
}

function prepareMaterial(source: THREE.MeshStandardMaterial) {
  const existing = materials.get(source);
  if (existing) return existing;
  const material = source.clone();
  if (source.map) {
    material.map = paddedAtlas(source.map);
    // Retain masked depth and two-sided sprays as their coverage shrinks.
    material.alphaTest = 0.18;
  } else {
    // The vertex-colored meshes inherit glTF's metallic default.
    material.metalness = 0;
  }
  materials.set(source, material);
  return material;
}

function distantGeometry(source: THREE.BufferGeometry, minExtent: number) {
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
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  scenicGeometry.set(source, geometry);
  return geometry;
}

export function sakuraParts(liteScene: THREE.Group, scene: THREE.Group, distant: boolean) {
  const lite = modelParts(liteScene);
  const chosen = modelParts(scene);
  // Both files contain identical bark geometry and an identical blossom atlas.
  const parts = [
    { ...lite.bark, name: 'bark', material: lite.bark.material, minExtent: 1.4 },
    { ...chosen.sprays, name: 'sprays', material: lite.sprays.material, minExtent: 0.54 },
    { ...chosen.flowers, name: 'flowers', material: lite.flowers.material, minExtent: 0.11 },
  ].map(part => ({
    ...part,
    material: prepareMaterial(part.material),
    geometry: distant ? distantGeometry(part.geometry, part.minExtent) : part.geometry,
  }));
  return { parts, bounds: chosen.bounds };
}
