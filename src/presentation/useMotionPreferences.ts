import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let preference: MediaQueryList | undefined;
let snapshot = { reducedMotion: false, visible: true };
const media = () => preference ??= window.matchMedia('(prefers-reduced-motion: reduce)');
const notify = () => listeners.forEach(listener => listener());

function subscribe(listener: () => void) {
  if (!listeners.size) {
    media().addEventListener('change', notify);
    document.addEventListener('visibilitychange', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      media().removeEventListener('change', notify);
      document.removeEventListener('visibilitychange', notify);
    }
  };
}

function getSnapshot() {
  const reducedMotion = media().matches;
  const visible = !document.hidden;
  if (snapshot.reducedMotion !== reducedMotion || snapshot.visible !== visible) snapshot = { reducedMotion, visible };
  return snapshot;
}

export function useMotionPreferences() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
