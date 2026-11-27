import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSceneStore } from './SceneStore';
import { sounds } from '../utils/audio';
import { collectEffectChanges, didEndGame, effectKey, isGameReset, primaryEffect, type EffectChange, type PresentationEvent } from './effectEvents';

const PresentationContext = createContext<PresentationEvent[]>([]);
export const usePresentationEvents = () => useContext(PresentationContext);
const lifetime: Partial<Record<EffectChange['kind'], number>> = {
  turn: 1450, 'dice-land': 2200, money: 1400, transaction: 3600, bankrupt: 5200, victory: 2800, jail: 3000,
};
const MAX_SEEN = 256;

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const store = useSceneStore();
  const [events, setEvents] = useState<PresentationEvent[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: PresentationEvent[] = [];
    let queued: EffectChange[] = [];
    let scheduled = false;
    let disposed = false;
    let revision = 0;
    const seen = new Set<string>();
    const publish = () => {
      clearTimeout(timer);
      pending = pending.filter(event => event.expiresAt > performance.now());
      setEvents([...pending]);
      if (pending.length) timer = setTimeout(publish, Math.max(16, Math.min(...pending.map(e => e.expiresAt)) - performance.now()));
    };
    const flush = () => {
      scheduled = false;
      const batch = queued;
      queued = [];
      if (disposed || document.hidden || !batch.length) return;
      const now = performance.now();
      revision++;
      const changes = batch.flatMap((change, index) => {
        const id = effectKey(change, revision, index);
        if (seen.has(id)) return [];
        if (change.activityId !== undefined) {
          seen.add(id);
          if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value!);
        }
        return [{ ...change, id, createdAt: now, expiresAt: now + (change.quiet ? 900 : lifetime[change.kind] ?? 2200) }];
      });
      const audible = primaryEffect(changes);
      if (audible) sounds.playEvent(audible);
      // Movement uses its own frame queue; avoid React renders on every step.
      const rolling = changes.some(change => change.kind === 'roll');
      if (rolling) pending = pending.filter(event => event.kind !== 'dice-land');
      const visibleChanges = changes.filter(change => change.kind !== 'move' && change.kind !== 'roll');
      if (!visibleChanges.length && !rolling) return;
      for (const event of visibleChanges) {
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
      if (isGameReset(previous, next)) { seen.clear(); clear(); return; }
      if (document.hidden) return;
      if (previous.turnPhase === 'GAME_OVER' && next.turnPhase === 'GAME_OVER') return;
      const completed = didEndGame(previous, next);
      if (completed) {
        // Solo can confirm the final elimination and victory in consecutive writes.
        const eliminations = queued.filter(change => change.kind === 'bankrupt');
        clear();
        queued.push(...eliminations);
      }
      const changes = collectEffectChanges(previous, next).filter(change => !completed ||
        change.kind === 'victory' || change.kind === 'bankrupt');
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
