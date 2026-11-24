type Point = [number, number, number];

/** Fit the board, castle and surrounding landmarks into the HUD's clear rectangle. */
export function overviewCamera(width: number, height: number, top = false, surroundings: readonly Point[] = []) {
  const compact = width <= 760;
  const framed = surroundings.length > 0;
  // The centered turn cue sits directly under the south island in an overhead or phone view.
  const bottom = compact ? (framed ? 207 : 180) : framed ? (top ? (width >= 1600 ? 210 : 196) : 151) : 164;
  const insets = { left: compact ? 12 : Math.max(244, Math.min(280, width * .15) + 36), right: compact ? 12 : 104,
    top: compact ? 204 : framed ? 106 : 138, bottom };
  const fov = 40;
  const elevation = top ? 1.52 : framed ? (compact ? 1.15 : 1.09) : 1.2;
  const yaw = framed && !top ? (compact ? -.38 : -.23) : 0;
  const yawSin = Math.sin(yaw), yawCos = Math.cos(yaw);
  const sin = Math.sin(elevation), cos = Math.cos(elevation);
  const target: [number, number, number] = [0, 0.7, 0];
  const tan = Math.tan(fov * Math.PI / 360);
  const usableWidth = width - insets.left - insets.right;
  const usableHeight = height - insets.top - insets.bottom;
  const board: Point[] = [];
  // Board including foliage and plinth, then the narrower castle silhouette.
  for (const [extent, low, high, depth] of [[13, -2.1, .7, 13], [6, .7, 11, 5]]) {
    for (const x of [-extent, extent]) for (const y of [low, high]) for (const z of [-depth, depth]) {
      board.push([x, y, z]);
    }
  }
  const cameraPoints = (world: readonly Point[]): Point[] => world.map(([x, y, z]) => {
    const relativeY = y - target[1];
    const forward = x * yawSin + z * yawCos;
    return [x * yawCos - z * yawSin, relativeY * cos - forward * sin, relativeY * sin + forward * cos];
  });
  const fullScene = cameraPoints([...board, ...surroundings]);
  const bounds = (distance: number) => {
    const xs = fullScene.map(([x, , depth]) => x * height / (2 * tan * (distance - depth)));
    const ys = fullScene.map(([, up, depth]) => -up * height / (2 * tan * (distance - depth)));
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  };
  // Fit actual perspective extents, then center their asymmetric silhouette.
  let near = 20, far = 300;
  for (let i = 0; i < 24; i++) {
    const middle = (near + far) / 2, box = bounds(middle);
    if (box.right - box.left > usableWidth * .97 || box.bottom - box.top > usableHeight * .97) near = middle;
    else far = middle;
  }
  const distance = far, box = bounds(distance);
  return { fov, insets, distance,
    offset: [(insets.right - insets.left + box.left + box.right) / 2,
      (insets.bottom - insets.top + box.top + box.bottom) / 2] as const,
    position: [yawSin * cos * distance, target[1] + sin * distance, yawCos * cos * distance] as Point, target };
}
