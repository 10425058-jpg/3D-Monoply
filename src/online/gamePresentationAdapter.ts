import { createStore } from 'zustand/vanilla';
import type { SceneState } from '../presentation/SceneStore';
import type { Match } from './types';
import { DICE_ROLL_MS, TOKEN_STEP_MS } from '../presentation/animationMath';
import { committedFeedback, committedMove, type CommittedEvent, type PresentationLabels } from './committedPresentation';

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
    gameSpeed: 1, gameId: 0, committedEffects: [], cameraMode: 'isometric', selectedSpaceId: null, hoveredSpaceId: null,
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
  private timer: ReturnType<typeof setTimeout> | undefined;
  private previous: Match | null = null;
  private playing = false;
  private labels: PresentationLabels = { spaceName: id => `space ${id}`, card: () => undefined };
  constructor(private readonly animating: (value: boolean) => void) {}
  setLabels(labels: PresentationLabels) { this.labels = labels; }
  setSpeed(gameSpeed: 1 | 2) { this.store.setState({ gameSpeed }); }
  private setPlaying(value: boolean) {
    if (this.playing === value) return;
    this.playing = value;
    this.animating(value);
  }
  private later(fn: () => void, ms: number, generation: number) {
    this.timer = setTimeout(() => { if (generation === this.generation) fn(); }, ms);
  }
  private resetTo(snapshot: Match) {
    this.store.setState(state => ({ ...mapMatch(snapshot), committedEffects: [], gameId: (state.gameId ?? 0) + 1 }));
  }
  apply(snapshot: Match, animate = true, events: readonly CommittedEvent[] = []) {
    const before = this.previous;
    if (before?.matchId === snapshot.matchId && snapshot.stateVersion <= before.stateVersion) return;
    const interrupted = this.playing;
    this.previous = snapshot;
    this.cancel();
    const consecutive = before?.matchId === snapshot.matchId && snapshot.stateVersion === before.stateVersion + 1;
    if (!animate || !consecutive || interrupted || !events.length) { this.resetTo(snapshot); return; }
    const mapped = mapMatch(snapshot);
    const { rolls, beats } = committedMove(before, snapshot, events, this.labels);
    const effects = committedFeedback(before, snapshot, events, mapped.players, this.labels);
    const finish = () => {
      this.store.setState({ ...mapped, committedEffects: effects });
      this.setPlaying(false);
    };
    if (!rolls) { finish(); return; }
    const generation = this.generation;
    const reduce = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.store.setState({ dice: mapped.dice, turnPhase: 'ROLLING' });
    if (reduce()) {
      finish();
      return;
    }
    this.setPlaying(true);
    let index = 0;
    let step = 0;
    const advance = () => {
      const beat = beats[index];
      if (!beat || reduce()) { finish(); return; }
      const speed = this.store.getState().gameSpeed;
      if ('card' in beat) {
        this.store.setState({ committedEffects: [beat.card] });
        index++;
        this.later(advance, 440 / speed, generation);
        return;
      }
      const position = beat.positions[step++];
      this.store.setState(state => ({ players: state.players.map(player => player.id === beat.seat
        ? { ...player, position, inJail: beat.jail ?? player.inJail } : player) }));
      if (step === beat.positions.length) { index++; step = 0; }
      this.later(advance, TOKEN_STEP_MS / speed, generation);
    };
    this.later(() => {
      this.store.setState({ turnPhase: 'MOVING' });
      advance();
    }, DICE_ROLL_MS / this.store.getState().gameSpeed, generation);
  }
  cancel() { ++this.generation; clearTimeout(this.timer); this.setPlaying(false); }
  reconcile() { this.cancel(); if (this.previous) this.resetTo(this.previous); }
  dispose() { this.cancel(); this.previous = null; }
}
