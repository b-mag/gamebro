type TrackId = 'title' | 'stage' | 'boss';

interface Note {
  freq: number;
  start: number;
  dur: number;
  vol?: number;
}

export class HorizonAudio {
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
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(master);
  }

  private ready(): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  playTrack(id: TrackId): void {
    if (this.currentTrack === id) return;
    this.stopTrack();
    this.currentTrack = id;
    this.playing = true;
    this.scheduleLoop(id);
  }

  stopTrack(): void {
    this.playing = false;
    this.currentTrack = null;
    if (this.loopTimer) clearTimeout(this.loopTimer);
  }

  sfx(type: 'shot' | 'laser' | 'hit' | 'hurt' | 'explode' | 'power' | 'select'): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    switch (type) {
      case 'shot':
        this.tone(880, t, 0.04, 0.12, 'square');
        this.tone(440, t + 0.03, 0.05, 0.08, 'square');
        break;
      case 'laser':
        this.tone(220, t, 0.15, 0.18, 'sawtooth');
        this.tone(110, t + 0.08, 0.2, 0.12, 'sawtooth');
        break;
      case 'hit':
        this.tone(160, t, 0.06, 0.15, 'square');
        break;
      case 'hurt':
        this.tone(120, t, 0.12, 0.2, 'square');
        this.tone(80, t + 0.06, 0.1, 0.15, 'square');
        break;
      case 'explode':
        this.tone(90, t, 0.18, 0.22, 'square');
        this.tone(60, t + 0.08, 0.2, 0.15, 'square');
        this.tone(40, t + 0.16, 0.15, 0.1, 'square');
        break;
      case 'power':
        this.tone(523, t, 0.06, 0.12, 'square');
        this.tone(784, t + 0.07, 0.1, 0.1, 'square');
        break;
      case 'select':
        this.tone(660, t, 0.06, 0.1, 'square');
        break;
    }
  }

  private scheduleLoop(id: TrackId): void {
    if (!this.ctx || !this.master || !this.playing) return;
    const notes = TRACKS[id];
    const loopDur = Math.max(...notes.map((n) => n.start + n.dur)) + 0.25;
    const base = this.ctx.currentTime + 0.04;
    for (const n of notes) {
      this.tone(n.freq, base + n.start, n.dur, n.vol ?? 0.07, 'square');
    }
    this.loopTimer = window.setTimeout(() => {
      if (this.playing && this.currentTrack === id) this.scheduleLoop(id);
    }, loopDur * 1000);
  }

  private tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType): void {
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
  }
}

const C3 = 130.81,
  E3 = 164.81,
  G3 = 196.0,
  A3 = 220.0,
  B3 = 246.94,
  C4 = 261.63,
  E4 = 329.63,
  G4 = 392.0,
  A4 = 440.0;

const TRACKS: Record<TrackId, Note[]> = {
  title: [
    { freq: C3, start: 0, dur: 0.2 },
    { freq: E3, start: 0.2, dur: 0.2 },
    { freq: G3, start: 0.4, dur: 0.2 },
    { freq: C4, start: 0.65, dur: 0.35, vol: 0.09 },
    { freq: B3, start: 1.1, dur: 0.2 },
    { freq: A3, start: 1.35, dur: 0.35 },
  ],
  stage: [
    { freq: E3, start: 0, dur: 0.12 },
    { freq: G3, start: 0.15, dur: 0.12 },
    { freq: B3, start: 0.3, dur: 0.12 },
    { freq: E4, start: 0.45, dur: 0.18 },
    { freq: G4, start: 0.7, dur: 0.12 },
    { freq: E4, start: 0.85, dur: 0.12 },
    { freq: B3, start: 1.0, dur: 0.12 },
    { freq: A3, start: 1.15, dur: 0.25 },
    { freq: G3, start: 1.5, dur: 0.15 },
    { freq: E3, start: 1.7, dur: 0.3 },
  ],
  boss: [
    { freq: C3, start: 0, dur: 0.1, vol: 0.1 },
    { freq: C3, start: 0.15, dur: 0.1, vol: 0.1 },
    { freq: E3, start: 0.3, dur: 0.12, vol: 0.1 },
    { freq: G3, start: 0.45, dur: 0.12, vol: 0.1 },
    { freq: A4, start: 0.65, dur: 0.2, vol: 0.11 },
    { freq: G4, start: 0.9, dur: 0.15 },
    { freq: E4, start: 1.1, dur: 0.15 },
    { freq: C4, start: 1.3, dur: 0.35, vol: 0.1 },
  ],
};
