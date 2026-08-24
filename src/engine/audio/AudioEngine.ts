/**
 * Web Audio API chiptune synthesizer — Game Boy DMG-inspired 4-channel aesthetic.
 * All sounds are procedurally generated (no external assets required).
 */

type SoundId =
  | 'boot'
  | 'beep'
  | 'beepHigh'
  | 'select'
  | 'siren'
  | 'explosion'
  | 'success'
  | 'wormhole'
  | 'ambient';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenActive = false;
  private muted = false;

  /** Must be called from a user gesture before playing sounds. */
  async init(): Promise<void> {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /** Expose context for game-specific music sequencers. */
  getContext(): AudioContext | null {
    return this.ctx;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.35;
    }
  }

  play(id: SoundId): void {
    if (!this.ctx || this.muted) return;
    void this.resume();

    switch (id) {
      case 'boot':
        this.playBootJingle();
        break;
      case 'beep':
        this.playSquare(440, 0.06, 0.15);
        break;
      case 'beepHigh':
        this.playSquare(880, 0.04, 0.12);
        break;
      case 'select':
        this.playSquare(660, 0.08, 0.2);
        break;
      case 'explosion':
        this.playExplosion();
        break;
      case 'success':
        this.playSuccess();
        break;
      case 'wormhole':
        this.playWormhole();
        break;
      default:
        break;
    }
  }

  /** Classic DMG power-on descending arpeggio. */
  private playBootJingle(): void {
    if (!this.ctx || !this.masterGain) return;
    const notes = [1318.51, 987.77, 739.99, 493.88, 369.99]; // E6 C6 G5 G4 C5-ish
    notes.forEach((freq, i) => {
      const t = this.ctx!.currentTime + i * 0.09;
      this.scheduleSquare(freq, t, 0.07, 0.25 - i * 0.03);
    });
  }

  private playSuccess(): void {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.scheduleSquare(freq, this.ctx!.currentTime + i * 0.1, 0.12, 0.2);
    });
  }

  private playWormhole(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 1.2);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  }

  private playExplosion(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  private playSquare(freq: number, duration: number, volume: number): void {
    if (!this.ctx) return;
    this.scheduleSquare(freq, this.ctx.currentTime, duration, volume);
  }

  private scheduleSquare(freq: number, startTime: number, duration: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /** Start looping Game Boy-style siren (spotting alarm). */
  startSiren(): void {
    if (!this.ctx || !this.masterGain || this.sirenActive) return;
    void this.resume();
    this.sirenActive = true;

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenLfo = this.ctx.createOscillator();

    const lfoGain = this.ctx.createGain();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 600;
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 4;
    lfoGain.gain.value = 200;
    this.sirenGain.gain.value = 0.12;

    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  stopSiren(): void {
    if (!this.sirenActive) return;
    this.sirenActive = false;
    try {
      this.sirenOsc?.stop();
      this.sirenLfo?.stop();
    } catch {
      /* already stopped */
    }
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenGain = null;
  }

  /** Subtle underwater ambient hum. */
  startAmbient(): void {
    if (!this.ctx || !this.masterGain || this.ambientOsc) return;
    void this.resume();
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 55;
    this.ambientGain.gain.value = 0.03;
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    this.ambientOsc.start();
  }

  stopAmbient(): void {
    try {
      this.ambientOsc?.stop();
    } catch {
      /* noop */
    }
    this.ambientOsc = null;
    this.ambientGain = null;
  }

  destroy(): void {
    this.stopSiren();
    this.stopAmbient();
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
