import React from 'react';
import { ArrowRight, Crown, Settings2, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import { useSession } from '../online/useSession';
import './main-menu.css';

interface MainMenuProps {
  solo: () => void;
  online: () => void;
  settings: () => void;
}

/** Decorative artwork and DOM controls only. Gameplay is loaded by the selected route. */
export default function MainMenu({ solo, online, settings }: MainMenuProps) {
  const { user } = useSession();
  return (
    <main className="main-menu" aria-labelledby="main-menu-title">
      <img className="main-menu-art" src={`${import.meta.env.BASE_URL}assets/menu/fantasy-city-menu.jpg`}
        alt="" aria-hidden="true" fetchPriority="high" decoding="async" width="1672" height="941" />
      <div className="main-menu-atmosphere" aria-hidden="true" />
      <header className="main-menu-header">
        <span className="main-menu-edition"><span><Crown size={18} /></span>THE MINIATURE CITY EDITION</span>
        <span className="main-menu-profile"><UserRound size={17} />{user?.username ?? 'Welcome, city explorer'}</span>
      </header>
      <section className="main-menu-panel">
        <div className="main-menu-logo">
          <span className="main-menu-crown" aria-hidden="true"><span /><Crown /><span /></span>
          <p>A LITTLE CITY. A GRAND ADVENTURE.</p>
          <h1 id="main-menu-title">MINIATURE<strong>CITY</strong></h1>
          <span className="main-menu-ribbon">FANTASY EDITION</span>
        </div>
        <p className="main-menu-invitation">A whole world of possibility.<br />Your next move starts here.</p>
        <div className="main-menu-actions">
          <button className="main-menu-play solo" onClick={solo}>
            <span className="main-menu-button-icon"><UserRound /></span>
            <span>PLAY SOLO<small>Your city. Your own adventure.</small></span><ArrowRight />
          </button>
          <button className="main-menu-play online" onClick={online}>
            <span className="main-menu-button-icon"><Users /></span>
            <span>PLAY ONLINE<small>Make memories with friends.</small></span><ArrowRight />
          </button>
          <button className="main-menu-settings" onClick={settings}><Settings2 size={18} />Settings & sound</button>
        </div>
        <span className="main-menu-reassurance"><ShieldCheck size={14} />Solo is always ready. No sign-in needed.</span>
      </section>
      <footer className="main-menu-footer"><span><Sparkles size={14} />A little magic. A lot of possibility.</span><span>2–4 PLAYERS · ONE SHARED ADVENTURE</span></footer>
    </main>
  );
}
