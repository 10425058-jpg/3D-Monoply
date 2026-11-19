import { createStore } from 'zustand/vanilla';
import { ApiError, describeError } from './apiClient';
import { EventTracker } from './eventTracker';
import type { MatchPresenter } from './gamePresentationAdapter';
import type { CommittedEvent, PresentationLabels } from './committedPresentation';
import { SocketClient } from './socketClient';
import type { SessionManager } from './sessionManager';
import type { ActionBody, ActionName, ActionReceipt, Connection, Envelope, EventPayloads, Match, Room } from './types';

interface OnlineState {
  room: Room | null; match: Match | null; connection: Connection; error: string | null;
  pending: string | null; uncertain: { action: ActionName; body: ActionBody } | null;
  animating: boolean; syncing: boolean; activity: { id: string; text: string }[];
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
  private spaceNames: ReadonlyMap<number, string> | null = null;
  get isActive() { return !this.disposed; }
  // Labels arrive from the already-authorized lazy match screen. The room
  // controller must not pull the gameplay catalog into the waiting-room bundle.
  setSpaceNames(names: ReadonlyMap<number, string> | null, card?: PresentationLabels['card']) {
    this.spaceNames = names;
    this.matchPresenter?.setLabels({ spaceName: id => this.spaceNames?.get(id) ?? `space ${id}`, card: card ?? (() => undefined) });
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
  reconcile = (): Promise<void> => {
    if (this.disposed) return Promise.resolve();
    if (this.flight) { this.again = true; return this.flight; }
    this.flight = (async () => {
      do {
        this.again = false;
        try {
          if (this.target.matchId) {
            const match = await this.session.api.request<Match>(`/matches/${this.target.matchId}`);
            if (this.disposed) return;
            if (!this.matchPresenter) {
              const { MatchPresenter } = await import('./gamePresentationAdapter');
              if (this.disposed) return;
              this.matchPresenter = new MatchPresenter(animating => this.state.setState({ animating }));
            }
            const previous = this.state.getState().match;
            if (!previous || match.stateVersion >= previous.stateVersion) {
              const ready = this.state.getState().connection === 'connected' && (typeof document === 'undefined' || !document.hidden);
              if (!previous || match.stateVersion > previous.stateVersion) {
                const commit = this.commits.get(match.stateVersion);
                this.presenter.apply(match, ready && !this.restoring, commit?.receipt ?? (commit?.gap ? [] : commit?.events));
                for (const version of this.commits.keys()) if (version <= match.stateVersion) this.commits.delete(version);
              }
              this.state.setState({ match, syncing: !ready });
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
    if (name.startsWith('game:') || name === 'player:connection_changed') {
      const payload = event.payload as Record<string, unknown>;
      if (name !== 'game:money_changed' || (payload.reason !== 'RENT' && payload.reason !== 'PURCHASE')) {
        const text = this.describeEvent(name, payload);
        this.state.setState(s => ({ activity: [...s.activity, { id: event.eventId, text }].slice(-35) }));
      }
    }
    // Snapshots are always fetched for this viewer. Events never mutate money or allowedActions.
    void this.reconcile();
  }
  private describeEvent(name: string, p: Record<string, unknown>) {
    const match=this.state.getState().match;
    const player = this.state.getState().match?.players.find(v => v.playerId === p.playerId);
    const who = player?.username ?? 'Player';
    if (name === 'game:dice_rolled') return `${who} rolled ${(p.dice as number[])?.join(' + ')}.`;
    if (name === 'game:money_changed') return `${who}: ${Number(p.amount) >= 0 ? '+' : ''}$${p.amount}.`;
    if (name === 'game:property_purchased') return `${who} bought ${this.spaceNames?.get(Number(p.spaceId))??'a property'} for $${p.price}.`;
    if (name === 'game:rent_paid') {
      const payer=match?.players.find(v=>v.playerId===p.payerPlayerId)?.username??'Player';
      const owner=match?.players.find(v=>v.playerId===p.ownerPlayerId)?.username??'the owner';
      return `${payer} paid $${p.amount} rent to ${owner} for ${this.spaceNames?.get(Number(p.spaceId))??'the property'}.`;
    }
    if (name === 'player:connection_changed') return `${who} ${p.connectionStatus === 'CONNECTED' ? 'reconnected' : 'disconnected'}.`;
    return name.replace('game:', '').replace(/_/g, ' ');
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
    this.spaceNames = null;
    this.disposed = true; this.socket?.stop(); this.matchPresenter?.dispose();
    this.commits.clear();
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== 'undefined') { window.removeEventListener('online', this.focus); window.removeEventListener('offline', this.offline); }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.focus);
  }
}
