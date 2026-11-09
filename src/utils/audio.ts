// Original synthesized effects. Audio follows confirmed events; it never changes game state.
import type { EffectKind } from '../presentation/effectEvents';

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private volume = 0.45;
  private unlocked = false;
  private voices = new Map<OscillatorNode, GainNode>();
  private lastPlayed = new Map<string, number>();
  private listeners = new Set<() => void>();
  public subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  constructor() {
    try {
      this.enabled = localStorage.getItem('monopoly-audio-muted') !== 'true';
      const saved = Number(localStorage.getItem('monopoly-audio-volume') ?? 0.45);
      if (Number.isFinite(saved)) this.volume = Math.max(0, Math.min(1, saved));
    } catch { /* Storage is optional. */ }
  }

  public unlock() {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return;
        this.ctx = new AudioCtor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      this.unlocked = true;
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch { /* Audio failure must never interrupt a game action. */ }
  }

  public setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) this.cancel();
    else this.unlock();
    try { localStorage.setItem('monopoly-audio-muted', String(!value)); } catch {}
    this.listeners.forEach(listener => listener());
  }
  public isEnabled() { return this.enabled; }
  public getVolume() { return this.volume; }
  public setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    try { localStorage.setItem('monopoly-audio-volume', String(this.volume)); } catch {}
    this.listeners.forEach(listener => listener());
  }

  private notes(key: string, frequencies: number[], duration = 0.14, spacing = 0.055, type: OscillatorType = 'sine') {
    const ctx = this.ctx;
    if (!this.enabled || !this.unlocked || !ctx || ctx.state !== 'running' || !this.master || document.hidden) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < (key === 'step' ? 85 : 140)) return;
    this.lastPlayed.set(key, now);
    frequencies.forEach((frequency, index) => {
      if (this.voices.size >= 12) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * spacing;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.master!);
      this.voices.set(oscillator, gain);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    });
  }

  public cancel() {
    for (const [oscillator, gain] of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch {}
      oscillator.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }
  public dispose() {
    this.cancel(); this.master?.disconnect(); this.master = null;
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => {});
    this.ctx = null; this.unlocked = false; this.lastPlayed.clear();
  }

  public playClick() { this.notes('click', [600], 0.055); }
  public playDiceRoll() { this.notes('roll', [360, 220, 310, 160], 0.045, 0.055, 'triangle'); }
  public playCash() { this.notes('cash', [988, 1319]); }
  public playPurchase() { this.notes('purchase', [523, 659, 784, 1047], 0.18); }
  public playUpgrade() { this.notes('upgrade', [440, 554, 659, 880], 0.2); }
  public playCardDraw() { this.notes('card', [330, 660], 0.13); }
  public playStep() { this.notes('step', [440], 0.035); }
  public playAlert() { this.notes('alert', [220, 165], 0.13, 0.07, 'triangle'); }
  public playEvent(kind: EffectKind, amount?: number) {
    if (kind === 'roll') this.playDiceRoll();
    else if (kind === 'dice-land') this.notes('land', [180, 240], 0.055, 0.025, 'triangle');
    else if (kind === 'move') this.playStep();
    else if (kind === 'ownership' || kind === 'trade') this.playPurchase();
    else if (kind === 'build') this.playUpgrade();
    else if (kind === 'money') amount && amount > 0 ? this.playCash() : this.notes('payment', [660, 440], 0.1);
    else if (kind === 'turn') this.notes('turn', [659, 880], 0.12);
    else if (kind === 'card' || kind === 'raid' || kind === 'auction') this.playCardDraw();
    else if (kind === 'jail' || kind === 'bankrupt' || kind === 'mortgage') this.playAlert();
    else if (kind === 'victory') this.notes('victory', [523, 659, 784, 1047, 1319], 0.26);
  }
}
export const sounds = new SoundSystem();
