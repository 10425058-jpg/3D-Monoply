import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Castle, Check, ChevronRight, Copy, Crown, Dice5, DoorOpen, Globe2, Loader2, LockKeyhole, Plus, RefreshCw, Settings2, ShieldCheck, Sparkles, Trophy, UserRound, Users, Wifi, X } from 'lucide-react';
import { useStore } from 'zustand';
import { Scene3D } from '../components/3d/Scene3D';
import { AudioControls } from '../components/ui/AudioControls';
import { useSceneState } from '../presentation/SceneStore';
import { BOARD_SPACES } from '../data/boardData';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../data/cardsData';
import { session } from './config';
import { describeError } from './apiClient';
import type { OnlineController } from './onlineController';
import type { ActionName, Room, RoomPage, RoomSummary } from './types';

export type Quality = 'low' | 'balanced' | 'high';
export const privateInvites = new Map<string, string>();
export const useSession = () => useSyncExternalStore(session.subscribe, session.getSnapshot);
const cash = (value: number) => `$${value.toLocaleString('en-US')}`;
const short = (id: string) => id.slice(0, 8).toUpperCase();
const tokenNames: Record<string, string> = { rubber_duck: 'Golden duck', cat: 'Cat', racecar: 'Racecar', yacht: 'Yacht' };

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const cancel = (event: Event) => { event.preventDefault(); close.current(); };
    dialog.addEventListener('cancel', cancel);
    return () => { dialog.removeEventListener('cancel', cancel); dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="city-dialog" aria-labelledby="city-dialog-title">
    <div className="city-dialog-header"><h2 id="city-dialog-title">{title}</h2><button className="city-icon" onClick={onClose} aria-label="Close dialog"><X /></button></div>{children}
  </dialog>;
}
export function ErrorNotice({ message }: { message: string | null }) {
  return message ? <p className="city-error" role="alert">{message}</p> : null;
}
export function Busy({ text = 'Loading your city…' }: { text?: string }) { return <p className="city-busy" role="status"><Loader2 className="city-spin" />{text}</p>; }
export function Settings({ quality, setQuality, onClose }: { quality: Quality; setQuality: (value: Quality) => void; onClose: () => void }) {
  return <Dialog title="Make yourself at home" onClose={onClose}><p>Choose the right balance for your device.</p>
    <label className="city-field">Graphics quality<select value={quality} onChange={e => setQuality(e.target.value as Quality)}><option value="low">Low · lighter rendering</option><option value="balanced">Balanced</option><option value="high">High · richer detail</option></select></label>
    <AudioControls /><button className="city-button gold" onClick={onClose}>Done<Check size={18} /></button></Dialog>;
}
export function Brand() { return <span className="city-brand"><span className="city-brand-mark"><Castle size={24} /></span><span>MINIATURE CITY<small>A little city. A big adventure.</small></span></span>; }
export function Menu({ quality, solo, online, settings }: { quality: Quality; solo: () => void; online: () => void; settings: () => void }) {
  const auth = useSession();
  return <main className="city-menu">
    <div className="city-menu-world"><Scene3D quality={quality} /></div><div className="city-menu-shade" />
    <header className="city-menu-header"><Brand /><span className="city-profile-pill"><UserRound size={18} />{auth.user?.username ?? 'Welcome, city explorer'}</span></header>
    <section className="city-menu-panel" aria-labelledby="menu-title"><div className="city-menu-crown"><Crown size={38} /></div><span className="city-eyebrow">THE MINIATURE CITY EDITION</span>
      <h1 id="menu-title"><span>3D</span>MINIATURE<br /><strong>CITY</strong></h1><p className="city-menu-tagline">Build · Trade · Invest · Make your move</p>
      <button className="city-menu-play gold" onClick={solo}><UserRound /><span>PLAY SOLO<small>Your city, at your pace</small></span><ChevronRight /></button>
      <button className="city-menu-play purple" onClick={online}><Users /><span>PLAY ONLINE<small>Around the table, from anywhere</small></span><ChevronRight /></button>
      <button className="city-menu-settings" onClick={settings}><Settings2 size={18} />Settings & sound</button><div className="city-menu-footer"><Castle size={16} />A whole world on one board<Sparkles size={16} /></div>
    </section><span className="city-menu-bottom">2–4 players · One beautiful city · Endless possibilities</span>
  </main>;
}
export function AuthScreen({ onHome, onSuccess }: { onHome: () => void; onSuccess: () => void }) {
  const auth = useSession(); const [mode, setMode] = useState<'login' | 'register'>('login');
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const first = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { first.current?.focus(); }, [mode]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (submitting.current) return;
    const fields = new FormData(event.currentTarget); const password = String(fields.get('password'));
    if (mode === 'register' && password !== fields.get('confirm')) { setError('Your passwords do not match.'); return; }
    if (new TextEncoder().encode(password).length > 72) { setError('Use a password of at most 72 bytes.'); return; }
    submitting.current = true; setPending(true); setError(null);
    try { await session.authenticate(mode, { email: String(fields.get('email')).trim(), password,
      ...(mode === 'register' ? { username: String(fields.get('username')).trim() } : {}) }); if (active.current) onSuccess(); }
    catch (error) { setError(describeError(error)); } finally { submitting.current = false; setPending(false); }
  };
  const toggle = () => { setMode(v => v === 'login' ? 'register' : 'login'); setError(null); };
  return <main className="city-shell"><header className="city-shell-header"><Brand /><button className="city-link light" onClick={onHome}><ArrowLeft size={17} />Main menu</button></header>
    <section className="city-auth-stage"><div className="city-auth-intro"><span className="city-eyebrow">GOOD COMPANY. GREAT POSSIBILITIES.</span><h1>There’s a seat<br />for you here.</h1><p>Bring your friends to Miniature City.<br />Your next great game starts together.</p><div className="city-auth-emblem"><Castle size={110} strokeWidth={1} /><span><Users size={29} /></span></div><div className="city-auth-trust"><ShieldCheck size={20} /><span>Secure sessions. Real players.<br />A shared city, wherever you are.</span></div></div>
      <section className="city-auth-card"><span className="city-eyebrow">WELCOME TO THE NEIGHBORHOOD</span><h2>{mode === 'login' ? 'Welcome back.' : 'Make yourself at home.'}</h2><p>{mode === 'login' ? 'Sign in and meet your friends at the board.' : 'Create your account to play with friends.'}</p>
        {auth.status === 'restoring' ? <Busy text="Restoring your secure session…" /> : <form onSubmit={submit} key={mode}>
          {mode === 'register' && <label className="city-field">Username<input ref={first} name="username" autoComplete="username" placeholder="CityExplorer" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title="3–24 letters, numbers or underscores" /></label>}
          <label className="city-field">Email<input ref={mode === 'login' ? first : undefined} name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={255} /></label>
          <label className="city-field">Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} required minLength={mode === 'register' ? 8 : 1} maxLength={72} /></label>
          {mode === 'register' && <label className="city-field">Confirm password<input name="confirm" type="password" autoComplete="new-password" placeholder="Enter your password again" required minLength={8} maxLength={72} /></label>}
          <ErrorNotice message={error ?? auth.error} /><button className={`city-button ${mode === 'login' ? 'purple' : 'gold'}`} disabled={pending}>{pending ? <Loader2 className="city-spin" size={19} /> : null}{pending ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={19} /></button>
          <p className="city-auth-switch">{mode === 'login' ? 'New to the city?' : 'Already a city explorer?'} <button type="button" onClick={toggle} disabled={pending}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        </form>}
      </section></section><footer className="city-shell-footer">MINIATURE CITY EDITION<span>Good games bring us together.</span></footer></main>;
}

export function OnlineLayout({ children, title, subtitle, home, solo, settings, profile }: {
  children: React.ReactNode; title: string; subtitle: string; home: () => void; solo: () => void; settings: () => void; profile: () => void;
}) {
  const auth = useSession();
  return <main className="city-shell"><header className="city-shell-header"><Brand /><span className="city-profile-pill"><span className="city-online-dot" />ONLINE EXPERIENCE</span></header>
    <div className="city-hub"><aside className="city-sidebar"><div className="city-sidebar-title"><Castle /><strong>YOUR CITY<br /><small>YOUR NEXT CHAPTER</small></strong></div>
      <nav aria-label="Main navigation"><button onClick={home}><Castle size={19} />Main menu</button><button onClick={solo}><UserRound size={19} />Play Solo</button><span aria-current="page"><Users size={19} />Play Online</span><button onClick={profile}><UserRound size={19} />My profile</button><button onClick={settings}><Settings2 size={19} />Settings</button></nav>
      <button className="city-sidebar-profile" onClick={profile}><span className="city-avatar">{auth.user?.username.slice(0, 1).toUpperCase()}</span><span><strong>{auth.user?.username}</strong><small>City explorer</small></span></button></aside>
      <section className="city-hub-content"><div className="city-page-heading"><div><span className="city-eyebrow">LET’S PLAY TOGETHER</span><h1>{title}</h1><p>{subtitle}</p></div><span className="city-status"><span className="city-online-dot" />Online</span></div>{children}</section></div>
    <footer className="city-shell-footer">MINIATURE CITY EDITION<span>2–4 friends. One shared adventure.</span></footer></main>;
}
export function Lobby({ enterRoom }: { enterRoom: (room: Room) => void }) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'join' | null>(null); const [pending, setPending] = useState(false);
  const generation = useRef(0); const lock = useRef(false);
  const mounted = useRef(true);
  const load = async (next?: string) => {
    const request = ++generation.current; setLoading(true); setError(null);
    try { const page = await session.api.request<RoomPage>(`/rooms?limit=20${next ? `&cursor=${encodeURIComponent(next)}` : ''}`);
      if (request === generation.current) { setRooms(old => next ? [...new Map([...old, ...page.items].map(r => [r.roomId, r])).values()] : page.items); setCursor(page.nextCursor); }
    } catch (error) { if (request === generation.current) setError(describeError(error)); }
    finally { if (request === generation.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; ++generation.current; }; }, []);
  const run = async (fn: () => Promise<Room>) => {
    if (lock.current) return; lock.current = true; setPending(true); setError(null);
    try { const room = await fn(); if (mounted.current) enterRoom(room); } catch (error) { if (mounted.current) setError(describeError(error)); }
    finally { lock.current = false; setPending(false); }
  };
  return <><div className="city-lobby-actions"><button className="city-button gold" onClick={() => { setError(null); setModal('create'); }}><Plus size={20} />Create a room</button><button className="city-button outline" onClick={() => { setError(null); setModal('join'); }}><LockKeyhole size={18} />Join private</button><button className="city-button outline city-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={18} className={loading ? 'city-spin' : ''} />Refresh</button></div>
    <div className="city-list-heading"><h2>Public rooms</h2><span>Find your next game</span></div><ErrorNotice message={modal ? null : error} />
    {loading && rooms.length === 0 ? <Busy text="Finding a table for you…" /> : rooms.length === 0 ? <div className="city-empty"><Users size={44} /><h3>A new city is waiting.</h3><p>{error && !modal ? 'The online service could not be reached. Try refreshing.' : 'No public rooms just yet. Create one and invite a friend.'}</p><button className="city-button outline" onClick={() => setModal('create')}>Start the first room<Plus size={18} /></button></div> : <div className="city-room-list">{rooms.map((room, index) => <article className="city-room-row" key={room.roomId}>
      <span className={`city-room-icon tone-${index % 3}`}><Castle size={26} /></span><div><h3>Central Castle <small>#{short(room.roomId)}</small></h3><p><Users size={14} />{room.memberCount} / {room.maxPlayers} players<span>·</span>Miniature City</p></div><span className="city-status">Waiting</span><button className="city-button blue" disabled={pending || room.memberCount >= room.maxPlayers} onClick={() => void run(() => session.api.request<Room>(`/rooms/${room.roomId}/join`, { method: 'POST', body: {} }))}>{room.memberCount >= room.maxPlayers ? 'Full' : 'Join'}<ArrowRight size={18} /></button></article>)}</div>}
    {cursor && <button className="city-button outline city-load-more" disabled={loading} onClick={() => void load(cursor)}>Load more rooms</button>}
    <div className="city-lobby-note"><ShieldCheck size={20} /><p>Your friends, your table.<span>Use a private room to play with an invitation code.</span></p></div>
    {modal && <Dialog title={modal === 'create' ? 'Start something great.' : 'Your friends saved you a seat.'} onClose={() => { if (!pending) setModal(null); }}><form onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      void run(async () => {
        if (modal === 'join') return session.api.request<Room>(`/rooms/${String(f.get('roomId')).trim().toLowerCase()}/join`, { method: 'POST', body: { inviteCode: String(f.get('inviteCode')).trim() } });
        const result = await session.api.request<{ room: Room; inviteCode?: string }>('/rooms', { method: 'POST', body: { mapId: 'central-castle', maxPlayers: Number(f.get('players')), isPrivate: f.get('visibility') === 'private' } });
        if (result.inviteCode && mounted.current) privateInvites.set(result.room.roomId, result.inviteCode);
        return result.room;
      });
    }}>{modal === 'create' ? <><p>One beautiful board. Room for your favorite people.</p><label className="city-field">Map<select name="map"><option value="central-castle">Central Castle</option></select></label><fieldset className="city-field"><legend>Players</legend><div className="city-choice-row">{[2, 3, 4].map(n => <label key={n}><input type="radio" name="players" value={n} defaultChecked={n === 4} /><span>{n} players</span></label>)}</div></fieldset><fieldset className="city-field"><legend>Visibility</legend><div className="city-choice-row"><label><input type="radio" name="visibility" value="public" defaultChecked /><span><Globe2 size={15} />Public</span></label><label><input type="radio" name="visibility" value="private" /><span><LockKeyhole size={15} />Private</span></label></div></fieldset></> : <><p>Ask your host for the room ID and invitation code.</p><label className="city-field">Room ID<input name="roomId" placeholder="Paste the full room ID" required pattern="[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}" /></label><label className="city-field">Invite code<input name="inviteCode" placeholder="Enter your private invite code" autoComplete="off" required maxLength={128} /></label><p className="city-info">Private codes come from your host. They never appear in the public lobby.</p></>}
      <ErrorNotice message={error} /><button className="city-button gold" disabled={pending}>{pending ? 'One moment…' : modal === 'create' ? 'Create room' : 'Join room'}<ArrowRight size={18} /></button></form></Dialog>}
  </>;
}

export function WaitingRoom({ controller, onLeave }: { controller: OnlineController; onLeave: () => void }) {
  const state = useStore(controller.state); const auth = useSession(); const [copy, setCopy] = useState('Copy invite');
  const [invite, setInvite] = useState<string | null>(() => privateInvites.get(state.room?.roomId ?? '') ?? null);
  const room = state.room;
  useEffect(() => { if (room) setInvite(privateInvites.get(room.roomId) ?? null); }, [room?.roomId]);
  if (!room) return <><Busy text="Opening your waiting room…" /><ErrorNotice message={state.error} /><button className="city-button outline" onClick={onLeave}>Back to lobby</button></>;
  const me = room.members.find(m => m.userId === auth.user?.id); const host = room.hostUserId === auth.user?.id;
  const ready = room.status === 'WAITING' && room.members.length >= 2 && room.members.every(m => m.isReady);
  return <><div className="city-waiting-toolbar"><span className="city-room-id">ROOM #{short(room.roomId)}</span><span>{room.isPrivate ? <LockKeyhole size={15} /> : <Globe2 size={15} />}{room.isPrivate ? 'Private' : 'Public'} · Central Castle · {room.members.length}/{room.maxPlayers} players</span></div>
    <div className="city-seats">{Array.from({ length: room.maxPlayers }, (_, seat) => { const member = room.members.find(m => m.seatOrder === seat);
      return <article className={`city-seat ${member ? '' : 'empty'}`} key={seat}><span className="city-seat-number">SEAT {seat + 1}</span><span className="city-seat-avatar" style={member ? { background: member.color } : undefined}>{member ? member.avatarUrl ? <img src={member.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <UserRound size={42} /> : <Plus size={38} />}</span><h2>{member?.username ?? 'Open seat'}</h2><p>{member ? tokenNames[member.token] : 'Good company goes here'}</p><div className="city-seat-badges">{member ? <><span className={member.isHost ? 'city-badge host' : 'city-badge'}>{member.isHost ? <Crown size={13} /> : null}{member.isHost ? 'Host' : 'Player'}</span><span className={`city-badge ${member.isReady ? 'ready' : ''}`}>{member.isReady ? <Check size={13} /> : null}{member.isReady ? 'Ready' : 'Not ready'}</span></> : <span className="city-badge">Waiting for a friend</span>}</div></article>;
    })}</div>
    {room.isPrivate && host && <section className="city-invite"><div><span className="city-eyebrow">INVITE YOUR PEOPLE</span><strong>{invite ?? 'Generate a new invitation code'}</strong><small>Room ID: {room.roomId}</small></div><div><button className="city-button outline" disabled={!invite || !!state.pending} onClick={async () => { try { await navigator.clipboard.writeText(`Room ID: ${room.roomId}\nInvite code: ${invite}`); setCopy('Copied!'); } catch { setCopy('Select and copy the code above'); } }}><Copy size={17} />{copy}</button><button className="city-link" disabled={!!state.pending} onClick={() => void controller.roomAction('rotate', async () => { const result = await session.api.request<{ inviteCode: string }>(`/rooms/${room.roomId}/invite/rotate`, { method: 'POST', body: {} }); if (!controller.isActive) return; privateInvites.set(room.roomId, result.inviteCode); setInvite(result.inviteCode); setCopy('Copy invite'); })}>Replace code</button></div></section>}
    <ErrorNotice message={state.error} /><div className="city-waiting-footer"><button className="city-link" disabled={!!state.pending} onClick={() => void controller.roomAction('leave', async () => { await session.api.request(`/rooms/${room.roomId}/leave`, { method: 'POST', body: {} }); privateInvites.delete(room.roomId); if (controller.isActive) onLeave(); })}><ArrowLeft size={17} />Leave room</button><span className={`city-connection ${state.connection}`}>{state.connection === 'connected' ? <Wifi size={16} /> : <RefreshCw size={16} />}{state.connection === 'connected' ? 'Everyone’s updates, in real time' : 'Reconnecting to your room…'}</span><div>{host ? <button className="city-button gold" disabled={!ready || !!state.pending || state.connection !== 'connected'} onClick={() => void controller.roomAction('start', async () => { const response = await session.api.request<{ matchId: string }>(`/rooms/${room.roomId}/start`, { method: 'POST', body: { rulesetId: 'mini-v1', contentVersion: 'central-castle@1' } }); if (controller.isActive) location.hash = `online/match/${response.matchId}`; })}>{state.pending === 'start' ? 'Starting…' : 'Start game'}<ArrowRight size={18} /></button> : <button className={`city-button ${me?.isReady ? 'outline' : 'purple'}`} disabled={!!state.pending || room.status !== 'WAITING'} onClick={() => void controller.roomAction('ready', async () => controller.acceptRoom(await session.api.request<Room>(`/rooms/${room.roomId}/ready`, { method: 'PATCH', body: { isReady: !me?.isReady } })))}>{me?.isReady ? 'Not ready' : 'I’m ready'}<Check size={18} /></button>}</div></div>
    <p className="city-waiting-hint">{host ? ready ? 'Your city is ready. Let the adventure begin.' : 'At least two players, and everyone ready. Then it’s game time.' : 'Get ready, then your host can start the game.'}</p></>;
}

const labels: Record<ActionName, string> = { 'roll-dice': 'Roll dice', 'buy-property': 'Buy property', 'decline-property': 'Pass on property', 'end-turn': 'End turn', 'pay-jail-bail': 'Pay $50 bail', 'use-jail-card': 'Use jail card', forfeit: 'Forfeit', 'forfeit-player': 'Forfeit absent player', abandon: 'Abandon match' };
export function OnlineMatch({ controller, quality, settings, onLobby }: { controller: OnlineController; quality: Quality; settings: () => void; onLobby: () => void }) {
  const state = useStore(controller.state); const auth = useSession(); const match = state.match;
  const selectedId = useSceneState(s => s.selectedSpaceId); const select = useSceneState(s => s.selectSpace);
  const [confirm, setConfirm] = useState<{ action: ActionName; target?: string } | null>(null);
  const [activity, setActivity] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(() => window.innerWidth > 760);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const resize = () => setPlayersOpen(!query.matches);
    query.addEventListener('change', resize); return () => query.removeEventListener('change', resize);
  }, []);
  if (!match) return <main className="city-shell"><Busy text="Rejoining the city…" /><ErrorNotice message={state.error} /><button className="city-button outline" onClick={onLobby}>Back to lobby</button></main>;
  const active = match.players.find(p => p.playerId === match.currentPlayerId);
  const viewer = match.players.find(p => p.userId === auth.user?.id);
  const terminal = match.status === 'FINISHED' || match.status === 'ABANDONED';
  const selected = selectedId === null ? null : BOARD_SPACES[selectedId];
  const owner = match.players.find(p => p.playerId === match.properties.find(p => p.spaceId === selectedId)?.ownerPlayerId);
  const card = match.lastCardResolved ? [...CHANCE_CARDS, ...COMMUNITY_CHEST_CARDS].find(c => c.id === match.lastCardResolved?.cardId) : null;
  const disabled = !!state.pending || state.animating || !!state.uncertain || state.connection !== 'connected';
  const actions = match.allowedActions.filter(a => !['forfeit', 'forfeit-player', 'abandon'].includes(a));
  return <main className="city-match"><div className="world-layer"><Scene3D quality={quality} /></div><div className="city-match-vignette" />
    <header className="city-match-header"><Brand /><div className="city-match-turn"><span className="city-eyebrow">ONLINE · MINI-V1 · TURN {match.turnNumber}</span><strong>{terminal ? 'Thanks for playing.' : match.status === 'PAUSED' ? 'The city is taking a breath.' : `${active?.username ?? 'Player'}’s turn`}</strong></div><span className={`city-connection ${state.connection}`} role="status"><Wifi size={17} />{state.connection === 'connected' ? 'Connected' : state.connection === 'offline' ? 'Offline' : 'Reconnecting…'}</span><button className="city-icon" onClick={settings} aria-label="Settings"><Settings2 /></button></header>
    <details className="city-match-players" open={playersOpen} onToggle={event => setPlayersOpen(event.currentTarget.open)}><summary><Users size={18} />Players <span>{match.players.length}</span></summary><div>{match.players.map(p => <article className={`city-match-player ${p.playerId === match.currentPlayerId ? 'active' : ''} ${p.isBankrupt ? 'eliminated' : ''}`} key={p.playerId}>
      <span className="city-avatar" style={{ background: p.color }}>{p.username[0].toUpperCase()}</span><div><strong>{p.username}{p.userId === auth.user?.id ? ' (you)' : ''}</strong><b>{cash(p.money)}</b><small>{tokenNames[p.token]} · {match.properties.filter(v => v.ownerPlayerId === p.playerId).length} properties{p.inJail ? ' · In jail' : ''}</small><span>{p.isBankrupt ? 'Eliminated' : p.connectionStatus === 'DISCONNECTED' ? 'Disconnected' : p.playerId === match.currentPlayerId ? 'Taking a turn' : 'Waiting'}</span></div></article>)}</div></details>
    {(state.connection !== 'connected' || match.status === 'PAUSED') && !terminal && <aside className="city-reconnect" role="status"><RefreshCw className="city-spin" size={23} /><div><strong>{state.connection !== 'connected' ? 'Finding our way back…' : 'Waiting for friends to reconnect'}</strong><p>Your last committed state is safe on the server. {match.status === 'PAUSED' ? 'The same game resumes when everyone returns.' : 'We’ll continue as soon as the connection returns.'}</p></div><button className="city-link" onClick={() => void controller.reconcile()}>Refresh</button></aside>}
    {selected && !terminal && <aside className="city-inspector"><button className="city-icon" aria-label="Close property" onClick={() => select(null)}><X size={17} /></button><span className="city-eyebrow">AROUND THE BOARD</span><h2 style={{ borderTopColor: selected.colorHex }}>{selected.name}</h2><p>{selected.price ? `${cash(selected.price)} · ${owner?.username ?? 'Unowned'}` : selected.type.replace(/_/g, ' ')}</p>{selected.rent && <small>Base rent {cash(selected.rent[0])}</small>}</aside>}
    <aside className="city-match-tools"><button className="city-button outline" onClick={() => setActivity(v => !v)}>{activity ? 'Close activity' : 'City activity'}</button>{match.allowedActions.includes('forfeit') && <button className="city-link" disabled={disabled} onClick={() => setConfirm({ action: 'forfeit' })}><DoorOpen size={16} />Forfeit</button>}{viewer?.isBankrupt && <button className="city-link" onClick={onLobby}>Back to lobby</button>}</aside>
    {activity && <aside className="city-activity"><h2>City activity</h2>{state.activity.length ? <ol>{state.activity.map(e => <li key={e.id}>{e.text}</li>)}</ol> : <p>Moves and moments will appear here.</p>}<small>State version {match.stateVersion}</small></aside>}
    <section className="city-online-dock" aria-label="Your actions"><ErrorNotice message={state.error} />
      {state.uncertain && <div className="city-info" role="status">We couldn’t confirm your last action. Retry it safely.<button className="city-link" disabled={!!state.pending} onClick={() => void controller.act(state.uncertain!.action, {}, true)}>Retry {labels[state.uncertain.action]}</button></div>}
      {card && <details className="city-last-card" key={`${card.id}-${match.lastCardResolved?.stateVersion}`} open><summary>{card.deck === 'chance' ? 'Chance' : 'Community Chest'} · {card.title}</summary><p>{card.description}</p></details>}
      <div className="city-dock-inner"><div className="city-dice-result"><Dice5 size={28} /><div><strong>{match.dice ? match.dice.values.join(' + ') : 'Make your move'}</strong><small>{state.animating ? 'Playing your move…' : match.dice ? 'Server result' : 'Your city awaits'}</small></div></div><div className="city-dock-actions">{actions.length ? actions.map(action => <button className={`city-button ${action === 'roll-dice' ? 'gold' : action === 'decline-property' ? 'outline' : 'blue'}`} key={action} disabled={disabled} onClick={() => void controller.act(action, { ...(['buy-property', 'decline-property'].includes(action) ? { spaceId: match.pendingPurchaseSpaceId! } : {}), ...(action === 'use-jail-card' ? { cardId: viewer?.heldJailCardIds[0] } : {}) })}>{state.pending === action ? 'One moment…' : labels[action]}{action === 'buy-property' && match.pendingPurchaseSpaceId !== null ? ` · ${cash(BOARD_SPACES[match.pendingPurchaseSpaceId].price ?? 0)}` : ''}</button>) : <span className="city-waiting-action">{terminal ? 'Match complete' : match.status === 'PAUSED' ? 'Game paused' : `Enjoy the city. ${active?.username ?? 'Your friend'} is playing.`}</span>}</div></div>
      {match.allowedActions.includes('forfeit-player') && <div className="city-host-actions"><label>Disconnected player<select id="absent-player">{match.players.filter(p => p.playerId !== viewer?.playerId && !p.isBankrupt && p.connectionStatus === 'DISCONNECTED').map(p => <option value={p.playerId} key={p.playerId}>{p.username}</option>)}</select></label><button className="city-link" disabled={disabled} onClick={() => setConfirm({ action: 'forfeit-player', target: (document.getElementById('absent-player') as HTMLSelectElement).value })}>Forfeit absent player</button></div>}
      {match.allowedActions.includes('abandon') && <button className="city-link" disabled={disabled} onClick={() => setConfirm({ action: 'abandon' })}>Abandon paused match</button>}
    </section>
    {confirm && <Dialog title={confirm.action === 'forfeit' ? 'Leave this adventure?' : confirm.action === 'abandon' ? 'End the match for everyone?' : 'Remove the absent player?'} onClose={() => setConfirm(null)}><p>{confirm.action === 'forfeit' ? 'You’ll forfeit your cash and properties. The other players can continue.' : confirm.action === 'abandon' ? 'This paused match will end without a winner.' : 'The server will check the player’s disconnect grace period before forfeiting them.'}</p><div className="city-dialog-actions"><button className="city-button outline" onClick={() => setConfirm(null)}>Keep playing</button><button className="city-button purple" onClick={() => { void controller.act(confirm.action, confirm.target ? { targetPlayerId: confirm.target } : {}); setConfirm(null); }}>{labels[confirm.action]}</button></div></Dialog>}
    {terminal && <Dialog title={match.status === 'ABANDONED' ? 'Until next time.' : 'A little city. A big victory.'} onClose={onLobby}><div className="city-results"><Trophy size={62} /><span className="city-eyebrow">{match.status === 'ABANDONED' ? 'MATCH ABANDONED' : 'MATCH FINISHED'}</span><h2>{match.status === 'ABANDONED' ? 'This adventure has ended.' : `${match.players.find(p => p.playerId === match.winnerPlayerId)?.username} wins!`}</h2><p>{match.status === 'ABANDONED' ? 'No winner was declared.' : match.finishReason === 'TURN_LIMIT' ? 'The city’s wealthiest explorer after 80 turns.' : 'The last explorer standing.'}</p>
      {match.standings?.map(row => <div className="city-result-row" key={row.playerId}><strong>{row.rank}. {match.players.find(p => p.playerId === row.playerId)?.username}</strong><span>{cash(row.netWorth)}</span></div>)}<button className="city-button purple" onClick={onLobby}>Back to lobby<ArrowRight size={18} /></button></div></Dialog>}
  </main>;
}
