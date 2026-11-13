import { createStore } from 'zustand/vanilla';
import type { SceneState } from '../presentation/SceneStore';
import type { Match } from './types';

/** UUID identity is explicitly mapped to immutable server seats, never array indices. */
export function mapMatch(snapshot: Match): Pick<SceneState, 'players' | 'properties' | 'currentPlayerIndex' | 'dice' | 'turnPhase' | 'winner'> {
  const ids = new Map<string, number>();
  const seats = new Set<number>();
  for (const player of snapshot.players) {
    if (ids.has(player.playerId) || seats.has(player.seatOrder)) throw new Error('Invalid server player identity');
    ids.set(player.playerId, player.seatOrder); seats.add(player.seatOrder);
  }
  const players = [...snapshot.players].sort((a, b) => a.seatOrder - b.seatOrder).map(p => ({
    id: ids.get(p.playerId)!, name: p.username, isAI: false, token: p.token, color: p.color,
    money: p.money, position: p.position, inJail: p.inJail, jailTurns: p.jailTurns,
    getOutOfJailCards: p.heldJailCardIds.length, isBankrupt: p.isBankrupt, landmarkLevel: 0,
  }));
  const properties: SceneState['properties'] = {};
  for (const p of snapshot.properties) {
    if (p.ownerPlayerId !== null && !ids.has(p.ownerPlayerId)) throw new Error('Unknown server property owner');
    properties[p.spaceId] = { spaceId: p.spaceId, ownerId: p.ownerPlayerId === null ? null : ids.get(p.ownerPlayerId)!, houses: p.houses, isMortgaged: p.isMortgaged };
  }
  return {
    players, properties,
    currentPlayerIndex: players.findIndex(p => p.id === ids.get(snapshot.currentPlayerId ?? '')),
    dice: snapshot.dice?.values ?? [1, 1], turnPhase: snapshot.turnPhase,
    winner: players.find(p => p.id === ids.get(snapshot.winnerPlayerId ?? '')) ?? null,
  };
}
export function createOnlineSceneStore() {
  return createStore<SceneState>((set) => ({
    players: [], properties: {}, currentPlayerIndex: -1, dice: [1, 1], turnPhase: 'PRE_ROLL',
    gameSpeed: 1, cameraMode: 'isometric', selectedSpaceId: null, hoveredSpaceId: null,
    logs: [], activeCard: null, auction: null, railroadRaid: null, winner: null,
    selectSpace: selectedSpaceId => set({ selectedSpaceId }),
    setHoveredSpace: hoveredSpaceId => set({ hoveredSpaceId }),
    setCameraMode: cameraMode => set({ cameraMode }),
  }));
}

/** Cancellable, bounded presentation of already committed results. Never writes authority. */
export class MatchPresenter {
  readonly store = createOnlineSceneStore();
  private generation = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private previous: Match | null = null;
  constructor(private readonly animating: (value: boolean) => void) {}
  private later(fn: () => void, ms: number, generation: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); if (generation === this.generation) fn(); }, ms);
    this.timers.add(timer);
  }
  apply(snapshot: Match, animate = true, committedRoll = false) {
    const before = this.previous; this.previous = snapshot;
    this.cancel();
    const mapped = mapMatch(snapshot);
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const roll = animate && !reduced && before && before.matchId === snapshot.matchId && snapshot.stateVersion > before.stateVersion &&
      snapshot.dice && (committedRoll || JSON.stringify(before.dice) !== JSON.stringify(snapshot.dice));
    if (!roll) { this.store.setState(mapped); return; }
    const generation = this.generation;
    const oldPlayers = this.store.getState().players;
    this.animating(true);
    this.store.setState({ ...mapped, players: oldPlayers, turnPhase: 'ROLLING' });
    this.later(() => {
      const mover = snapshot.players.find(p => p.playerId === snapshot.dice?.rolledByPlayerId);
      const old = before.players.find(p => p.playerId === mover?.playerId);
      const steps = old && mover ? (mover.position - old.position + 40) % 40 : 0;
      // Card relocations/backward movement and Jail reconcile directly; ordinary rolls hop each tile.
      const walk = mover && old && !mover.inJail && steps > 0 && steps <= snapshot.dice!.total && steps <= 12;
      if (!walk) { this.store.setState(mapped); this.animating(false); return; }
      this.store.setState({ ...mapped, players: oldPlayers, turnPhase: 'MOVING' });
      for (let i = 1; i <= steps; i++) this.later(() => {
        this.store.setState({ players: mapped.players.map(p => p.id === mover.seatOrder ? { ...p, position: (old.position + i) % 40 } : p) });
      }, (i - 1) * 185, generation);
      this.later(() => { this.store.setState(mapped); this.animating(false); }, steps * 185 + 80, generation);
    }, 660, generation);
  }
  cancel() { ++this.generation; this.timers.forEach(clearTimeout); this.timers.clear(); this.animating(false); }
  reconcile() { if (this.previous) this.apply(this.previous, false); }
  dispose() { this.cancel(); this.previous = null; }
}
