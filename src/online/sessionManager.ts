import type { AuthResponse, SessionTokens, User } from './types';
import { ApiClient, ApiError } from './apiClient';

// This is a non-secret browser marker. It prevents an offline logout from
// silently restoring an unrevoked HttpOnly refresh cookie on the next reload.
const PENDING_LOGOUT_KEY = 'miniature-city-pending-logout';
const readPendingLogout = () => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(PENDING_LOGOUT_KEY) === '1'; } catch { return false; }
};
const writePendingLogout = (pending: boolean) => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (pending) localStorage.setItem(PENDING_LOGOUT_KEY, '1');
    else localStorage.removeItem(PENDING_LOGOUT_KEY);
  } catch { /* Storage denied by browser; best-effort session-only behavior. */ }
};

export interface SessionState { user: User | null; accessToken: string | null; status: 'idle' | 'restoring' | 'authenticated' | 'anonymous'; error: string | null }
/** All credentials are memory-only. Web Locks serialize rotating cookies across tabs. */
export class SessionManager {
  readonly api: ApiClient;
  private state: SessionState = { user: null, accessToken: null, status: readPendingLogout() ? 'anonymous' : 'idle', error: null };
  private csrf: string | null = null;
  private expiresAt = 0;
  private refreshFlight: Promise<void> | null = null;
  private restoreFlight: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private generation = 0;
  private pendingLogout = readPendingLogout();
  private logoutFlight: Promise<void> | null = null;
  private channel: BroadcastChannel | null = null;
  constructor(baseUrl: string, transport: typeof fetch = fetch) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { if (this.pendingLogout || readPendingLogout()) void this.flushPendingLogout().catch(() => {}); });
    }
    this.api = new ApiClient(baseUrl, { token: () => this.state.accessToken, refresh: () => this.refresh() }, transport);
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('miniature-city-session');
      this.channel.onmessage = event => {
        if (event.data === 'signed-out') {
          this.pendingLogout = true;
          writePendingLogout(true);
          this.clear();
          void this.flushPendingLogout().catch(() => {});
        }
      };
    }
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(next: Partial<SessionState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn()); }
  private accept(tokens: SessionTokens, user: User) {
    this.csrf = tokens.csrfToken; this.expiresAt = Date.now() + tokens.expiresIn * 1000;
    this.update({ accessToken: tokens.accessToken, user, status: 'authenticated', error: null });
  }
  private async cookieLock<T>(fn: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('miniature-city-session', fn);
    return fn();
  }
  refresh = (): Promise<void> => {
    if (this.pendingLogout || readPendingLogout()) return Promise.reject(new ApiError('LOGOUT_PENDING', 401));
    if (this.refreshFlight) return this.refreshFlight;
    const generation = this.generation;
    const flight = this.cookieLock(async () => {
      // Always bootstrap inside the lock: another tab may have rotated the cookie/CSRF.
      const { csrfToken } = await this.api.request<{ csrfToken: string }>('/auth/csrf', { authorized: false });
      const tokens = await this.api.request<SessionTokens>('/auth/refresh', {
        method: 'POST', body: {}, csrf: csrfToken, authorized: false,
      });
      const user = await this.api.request<User>('/users/me', { accessToken: tokens.accessToken, retry: false });
      if (generation !== this.generation) throw new ApiError('UNAUTHORIZED', 401);
      this.accept(tokens, user);
    }).catch(error => {
      if (generation === this.generation) this.clear(error instanceof ApiError && error.status !== 401 ? error.message : null);
      throw error;
    }).finally(() => { if (this.refreshFlight === flight) this.refreshFlight = null; });
    this.refreshFlight = flight;
    return flight;
  };
  restore = (): Promise<void> => {
    // After an offline logout, never accept the still-present refresh cookie
    // until the pending server-side revocation has finished.
    if (this.pendingLogout || readPendingLogout()) {
      this.pendingLogout = true;
      this.clear();
      return this.flushPendingLogout().catch(() => {});
    }
    if (this.restoreFlight) return this.restoreFlight;
    if (this.state.status === 'authenticated') return Promise.resolve();
    const generation = this.generation;
    this.update({ status: 'restoring', error: null });
    this.restoreFlight = (async () => {
      try {
        await this.refresh();
      } catch (error) {
        if (generation === this.generation && this.state.status === 'restoring') this.clear(error instanceof ApiError ? error.message : null);
      }
    })().finally(() => { this.restoreFlight = null; });
    return this.restoreFlight;
  };
  async authenticate(mode: 'login' | 'register', fields: { email: string; password: string; username?: string }) {
    // Do not let a later login replace the cookie before old-session revocation:
    // that would silently log out the *new* user when the queued retry runs.
    if (this.pendingLogout || readPendingLogout()) {
      this.pendingLogout = true;
      try { await this.flushPendingLogout(); }
      catch { throw new ApiError('LOGOUT_PENDING', 503); }
    }
    ++this.generation;
    await this.refreshFlight?.catch(() => {});
    const generation = this.generation;
    const response = await this.cookieLock(() => this.api.request<AuthResponse>(`/auth/${mode}`, {
      method: 'POST', body: fields, authorized: false,
    }));
    if (generation !== this.generation) return;
    this.accept(response, response.user);
  }
  async ensureFresh() { if (this.state.accessToken && Date.now() > this.expiresAt - 60000) await this.refresh(); }
  /** Best-effort server revocation while the browser stays signed out.
   * The marker survives reloads, so an offline request cannot be mistaken for
   * successful server logout or used to restore the old session.
   */
  private flushPendingLogout = (): Promise<void> => {
    if (!this.pendingLogout && !readPendingLogout()) return Promise.resolve();
    if (this.logoutFlight) return this.logoutFlight;
    // Wait for an older refresh BEFORE acquiring the cookie lock.
    // Waiting for refresh inside the lock can deadlock another tab's rotation.
    const flight = (async () => {
      await this.refreshFlight?.catch(() => {});
      return this.cookieLock(async () => {
      try {
        const { csrfToken } = await this.api.request<{ csrfToken: string }>('/auth/csrf', { authorized: false });
        await this.api.request('/auth/logout', { method: 'POST', body: {}, authorized: false, csrf: csrfToken });
      } catch (error) {
        // 401 means the refresh cookie is already expired/revoked: safe to finish.
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
      this.pendingLogout = false;
      writePendingLogout(false);
      });
    })().finally(() => { if (this.logoutFlight === flight) this.logoutFlight = null; });
    this.logoutFlight = flight;
    return flight;
  };
  async logout() {
    // Immediate local logout even if the API is offline. Never permit an
    // access JWT to remain usable through this tab after clicking Sign out.
    this.pendingLogout = true;
    writePendingLogout(true);
    this.clear();
    this.channel?.postMessage('signed-out');
    await this.flushPendingLogout().catch(() => {
      // On a later 'online' event, restore, or login attempt, retry revocation.
      // Keep pending marker to block silent session restoration.
    });
  }

  clear(error: string | null = null) {
    ++this.generation; this.csrf = null; this.expiresAt = 0;
    this.update({ user: null, accessToken: null, status: 'anonymous', error });
  }
}
