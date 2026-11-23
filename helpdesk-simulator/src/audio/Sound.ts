/**
 * Sons synthétisés avec la Web Audio API (aucun fichier audio nécessaire).
 */
export type SoundName = 'notify' | 'ticket' | 'ring' | 'badge' | 'denied' | 'click' | 'door' | 'coffee' | 'plug' | 'open' | 'close';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  volume = 0.6;

  /** Le contexte audio doit être créé après un geste utilisateur. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number, muted: boolean): void {
    this.volume = v;
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.4, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(start: number, dur: number, vol = 0.3, freq = 800): void {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(this.master);
    src.start(this.ctx.currentTime + start);
  }

  play(name: SoundName): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'notify':
        this.tone(880, 0, 0.12, 'sine', 0.3);
        this.tone(1320, 0.1, 0.18, 'sine', 0.3);
        break;
      case 'ticket':
        this.tone(660, 0, 0.1, 'triangle', 0.35);
        this.tone(990, 0.1, 0.1, 'triangle', 0.35);
        this.tone(1320, 0.2, 0.2, 'triangle', 0.35);
        break;
      case 'ring':
        for (let i = 0; i < 2; i++) {
          for (let k = 0; k < 8; k++) this.tone(k % 2 ? 480 : 440, i * 0.6 + k * 0.05, 0.05, 'square', 0.12);
        }
        break;
      case 'badge':
        this.tone(1800, 0, 0.08, 'square', 0.15);
        this.tone(2400, 0.09, 0.12, 'square', 0.15);
        break;
      case 'denied':
        this.tone(220, 0, 0.3, 'sawtooth', 0.2);
        break;
      case 'click':
        this.tone(1200, 0, 0.03, 'square', 0.12);
        break;
      case 'plug':
        this.noise(0, 0.05, 0.5, 3000);
        this.tone(2000, 0, 0.02, 'square', 0.1);
        break;
      case 'door':
        this.noise(0, 0.25, 0.25, 300);
        break;
      case 'coffee':
        this.noise(0, 1.2, 0.18, 600);
        this.tone(300, 1.2, 0.15, 'sine', 0.2);
        break;
      case 'open':
        this.tone(500, 0, 0.08, 'sine', 0.15, 900);
        break;
      case 'close':
        this.tone(900, 0, 0.08, 'sine', 0.15, 500);
        break;
    }
  }
}

export const sound = new Sound();
