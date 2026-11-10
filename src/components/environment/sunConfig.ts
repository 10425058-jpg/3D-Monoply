// World-space direction, shared by the sky, cloud highlights, and sunlight.
// The kingdom floats above its horizon, so the distant sunset is below world Y=0.
const direction: [number, number, number] = [0.329, -0.629, -1];
const length = Math.hypot(...direction);

export const SUN_DIRECTION: [number, number, number] = direction.map(value => value / length) as [number, number, number];
export const SUN_ANGULAR_RADIUS = 0.026;
export const SUN_LIGHT_INTENSITY = 0.08;
