import { useEffect, useState } from 'react';

export function useMotionPreferences() {
  const [preferences, setPreferences] = useState(() => ({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    visible: !document.hidden,
  }));
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPreferences({ reducedMotion: media.matches, visible: !document.hidden });
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => { media.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return preferences;
}
