// Original synthesized effects. Audio follows confirmed events; it never changes game state.
import type { EffectChange } from '../presentation/effectEvents';

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
    if (!this.enabled || this.volume === 0 || !this.unlocked || !ctx || ctx.state !== 'running' || !this.master || document.hidden) return;
    const now = performance.now();
    const minimumGap = key === 'step' ? 95 : key === 'dice-impact' ? 57 : 140;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < minimumGap) return;
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
    this.lastPlayed.clear();
  }
  public dispose() {
    this.cancel(); this.master?.disconnect(); this.master = null;
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => {});
    this.ctx = null; this.unlocked = false; this.lastPlayed.clear();
  }

  public playClick() { this.notes('click', [600], 0.055); }
  public playDiceRoll() { this.notes('roll', [225, 340], .038, .045, 'triangle'); }
  public playDiceImpact(beat: number) {
    this.notes('dice-impact', [beat === 0 ? 164 : beat === 1 ? 206 : 265], .052, .02, 'triangle');
  }
  public playCash() { this.notes('cash', [988, 1319]); }
  public playPurchase() { this.notes('purchase', [523, 659, 784, 1047], 0.18); }
  public playUpgrade() { this.notes('upgrade', [440, 554, 659, 880], 0.2); }
  public playCardDraw() { this.notes('card', [330, 660], 0.13); }
  public playStep(arrived = false) {
    if (arrived) this.notes('arrive', [390, 585], .085, .028, 'triangle');
    else this.notes('step', [253], .034, .02, 'triangle');
  }
  public playCollection(direct: boolean) {
    if (direct) this.notes('transfer', [620, 840, 1050], .11, .041);
    else this.playCash();
  }
  public playAlert() { this.notes('alert', [220, 165], 0.13, 0.07, 'triangle'); }
  public playEvent({ kind, amount, cash, dice, developmentLevel, buildingCount, auctionWon, quiet, playerId, damaged }: EffectChange) {
    if (kind === 'roll') this.playDiceRoll();
    else if (kind === 'dice-land') {
      if (dice && dice[0] === dice[1]) this.notes('doubles', [587, 784, 1175], .15, .046);
      else this.notes('land', [264, 396], .066, .031, 'triangle');
    }
    else if (kind === 'ownership' && playerId !== undefined) {
      if (auctionWon) this.notes('gavel', [145, 231, 784, 988], .105, .034, 'triangle');
      else this.playPurchase();
    }
    else if (kind === 'trade') this.notes('trade', [494, 740, 622], .12, .045);
    else if (kind === 'landmark') this.playUpgrade();
    else if (kind === 'build' || kind === 'construction') {
      if (amount !== undefined && amount < 0) this.notes('sale', [520, 661], .11);
      else if (developmentLevel === 3 || buildingCount === 5) this.notes('hotel', [523, 659, 784, 1175], .21, .052);
      else if (developmentLevel === 2) this.notes('apartment', [349, 466, 699], .17);
      else this.notes('house', [255, 440, 587], .12, .052, 'triangle');
    }
    else if (kind === 'money' && (playerId ?? 0) >= 4) {
      if ((amount ?? 0) > 0) this.playCash();
      else this.notes('payment', [550, 367], .09);
    }
    else if (kind === 'turn' && !quiet) this.notes('turn', [550, 734], .105);
    else if (kind === 'card' || kind === 'raid') this.playCardDraw();
    else if (kind === 'auction') this.notes('auction', [298, 410], .065, .07, 'triangle');
    else if (kind === 'jail') this.notes('jail', [268, 180], .09, .05, 'triangle');
    else if (kind === 'heist') this.notes('heist', [185, 277, 554, 831], .14, .058, 'triangle');
    else if (kind === 'shutdown') this.notes('shutdown', damaged ? [158, 115, 86] : [230, 184], .13, .044, 'triangle');
    else if (kind === 'bankrupt') this.notes('bankrupt', [330, 247, 196], .16, .07);
    else if (kind === 'mortgage') this.playAlert();
    else if (kind === 'victory') this.notes('victory', [523, 659, 784, 1047, 1319], 0.26);
    else if (kind === 'transaction' && cash) {
      if (cash.category === 'salary') this.notes('salary', [523, 698, 1047], .13, .04);
      else if (cash.toId !== null) {
        if (cash.toId >= 4) this.playCollection(cash.fromId !== null);
      } else this.notes('payment', [550, 367], .09);
    }
  }
}
export const sounds = new SoundSystem();
