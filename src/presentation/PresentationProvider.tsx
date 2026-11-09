import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { sounds } from '../utils/audio';
import { collectEffectChanges, isGameReset, primaryEffect, PresentationEvent } from './effectEvents';

const PresentationContext = createContext<PresentationEvent[]>([]);
export const usePresentationEvents = () => useContext(PresentationContext);
let nextEventId = 0;

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<PresentationEvent[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: PresentationEvent[] = [];
    const publish = () => {
      clearTimeout(timer);
      pending = pending.filter(event => event.expiresAt > performance.now());
      setEvents([...pending]);
      if (pending.length) timer = setTimeout(publish, Math.max(16, Math.min(...pending.map(e => e.expiresAt)) - performance.now()));
    };
    const unsubscribe = useGameStore.subscribe((next, previous) => {
      if (isGameReset(previous, next)) { pending = []; publish(); sounds.cancel(); return; }
      if (document.hidden) return;
      const changes = collectEffectChanges(previous, next);
      if (!changes.length) return;
      const now = performance.now();
      const audible = primaryEffect(changes);
      if (audible) sounds.playEvent(audible.kind, audible.amount);
      // Movement uses its own frame queue; avoid React renders on every step.
      const visibleChanges = changes.filter(change => change.kind !== 'move' && change.kind !== 'roll');
      if (!visibleChanges.length) return;
      for (const change of visibleChanges) {
        const event = { ...change, id: ++nextEventId, createdAt: now,
          expiresAt: now + (change.kind === 'turn' ? 1700 : change.kind === 'money' ? 1200 : 1400) };
        pending = pending.filter(e => !(e.kind === event.kind && e.spaceId === event.spaceId && e.playerId === event.playerId));
        pending.push(event);
      }
      pending = pending.slice(-20);
      publish();
    });
    const hide = () => { if (document.hidden) { pending = []; publish(); sounds.cancel(); } };
    // Unlock once on an actual gesture; state-driven AI sounds never unlock audio.
    const unlock = () => sounds.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', hide);
    return () => {
      unsubscribe(); clearTimeout(timer); sounds.dispose();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  return <PresentationContext.Provider value={events}>{children}</PresentationContext.Provider>;
}
