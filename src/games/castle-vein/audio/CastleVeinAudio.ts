/**
 * Castle Vein chiptune — Castlevania-inspired procedural music via Web Audio.
 * Game-local; uses shared AudioContext from engine when available.
 */

type TrackId = 'intro' | 'castle' | 'dungeon' | 'boss';

interface Note {
  freq: number;
  start: number;
  dur: number;
  vol?: number;
}

/** Simple square-wave melody sequencer. */
export class CastleVeinAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentTrack: TrackId | null = null;
  private loopTimer = 0;
  private playing = false;

  init(ctx: AudioContext, master: GainNode): void {
    this.ctx = ctx;
    this.master = master;
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(master);
  }

  /** Ensure audio context is running (browser autoplay policy). */
  private ensureReady(): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  playTrack(id: TrackId): void {
    if (this.currentTrack === id) return;
    this.stopTrack();
    this.currentTrack = id;
    this.playing = true;
    this.loopTimer = 0;
    this.scheduleLoop(id);
  }

  stopTrack(): void {
    this.playing = false;
    this.currentTrack = null;
  }

  /** One-shot SFX — jump, whip, sword, hit, hurt, pickup, save, dash. */
  sfx(type: 'jump' | 'whip' | 'sword' | 'hit' | 'hurt' | 'pickup' | 'save' | 'dash'): void {
    if (!this.ensureReady()) return;
    const t = this.ctx!.currentTime;
    switch (type) {
      case 'jump':
        this.tone(262, t, 0.07, 0.22, 'square');
        this.tone(392, t + 0.04, 0.06, 0.15, 'square');
        break;
      case 'whip':
        this.tone(180, t, 0.04, 0.25, 'square');
        this.tone(90, t + 0.03, 0.08, 0.2, 'square');
        break;
      case 'sword':
        this.tone(440, t, 0.03, 0.22, 'square');
        this.tone(220, t + 0.04, 0.1, 0.18, 'square');
        break;
      case 'hit':
        this.tone(80, t, 0.1, 0.2, 'square');
        break;
      case 'hurt':
        this.tone(150, t, 0.15, 0.18, 'square');
        this.tone(100, t + 0.05, 0.12, 0.12, 'square');
        break;
      case 'pickup':
        this.tone(523, t, 0.06, 0.12, 'square');
        this.tone(784, t + 0.07, 0.08, 0.1, 'square');
        break;
      case 'save':
        this.tone(392, t, 0.1, 0.12, 'square');
        this.tone(523, t + 0.1, 0.1, 0.12, 'square');
        this.tone(659, t + 0.2, 0.15, 0.1, 'square');
        break;
      case 'dash':
        this.tone(440, t, 0.06, 0.1, 'square');
        this.tone(660, t + 0.04, 0.08, 0.08, 'square');
        break;
    }
  }

  private scheduleLoop(id: TrackId): void {
    if (!this.ctx || !this.master || !this.playing) return;
    const notes = TRACKS[id];
    const loopDur = Math.max(...notes.map((n) => n.start + n.dur)) + 0.2;
    const base = this.ctx.currentTime + 0.05;

    for (const n of notes) {
      this.tone(n.freq, base + n.start, n.dur, n.vol ?? 0.08, 'square');
    }

    this.loopTimer = window.setTimeout(() => {
      if (this.playing && this.currentTrack === id) this.scheduleLoop(id);
    }, loopDur * 1000);
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    vol: number,
    type: OscillatorType,
  ): void {
    const out = this.sfxGain ?? this.master;
    if (!this.ctx || !out) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }

  destroy(): void {
    this.stopTrack();
    if (this.loopTimer) clearTimeout(this.loopTimer);
  }
}

// Castlevania-inspired minor-key arpeggios (original compositions)
const E2 = 82.41,
  G2 = 98.0,
  A2 = 110.0,
  B2 = 123.47,
  D3 = 146.83,
  E3 = 164.81,
  G3 = 196.0,
  A3 = 220.0,
  B3 = 246.94,
  D4 = 293.66,
  E4 = 329.63;

const TRACKS: Record<TrackId, Note[]> = {
  intro: [
    { freq: E3, start: 0, dur: 0.15 },
    { freq: G3, start: 0.15, dur: 0.15 },
    { freq: A3, start: 0.3, dur: 0.15 },
    { freq: B3, start: 0.45, dur: 0.2 },
    { freq: E4, start: 0.7, dur: 0.3, vol: 0.1 },
    { freq: A3, start: 1.0, dur: 0.15 },
    { freq: B3, start: 1.15, dur: 0.15 },
    { freq: D4, start: 1.3, dur: 0.4, vol: 0.1 },
  ],
  castle: [
    { freq: E3, start: 0, dur: 0.2 },
    { freq: G3, start: 0.25, dur: 0.2 },
    { freq: B3, start: 0.5, dur: 0.2 },
    { freq: E4, start: 0.75, dur: 0.3 },
    { freq: D4, start: 1.1, dur: 0.2 },
    { freq: B3, start: 1.35, dur: 0.2 },
    { freq: G3, start: 1.6, dur: 0.2 },
    { freq: E3, start: 1.85, dur: 0.4 },
    { freq: A3, start: 2.4, dur: 0.2 },
    { freq: B3, start: 2.65, dur: 0.2 },
    { freq: D4, start: 2.9, dur: 0.4 },
  ],
  dungeon: [
    { freq: A2, start: 0, dur: 0.3, vol: 0.09 },
    { freq: E3, start: 0.35, dur: 0.3 },
    { freq: A3, start: 0.7, dur: 0.3 },
    { freq: G3, start: 1.05, dur: 0.2 },
    { freq: E3, start: 1.3, dur: 0.2 },
    { freq: D3, start: 1.55, dur: 0.4, vol: 0.09 },
    { freq: A2, start: 2.1, dur: 0.3 },
    { freq: B2, start: 2.45, dur: 0.3 },
    { freq: D3, start: 2.8, dur: 0.5 },
  ],
  boss: [
    { freq: E2, start: 0, dur: 0.15, vol: 0.12 },
    { freq: E2, start: 0.2, dur: 0.15, vol: 0.12 },
    { freq: G2, start: 0.4, dur: 0.15, vol: 0.12 },
    { freq: A2, start: 0.55, dur: 0.15, vol: 0.12 },
    { freq: E3, start: 0.75, dur: 0.25, vol: 0.12 },
    { freq: D3, start: 1.05, dur: 0.15, vol: 0.1 },
    { freq: E3, start: 1.25, dur: 0.15, vol: 0.1 },
    { freq: G3, start: 1.45, dur: 0.3, vol: 0.12 },
    { freq: E3, start: 1.85, dur: 0.15, vol: 0.1 },
    { freq: D3, start: 2.05, dur: 0.15, vol: 0.1 },
    { freq: B2, start: 2.25, dur: 0.4, vol: 0.12 },
  ],
};
