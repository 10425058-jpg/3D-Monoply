import { io, type Socket } from 'socket.io-client';
import type { Connection, Envelope, EventPayloads } from './types';
import type { SessionManager } from './sessionManager';
import { ApiError } from './apiClient';

export const GAME_EVENTS: (keyof EventPayloads)[] = [
  'room:snapshot', 'room:updated', 'room:host_changed', 'match:started', 'match:snapshot',
  'game:dice_rolled', 'game:player_moved', 'game:property_purchased', 'game:rent_paid', 'game:money_changed',
  'game:card_resolved', 'game:jail_changed', 'game:turn_changed', 'game:paused', 'game:resumed',
  'game:player_bankrupt', 'game:finished', 'game:abandoned', 'player:connection_changed',
];
export class SocketClient {
  private socket: Socket | null = null;
  private unsubscribe: (() => void) | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptionRetry: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  constructor(private readonly url: string, private readonly session: SessionManager,
    private readonly target: { roomId?: string; matchId?: string },
    private readonly callbacks: {
      connection: (state: Connection) => void;
      event: (name: keyof EventPayloads, event: Envelope) => void;
      reconcile: () => void;
      error: (error: unknown) => void;
    }, private readonly factory: typeof io = io) {}
  start() {
    let lastToken: string | null = null;
    const connect = () => {
      const token = this.session.getSnapshot().accessToken;
      if (lastToken === token) return;
      lastToken = token;
      this.socket?.removeAllListeners(); this.socket?.disconnect(); this.socket = null;
      if (!token || this.disposed) return;
      this.callbacks.connection('connecting');
      const socket = this.factory(this.url, { auth: { token }, autoConnect: false, reconnectionDelayMax: 5000 });
      this.socket = socket;
      socket.on('connect', async () => {
        try {
          for (const [kind, id] of [['room', this.target.roomId], ['match', this.target.matchId]] as const) {
            if (!id) continue;
            const response = await socket.timeout(8000).emitWithAck(`${kind}:join`, { [`${kind}Id`]: id });
            if (!response?.ok) throw new ApiError(response?.error?.code ?? 'UNAVAILABLE');
          }
          if (socket === this.socket && !this.disposed) { this.callbacks.connection('connected'); this.callbacks.reconcile(); }
        } catch (error) {
          if (!this.disposed && socket === this.socket) {
            this.callbacks.connection('reconnecting'); this.callbacks.error(error);
            // A lost acknowledgement must not strand an otherwise connected socket.
            if (!(error instanceof ApiError && ['FORBIDDEN', 'ROOM_NOT_FOUND', 'MATCH_NOT_FOUND'].includes(error.code))) {
              if (this.subscriptionRetry) clearTimeout(this.subscriptionRetry);
              this.subscriptionRetry = setTimeout(() => { if (!this.disposed && socket === this.socket) socket.disconnect().connect(); }, 1500);
            }
          }
        }
      });
      socket.on('disconnect', reason => {
        if (socket !== this.socket || this.disposed) return;
        this.callbacks.connection(navigator.onLine ? 'reconnecting' : 'offline');
        if (reason === 'io server disconnect') this.session.refresh().catch(this.callbacks.error);
      });
      socket.on('connect_error', error => {
        if (socket !== this.socket || this.disposed) return;
        this.callbacks.connection(navigator.onLine ? 'reconnecting' : 'offline');
        if (error.message === 'UNAUTHORIZED') this.session.refresh().catch(this.callbacks.error);
      });
      socket.on('server_error', error => {
        if (error?.code === 'UNAUTHORIZED') this.session.refresh().catch(this.callbacks.error);
        else this.callbacks.error(new ApiError(error?.code ?? 'UNAVAILABLE'));
      });
      for (const name of GAME_EVENTS) socket.on(name, (event: Envelope) => {
        if (!this.disposed && socket === this.socket) this.callbacks.event(name, event);
      });
      socket.connect();
    };
    this.unsubscribe = this.session.subscribe(connect); connect();
    this.refreshTimer = setInterval(() => this.session.ensureFresh().catch(this.callbacks.error), 30000);
  }
  stop() {
    this.disposed = true;
    this.unsubscribe?.(); this.unsubscribe = null;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.subscriptionRetry) clearTimeout(this.subscriptionRetry);
    this.socket?.removeAllListeners(); this.socket?.disconnect(); this.socket = null;
  }
}
