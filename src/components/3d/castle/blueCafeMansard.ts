import * as THREE from 'three';

/**
 * The authored, shipped central-city GLBs combine all red details into a shared
 * material: the left café mansard, entrance stair runner and café awning.
 * Recolor ONLY the café roof triangles; never recolor the entire red batch.
 *
 * Authoring source: tools/blender/generate_central_city.py houses(), index 0
 *   café at Blender (-5.15, -0.30), glTF Y-up centre X≈-5.15.
 *   original roof Z-up height 2.18–3.08 (world Y≈2.54–3.46).
 *
 * The shared atlas is 4x4: burgundy swatch 10 (column 2, row 2)
 * -> blue slate swatch 2 (column 2, row 0). Depending on glTF UV
 * convention, this is a shift of +0.5 or -0.5 in texture V.
 */
export function blueCafeMansard(object: THREE.Mesh): THREE.BufferGeometry | null {
  const material = object.material;
  if (Array.isArray(material) || !/^Royal district red(?:\.\d{3})?$/.test(material.name)) return null;

  const geometry = object.geometry;
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  if (!position || !uv) return null;

  const index = geometry.getIndex();
  const triangleCount = (index?.count ?? position.count) / 3;
  if (!Number.isInteger(triangleCount)) return null;

  const point = new THREE.Vector3();
  const roofIndices = new Set<number>();
  const inCafeRoof = (vertex: number) => {
    point.fromBufferAttribute(position, vertex).applyMatrix4(object.matrixWorld);
    // Covers the single café mansard with a little margin for rotated eaves.
    // All other houses, low awnings and the castle's red stairs are excluded.
    return point.x > -6.45 && point.x < -3.9 &&
      point.y > 2.4 && point.y < 3.65;
  };

  // Classify complete triangles rather than individual corners, preventing
  // burgundy slivers on the mansard's roof edges and diagonals.
  for (let t = 0; t < triangleCount; t++) {
    const vertices = [0, 1, 2].map(c => index ? index.getX(t * 3 + c) : t * 3 + c);
    if (vertices.every(inCafeRoof)) vertices.forEach(vertex => roofIndices.add(vertex));
  }
  if (!roofIndices.size) return null;

  let changed = 0;
  const output = geometry.clone();
  const mapped = output.getAttribute('uv');
  for (const vertex of roofIndices) {
    const u = uv.getX(vertex);
    const v = uv.getY(vertex);
    if (u <= 0.5 || u >= 0.75) continue;
    // Some exporters flip atlas V when saving the shared texture.
    const offset = v >= 0.25 && v < 0.5 ? 0.5 :
      v >= 0.5 && v < 0.75 ? -0.5 : null;
    if (offset === null) continue;
    mapped.setY(vertex, v + offset);
    changed++;
  }
  if (!changed) {
    output.dispose();
    return null;
  }
  mapped.needsUpdate = true;
  return output;
}
