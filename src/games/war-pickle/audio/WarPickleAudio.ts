type TrackId = 'title' | 'stage' | 'boss';

interface Note {
  freq: number;
  start: number;
  dur: number;
  vol?: number;
}

export class WarPickleAudio {
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

  sfx(type: 'jump' | 'shoot' | 'hit' | 'hurt' | 'explode' | 'pickup' | 'select'): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    switch (type) {
      case 'jump':
        this.tone(300, t, 0.06, 0.15, 'square');
        this.tone(450, t + 0.04, 0.06, 0.1, 'square');
        break;
      case 'shoot':
        this.tone(700, t, 0.04, 0.14, 'square');
        this.tone(200, t + 0.03, 0.05, 0.1, 'square');
        break;
      case 'hit':
        this.tone(100, t, 0.08, 0.16, 'square');
        break;
      case 'hurt':
        this.tone(140, t, 0.12, 0.18, 'square');
        break;
      case 'explode':
        this.tone(80, t, 0.15, 0.2, 'square');
        this.tone(50, t + 0.1, 0.2, 0.14, 'square');
        break;
      case 'pickup':
        this.tone(520, t, 0.06, 0.12, 'square');
        this.tone(780, t + 0.07, 0.08, 0.1, 'square');
        break;
      case 'select':
        this.tone(640, t, 0.05, 0.1, 'square');
        break;
    }
  }

  private scheduleLoop(id: TrackId): void {
    if (!this.ctx || !this.master || !this.playing) return;
    const notes = TRACKS[id];
    const loopDur = Math.max(...notes.map((n) => n.start + n.dur)) + 0.2;
    const base = this.ctx.currentTime + 0.04;
    for (const n of notes) this.tone(n.freq, base + n.start, n.dur, n.vol ?? 0.08, 'square');
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

const D3 = 146.83,
  F3 = 174.61,
  A3 = 220.0,
  C4 = 261.63,
  D4 = 293.66,
  F4 = 349.23,
  A4 = 440.0;

const TRACKS: Record<TrackId, Note[]> = {
  title: [
    { freq: D3, start: 0, dur: 0.15 },
    { freq: F3, start: 0.15, dur: 0.15 },
    { freq: A3, start: 0.3, dur: 0.15 },
    { freq: D4, start: 0.5, dur: 0.3, vol: 0.1 },
    { freq: C4, start: 0.9, dur: 0.2 },
    { freq: A3, start: 1.15, dur: 0.35 },
  ],
  stage: [
    { freq: D3, start: 0, dur: 0.1, vol: 0.1 },
    { freq: D3, start: 0.15, dur: 0.1, vol: 0.1 },
    { freq: F3, start: 0.3, dur: 0.12 },
    { freq: A3, start: 0.45, dur: 0.12 },
    { freq: D4, start: 0.65, dur: 0.15 },
    { freq: F4, start: 0.85, dur: 0.12 },
    { freq: D4, start: 1.0, dur: 0.12 },
    { freq: A3, start: 1.15, dur: 0.25 },
    { freq: F3, start: 1.5, dur: 0.2 },
    { freq: D3, start: 1.75, dur: 0.3 },
  ],
  boss: [
    { freq: A3, start: 0, dur: 0.1, vol: 0.11 },
    { freq: A3, start: 0.15, dur: 0.1, vol: 0.11 },
    { freq: C4, start: 0.3, dur: 0.12 },
    { freq: D4, start: 0.45, dur: 0.12 },
    { freq: A4, start: 0.65, dur: 0.2, vol: 0.12 },
    { freq: F4, start: 0.9, dur: 0.15 },
    { freq: D4, start: 1.1, dur: 0.35 },
  ],
};
