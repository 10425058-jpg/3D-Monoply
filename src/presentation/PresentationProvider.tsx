import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSceneStore } from './SceneStore';
import { sounds } from '../utils/audio';
import { collectEffectChanges, isGameReset, primaryEffect, type EffectChange, type PresentationEvent } from './effectEvents';

const PresentationContext = createContext<PresentationEvent[]>([]);
export const usePresentationEvents = () => useContext(PresentationContext);
let nextEventId = 0;
const lifetime: Partial<Record<EffectChange['kind'], number>> = {
  turn: 1600, 'dice-land': 2200, money: 1400, transaction: 3600, bankrupt: 5200, victory: 4200, jail: 3000,
};

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const store = useSceneStore();
  const [events, setEvents] = useState<PresentationEvent[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: PresentationEvent[] = [];
    let queued: EffectChange[] = [];
    let scheduled = false;
    let disposed = false;
    const publish = () => {
      clearTimeout(timer);
      pending = pending.filter(event => event.expiresAt > performance.now());
      setEvents([...pending]);
      if (pending.length) timer = setTimeout(publish, Math.max(16, Math.min(...pending.map(e => e.expiresAt)) - performance.now()));
    };
    const flush = () => {
      scheduled = false;
      const changes = queued;
      queued = [];
      if (disposed || document.hidden || !changes.length) return;
      const now = performance.now();
      const audible = primaryEffect(changes);
      if (audible) sounds.playEvent(audible.kind, audible.amount, audible.cash);
      // Movement uses its own frame queue; avoid React renders on every step.
      const rolling = changes.some(change => change.kind === 'roll');
      if (rolling) pending = pending.filter(event => event.kind !== 'dice-land');
      const visibleChanges = changes.filter(change => change.kind !== 'move' && change.kind !== 'roll');
      if (!visibleChanges.length && !rolling) return;
      for (const change of visibleChanges) {
        const event = { ...change, id: ++nextEventId, createdAt: now,
          expiresAt: now + (lifetime[change.kind] ?? 2200) };
        if (event.kind !== 'transaction') {
          pending = pending.filter(e => !(e.kind === event.kind && e.spaceId === event.spaceId && e.playerId === event.playerId));
        }
        pending.push(event);
      }
      pending = pending.slice(-20);
      publish();
    };
    const clear = () => { queued = []; pending = []; publish(); sounds.cancel(); };
    const unsubscribe = store.subscribe((next, previous) => {
      if (isGameReset(previous, next)) { clear(); return; }
      if (document.hidden) return;
      const changes = collectEffectChanges(previous, next);
      if (!changes.length) return;
      queued.push(...changes);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    });
    const hide = () => { if (document.hidden) clear(); };
    // Unlock once on an actual gesture; state-driven AI sounds never unlock audio.
    const unlock = () => sounds.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', hide);
    return () => {
      disposed = true; unsubscribe(); clearTimeout(timer); sounds.dispose();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [store]);
  return <PresentationContext.Provider value={events}>{children}</PresentationContext.Provider>;
}
