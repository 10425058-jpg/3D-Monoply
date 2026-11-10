let preference: MediaQueryList | undefined;

/** Read the live preference too, so a queued frame cannot animate after a toggle. */
export function mayAnimateEnvironment(enabled: boolean) {
  if (!enabled || document.hidden) return false;
  preference ??= window.matchMedia('(prefers-reduced-motion: reduce)');
  return !preference.matches;
}
