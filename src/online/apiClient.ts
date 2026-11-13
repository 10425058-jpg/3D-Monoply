export class ApiError extends Error {
  constructor(public code: string, public status = 0) { super(errorMessage(code)); this.name = 'ApiError'; }
}
const messages: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.', INVALID_CREDENTIALS: 'Email or password is incorrect.',
  CSRF_INVALID: 'Your session changed in another tab. Please try again.', USERNAME_TAKEN: 'That username is already taken.',
  EMAIL_TAKEN: 'That email is already registered.', ROOM_FULL: 'This room is full.', ROOM_ALREADY_STARTED: 'This match has already started.',
  ROOM_CLOSED: 'This room has closed. Create a new room to play again.', INVALID_INVITE_CODE: 'That invite code is incorrect.',
  ROOM_NOT_FOUND: 'This room could not be found.', MATCH_NOT_FOUND: 'This match could not be found.',
  FORBIDDEN: 'You do not have permission to do that.', RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  STATE_VERSION_CONFLICT: 'The game changed. The latest state has been loaded; choose your action again.',
  CONTENT_VERSION_MISMATCH: 'Your game content is out of date. Reload the page.',
  NOT_YOUR_TURN: 'It is another player’s turn.', INVALID_PHASE: 'That action is no longer available.',
  INVALID_ACTION: 'That action is not available right now.', INSUFFICIENT_FUNDS: 'You do not have enough cash.',
  MATCH_PAUSED: 'The match is paused while players reconnect.', MATCH_ALREADY_TERMINAL: 'This match has ended.',
  PLAYER_NOT_ELIGIBLE_FOR_FORFEIT: 'That player cannot be removed yet. Refresh and try again.',
  VALIDATION_ERROR: 'Please check your details and try again.',
};
export function errorMessage(code: string) { return messages[code] ?? 'Online Service Unavailable. Please try again shortly.'; }
export function describeError(error: unknown) { return error instanceof ApiError ? error.message : errorMessage('UNAVAILABLE'); }
export async function parseEnvelope<T>(response: Response): Promise<T> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new ApiError('UNAVAILABLE', response.status); }
  if (!response.ok) {
    const code = (value as { error?: { code?: unknown } })?.error?.code;
    throw new ApiError(typeof code === 'string' ? code : 'UNAVAILABLE', response.status);
  }
  if (!value || typeof value !== 'object' || !('data' in value) || !('meta' in value)) throw new ApiError('INVALID_RESPONSE');
  return (value as { data: T }).data;
}
export class ApiClient {
  constructor(readonly baseUrl: string, private readonly session: {
    token: () => string | null; refresh: () => Promise<void>;
  }, private readonly transport: typeof fetch = fetch) {}
  async request<T>(path: string, options: { method?: string; body?: unknown; authorized?: boolean; csrf?: string; retry?: boolean; accessToken?: string } = {}): Promise<T> {
    const initialToken = this.session.token();
    const send = async () => {
      const headers: Record<string, string> = {};
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      const token = options.accessToken ?? this.session.token();
      if (options.authorized !== false && token) headers.Authorization = `Bearer ${token}`;
      if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 20000);
      try {
        const transport = this.transport;
        return await parseEnvelope<T>(await transport(`${this.baseUrl}${path}`, {
          method: options.method ?? 'GET', headers, credentials: 'include', cache: 'no-store', signal: abort.signal,
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        }));
      } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('NETWORK_ERROR'); }
      finally { clearTimeout(timeout); }
    };
    try { return await send(); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401 && options.authorized !== false && options.retry !== false) {
        if (this.session.token() === initialToken) await this.session.refresh();
        return send(); // One retry, with the identical action body and UUID.
      }
      throw error;
    }
  }
}
