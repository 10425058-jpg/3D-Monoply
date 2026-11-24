import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ISLAND_BOARD_DOCK, ISLAND_BOARD_DOCK_Y, ISLAND_DISTANCE, ISLAND_DOCK, ISLAND_DOCK_Y,
  ISLAND_BASE_RADIUS, ISLAND_SURFACE_Y, STATUE_PLINTH_TOP,
} from './playerIslandLayout';

type Point = [number, number, number];
type Surface = 'painted' | 'metal' | 'light';
const gold = '#e9b456';
const trim = '#ffcf75';
const blue = '#173c9b';
const ivory = '#ead2a5';
const goldTorus = (radius: number, tube: number, rings = 30) => new THREE.TorusGeometry(radius, tube, 7, rings);
const disc = (top: number, bottom: number, height: number, sides = 40) => new THREE.CylinderGeometry(top, bottom, height, sides);
const bead = (radius: number) => new THREE.SphereGeometry(radius, 9, 6);

/** Collect each finish into one world-static draw while keeping the island independently cullable. */
function islandBatch() {
  const parts: Record<Surface, THREE.BufferGeometry[]> = { painted: [], metal: [], light: [] };
  const add = (surface: Surface, source: THREE.BufferGeometry, color?: string, at: Point = [0, 0, 0],
    scale: Point = [1, 1, 1], rotate: Point = [0, 0, 0]) => {
    const mesh = source.index ? source.toNonIndexed() : source;
    if (mesh !== source) source.dispose();
    mesh.deleteAttribute('uv');
    mesh.scale(...scale).rotateX(rotate[0]).rotateY(rotate[1]).rotateZ(rotate[2]).translate(...at);
    if (color) {
      const tint = new THREE.Color(color);
      const colors = new Float32Array(mesh.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
      mesh.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    parts[surface].push(mesh);
  };
  const finish = (surface: Surface) => {
    const geometry = mergeGeometries(parts[surface]);
    parts[surface].forEach(mesh => mesh.dispose());
    return geometry;
  };
  return { add, finish };
}

function shoreProfile(grass: boolean, phase: number) {
  const sectors = grass ? 44 : 22;
  const shell = grass ? [
    [0, .013, '#719c36'], [.55, .013, '#79a63d'], [.88, .002, '#6a982f'],
    [.98, -.063, '#618e2b'], [1, -.16, '#527922'], [.96, -.28, '#45691d'], [.89, -.35, '#345522'],
  ] : [
    [.93, -.24, '#756879'], [.91, -.49, '#766a7a'], [.83, -.98, '#615770'],
    [.61, -1.66, '#50485f'], [.34, -2.23, '#483e58'], [.06, -2.51, '#3c354d'], [0, -2.54, '#3c354d'],
  ];
  const positions: number[] = [], colors: number[] = [], faces: number[] = [];
  const tint = new THREE.Color();
  shell.forEach(([radius, height, color], ring) => {
    for (let i = 0; i < sectors; i++) {
      const theta = i * Math.PI * 2 / sectors;
      const scallop = .025 * Math.sin(5 * theta) + .023 * Math.cos(9 * theta);
      const face = Math.sin((grass ? 4 : 7) * theta);
      const r = ISLAND_BASE_RADIUS * Number(radius) * (1 + scallop + (grass ? 0 : .045 * face));
      const erosion = grass ? Math.max(0, ring - 3) * (.024 + .028 * Math.sin(8 * theta)) :
        (.04 * face + .06 * Math.sin(3 * theta + ring)) * Math.sin(Math.PI * ring / (shell.length - 1));
      positions.push(r * Math.cos(theta), Number(height) - erosion, r * Math.sin(theta));
      tint.set(String(color)).multiplyScalar(1 + .12 * Math.sin(3 * theta + phase) + .09 * Math.cos(11 * theta));
      colors.push(tint.r, tint.g, tint.b);
      if (ring === shell.length - 1) continue;
      const a = ring * sectors + i, b = ring * sectors + (i + 1) % sectors;
      faces.push(a, b, a + sectors, b, b + sectors, a + sectors);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  if (grass) { geometry.computeVertexNormals(); return geometry; }
  const facets = geometry.toNonIndexed();
  geometry.dispose();
  facets.computeVertexNormals();
  return facets;
}

export function makePlayerIsland(seat: number) {
  const { add, finish } = islandBatch();
  add('painted', shoreProfile(false, seat * 1.27));
  add('painted', shoreProfile(true, seat * 1.27));
  // Broad slate faces project from under the grass and taper into the floating bedrock.
  const slate = ['#766e85', '#685f76', '#746572', '#5e596e'];
  for (let i = 0; i < 11; i++) {
    const theta = i * Math.PI * 2 / 11;
    const width = .41 + .12 * Math.sin(i * 3.7);
    const length = .71 + .19 * Math.cos(i * 3.1);
    const ledge = new THREE.DodecahedronGeometry(1, 0);
    add('painted', ledge.rotateZ(.13 * Math.sin(i * 2)), slate[i % slate.length],
      [2.34 * Math.cos(theta), -.61 - .12 * Math.sin(i * 2), 2.34 * Math.sin(theta)], [width, length, .42], [0, -theta, 0]);
  }

  // Stone plinth with a recessed enamel frieze and inset gilt bands.
  add('painted', disc(1.54, 1.61, .12), '#a08c75', [0, .048, 0]);
  add('metal', disc(1.49, 1.56, .075), gold, [0, .123, 0]);
  add('painted', disc(1.47, 1.47, .20), blue, [0, .23, 0]);
  add('metal', disc(1.49, 1.49, .065), gold, [0, .314, 0]);
  add('painted', disc(1.37, 1.49, .11), ivory, [0, STATUE_PLINTH_TOP - .055, 0]);
  add('metal', goldTorus(1.27, .016), trim, [0, STATUE_PLINTH_TOP + .004, 0], undefined, [Math.PI / 2, 0, 0]);
  for (let step = 0; step < 16; step++) {
    const theta = step * Math.PI / 8;
    add('metal', new THREE.OctahedronGeometry(.082), step % 2 ? trim : gold,
      [1.467 * Math.cos(theta), .23, 1.467 * Math.sin(theta)], [.98, .82, .98]);
  }

  for (const x of [-1.86, 1.86]) {
    // Paired royal standards with cut swallowtails and crown relief.
    const z = -.99;
    add('painted', disc(.17, .224, .15, 16), ivory, [x, .076, z]);
    add('metal', disc(.041, .056, 1.63, 10), gold, [x, .935, z]);
    add('metal', bead(.087), trim, [x, 1.79, z]);
    add('metal', disc(.033, .033, .69, 10), gold, [x, 1.53, z], undefined, [0, 0, Math.PI / 2]);
    for (const tip of [-.35, .35]) add('metal', bead(.052), trim, [x + tip, 1.53, z]);
    const banner = new THREE.Shape().moveTo(-.28, 1.5).lineTo(-.28, .76).lineTo(0, .93)
      .lineTo(.28, .76).lineTo(.28, 1.5).closePath();
    add('metal', new THREE.ShapeGeometry(banner), gold, [x, 0, z]);
    const crown = new THREE.Shape().moveTo(-.14, 1.28).lineTo(-.07, 1.24).lineTo(0, 1.35)
      .lineTo(.07, 1.24).lineTo(.14, 1.28).lineTo(.104, 1.12).lineTo(-.104, 1.12).closePath();
    for (const side of [-1, 1]) {
      add('painted', new THREE.ShapeGeometry(banner), blue, [x, .081, z + side * .013], [.87, .93, 1]);
      add('metal', new THREE.ShapeGeometry(crown), trim, [x, 0, z + side * .022]);
    }
  }

  for (const x of [-.78, .78]) add('metal', disc(.056, .09, .46, 10), gold, [x, .23, 1.99]);

  for (const x of [-2.16, 2.16]) {
    const z = .45;
    add('painted', disc(.16, .20, .10, 12), ivory, [x, .05, z]);
    add('metal', disc(.056, .088, .39, 12), gold, [x, .26, z]);
    add('metal', disc(.17, .11, .083, 6), gold, [x, .465, z]);
    add('light', disc(.16, .119, .24, 6), '#ffe09c', [x, .62, z]);
    add('metal', disc(.057, .204, .135, 6), gold, [x, .805, z]);
    add('metal', bead(.056), trim, [x, .899, z]);
    for (let step = 0; step < 6; step++) {
      const theta = Math.PI / 6 + step * Math.PI / 3;
      add('metal', disc(.019, .018, .246, 5), gold, [x + .128 * Math.cos(theta), .623, z + .128 * Math.sin(theta)]);
    }
  }

  const shrubby = ['#659431', '#4d7928', '#7aa443', '#858f43'];
  const petals = ['#e4a8b6', '#f5c8c7', '#ebc4cd'];
  for (const [index, [x, z, size]] of [[-1.16, -2.06, .34], [1.25, -2.02, .29], [-2.2, -.34, .19],
    [2.12, -.37, .23], [-1.72, 1.55, .16], [1.63, 1.69, .16], [.18, -2.25, .24]].entries()) {
    for (let leaf = 0; leaf < 3; leaf++) {
      const spread = leaf - 1;
      add('painted', bead(size), shrubby[(seat + leaf + index) % shrubby.length],
        [x + .17 * spread, size * .53, z + .07 * Math.cos(leaf * 2)], [1, .84 + .13 * leaf, .82]);
      if (index % 3 === 0) add('painted', bead(size * .23), petals[leaf],
        [x + .15 * spread, size * (1.02 + .15 * leaf), z + .11], [1, .8, 1]);
    }
  }
  return { painted: finish('painted'), metal: finish('metal'), light: finish('light') };
}

/** In local chain coordinates the outward direction is +Z. The outer and inner mounts stay fixed. */
export function makeIslandChain() {
  const { add, finish } = islandBatch();
  const boardZ = ISLAND_BOARD_DOCK - ISLAND_DISTANCE;
  const boardY = ISLAND_BOARD_DOCK_Y - ISLAND_SURFACE_Y;
  const islandZ = -ISLAND_DOCK, islandY = ISLAND_DOCK_Y;
  for (const [z, y, outward] of [[boardZ, boardY, 1], [islandZ, islandY, -1]]) {
    const flange = new THREE.CylinderGeometry(.31, .34, .13, 8);
    add('metal', flange, gold, [0, y, z], undefined, [Math.PI / 2, 0, 0]);
    add('metal', goldTorus(.208, .055, 20), trim, [0, y, z + outward * .1]);
    for (const x of [-.22, .22]) add('metal', bead(.042), trim, [x, y + .05, z + outward * .075]);
  }

  const start = new THREE.Vector3(0, boardY, boardZ + .12);
  const end = new THREE.Vector3(0, islandY, islandZ - .12);
  const forward = new THREE.Vector3(0, 0, 1);
  const point = new THREE.Vector3(), tangent = new THREE.Vector3(), rotation = new THREE.Euler();
  for (let i = 0; i < 5; i++) {
    const t = (i + .5) / 5;
    point.copy(start).lerp(end, t);
    point.y -= .27 * 4 * t * (1 - t);
    tangent.copy(end).sub(start);
    tangent.y -= 1.08 * (1 - 2 * t);
    const frame = new THREE.Quaternion().setFromUnitVectors(forward, tangent.normalize());
    const twist = new THREE.Quaternion().setFromAxisAngle(forward, i % 2 ? .96 : -.43);
    rotation.setFromQuaternion(frame.multiply(twist).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), 'XYZ');
    // The geometry starts in XY and is stretched along Y, which becomes the link's tangent.
    add('metal', goldTorus(.132, .052, 20), i % 2 ? gold : trim, point.toArray(),
      [1, 1.68, 1], [rotation.x, rotation.y, rotation.z]);
  }
  return finish('metal');
}
