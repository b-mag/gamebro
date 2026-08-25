type TrackId = 'rain' | 'overworld' | 'temple' | 'item';

interface Note {
  freq: number;
  start: number;
  dur: number;
  vol?: number;
}

export class TemplesAudio {
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
    type: 'slash' | 'hit' | 'hurt' | 'pickup' | 'door' | 'select' | 'fanfare' | 'bush',
  ): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    switch (type) {
      case 'slash':
        this.tone(400, t, 0.04, 0.14, 'square');
        this.tone(200, t + 0.03, 0.06, 0.1, 'square');
        break;
      case 'hit':
        this.tone(90, t, 0.08, 0.16, 'square');
        break;
      case 'hurt':
        this.tone(150, t, 0.12, 0.16, 'square');
        this.tone(100, t + 0.06, 0.1, 0.12, 'square');
        break;
      case 'pickup':
        this.tone(523, t, 0.08, 0.12, 'square');
        this.tone(784, t + 0.1, 0.12, 0.1, 'square');
        break;
      case 'door':
        this.tone(220, t, 0.1, 0.12, 'square');
        this.tone(330, t + 0.1, 0.15, 0.1, 'square');
        break;
      case 'select':
        this.tone(560, t, 0.05, 0.1, 'square');
        break;
      case 'fanfare':
        this.tone(392, t, 0.12, 0.12, 'square');
        this.tone(523, t + 0.12, 0.12, 0.12, 'square');
        this.tone(659, t + 0.24, 0.2, 0.12, 'square');
        break;
      case 'bush':
        this.tone(180, t, 0.05, 0.08, 'square');
        break;
    }
  }

  private scheduleLoop(id: TrackId): void {
    if (!this.ctx || !this.master || !this.playing) return;
    const notes = TRACKS[id];
    const loopDur = Math.max(...notes.map((n) => n.start + n.dur)) + 0.25;
    const base = this.ctx.currentTime + 0.04;
    for (const n of notes) this.tone(n.freq, base + n.start, n.dur, n.vol ?? 0.07, 'square');
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

const E3 = 164.81,
  G3 = 196.0,
  A3 = 220.0,
  B3 = 246.94,
  D4 = 293.66,
  E4 = 329.63,
  G4 = 392.0,
  A2 = 110.0;

const TRACKS: Record<TrackId, Note[]> = {
  rain: [
    { freq: A2, start: 0, dur: 0.4, vol: 0.05 },
    { freq: E3, start: 0.5, dur: 0.4, vol: 0.05 },
    { freq: G3, start: 1.0, dur: 0.5, vol: 0.06 },
    { freq: E3, start: 1.6, dur: 0.4, vol: 0.05 },
  ],
  overworld: [
    { freq: G3, start: 0, dur: 0.15 },
    { freq: B3, start: 0.15, dur: 0.15 },
    { freq: D4, start: 0.3, dur: 0.15 },
    { freq: G4, start: 0.5, dur: 0.25, vol: 0.09 },
    { freq: E4, start: 0.85, dur: 0.15 },
    { freq: D4, start: 1.05, dur: 0.15 },
    { freq: B3, start: 1.25, dur: 0.3 },
    { freq: A3, start: 1.65, dur: 0.2 },
    { freq: G3, start: 1.9, dur: 0.35 },
  ],
  temple: [
    { freq: E3, start: 0, dur: 0.25, vol: 0.08 },
    { freq: G3, start: 0.3, dur: 0.25 },
    { freq: A3, start: 0.6, dur: 0.25 },
    { freq: B3, start: 0.95, dur: 0.35 },
    { freq: A3, start: 1.4, dur: 0.2 },
    { freq: G3, start: 1.65, dur: 0.2 },
    { freq: E3, start: 1.9, dur: 0.4 },
  ],
  item: [
    { freq: D4, start: 0, dur: 0.15 },
    { freq: E4, start: 0.15, dur: 0.15 },
    { freq: G4, start: 0.3, dur: 0.3, vol: 0.1 },
  ],
};
