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

const DICE_RELEASE = .135;
export const DICE_IMPACTS = [[.61, .805, .94], [.652, .835, .953]] as const;
type DicePose = { x: number; z: number; height: number; pitch: number; yaw: number; bank: number };
export const createDicePose = (): DicePose => ({ x: 0, z: 0, height: 0, pitch: 0, yaw: 0, bank: 0 });

export const diceRestYaw = (roll: number, index: number) =>
  (index === 0 ? -.18 : .24) + ((roll + index * 3) % 5 - 2) * .08;

/** Three diminishing flights. Relative spin is zero at rest, so yaw can vary independently of the upward face. */
export function diceThrow(progress: number, index: number, roll = 0, pose = createDicePose()) {
  const [first, second, third] = DICE_IMPACTS[index === 0 ? 0 : 1];
  const direction = index === 0 ? -1 : 1;
  const variant = ((roll * 3 + index * 5) % 7 - 3) / 3;
  const t = Math.max(0, Math.min(third, progress));
  const windup = smoothStep(t / DICE_RELEASE);
  const flight = Math.max(0, (t - DICE_RELEASE) / (third - DICE_RELEASE));
  const ground = 1 - (1 - flight) ** 2;
  const start = t < first ? DICE_RELEASE : t < second ? first : second;
  const end = t < first ? first : t < second ? second : third;
  const bounce = Math.max(0, (t - start) / (end - start));
  const arc = t < first ? 1.02 + variant * .11 - index * .09 : t < second ? .28 : .085;
  const spin = 2 * Math.PI * (1 - flight) ** 2;
  const load = windup * (1 - flight);
  pose.x = direction * (.24 * load + (.5 + variant * .14) * Math.sin(ground * Math.PI));
  pose.z = -.58 * (1 - ground) * windup + (.29 + variant * .2) * Math.sin(ground * Math.PI);
  pose.height = 4 * bounce * (1 - bounce) * arc;
  pose.pitch = spin * (roll % 2 ? -2 : 2) * (index ? -1 : 1) + .18 * load;
  pose.yaw = direction * spin - variant * .32 * load;
  pose.bank = direction * (spin + .14 * load);
  return pose;
}

/** A new roll has no landing age yet. Keep it full size until it settles. */
export function diceResultScale(rolling: boolean, landingAge: number, reduced: boolean) {
  if (rolling) return 1;
  if (!Number.isFinite(landingAge) || landingAge >= 2.2) return 0;
  return reduced || landingAge <= 1.9 ? 1 : Math.max(0, (2.2 - landingAge) / 0.3);
}

export const PLAYER_TOKEN_SCALE = 1.3;

export function tokenOffset(index:number,count:number,isCorner=false){
  // Wider corners can accommodate four enlarged tokens without overlapping.
  if(count<=4){const angle=index*Math.PI/2+Math.PI/4;const radius=isCorner?.80:.58;return {x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,scale:1};}
  return {x:(index%3-1)*.52,z:(Math.floor(index/3)-.5)*.72,scale:.78};
}

/** Keep the existing clearance on narrow shared streets and five/six-seat boards. */
export function tokenRenderScale(count:number,isCorner:boolean,shared:boolean){
  return (isCorner?1.2:1.06)*(count>4?.78:1)*(count<=4&&(isCorner||!shared)?PLAYER_TOKEN_SCALE:1);
}

export const TOKEN_RING_OUTER_RADIUS = .34;
export const tokenRingScale = (count: number) => count > 4 ? .8 : 1;

/** Align actors above the same lifted top surface used by Board3D. */
export const tileActorHeight=(id:number,hovered:number|null,selected:number|null)=>.34+(hovered===id ? .12 : selected===id ? .08 : 0);

export const createHopPose = () => ({ blend: 0, height: 0, tilt: 0 });

export function hopPose(progress: number, pose = createHopPose()) {
  const t = Math.max(0, Math.min(1, progress));
  const arc = t < .5 ? Math.max(0, (t - .12) / .38) : (1 - t) / .5;
  pose.blend = smoothStep((t - .12) / .88);
  pose.height = Math.sin(Math.PI * .5 * arc) * .42;
  pose.tilt = t < .12 ? -.095 * Math.sin(t / .12 * Math.PI) : .12 * Math.sin(2 * Math.PI * (t - .12) / .88);
  return pose;
}

export const turnAngle = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
