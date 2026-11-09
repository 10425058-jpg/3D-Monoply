import React from 'react';
import { Camera, Settings, Mail, Banknote, Gem, Crown } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { sounds } from '../../utils/audio';
import { AudioControls } from './AudioControls';

export const TopHeader: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const activePlayer = useGameStore(s => s.players[s.currentPlayerIndex] || s.players[0]);
  const cameraMode = useGameStore(s => s.cameraMode);
  const setCameraMode = useGameStore(s => s.setCameraMode);
  const stars = useGameStore(s => s.metaProgress.stickerStars);
  return <header className="fantasy-header">
    <div className="kingdom-brand"><Crown aria-hidden="true" /><div><strong>3D MONOPOLY</strong>
      <span>MINIATURE CITY EDITION</span></div></div>
    <div className="resource-bar">
      <button className="resource-pill" onClick={() => sounds.playCash()} title="Current player cash balance"
        aria-label={`Cash balance: $${activePlayer?.money.toLocaleString() ?? 0}`}>
        <Banknote aria-hidden="true" /><span key={activePlayer?.money} className="resource-value">${activePlayer?.money.toLocaleString() ?? 0}</span>
      </button>
      <button className="resource-pill stars" onClick={() => sounds.playPurchase()} title="Sticker stars"
        aria-label={`Sticker stars: ${stars}`}><Gem aria-hidden="true" /><span className="resource-value">{stars}</span><small>Stars</small></button>
      <button className="royal-icon camera-toggle" onClick={() => { sounds.playClick(); setCameraMode(cameraMode === 'top' ? 'isometric' : 'top'); }}
        title={cameraMode === 'top' ? 'Switch to 3D Isometric View' : 'Switch to Top-Down View'} aria-label="Toggle overhead camera"><Camera /></button>
      <button className="royal-icon" onClick={() => sounds.playClick()} title="Inbox & Rewards" aria-label="Inbox & Rewards"><Mail /></button>
      <AudioControls compact />
      <button className="royal-icon" onClick={() => { sounds.playClick(); onOpenSettings(); }}
        title="Game Settings & New Game" aria-label="Game Settings & New Game"><Settings /></button>
    </div>
  </header>;
};
