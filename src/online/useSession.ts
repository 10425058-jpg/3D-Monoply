import { useSyncExternalStore } from 'react';
import { session } from './config';

// Shared by the lightweight menu and online UI; never imports gameplay modules.
export const useSession = () => useSyncExternalStore(session.subscribe, session.getSnapshot);
