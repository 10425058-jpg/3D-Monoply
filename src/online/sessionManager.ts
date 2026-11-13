import type { AuthResponse, SessionTokens, User } from './types';
import { ApiClient, ApiError } from './apiClient';

export interface SessionState { user: User | null; accessToken: string | null; status: 'idle' | 'restoring' | 'authenticated' | 'anonymous'; error: string | null }
/** All credentials are memory-only. Web Locks serialize rotating cookies across tabs. */
export class SessionManager {
  readonly api: ApiClient;
  private state: SessionState = { user: null, accessToken: null, status: 'idle', error: null };
  private csrf: string | null = null;
  private expiresAt = 0;
  private refreshFlight: Promise<void> | null = null;
  private restoreFlight: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private generation = 0;
  private channel: BroadcastChannel | null = null;
  constructor(baseUrl: string, transport: typeof fetch = fetch) {
    this.api = new ApiClient(baseUrl, { token: () => this.state.accessToken, refresh: () => this.refresh() }, transport);
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('miniature-city-session');
      this.channel.onmessage = event => { if (event.data === 'signed-out') this.clear(); };
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
  async logout() {
    await this.refreshFlight?.catch(() => {});
    try {
      await this.cookieLock(async () => {
        const { csrfToken } = await this.api.request<{ csrfToken: string }>('/auth/csrf', { authorized: false });
        await this.api.request('/auth/logout', { method: 'POST', body: {}, authorized: false, csrf: csrfToken });
      });
    } catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    this.channel?.postMessage('signed-out'); this.clear();
  }
  clear(error: string | null = null) {
    ++this.generation; this.csrf = null; this.expiresAt = 0;
    this.update({ user: null, accessToken: null, status: 'anonymous', error });
  }
}
