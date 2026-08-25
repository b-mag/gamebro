type TrackId = 'title' | 'dock' | 'fight';

interface Note {
  freq: number;
  start: number;
  dur: number;
  vol?: number;
}

export class HookedAudio {
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

  sfx(
    type: 'cast' | 'splash' | 'bite' | 'hook' | 'reel' | 'catch' | 'snap' | 'escape' | 'select',
  ): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    switch (type) {
      case 'cast':
        this.tone(400, t, 0.08, 0.12, 'square');
        this.tone(250, t + 0.08, 0.1, 0.1, 'square');
        break;
      case 'splash':
        this.tone(180, t, 0.06, 0.12, 'square');
        this.tone(120, t + 0.05, 0.08, 0.08, 'square');
        break;
      case 'bite':
        this.tone(600, t, 0.04, 0.14, 'square');
        this.tone(300, t + 0.05, 0.08, 0.12, 'square');
        break;
      case 'hook':
        this.tone(520, t, 0.06, 0.14, 'square');
        this.tone(780, t + 0.06, 0.1, 0.12, 'square');
        break;
      case 'reel':
        this.tone(220, t, 0.03, 0.06, 'square');
        break;
      case 'catch':
        this.tone(392, t, 0.1, 0.12, 'square');
        this.tone(523, t + 0.1, 0.1, 0.12, 'square');
        this.tone(659, t + 0.2, 0.2, 0.1, 'square');
        break;
      case 'snap':
        this.tone(100, t, 0.15, 0.18, 'square');
        this.tone(60, t + 0.08, 0.12, 0.12, 'square');
        break;
      case 'escape':
        this.tone(200, t, 0.1, 0.12, 'square');
        this.tone(150, t + 0.1, 0.12, 0.1, 'square');
        break;
      case 'select':
        this.tone(560, t, 0.05, 0.1, 'square');
        break;
    }
  }

  private scheduleLoop(id: TrackId): void {
    if (!this.ctx || !this.master || !this.playing) return;
    const notes = TRACKS[id];
    const loopDur = Math.max(...notes.map((n) => n.start + n.dur)) + 0.25;
    const base = this.ctx.currentTime + 0.04;
    for (const n of notes) this.tone(n.freq, base + n.start, n.dur, n.vol ?? 0.065, 'square');
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

const G3 = 196.0,
  A3 = 220.0,
  B3 = 246.94,
  D4 = 293.66,
  E4 = 329.63,
  G4 = 392.0,
  E3 = 164.81;

const TRACKS: Record<TrackId, Note[]> = {
  title: [
    { freq: E3, start: 0, dur: 0.2 },
    { freq: G3, start: 0.2, dur: 0.2 },
    { freq: B3, start: 0.4, dur: 0.2 },
    { freq: E4, start: 0.65, dur: 0.35, vol: 0.09 },
    { freq: D4, start: 1.1, dur: 0.25 },
    { freq: B3, start: 1.4, dur: 0.35 },
  ],
  dock: [
    { freq: G3, start: 0, dur: 0.2 },
    { freq: B3, start: 0.25, dur: 0.2 },
    { freq: D4, start: 0.5, dur: 0.2 },
    { freq: E4, start: 0.75, dur: 0.3 },
    { freq: D4, start: 1.15, dur: 0.2 },
    { freq: B3, start: 1.4, dur: 0.2 },
    { freq: A3, start: 1.65, dur: 0.35 },
  ],
  fight: [
    { freq: E4, start: 0, dur: 0.1, vol: 0.09 },
    { freq: E4, start: 0.15, dur: 0.1, vol: 0.09 },
    { freq: G4, start: 0.3, dur: 0.12 },
    { freq: B3, start: 0.5, dur: 0.15 },
    { freq: A3, start: 0.7, dur: 0.15 },
    { freq: G3, start: 0.9, dur: 0.25 },
  ],
};
