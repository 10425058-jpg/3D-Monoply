import { createStore } from 'zustand/vanilla';
import { ApiError, describeError } from './apiClient';
import { EventTracker } from './eventTracker';
import { MatchPresenter } from './gamePresentationAdapter';
import { SocketClient } from './socketClient';
import type { SessionManager } from './sessionManager';
import type { ActionBody, ActionName, ActionReceipt, Connection, Envelope, EventPayloads, Match, Room } from './types';

interface OnlineState {
  room: Room | null; match: Match | null; connection: Connection; error: string | null;
  pending: string | null; uncertain: { action: ActionName; body: ActionBody } | null;
  animating: boolean; activity: { id: string; text: string }[];
}
export class OnlineController {
  readonly state = createStore<OnlineState>(() => ({ room: null, match: null, connection: 'connecting',
    error: null, pending: null, uncertain: null, animating: false, activity: [] }));
  readonly presenter = new MatchPresenter(animating => this.state.setState({ animating }));
  private socket: SocketClient | null = null;
  private tracker = new EventTracker();
  private disposed = false;
  private flight: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private rolls = new Set<number>();
  get isActive() { return !this.disposed; }
  constructor(private readonly session: SessionManager, private readonly socketUrl: string,
    private readonly target: { roomId?: string; matchId?: string },
    private readonly onMatch: (matchId: string) => void) {}
  start() {
    this.socket = new SocketClient(this.socketUrl, this.session, this.target, {
      connection: connection => this.state.setState(s => ({ connection,
        error: connection === 'connected' && s.error?.startsWith('Online Service Unavailable') ? null : s.error })),
      event: (name, event) => this.event(name, event), reconcile: () => { void this.reconcile(); },
      error: error => { if (!this.disposed) this.state.setState({ error: describeError(error) }); },
    });
    this.socket.start(); void this.reconcile();
    this.timer = setInterval(() => { if (!document.hidden) void this.reconcile(); }, 8000);
    window.addEventListener('online', this.focus);
    window.addEventListener('offline', this.offline);
    document.addEventListener('visibilitychange', this.focus);
  }
  private offline = () => this.state.setState({ connection: 'offline' });
  private focus = () => { if (!document.hidden) { this.presenter.reconcile(); void this.session.ensureFresh().then(() => this.reconcile()).catch(() => {}); } };
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
            const previous = this.state.getState().match;
            if (!previous || match.stateVersion >= previous.stateVersion) {
              this.state.setState({ match });
              if (!previous || match.stateVersion > previous.stateVersion) this.presenter.apply(match, true, this.rolls.has(match.stateVersion));
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
    if (name === 'game:dice_rolled' && event.stateVersion !== undefined) this.rolls.add(event.stateVersion);
    if (this.rolls.size > 100) this.rolls.delete(this.rolls.values().next().value!);
    if (name === 'room:updated' || name === 'room:snapshot') this.acceptRoom(event.payload as Room);
    if (name === 'match:started') this.onMatch((event.payload as EventPayloads['match:started']).matchId);
    if (name.startsWith('game:') || name === 'player:connection_changed') {
      const text = this.describeEvent(name, event.payload as Record<string, unknown>);
      this.state.setState(s => ({ activity: [...s.activity, { id: event.eventId, text }].slice(-35) }));
    }
    // Snapshots are always fetched for this viewer. Events never mutate money or allowedActions.
    void this.reconcile();
  }
  private describeEvent(name: string, p: Record<string, unknown>) {
    const player = this.state.getState().match?.players.find(v => v.playerId === p.playerId);
    const who = player?.username ?? 'Player';
    if (name === 'game:dice_rolled') return `${who} rolled ${(p.dice as number[])?.join(' + ')}.`;
    if (name === 'game:money_changed') return `${who}: ${Number(p.amount) >= 0 ? '+' : ''}$${p.amount}.`;
    if (name === 'game:property_purchased') return `${who} bought a property for $${p.price}.`;
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
    if (!state.match || state.pending || state.animating || (!retry && state.uncertain)) return;
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
      if (receipt.events.some(e => e.type === 'game:dice_rolled')) this.rolls.add(receipt.stateVersion);
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
    this.disposed = true; this.socket?.stop(); this.presenter.dispose();
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== 'undefined') { window.removeEventListener('online', this.focus); window.removeEventListener('offline', this.offline); }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.focus);
  }
}
