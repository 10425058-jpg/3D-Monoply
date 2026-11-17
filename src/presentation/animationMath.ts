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

/** A new roll has no landing age yet. Keep it full size until it settles. */
export function diceResultScale(rolling: boolean, landingAge: number, reduced: boolean) {
  if (rolling) return 1;
  if (!Number.isFinite(landingAge) || landingAge >= 2.2) return 0;
  return reduced || landingAge <= 1.9 ? 1 : Math.max(0, (2.2 - landingAge) / 0.3);
}

export function tokenOffset(index:number,count:number){
  if(count<=4){const angle=index*Math.PI/2+Math.PI/4;return {x:Math.cos(angle)*.58,z:Math.sin(angle)*.58,scale:1};}
  return {x:(index%3-1)*.52,z:(Math.floor(index/3)-.5)*.72,scale:.78};
}

export const TOKEN_RING_OUTER_RADIUS = .34;
export const tokenRingScale = (count: number) => count > 4 ? .8 : 1;

/** Align actors above the same lifted top surface used by Board3D. */
export const tileActorHeight=(id:number,hovered:number|null,selected:number|null)=>.34+(hovered===id ? .12 : selected===id ? .08 : 0);

export function hopPose(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return { blend: smoothStep(t), height: Math.sin(t * Math.PI) * 0.42, tilt: Math.sin(t * Math.PI) * 0.12 };
}
