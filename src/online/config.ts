import { SessionManager } from './sessionManager';
const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
export const API_URL = (env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const SOCKET_URL = env.VITE_SOCKET_URL || (API_URL.startsWith('http') ? `${new URL(API_URL).origin}/game` : '/game');
export const session = new SessionManager(API_URL);
