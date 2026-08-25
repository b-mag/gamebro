import type { GameBoyEngine, Game, CanvasRenderer, InputState } from '@/engine';
import { PaletteShade } from '@/engine';
import { HookedAudio } from './audio/HookedAudio';
import {
  drawDockScene,
  drawAngler,
  drawFish,
  drawBobber,
  drawTensionBar,
  type FishKind,
} from './render/Sprites';

type Mode = 'title' | 'aim' | 'waiting' | 'bite' | 'fight' | 'result' | 'log' | 'demo';
type LureDepth = 0 | 1 | 2;

interface Fish {
  x: number;
  y: number;
  vx: number;
  kind: FishKind;
  behavior: 'curious' | 'shy' | 'aggressive';
  depth: LureDepth;
  t: number;
}

interface CatchRecord {
  kind: FishKind;
  weight: number;
}

const KIND_WEIGHT: Record<FishKind, [number, number]> = {
  minnow: [0.2, 0.5],
  bass: [1.0, 2.5],
  pike: [2.0, 4.0],
  finfolk: [5.0, 8.0],
};

const DEPTH_LABEL = ['SHALLOW', 'MID', 'DEEP'];

export class Hooked implements Game {
  readonly id = 'hooked';
  readonly slug = 'hooked';
  readonly name = 'Hooked';
  readonly description = 'Read the water. Own the strike. GB fishing.';

  private engine: GameBoyEngine | null = null;
  private audio = new HookedAudio();
  private mode: Mode = 'title';
  private fish: Fish[] = [];
  private aimX = 80;
  private bobberX = 80;
  private bobberY = 70;
  private waitT = 0;
  private biteT = 0;
  private biteWindow = 0.7;
  private tension = 0.5;
  private fightFish: Fish | null = null;
  private reelPulse = 0;
  private lureDepth: LureDepth = 1;
  private catches: CatchRecord[] = [];
  private resultMsg = '';
  private resultT = 0;
  private caughtFinfolk = false;
  private anim = 0;
  private message = '';

  init(engine: GameBoyEngine): void {
    this.engine = engine;
    void engine.initAudio().then(() => {
      const ctx = engine.audio.getContext();
      const master = engine.audio.getMasterGain();
      if (ctx && master) this.audio.init(ctx, master);
      this.audio.playTrack('title');
    });
    this.mode = 'title';
  }

  private spawnFish(): void {
    this.fish = [
      {
        x: 40,
        y: 55,
        vx: 20,
        kind: 'minnow',
        behavior: 'curious',
        depth: 0,
        t: 0,
      },
      {
        x: 100,
        y: 70,
        vx: -15,
        kind: 'bass',
        behavior: 'shy',
        depth: 1,
        t: 1,
      },
      {
        x: 70,
        y: 88,
        vx: 12,
        kind: 'pike',
        behavior: 'aggressive',
        depth: 2,
        t: 2,
      },
    ];
    if (this.catches.length >= 2 && !this.caughtFinfolk) {
      this.fish.push({
        x: 120,
        y: 78,
        vx: -10,
        kind: 'finfolk',
        behavior: 'shy',
        depth: 1,
        t: 0,
      });
    }
  }

  private startPlay(): void {
    this.catches = [];
    this.caughtFinfolk = false;
    this.lureDepth = 1;
    this.spawnFish();
    this.mode = 'aim';
    this.message = 'AIM + A CAST';
    this.audio.playTrack('dock');
    this.audio.sfx('select');
  }

  private cast(): void {
    this.bobberX = this.aimX;
    this.bobberY = 50 + this.lureDepth * 16;
    this.mode = 'waiting';
    this.waitT = 0.8 + Math.random() * 1.5;
    this.message = 'WAIT...';
    this.audio.sfx('cast');
    this.audio.sfx('splash');
  }

  private nearFish(): Fish | null {
    let best: Fish | null = null;
    let bestD = 999;
    for (const f of this.fish) {
      if (f.depth !== this.lureDepth) continue;
      const d = Math.abs(f.x - this.bobberX) + Math.abs(f.y - this.bobberY) * 0.5;
      const range = f.behavior === 'curious' ? 28 : f.behavior === 'aggressive' ? 36 : 18;
      if (d < range && d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  private startBite(f: Fish): void {
    this.fightFish = f;
    this.mode = 'bite';
    this.biteT = this.biteWindow * (f.behavior === 'aggressive' ? 0.7 : f.behavior === 'shy' ? 1.1 : 1);
    this.message = 'B SET HOOK!';
    this.audio.sfx('bite');
  }

  private startFight(): void {
    this.mode = 'fight';
    this.tension = 0.5;
    this.waitT = 0;
    this.message = 'HOLD A REEL';
    this.audio.playTrack('fight');
    this.audio.sfx('hook');
  }

  private resolveCatch(ok: boolean, reason: string): void {
    if (ok && this.fightFish) {
      const [lo, hi] = KIND_WEIGHT[this.fightFish.kind];
      const weight = lo + Math.random() * (hi - lo);
      this.catches.push({ kind: this.fightFish.kind, weight });
      if (this.fightFish.kind === 'finfolk') this.caughtFinfolk = true;
      this.resultMsg = `${this.fightFish.kind.toUpperCase()} ${weight.toFixed(1)}lb`;
      this.audio.sfx('catch');
      // remove that fish
      this.fish = this.fish.filter((f) => f !== this.fightFish);
    } else {
      this.resultMsg = reason;
      this.audio.sfx(reason.includes('SNAP') ? 'snap' : 'escape');
    }
    this.mode = 'result';
    this.resultT = 2;
    this.fightFish = null;
    this.audio.playTrack('dock');
    if (this.caughtFinfolk) {
      this.resultT = 2.5;
    }
  }

  update(dt: number): void {
    this.anim += dt;

    for (const f of this.fish) {
      f.t += dt;
      f.x += f.vx * dt;
      if (f.behavior === 'shy') f.y += Math.sin(f.t * 2) * 8 * dt;
      if (f.behavior === 'curious') f.y += Math.sin(f.t) * 5 * dt;
      if (f.behavior === 'aggressive') f.x += Math.sin(f.t * 3) * 15 * dt;
      if (f.x < 10 || f.x > 150) f.vx *= -1;
      f.y = Math.max(48, Math.min(95, f.y));
    }

    if (this.mode === 'waiting') {
      this.waitT -= dt;
      // fish attracted to bobber
      const near = this.nearFish();
      if (near && near.behavior === 'curious') {
        near.vx = Math.sign(this.bobberX - near.x) * 25;
      }
      if (this.waitT <= 0) {
        const f = this.nearFish();
        if (f) this.startBite(f);
        else {
          this.mode = 'aim';
          this.message = 'NOTHING... AIM AGAIN';
          this.audio.sfx('escape');
        }
      }
    }

    if (this.mode === 'bite') {
      this.biteT -= dt;
      if (this.biteT <= 0) {
        this.resolveCatch(false, 'TOO SLOW');
      }
    }

    if (this.mode === 'fight' && this.fightFish) {
      const pull = this.fightFish.kind === 'finfolk' ? 0.35 : this.fightFish.kind === 'pike' ? 0.28 : 0.2;
      // fish pulls randomly
      this.tension += (Math.sin(this.anim * 5) * pull + (this.reelPulse > 0 ? 0.25 : -0.12)) * dt;
      this.tension = Math.max(0, Math.min(1, this.tension));
      if (this.reelPulse > 0) {
        this.reelPulse -= dt;
        if (Math.floor(this.anim * 10) % 3 === 0) this.audio.sfx('reel');
      }

      const sweetMin = 0.35;
      const sweetMax = 0.7;
      if (this.tension >= 0.98) this.resolveCatch(false, 'LINE SNAP!');
      else if (this.tension <= 0.05) this.resolveCatch(false, 'GOT AWAY');
      else if (this.tension > sweetMin && this.tension < sweetMax) {
        // progress toward catch while in zone with reel
        if (this.reelPulse > 0) {
          this.waitT = (this.waitT || 0) + dt;
          if (this.waitT > 1.8) this.resolveCatch(true, '');
        }
      } else {
        this.waitT = Math.max(0, (this.waitT || 0) - dt * 0.5);
      }
    }

    if (this.mode === 'result') {
      this.resultT -= dt;
      if (this.resultT <= 0) {
        if (this.caughtFinfolk) {
          this.mode = 'demo';
          this.audio.playTrack('title');
        } else {
          if (this.fish.length < 2) this.spawnFish();
          this.mode = 'aim';
          this.message = 'AIM + A CAST';
        }
      }
    }
  }

  onInput(input: InputState): void {
    if (this.mode === 'title') {
      if (input.pressed.has('a') || input.pressed.has('start')) this.startPlay();
      return;
    }
    if (this.mode === 'demo') {
      if (input.pressed.has('a') || input.pressed.has('start')) {
        this.mode = 'title';
        this.audio.playTrack('title');
      }
      return;
    }
    if (this.mode === 'log') {
      if (input.pressed.has('start') || input.pressed.has('b')) {
        this.mode = 'aim';
        this.audio.sfx('select');
      }
      return;
    }
    if (input.pressed.has('start') && (this.mode === 'aim' || this.mode === 'waiting')) {
      this.mode = 'log';
      this.audio.sfx('select');
      return;
    }
    if (input.pressed.has('select') && this.mode === 'aim') {
      this.lureDepth = ((this.lureDepth + 1) % 3) as LureDepth;
      this.message = `LURE ${DEPTH_LABEL[this.lureDepth]}`;
      this.audio.sfx('select');
      return;
    }

    if (this.mode === 'aim') {
      if (input.held.has('left')) this.aimX = Math.max(20, this.aimX - 2);
      if (input.held.has('right')) this.aimX = Math.min(140, this.aimX + 2);
      if (input.held.has('up')) this.aimX = Math.max(20, this.aimX - 1);
      if (input.pressed.has('a')) this.cast();
      return;
    }

    if (this.mode === 'bite') {
      if (input.pressed.has('b')) this.startFight();
      return;
    }

    if (this.mode === 'fight') {
      if (input.held.has('a')) this.reelPulse = 0.1;
      if (input.held.has('left')) this.tension = Math.max(0, this.tension - 0.02);
      if (input.held.has('right')) this.tension = Math.min(1, this.tension + 0.02);
      return;
    }
  }

  render(renderer: CanvasRenderer): void {
    const ctx = renderer.context;
    renderer.clear(PaletteShade.Lightest);

    if (this.mode === 'title') {
      drawDockScene(ctx);
      renderer.drawText('HOOKED', 80, 36, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 14,
      });
      renderer.drawText('READ THE WATER', 80, 56, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 6,
      });
      drawAngler(ctx, 70, 100);
      renderer.drawText('A START', 80, 88, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 7,
      });
      return;
    }

    drawDockScene(ctx);

    // fish underwater
    for (const f of this.fish) {
      drawFish(ctx, f.x, f.y, f.kind, Math.sign(f.vx) || 1);
    }

    drawAngler(ctx, 20, 108);

    if (this.mode === 'aim') {
      // aim marker
      renderer.fillRect(this.aimX - 1, 45, 2, 50, PaletteShade.Darkest);
      renderer.fillRect(this.aimX - 4, 45, 8, 2, PaletteShade.Darkest);
      renderer.drawText(DEPTH_LABEL[this.lureDepth], 120, 2, {
        shade: PaletteShade.Dark,
        size: 5,
      });
    }

    if (this.mode === 'waiting' || this.mode === 'bite') {
      // fishing line
      renderer.drawLine(36, 110, this.bobberX + 2, this.bobberY, PaletteShade.Darkest);
      drawBobber(ctx, this.bobberX, this.bobberY, this.mode === 'bite');
    }

    if (this.mode === 'fight' && this.fightFish) {
      renderer.drawLine(36, 110, this.fightFish.x, this.fightFish.y, PaletteShade.Darkest);
      drawFish(ctx, this.fightFish.x, this.fightFish.y, this.fightFish.kind, -1);
      drawTensionBar(ctx, this.tension, 0.35, 0.7);
      renderer.drawText('TENSION', 80, 18, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 5,
      });
    }

    if (this.mode === 'result') {
      renderer.fillRect(20, 50, 120, 36, PaletteShade.Lightest);
      renderer.strokeRect(20, 50, 120, 36, PaletteShade.Darkest);
      renderer.drawText(this.resultMsg, 80, 62, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 7,
      });
    }

    if (this.mode === 'log') {
      renderer.fillRect(10, 20, 140, 100, PaletteShade.Lightest);
      renderer.strokeRect(10, 20, 140, 100, PaletteShade.Darkest);
      renderer.drawText('CATCH LOG', 80, 28, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 8,
      });
      if (this.catches.length === 0) {
        renderer.drawText('NO CATCHES YET', 80, 60, {
          shade: PaletteShade.Dark,
          align: 'center',
          size: 6,
        });
      } else {
        this.catches.slice(-5).forEach((c, i) => {
          renderer.drawText(`${c.kind.toUpperCase()} ${c.weight.toFixed(1)}lb`, 20, 44 + i * 12, {
            shade: PaletteShade.Dark,
            size: 6,
          });
        });
      }
      renderer.drawText('START BACK', 80, 108, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
    }

    if (this.mode === 'demo') {
      renderer.fillRect(16, 40, 128, 60, PaletteShade.Lightest);
      renderer.strokeRect(16, 40, 128, 60, PaletteShade.Darkest);
      renderer.drawText('FINFOLK CAUGHT!', 80, 52, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 8,
      });
      renderer.drawText('DEMO COMPLETE', 80, 68, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A TITLE', 80, 84, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }

    if (this.mode !== 'log' && this.mode !== 'demo') {
      renderer.drawText(this.message, 80, 132, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 5,
      });
      renderer.drawText(`CATCH ${this.catches.length}`, 4, 2, {
        shade: PaletteShade.Dark,
        size: 5,
      });
    }
  }

  destroy(): void {
    this.audio.destroy();
  }
}

export function createHooked(): Game {
  return new Hooked();
}
