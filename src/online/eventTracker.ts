import type { Envelope } from './types';
/** Presence is unsequenced and may share a version. Do not discard it as stale gameplay. */
export class EventTracker {
  private seen = new Set<string>();
  private sequence = 0;
  accept(event: Envelope) {
    if (!event?.eventId || this.seen.has(event.eventId)) return { accepted: false, gap: false };
    this.seen.add(event.eventId);
    if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value!);
    const gap = event.sequence !== undefined && this.sequence > 0 && event.sequence > this.sequence + 1;
    const old = event.sequence !== undefined && event.sequence <= this.sequence;
    if (event.sequence !== undefined) this.sequence = Math.max(this.sequence, event.sequence);
    return { accepted: !old, gap };
  }
}
