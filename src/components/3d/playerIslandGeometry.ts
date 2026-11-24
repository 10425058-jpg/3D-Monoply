import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import {
  ISLAND_BASE_RADIUS, ISLAND_BOARD_DOCK, ISLAND_BOARD_DOCK_Y, ISLAND_DISTANCE, ISLAND_DOCK, ISLAND_DOCK_Y,
  ISLAND_SURFACE_Y, STATUE_PLINTH_TOP,
} from './playerIslandLayout';

type Point = [number, number, number];
type Surface = 'painted' | 'metal' | 'light' | 'accent';
const gold = '#dba14a';
const gild = '#efba62';
const trim = '#ffe09b';
const ivory = '#ead5ae';
const disc = (top: number, bottom: number, height: number, sides = 32) => new THREE.CylinderGeometry(top, bottom, height, sides);
const torus = (radius: number, tube: number, sides = 24) => new THREE.TorusGeometry(radius, tube, 7, sides);
const bead = (radius: number) => new THREE.SphereGeometry(radius, 8, 5);
const profile = (points: [number, number][], segments = 40) => new THREE.LatheGeometry(points.map(point => new THREE.Vector2(...point)), segments);

/** Shared finishes keep the monument, landscaping, and decoration in four draws per island. */
function islandBatch() {
  const parts: Record<Surface, THREE.BufferGeometry[]> = { painted: [], metal: [], light: [], accent: [] };
  const add = (surface: Surface, source: THREE.BufferGeometry, color?: string, at: Point = [0, 0, 0],
    scale: Point = [1, 1, 1], rotate: Point = [0, 0, 0]) => {
    const mesh = source;
    // Preserve shared vertices on mouldings, toruses and cylinders when batching their finishes.
    if (!mesh.index) mesh.setIndex(Array.from({ length: mesh.getAttribute('position').count }, (_, index) => index));
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

function terrain(seat: number, grass: boolean) {
  const sectors = grass ? 44 : 26;
  const rings: [number, number, string][] = grass ? [
    [0, .013, '#719c36'], [.55, .013, '#79a63d'], [.88, .002, '#6a982f'],
    [.98, -.063, '#618e2b'], [1, -.16, '#527922'], [.96, -.28, '#45691d'], [.89, -.35, '#345522'],
  ] : [
    [.918, -.22, '#665968'], [.94, -.49, '#81758e'], [.874, -.98, '#746b84'],
    [.825, -1.28, '#6c637c'], [.713, -1.94, '#66627b'], [.572, -2.45, '#5a546f'],
    [.367, -3.05, '#53506a'], [.18, -3.61, '#4c4660'], [.035, -3.80, '#464059'], [0, -3.83, '#464059'],
  ];
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const tint = new THREE.Color();
  const phase = seat * 1.27;
  rings.forEach(([radius, height, material], ring) => {
    for (let i = 0; i < sectors; i++) {
      const theta = i * Math.PI * 2 / sectors;
      const scallop = .025 * Math.sin(5 * theta) + .023 * Math.cos(9 * theta);
      const joint = .049 * Math.sin(9 * theta + phase) + .038 * Math.cos(4 * theta - phase);
      const skirt = Math.min(.956 * ISLAND_BASE_RADIUS, ISLAND_BASE_RADIUS * radius * (1 + scallop + joint));
      const r = grass ? ISLAND_BASE_RADIUS * radius * (1 + scallop) : skirt;
      const yVariation = grass ? Math.max(0, ring - 3) * (.024 + .028 * Math.sin(8 * theta)) :
        Math.sin(Math.PI * ring / (rings.length - 1)) * (.16 * Math.sin(theta * 5 + phase) + .13 * Math.cos(theta * 3 + ring));
      const offset = grass ? 0 : .41 * (ring / (rings.length - 1)) ** 1.2;
      const skew = grass ? 0 : .030 * ring * Math.cos(theta * 3 + phase);
      positions.push(r * Math.cos(theta + skew) + offset * Math.cos(phase), height - yVariation,
        r * Math.sin(theta + skew) + offset * Math.sin(phase));
      tint.set(material).multiplyScalar(1 + .14 * Math.cos(3 * theta + phase) + .13 * Math.cos(11 * theta) + (grass ? 0 : .13 * Math.sin(i * 2.17 + ring * .38)));
      colors.push(tint.r, tint.g, tint.b);
      if (ring === rings.length - 1) continue;
      const a = ring * sectors + i, b = ring * sectors + (i + 1) % sectors;
      if (!grass && (i + ring) % 2) indices.push(a, b, b + sectors, a, b + sectors, a + sectors);
      else indices.push(a, b, a + sectors, b, b + sectors, a + sectors);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  if (grass) { geometry.computeVertexNormals(); return geometry; }
  const facets = geometry.toNonIndexed();
  geometry.dispose();
  facets.computeVertexNormals();
  return facets;
}

function cliffButtresses(add: ReturnType<typeof islandBatch>['add'], seat: number) {
  const slate = ['#80748d', '#71677f', '#88808e', '#756277', '#675e7b'];
  for (let index = 0; index < 11; index++) {
    const direction = index * Math.PI * 2 / 11 + seat * .43;
    const length = .84 + .23 * Math.sin(index * 2.31 + seat);
    const width = .19 + .047 * Math.cos(index * 2.43);
    const point = (span: number, y: number, r: number) => new THREE.Vector3(
      ISLAND_BASE_RADIUS * r * Math.cos(direction + span * width), y,
      ISLAND_BASE_RADIUS * r * Math.sin(direction + span * width));
    // The inner points sink into the main cliff. Broad outer faces form staggered, tapering ledges.
    const stone = new ConvexGeometry([
      point(-.90, -.31, .85), point(.91, -.27, .81), point(-.79, -.60, .952), point(.70, -.44, .956),
      point(-.94, -.96 - length * .38, .917), point(.82, -.68 - length * .36, .938),
      point(-.61, -1.48 - length * .56, .74), point(.73, -1.29 - length * .7, .78),
      point((index % 3 - 1) * .42, -1.71 - length * 1.05, .48), point(0, -.88, .65),
    ]);
    add('painted', stone, slate[(index + seat) % slate.length]);
  }
}

function crown() {
  return new THREE.Shape().moveTo(-.5, .18).lineTo(-.32, -.39).lineTo(.32, -.39).lineTo(.5, .18)
    .quadraticCurveTo(.24, -.10, .17, .21).lineTo(0, .49).lineTo(-.17, .21).quadraticCurveTo(-.24, -.10, -.5, .18).closePath();
}

function fleur() {
  return new THREE.Shape().moveTo(0, .53).bezierCurveTo(-.35, .24, -.13, .14, -.065, -.10)
    .bezierCurveTo(-.23, .21, -.56, .17, -.51, -.12).quadraticCurveTo(-.42, -.22, -.37, -.08)
    .quadraticCurveTo(-.18, -.05, -.14, -.24).lineTo(-.23, -.28).lineTo(-.10, -.34)
    .lineTo(0, -.52).lineTo(.10, -.34).lineTo(.23, -.28).lineTo(.14, -.24)
    .quadraticCurveTo(.18, -.05, .37, -.08).quadraticCurveTo(.42, -.22, .51, -.12)
    .bezierCurveTo(.56, .17, .23, .21, .065, -.10).bezierCurveTo(.13, .14, .35, .24, 0, .53).closePath();
}

function relief(shape: THREE.Shape, depth = .014, bevel = .008) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 4 });
}

function monument(add: ReturnType<typeof islandBatch>['add']) {
  // Mouldings share their seams so the statue keeps its original grounding height.
  add('painted', profile([[0, .013], [1.52, .013], [1.592, .038], [1.608, .063], [1.59, .092],
    [1.52, .106], [1.506, .145], [0, .145]]), '#b0a084');
  add('metal', profile([[1.49, .101], [1.531, .102], [1.55, .123], [1.551, .145], [1.534, .165], [1.487, .171]]), gild);
  add('painted', profile([[0, .137], [1.48, .137], [1.485, .166], [1.457, .187], [1.457, .281],
    [1.49, .303], [1.5, .319], [0, .319]]), '#ad987a');
  add('metal', profile([[1.49, .296], [1.507, .299], [1.539, .313], [1.546, .34], [1.529, .357], [1.48, .369]]), gild);
  add('painted', profile([[0, .349], [1.507, .349], [1.5, .379], [1.457, .407], [1.4, .424],
    [1.372, STATUE_PLINTH_TOP], [0, STATUE_PLINTH_TOP]]), ivory);
  add('metal', torus(1.298, .010, 44), trim, [0, STATUE_PLINTH_TOP + .003, 0], undefined, [Math.PI / 2, 0, 0]);
  add('painted', torus(1.185, .009, 40), '#c9b588', [0, STATUE_PLINTH_TOP + .002, 0], undefined, [Math.PI / 2, 0, 0]);

  const panel = new THREE.Shape().moveTo(-.31, -.061).lineTo(-.275, .036).quadraticCurveTo(0, .107, .275, .036)
    .lineTo(.31, -.061).quadraticCurveTo(0, -.106, -.31, -.061).closePath();
  for (let index = 0; index < 10; index++) {
    const angle = (index + .5) * Math.PI / 5;
    const x = Math.sin(angle), z = Math.cos(angle);
    const face: Point = [0, angle, 0];
    add('metal', relief(panel, .009, .010), gold, [x * 1.452, .225, z * 1.452], undefined, face);
    add('accent', relief(panel, .004, .004), '#d7c8c0', [x * 1.470, .224, z * 1.470], [.88, .77, .83], face);
    add('metal', relief(index % 2 ? fleur() : crown(), .033, .028), trim, [x * 1.488, .219, z * 1.488], [.104, .111, .31], face);
    for (const side of [-1, 1]) for (let leaf = 0; leaf < 2; leaf++) {
      const offset = side * (.088 + leaf * .049);
      add('metal', bead(.021), leaf ? gild : trim, [x * 1.49 + z * offset, .212 + leaf * .014, z * 1.49 - x * offset],
        [1.6, .49, .48], [0, angle, side * .34]);
    }
    const seam = angle + Math.PI / 10;
    const dx = Math.sin(seam), dz = Math.cos(seam);
    add('metal', new THREE.OctahedronGeometry(.053), gild, [dx * 1.478, .225, dz * 1.478], [.84, 1.1, .8]);
    add('accent', new THREE.OctahedronGeometry(.031), '#ffffff', [dx * 1.516, .225, dz * 1.516], [.82, 1.12, .82]);
    add('painted', new THREE.BoxGeometry(.018, .006, .108), '#bbab8d', [dx * 1.227, STATUE_PLINTH_TOP + .003, dz * 1.227], undefined, [0, seam, 0]);
  }
}

export function makePlayerIsland(seat: number) {
  const { add, finish } = islandBatch();
  add('painted', terrain(seat, false));
  cliffButtresses(add, seat);
  add('painted', terrain(seat, true));
  monument(add);

  for (const x of [-1.82, 1.82]) {
    const z = -1.035;
    add('painted', disc(.169, .231, .16, 12), ivory, [x, .079, z]);
    add('metal', disc(.034, .048, 1.66, 10), gold, [x, .94, z]);
    add('metal', new THREE.OctahedronGeometry(.099), trim, [x, 1.826, z], [.61, 1.13, .61]);
    add('accent', bead(.071), '#ffffff', [x, 1.72, z]);
    add('metal', disc(.033, .033, .757, 10), gold, [x, 1.54, z], undefined, [0, 0, Math.PI / 2]);
    for (const tip of [-.39, .39]) add('metal', bead(.052), trim, [x + tip, 1.54, z]);
    const banner = new THREE.Shape().moveTo(-.306, 1.505).quadraticCurveTo(-.335, 1.11, -.285, .802)
      .lineTo(0, .948).lineTo(.285, .802).quadraticCurveTo(.318, 1.11, .306, 1.505).closePath();
    add('metal', relief(banner, .008, .012), gild, [x, 0, z]);
    for (const side of [-1, 1]) {
      add('accent', new THREE.ShapeGeometry(banner, 10), '#ffffff', [x, .1, z + side * .021], [.871, .919, 1]);
      const crest = side === 1 ? crown() : fleur();
      add('metal', relief(crest, .017, .02), trim, [x, 1.207, z + side * .037], [.28, .245, .5]);
    }
  }

  // Three shallow stone trays separate the mint's material families.
  for (const [x, z, sx, sz, tint] of [[-1.95, 1.47, .63, .41, '#ad856f'], [-2.25, -.04, .40, .63, '#9698ac'],
    [2.105, 1.17, .56, .46, '#ae946a']] as const) {
    add('painted', disc(.95, 1, .051, 20), '#c4b391', [x, .031, z], [sx, 1, sz]);
    add('painted', disc(.90, .90, .012, 20), tint, [x, .057, z], [sx, 1, sz]);
    add('metal', torus(.938, .027, 22), gild, [x, .064, z], [sx, sz, .70], [Math.PI / 2, 0, 0]);
    add('metal', new THREE.ShapeGeometry(fleur(), 4), '#c4ae84', [x, .066, z], [.295, .288, 1], [-Math.PI / 2, 0, 0]);
  }

  for (const x of [-2.46, 2.38]) {
    const z = x < 0 ? .91 : .32;
    add('painted', disc(.135, .174, .091, 12), ivory, [x, .056, z]);
    add('metal', profile([[.089, .093], [.071, .14], [.054, .19], [.048, .325], [.064, .389], [.103, .416]], 12), gold, [x, 0, z]);
    add('metal', disc(.158, .101, .064, 6), gild, [x, .445, z]);
    add('light', disc(.146, .109, .223, 6), '#ffdaa0', [x, .584, z]);
    add('metal', disc(.055, .181, .117, 6), gild, [x, .751, z]);
    add('accent', new THREE.OctahedronGeometry(.062), '#ffffff', [x, .848, z]);
    for (let step = 0; step < 6; step++) {
      const theta = Math.PI / 6 + step * Math.PI / 3;
      add('metal', disc(.015, .017, .23, 5), gild, [x + .116 * Math.cos(theta), .582, z + .116 * Math.sin(theta)]);
    }
  }

  const leaves = ['#6b9437', '#4f7e2d', '#779b43', '#8a954e'];
  for (const [index, [x, z, size]] of [[-1.25, -2.18, .29], [1.24, -2.13, .28], [-2.33, -1.21, .18],
    [2.16, -.89, .26], [-.91, 2.39, .16], [1.01, 2.28, .17], [.25, -2.53, .23]].entries()) {
    add('painted', new THREE.DodecahedronGeometry(size * .58), '#8b8187', [x - .13, size * .24, z + .13], [1.12, .56, .86]);
    for (let leaf = 0; leaf < 3; leaf++) {
      const spread = leaf - 1;
      add('painted', bead(size), leaves[(seat + leaf + index) % leaves.length],
        [x + .15 * spread, size * .53, z + .053 * Math.cos(leaf * 2)], [1, .81 + .16 * leaf, .80]);
      if (index % 3 === 1) add('painted', bead(size * .18), leaf === 1 ? '#f9e7a0' : '#f7ecd3',
        [x + .13 * spread, size * (1.02 + .15 * leaf), z + .079], [1, .71, 1]);
    }
  }
  return { painted: finish('painted'), metal: finish('metal'), light: finish('light'), accent: finish('accent') };
}

/** The global anchor positions stay fixed. Only the five interlocking links are instanced. */
export function makeIslandChain() {
  const { add, finish } = islandBatch();
  const boardZ = ISLAND_BOARD_DOCK - ISLAND_DISTANCE;
  const boardY = ISLAND_BOARD_DOCK_Y - ISLAND_SURFACE_Y;
  const islandZ = -ISLAND_DOCK, islandY = ISLAND_DOCK_Y;
  const shield = new THREE.Shape().moveTo(0, .33).lineTo(.279, .207).lineTo(.29, -.054)
    .quadraticCurveTo(.27, -.21, 0, -.316).quadraticCurveTo(-.27, -.21, -.29, -.054).lineTo(-.279, .207).closePath();
  for (const [z, y, face] of [[boardZ, boardY, 1], [islandZ, islandY, -1]]) {
    add('metal', relief(shield, .079, .027), gold, [0, y, z - face * .055], [1.12, 1, 1], [0, face < 0 ? Math.PI : 0, 0]);
    add('metal', disc(.237, .271, .074, 10), '#d59142', [0, y - .018, z + face * .052], undefined, [Math.PI / 2, 0, 0]);
    add('metal', torus(.176, .055, 20), trim, [0, y - .018, z + face * .102], [.96, 1, 1]);
    add('metal', torus(.232, .016, 20), trim, [0, y - .018, z + face * .078]);
    for (const x of [-.248, .248]) add('metal', bead(.038), trim, [x, y + .112, z + face * .085], [1, 1, .57]);
    add('metal', new THREE.OctahedronGeometry(.091), gild, [0, y + .237, z + face * .087], [1, .83, .60]);
    add(face > 0 ? 'metal' : 'accent', new THREE.OctahedronGeometry(.061), face > 0 ? '#eac079' : '#ffffff',
      [0, y + .237, z + face * .114], [.84, .92, .71]);
  }

  const link = new THREE.TorusGeometry(.129, .061, 8, 22).scale(1, 1.65, 1);
  const start = new THREE.Vector3(0, boardY - .018, boardZ + .122);
  const end = new THREE.Vector3(0, islandY - .018, islandZ - .122);
  const forward = new THREE.Vector3(0, 0, 1), localX = new THREE.Vector3(1, 0, 0);
  const linkPlane = new THREE.Quaternion().setFromAxisAngle(localX, Math.PI / 2);
  const matrices = Array.from({ length: 5 }, (_, index) => {
    const t = (index + .5) / 5;
    const point = start.clone().lerp(end, t);
    point.y -= .245 * 4 * t * (1 - t);
    const tangent = end.clone().sub(start);
    tangent.y -= .98 * (1 - 2 * t);
    const frame = new THREE.Quaternion().setFromUnitVectors(forward, tangent.normalize());
    const twist = new THREE.Quaternion().setFromAxisAngle(forward, -.43 + (index % 2) * Math.PI / 2);
    return new THREE.Matrix4().compose(point, frame.multiply(twist).multiply(linkPlane), new THREE.Vector3(1, 1, 1));
  });
  return { mounts: finish('metal'), jewels: finish('accent'), link, matrices };
}
