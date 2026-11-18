const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Bounded cross-section around an authored waterfall centreline. Both ends
 * return to the anchor plane; the convex middle retains depth from side views. */
export function waterfallProfile(fraction: number, across: number, width: number) {
  const t = Math.max(0, Math.min(1, fraction)), u = Math.max(0, Math.min(1, across));
  const swell = Math.sin(t * Math.PI);
  const spread = width * (.86 + smooth(t / .18) * .46 + swell * .30);
  const depthEnvelope = smooth(t / .09) * (1 - smooth((t - .82) / .18));
  const lane = Math.sin(u * Math.PI);
  const drift = swell * Math.sin(t * 4.5) * width * .09;
  return {
    sideways: (u - .5) * spread + drift,
    bulge: lane * width * depthEnvelope * (.34 + Math.sin(u * 17 + t * 6) * .027),
    vertical: Math.sin(u * 10.5 + t * 7) * width * .018 * swell,
  };
}
