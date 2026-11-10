/** Fit the physical board and castle into the existing HUD's clear rectangle. */
export function overviewCamera(width: number, height: number, top = false) {
  const compact = width <= 760;
  const insets = { left: compact ? 12 : Math.max(244, Math.min(280, width * .15) + 36), right: compact ? 12 : 104,
    top: compact ? 204 : 138, bottom: compact ? 180 : 164 };
  const fov = 40;
  const elevation = top ? 1.52 : 1.2;
  const sin = Math.sin(elevation), cos = Math.cos(elevation);
  const target: [number, number, number] = [0, 0.7, 0];
  const tan = Math.tan(fov * Math.PI / 360);
  const usableWidth = width - insets.left - insets.right;
  const usableHeight = height - insets.top - insets.bottom;
  const points: [number, number, number][] = [];
  // Board including foliage and plinth, then the narrower castle silhouette.
  for (const [extent, low, high, depth] of [[13, -2.1, .7, 13], [6, .7, 11, 5]]) {
    for (const x of [-extent, extent]) for (const y of [low, high]) for (const z of [-depth, depth]) {
      const relativeY = y - target[1];
      const towardCamera = relativeY * sin + z * cos;
      const up = relativeY * cos - z * sin;
      points.push([x, up, towardCamera]);
    }
  }
  const bounds = (distance: number) => {
    const xs = points.map(([x, , depth]) => x * height / (2 * tan * (distance - depth)));
    const ys = points.map(([, up, depth]) => -up * height / (2 * tan * (distance - depth)));
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
    position: [0, target[1] + sin * distance, cos * distance] as [number, number, number], target };
}
