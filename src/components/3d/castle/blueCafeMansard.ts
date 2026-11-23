import * as THREE from 'three';

/**
 * The four fountain-side houses are already modeled and must not be rebuilt.
 * Only the red on the LEFT CAFÉ'S blue-roofed awning must become royal blue:
 * preserve its cream/white stripes, all roof shapes, all other houses and the
 * castle's burgundy stair carpet.
 *
 * Authored source: tools/blender/generate_central_city.py, houses() index 0,
 * placed at Blender X=-5.15,Y=-0.30. Its striped awning uses red and cream
 * surfaces around glTF X=-5.15,Y=1.50..1.74,Z=1.0..1.5.
 *
 * The GLB joins red triangles from several objects into a single mesh. Its
 * atlas is shared, so changing the red material would also change the stairs.
 * Remap UVs ONLY for red triangles of this café awning (and retain the existing
 * café roof color correction). The POSITION, NORMAL, INDEX, SHAPE and transforms
 * are never edited. White/cream triangles use a different material and stay white.
 */
export function recolorCafeRedToBlue(object: THREE.Mesh): THREE.BufferGeometry | null {
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
  const changedIndices = new Set<number>();
  const worldPoints: THREE.Vector3[] = [];

  // Evaluate actual transformed world vertices of each triangle. Recolor only
  // complete café surface triangles; the four houses share the same red atlas.
  for (let t = 0; t < triangleCount; t++) {
    const vertices = [0, 1, 2].map(c => index ? index.getX(t * 3 + c) : t * 3 + c);
    worldPoints.length = 0;
    for (const vertex of vertices) {
      worldPoints.push(point.fromBufferAttribute(position, vertex)
        .applyMatrix4(object.matrixWorld).clone());
    }
    const roof = worldPoints.every(p =>
      p.x > -6.45 && p.x < -3.9 && p.y > 2.4 && p.y < 3.65);
    const stripedAwning = worldPoints.every(p =>
      p.x > -6.15 && p.x < -4.1 &&
      p.y > 1.35 && p.y < 1.9 && p.z > 0.75 && p.z < 1.75);
    if (!roof && !stripedAwning) continue;

    // The red atlas swatch (column 2, row 2) is mapped to the existing blue
    // slate swatch (column 2, row 0). Works with either glTF V orientation.
    for (const vertex of vertices) {
      const u = uv.getX(vertex);
      const v = uv.getY(vertex);
      if (u <= 0.5 || u >= 0.75) continue;
      if ((v >= 0.25 && v < 0.5) || (v >= 0.5 && v < 0.75))
        changedIndices.add(vertex);
    }
  }
  if (!changedIndices.size) return null;

  // A separate, owned geometry keeps cached GLB attributes untouched.
  // Only texture UVs change: absolutely no roof/awning rebuilding.
  const recolored = geometry.clone();
  const mapped = recolored.getAttribute('uv');
  for (const vertex of changedIndices) {
    const v = uv.getY(vertex);
    const offset = v >= 0.25 && v < 0.5 ? 0.5 : -0.5;
    mapped.setY(vertex, v + offset);
  }
  mapped.needsUpdate = true;
  return recolored;
}
