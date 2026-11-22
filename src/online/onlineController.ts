import { createStore } from 'zustand/vanilla';
import type { MatchActivityEvent } from '../game/matchActivity';
import { ApiError, describeError } from './apiClient';
import { EventTracker } from './eventTracker';
import type { MatchPresenter } from './gamePresentationAdapter';
import type { CommittedEvent, PresentationLabels } from './committedPresentation';
import { SocketClient } from './socketClient';
import type { SessionManager } from './sessionManager';
import type { ActionBody, ActionName, ActionReceipt, Connection, Envelope, EventPayloads, Match, PublicActivityEvent, Room } from './types';

interface OnlineState {
  room: Room | null; match: Match | null; connection: Connection; error: string | null;
  pending: string | null; uncertain: { action: ActionName; body: ActionBody } | null;
  animating: boolean; syncing: boolean; activity: MatchActivityEvent[];
}
export class OnlineController {
  readonly state = createStore<OnlineState>(() => ({ room: null, match: null, connection: 'connecting',
    error: null, pending: null, uncertain: null, animating: false, syncing: false, activity: [] }));
  private matchPresenter: MatchPresenter | null = null;
  get presenter() {
    if (!this.matchPresenter) throw new Error('Match presentation requires an authorized snapshot');
    return this.matchPresenter;
  }
  private socket: SocketClient | null = null;
  private tracker = new EventTracker();
  private disposed = false;
  private flight: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private commits = new Map<number, { events: CommittedEvent[]; receipt?: CommittedEvent[]; gap?: boolean }>();
  private restoring = true;
  private labels: PresentationLabels | null = null;
  private projectActivity: typeof import('./committedActivity')['projectActivity'] | null = null;
  private activitySequence = 0;
  private pendingActivity: { match: Match; events: PublicActivityEvent[]; silent: boolean }[] = [];
  get isActive() { return !this.disposed; }
  // Labels arrive from the already-authorized lazy match screen. The room
  // controller must not pull the gameplay catalog into the waiting-room bundle.
  setSpaceNames(names: ReadonlyMap<number, string> | null, card?: PresentationLabels['card']) {
    const labels = { spaceName: (id: number) => names?.get(id) ?? `space ${id}`, card: card ?? (() => undefined) };
    this.labels = names ? labels : null;
    this.matchPresenter?.setLabels(labels);
    const project = this.projectActivity;
    if (!names || !project || !this.pendingActivity.length) return;
    const pending = this.pendingActivity;
    this.pendingActivity = [];
    this.state.setState(s => ({ activity: pending.reduce(
      (history, batch) => project(history, batch.match, batch.events, labels, batch.silent), s.activity,
    ) }));
  }
  constructor(private readonly session: SessionManager, private readonly socketUrl: string,
    private readonly target: { roomId?: string; matchId?: string },
    private readonly onMatch: (matchId: string) => void) {}
  start() {
    if (this.target.matchId) this.state.setState({ syncing: true });
    this.socket = new SocketClient(this.socketUrl, this.session, this.target, {
      connection: connection => this.setConnection(connection),
      event: (name, event) => this.event(name, event), reconcile: () => { void this.reconcile(); },
      error: error => { if (!this.disposed) this.state.setState({ error: describeError(error) }); },
    });
    this.socket.start(); void this.reconcile();
    this.timer = setInterval(() => { if (!document.hidden) void this.reconcile(); }, 8000);
    window.addEventListener('online', this.focus);
    window.addEventListener('offline', this.offline);
    document.addEventListener('visibilitychange', this.focus);
  }
  private beginRestore() {
    this.restoring = true;
    this.commits.clear();
    this.matchPresenter?.reconcile();
    if (this.target.matchId) this.state.setState({ syncing: true });
  }
  private setConnection(connection: Connection) {
    if (connection !== 'connected' && this.state.getState().connection === 'connected') this.beginRestore();
    this.state.setState(s => ({ connection,
      error: connection === 'connected' && s.error?.startsWith('Online Service Unavailable') ? null : s.error }));
  }
  private offline = () => this.setConnection('offline');
  private focus = () => {
    if (document.hidden) { this.beginRestore(); return; }
    void this.session.ensureFresh().then(() => this.reconcile()).catch(() => {});
  };
  private commit(version: number) {
    if (!this.commits.has(version)) this.commits.set(version, { events: [] });
    if (this.commits.size > 8) this.commits.delete(this.commits.keys().next().value!);
    return this.commits.get(version)!;
  }
  private acceptActivity(match: Match, rows: PublicActivityEvent[] | undefined, silent: boolean) {
    const events = rows?.filter(event => event.sequence > this.activitySequence && event.stateVersion <= match.stateVersion);
    if (!events?.length) return;
    this.activitySequence = events[events.length - 1].sequence;
    if (!this.labels || !this.projectActivity) {
      this.pendingActivity.push({ match, events, silent });
      return;
    }
    return this.projectActivity(this.state.getState().activity, match, events, this.labels, silent);
  }
  reconcile = (): Promise<void> => {
    if (this.disposed) return Promise.resolve();
    if (this.flight) { this.again = true; return this.flight; }
    this.flight = (async () => {
      do {
        this.again = false;
        try {
          if (this.target.matchId) {
            const { activityEvents, ...match } = await this.session.api.request<Match>(
              `/matches/${this.target.matchId}?activityAfter=${this.activitySequence}`,
            );
            if (this.disposed) return;
            if (!this.matchPresenter) {
              const [{ MatchPresenter }, activity] = await Promise.all([
                import('./gamePresentationAdapter'), import('./committedActivity'),
              ]);
              if (this.disposed) return;
              this.projectActivity = activity.projectActivity;
              this.matchPresenter = new MatchPresenter(animating => this.state.setState({ animating }));
            }
            const previous = this.state.getState().match;
            if (!previous || match.stateVersion >= previous.stateVersion) {
              const ready = this.state.getState().connection === 'connected' && (typeof document === 'undefined' || !document.hidden);
              if (!previous || match.stateVersion > previous.stateVersion) {
                const commit = this.commits.get(match.stateVersion);
                const stored = activityEvents?.filter(event => event.stateVersion === match.stateVersion && event.type.startsWith('game:'));
                const effects = stored?.length ? stored : commit?.receipt ?? (commit?.gap ? [] : commit?.events);
                this.presenter.apply(match, ready && !this.restoring, effects);
                for (const version of this.commits.keys()) if (version <= match.stateVersion) this.commits.delete(version);
              }
              const activity = this.acceptActivity(match, activityEvents, !ready || this.restoring || !previous);
              this.state.setState({ match, syncing: !ready, ...(activity && { activity }) });
              if (ready) this.restoring = false;
            }
            const room = await this.session.api.request<Room>(`/rooms/${match.roomId}`);
            if (!this.disposed) this.acceptRoom(room);
          } else if (this.target.roomId) {
            const room = await this.session.api.request<Room>(`/rooms/${this.target.roomId}`);
            if (!this.disposed) this.acceptRoom(room);
          }
        } catch (error) { if (!this.disposed) this.state.setState({ error: describeError(error) }); }
      } while (this.again && !this.disposed);
    })().finally(() => { this.flight = null; });
    return this.flight;
  };
  acceptRoom(room: Room) {
    if (this.disposed) return;
    const current = this.state.getState().room;
    if (current && current.roomId === room.roomId && current.roomRevision > room.roomRevision) return;
    this.state.setState({ room });
    if (!this.target.matchId && room.matchId) this.onMatch(room.matchId);
  }
  private event(name: keyof EventPayloads, event: Envelope) {
    if (event.roomId && this.target.roomId && event.roomId !== this.target.roomId) return;
    if (event.matchId && event.matchId !== this.target.matchId) return;
    const decision = this.tracker.accept(event);
    if (!decision.accepted) return;
    if (name === 'room:updated' || name === 'room:snapshot') this.acceptRoom(event.payload as Room);
    if (name === 'match:started') this.onMatch((event.payload as EventPayloads['match:started']).matchId);
    if (name.startsWith('game:') && event.stateVersion !== undefined) {
      const current = this.state.getState().match?.stateVersion ?? -1;
      if (event.stateVersion <= current) return;
      const commit = this.commit(event.stateVersion);
      commit.events.push({ type: name, payload: event.payload as Record<string, unknown> });
      commit.gap ||= decision.gap;
    }
    // Snapshots are always fetched for this viewer. Events never mutate money or allowedActions.
    void this.reconcile();
  }
  async roomAction<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    if (this.state.getState().pending) return;
    this.state.setState({ pending: label, error: null });
    try { return await fn(); } catch (error) { if (!this.disposed) this.state.setState({ error: describeError(error) }); }
    finally { if (!this.disposed) this.state.setState({ pending: null }); }
  }
  async act(action: ActionName, extra: Pick<ActionBody, 'spaceId' | 'cardId' | 'targetPlayerId'> = {}, retry = false) {
    const state = this.state.getState();
    if (!state.match || state.pending || state.animating || state.syncing || (!retry && state.uncertain)) return;
    const original = retry ? state.uncertain : null;
    if (retry && !original) return;
    if (!retry && (!state.match.allowedActions.includes(action) || state.connection !== 'connected')) return;
    const body: ActionBody = original?.body ?? { clientActionId: crypto.randomUUID(), expectedStateVersion: state.match.stateVersion,
      contentVersion: state.match.contentVersion, ...extra };
    const name = original?.action ?? action;
    this.state.setState({ pending: name, error: null });
    try {
      const receipt = await this.session.api.request<ActionReceipt>(`/matches/${state.match.matchId}/actions/${name}`, { method: 'POST', body });
      if (this.disposed) return;
      if (receipt.stateVersion > (this.state.getState().match?.stateVersion ?? -1)) this.commit(receipt.stateVersion).receipt = receipt.events;
      this.state.setState({ uncertain: null });
      await this.reconcile();
    } catch (error) {
      if (this.disposed) return;
      const uncertain = error instanceof ApiError && (error.status === 0 || error.status >= 500);
      this.state.setState({ error: describeError(error), uncertain: uncertain ? { action: name, body } : null });
      await this.reconcile();
    } finally { if (!this.disposed) this.state.setState({ pending: null }); }
  }
  stop() {
    this.labels = null;
    this.projectActivity = null;
    this.pendingActivity = [];
    this.disposed = true; this.socket?.stop(); this.matchPresenter?.dispose();
    this.commits.clear();
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== 'undefined') { window.removeEventListener('online', this.focus); window.removeEventListener('offline', this.offline); }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.focus);
  }
}
