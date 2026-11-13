import React, { useEffect, useState } from 'react';
import { ArrowRight, Dice5, DoorOpen, RefreshCw, Settings2, Trophy, Users, Wifi, X } from 'lucide-react';
import { useStore } from 'zustand';
import { Scene3D } from '../components/3d/Scene3D';
import { SceneStoreProvider, useSceneState } from '../presentation/SceneStore';
import { PresentationProvider } from '../presentation/PresentationProvider';
import { BOARD_SPACES } from '../data/boardData';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from '../data/cardsData';
import { Brand, Busy, Dialog, ErrorNotice, cash, tokenNames, useSession, type Quality } from './components';
import type { OnlineController } from './onlineController';
import type { ActionName } from './types';
import '../app-ui.css';
import '../fantasy-hud.css';
import '../game-effects.css';

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

/** Loaded only after an authorized REST snapshot confirms the server match. */
export default function OnlineMatchScreen(props: { controller: OnlineController; quality: Quality; settings: () => void; onLobby: () => void }) {
  return <SceneStoreProvider value={props.controller.presenter.store}><PresentationProvider><OnlineMatch {...props} /></PresentationProvider></SceneStoreProvider>;
}