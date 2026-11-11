// Preserve the existing board's tiny shadow-free accent light unchanged.
const direction: [number, number, number] = [0.329, -0.629, -1];
const length = Math.hypot(...direction);

export const SUN_DIRECTION: [number, number, number] = direction.map(value => value / length) as [number, number, number];
// The visible sunset stays fixed in world space, rather than following a HUD
// corner as the camera orbits. The floating kingdom sits above this horizon.
const skyDirection: [number, number, number] = [.30,-.38,-1];
export const SKY_SUN_DIRECTION = skyDirection.map(value => value/Math.hypot(...skyDirection)) as [number,number,number];
export const SUN_ANGULAR_RADIUS = 0.030;
export const SUN_LIGHT_INTENSITY = 0.08;
