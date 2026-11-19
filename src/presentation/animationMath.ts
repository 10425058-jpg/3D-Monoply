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
export const DICE_ROLL_MS = 680;
export const TOKEN_STEP_MS = 155;

/** Anticipation, a long throw, and two short bounces. Progress is shared with the committed roll. */
export function diceThrow(progress: number, index: number) {
  const windup = smoothStep(progress / .14);
  const travel = Math.max(0, Math.min(1, (progress - .14) / .86));
  const direction = index === 0 ? -1 : 1;
  const flight = travel < .57 ? [0, .57, .86] : travel < .83 ? [.57, .83, .24] : [.83, 1, .07];
  const bounce = (travel - flight[0]) / (flight[1] - flight[0]);
  const height = 4 * bounce * (1 - bounce) * flight[2];
  const turn = 2 * Math.PI * (1 - (1 - travel) ** 2);
  return {
    x: direction * (1 - smoothStep(travel)) * (.28 * windup - .1 * Math.sin(travel * Math.PI)),
    z: -.52 * windup * (1 - travel) ** 2 + .11 * Math.sin(travel * Math.PI),
    height: height * (index === 0 ? 1 : .85),
    pitch: 2 * turn,
    yaw: direction * turn,
    bank: direction * (turn + Math.sin(windup * Math.PI) * .17),
  };
}

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
