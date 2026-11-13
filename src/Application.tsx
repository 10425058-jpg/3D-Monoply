import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import MainMenu from './menu/MainMenu';
import { session } from './online/config';
import { AuthScreen, Busy, Dialog, ErrorNotice, Lobby, OnlineLayout, Settings, privateInvites, useSession, type Quality } from './online/components';
import { describeError } from './online/apiClient';
import './online/online.css';

const SoloGame = lazy(() => import('./game/SoloGame'));
const RoomScreen = lazy(() => import('./online/RoomScreen'));
const route = () => location.hash.slice(1) || 'home';
export const navigate = (path: string) => { location.hash = path; };
function initialQuality(): Quality {
  try { const value = localStorage.getItem('monopoly-graphics-quality'); if (value === 'low' || value === 'balanced' || value === 'high') return value; } catch {}
  return navigator.hardwareConcurrency <= 4 ? 'low' : 'balanced';
}
export default function Application() {
  const [path, setPath] = useState(route); const auth = useSession();
  const [quality, updateQuality] = useState<Quality>(initialQuality); const [settings, setSettings] = useState(false);
  const [profile, setProfile] = useState(false); const [loggingOut, setLoggingOut] = useState(false); const [logoutError, setLogoutError] = useState<string | null>(null);
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    if (auth.status === 'anonymous') { privateInvites.clear(); setProfile(false); }
    if (auth.user) {
      if (previousUser.current && previousUser.current !== auth.user.id) { privateInvites.clear(); navigate('online/lobby'); }
      previousUser.current = auth.user.id;
    }
  }, [auth.user?.id, auth.status]);
  useEffect(() => { const update = () => setPath(route()); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { if (path.startsWith('online') && auth.status === 'idle') void session.restore(); }, [path, auth.status]);
  const setQuality = (value: Quality) => { updateQuality(value); try { localStorage.setItem('monopoly-graphics-quality', value); } catch {} };
  const home = () => navigate('home'); const solo = () => navigate('solo'); const online = () => navigate('online/lobby');
  const [_, area, id] = path.split('/');
  const uuid = id && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);
  let content: React.ReactNode;
  if (path === 'solo') content = <SoloGame onHome={home} />;
  else if (!path.startsWith('online')) content = <MainMenu solo={solo} online={online} settings={() => setSettings(true)} />;
  else if (auth.status !== 'authenticated') content = <AuthScreen onHome={home} onSuccess={() => { if (area !== 'room' && area !== 'match') online(); }} />;
  else if (area === 'match' && uuid) content = <RoomScreen key={`${auth.user?.id}-${id}`} id={id} match quality={quality} settings={() => setSettings(true)} />;
  else content = <OnlineLayout title={area === 'room' && uuid ? 'Waiting room' : 'Find your next adventure.'}
    subtitle={area === 'room' && uuid ? 'A seat for every friend. A city full of possibilities.' : 'Join a table, invite your friends, and make this little city yours.'}
    home={home} solo={solo} settings={() => setSettings(true)} profile={() => { setLogoutError(null); setProfile(true); }}>
    {area === 'room' && uuid ? <RoomScreen key={`${auth.user?.id}-${id}`} id={id} match={false} quality={quality} settings={() => setSettings(true)} /> : <Lobby key={auth.user?.id} enterRoom={room => navigate(`online/room/${room.roomId}`)} resumeMatch={matchId => navigate(`online/match/${matchId}`)} />}
  </OnlineLayout>;
  return <><Suspense fallback={<main className="game-loading"><Busy text={path === 'solo' ? 'Opening your 3D city…' : 'Opening your room…'} /></main>}>{content}</Suspense>{settings && <Settings quality={quality} setQuality={setQuality} onClose={() => setSettings(false)} />}
    {profile && <Dialog title="Your place in the city" onClose={() => { if (!loggingOut) setProfile(false); }}><div className="city-profile-detail"><span className="city-seat-avatar"><UserRound size={40} /></span><h2>{auth.user?.username}</h2><p>{auth.user?.email}</p><span className="city-status"><ShieldCheck size={15} />Signed in securely</span></div><ErrorNotice message={logoutError} /><button className="city-button outline" disabled={loggingOut} onClick={async () => { setLoggingOut(true); setLogoutError(null); try { await session.logout(); privateInvites.clear(); setProfile(false); home(); } catch (error) { setLogoutError(describeError(error)); } finally { setLoggingOut(false); } }}><LogOut size={17} />{loggingOut ? 'Signing out…' : 'Sign out'}</button></Dialog>}
  </>;
}
