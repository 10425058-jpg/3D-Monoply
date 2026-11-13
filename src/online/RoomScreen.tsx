import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { session, SOCKET_URL } from './config';
import { OnlineController } from './onlineController';
import { Busy, ErrorNotice, WaitingRoom, type Quality } from './components';

const OnlineMatchScreen = lazy(() => import('./OnlineMatchScreen'));
const navigate = (path: string) => { location.hash = path; };

function ConfirmedMatch({ controller, quality, settings }: { controller: OnlineController; quality: Quality; settings: () => void }) {
  const match = useStore(controller.state, state => state.match);
  const error = useStore(controller.state, state => state.error);
  // A URL alone never loads the game. A successful authorized backend snapshot is required.
  if (!match) return <main className="city-shell"><Busy text="Confirming your match…" /><ErrorNotice message={error} />
    <button className="city-button outline" onClick={() => navigate('online/lobby')}>Back to lobby</button></main>;
  return <Suspense fallback={<main className="game-loading"><Busy text="Opening your 3D city…" /></main>}>
    <OnlineMatchScreen controller={controller} quality={quality} settings={settings} onLobby={() => navigate('online/lobby')} />
  </Suspense>;
}

export default function RoomScreen({ id, match, quality, settings }: { id: string; match: boolean; quality: Quality; settings: () => void }) {
  const [controller, setController] = useState<OnlineController | null>(null);
  useEffect(() => {
    const current = new OnlineController(session, SOCKET_URL, match ? { matchId: id } : { roomId: id }, next => navigate(`online/match/${next}`));
    setController(current); current.start(); return () => current.stop();
  }, [id, match]);
  if (!controller) return <Busy text="Opening your room…" />;
  return match ? <ConfirmedMatch controller={controller} quality={quality} settings={settings} />
    : <WaitingRoom controller={controller} onLeave={() => navigate('online/lobby')} />;
}
