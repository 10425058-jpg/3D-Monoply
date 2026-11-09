/** Pure presentation math. No random numbers, timers or game-state writes. */
export const DIE_REST_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0], 2: [-Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2], 5: [Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0],
};

export const smoothStep = (progress: number) => {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
};

export const isAdjacentTile = (from: number, to: number) =>
  (to - from + 40) % 40 === 1 || (from - to + 40) % 40 === 1;

export const movementDuration = (speed: number) => 0.145 / speed;

export function hopPose(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return { blend: smoothStep(t), height: Math.sin(t * Math.PI) * 0.42, tilt: Math.sin(t * Math.PI) * 0.12 };
}
