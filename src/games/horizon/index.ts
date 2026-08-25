import type { GameBoyEngine, Game, CanvasRenderer, InputState } from '@/engine';
import { PaletteShade, GB_WIDTH, GB_HEIGHT } from '@/engine';
import { HorizonAudio } from './audio/HorizonAudio';
import {
  drawMech,
  drawFighter,
  drawEnemyMech,
  drawBullet,
  drawLaser,
  drawPowerup,
  drawExplosion,
  drawStarfield,
} from './render/Sprites';

type Mode = 'title' | 'playing' | 'paused' | 'dead' | 'win';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  enemy: boolean;
  life: number;
}

interface Enemy {
  x: number;
  y: number;
  hp: number;
  type: 'fighter' | 'mech' | 'boss';
  t: number;
  shootCd: number;
}

interface Fx {
  x: number;
  y: number;
  life: number;
}

interface Power {
  x: number;
  y: number;
}

export class Horizon implements Game {
  readonly id = 'horizon';
  readonly slug = 'horizon';
  readonly name = 'Horizon';
  readonly description = 'Mech horizontal shooter. Bullets, lasers, bosses.';

  private engine: GameBoyEngine | null = null;
  private audio = new HorizonAudio();
  private mode: Mode = 'title';
  private px = 24;
  private py = 60;
  private hp = 5;
  private maxHp = 5;
  private invuln = 0;
  private shotCd = 0;
  private laserCd = 0;
  private laserActive = 0;
  private power = 0;
  private scroll = 0;
  private waveT = 0;
  private bossSpawned = false;
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private fx: Fx[] = [];
  private powers: Power[] = [];
  private stars: { x: number; y: number; s: number }[] = [];
  private flash = 0;
  private anim = 0;

  init(engine: GameBoyEngine): void {
    this.engine = engine;
    void engine.initAudio().then(() => {
      const ctx = engine.audio.getContext();
      const master = engine.audio.getMasterGain();
      if (ctx && master) this.audio.init(ctx, master);
      this.audio.playTrack('title');
    });
    this.stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * 160,
      y: Math.random() * 144,
      s: 0.3 + Math.random() * 0.9,
    }));
    this.resetRun();
    this.mode = 'title';
  }

  private resetRun(): void {
    this.px = 24;
    this.py = 60;
    this.hp = 5;
    this.invuln = 0;
    this.shotCd = 0;
    this.laserCd = 0;
    this.laserActive = 0;
    this.power = 0;
    this.scroll = 0;
    this.waveT = 0;
    this.bossSpawned = false;
    this.bullets = [];
    this.enemies = [];
    this.fx = [];
    this.powers = [];
    this.flash = 0;
  }

  private startGame(): void {
    this.resetRun();
    this.mode = 'playing';
    this.audio.playTrack('stage');
    this.audio.sfx('select');
  }

  update(dt: number): void {
    this.anim += dt;
    if (this.mode !== 'playing') return;

    this.scroll += 40 * dt;
    this.waveT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shotCd > 0) this.shotCd -= dt;
    if (this.laserCd > 0) this.laserCd -= dt;
    if (this.laserActive > 0) this.laserActive -= dt;
    if (this.flash > 0) this.flash -= dt;

    this.spawnWaves();
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePowers(dt);
    this.fx = this.fx.filter((f) => {
      f.life -= dt;
      return f.life > 0;
    });

    if (this.laserActive > 0) {
      for (const e of this.enemies) {
        if (e.y + 10 > this.py && e.y < this.py + 16 && e.x > this.px) {
          e.hp -= 18 * dt;
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    }

    if (this.bossSpawned && this.enemies.every((e) => e.type !== 'boss') && this.enemies.length === 0) {
      this.mode = 'win';
      this.audio.playTrack('title');
      this.audio.sfx('power');
    }
  }

  private spawnWaves(): void {
    if (this.waveT < 1.2) return;
    this.waveT = 0;
    if (!this.bossSpawned && this.scroll > 900) {
      this.bossSpawned = true;
      this.enemies.push({
        x: 140,
        y: 50,
        hp: 80,
        type: 'boss',
        t: 0,
        shootCd: 0.5,
      });
      this.audio.playTrack('boss');
      return;
    }
    if (this.bossSpawned) return;
    const y = 20 + Math.random() * 90;
    if (Math.random() < 0.7) {
      this.enemies.push({ x: 170, y, hp: 2 + this.power, type: 'fighter', t: 0, shootCd: 1 });
    } else {
      this.enemies.push({ x: 170, y, hp: 6, type: 'mech', t: 0, shootCd: 1.2 });
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      e.t += dt;
      if (e.type === 'fighter') {
        e.x -= (35 + Math.sin(e.t * 3) * 10) * dt;
        e.y += Math.sin(e.t * 4) * 20 * dt;
      } else if (e.type === 'mech') {
        e.x -= 22 * dt;
        e.y += Math.sin(e.t * 2) * 12 * dt;
      } else {
        e.x = 120 + Math.sin(e.t * 0.8) * 15;
        e.y = 40 + Math.sin(e.t * 1.2) * 40;
      }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && e.x < 160) {
        e.shootCd = e.type === 'boss' ? 0.45 : e.type === 'mech' ? 1.1 : 1.4;
        this.bullets.push({
          x: e.x,
          y: e.y + 6,
          vx: -70 - (e.type === 'boss' ? 20 : 0),
          vy: e.type === 'boss' ? (Math.random() - 0.5) * 40 : 0,
          enemy: true,
          life: 3,
        });
        if (e.type === 'boss') {
          this.bullets.push({
            x: e.x,
            y: e.y + 10,
            vx: -55,
            vy: 25,
            enemy: true,
            life: 3,
          });
        }
      }
      if (
        this.invuln <= 0 &&
        e.x < this.px + 14 &&
        e.x + 14 > this.px &&
        e.y < this.py + 16 &&
        e.y + 14 > this.py
      ) {
        this.hurt();
      }
    }
    this.enemies = this.enemies.filter((e) => e.x > -30 && e.hp > 0);
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.enemy) {
        if (
          this.invuln <= 0 &&
          b.x < this.px + 14 &&
          b.x + 4 > this.px &&
          b.y < this.py + 16 &&
          b.y + 3 > this.py
        ) {
          b.life = 0;
          this.hurt();
        }
      } else {
        for (const e of this.enemies) {
          if (b.x < e.x + 16 && b.x + 4 > e.x && b.y < e.y + 16 && b.y + 3 > e.y) {
            e.hp -= 1 + this.power * 0.5;
            b.life = 0;
            this.audio.sfx('hit');
            if (e.hp <= 0) this.killEnemy(e);
            break;
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -10 && b.x < 180);
  }

  private updatePowers(dt: number): void {
    for (const p of this.powers) {
      p.x -= 25 * dt;
      if (p.x < this.px + 14 && p.x + 8 > this.px && p.y < this.py + 16 && p.y + 8 > this.py) {
        p.x = -99;
        this.power = Math.min(2, this.power + 1);
        this.audio.sfx('power');
      }
    }
    this.powers = this.powers.filter((p) => p.x > -10);
  }

  private killEnemy(e: Enemy): void {
    this.fx.push({ x: e.x + 6, y: e.y + 6, life: 0.35 });
    this.audio.sfx('explode');
    if (Math.random() < 0.25 && e.type !== 'boss') {
      this.powers.push({ x: e.x, y: e.y });
    }
    e.hp = 0;
  }

  private hurt(): void {
    this.hp -= 1;
    this.invuln = 1.1;
    this.flash = 0.15;
    this.audio.sfx('hurt');
    if (this.hp <= 0) {
      this.mode = 'dead';
      this.audio.playTrack('title');
      this.audio.sfx('explode');
    }
  }

  onInput(input: InputState): void {
    if (this.mode === 'title') {
      if (input.pressed.has('a') || input.pressed.has('start')) this.startGame();
      return;
    }
    if (this.mode === 'dead' || this.mode === 'win') {
      if (input.pressed.has('a') || input.pressed.has('start')) {
        this.mode = 'title';
        this.audio.playTrack('title');
      }
      return;
    }
    if (input.pressed.has('start')) {
      this.mode = this.mode === 'paused' ? 'playing' : 'paused';
      this.audio.sfx('select');
      return;
    }
    if (this.mode !== 'playing') return;

    const spd = 70;
    if (input.held.has('up')) this.py -= spd * (1 / 60);
    if (input.held.has('down')) this.py += spd * (1 / 60);
    if (input.held.has('left')) this.px -= spd * (1 / 60);
    if (input.held.has('right')) this.px += spd * (1 / 60);
    this.px = Math.max(4, Math.min(70, this.px));
    this.py = Math.max(8, Math.min(GB_HEIGHT - 24, this.py));

    if (input.held.has('a') && this.shotCd <= 0) {
      this.shotCd = this.power >= 2 ? 0.1 : 0.16;
      this.bullets.push({ x: this.px + 16, y: this.py + 7, vx: 140, vy: 0, enemy: false, life: 2 });
      if (this.power >= 1) {
        this.bullets.push({
          x: this.px + 14,
          y: this.py + 3,
          vx: 130,
          vy: -20,
          enemy: false,
          life: 2,
        });
        this.bullets.push({
          x: this.px + 14,
          y: this.py + 11,
          vx: 130,
          vy: 20,
          enemy: false,
          life: 2,
        });
      }
      this.audio.sfx('shot');
    }
    if (input.pressed.has('b') && this.laserCd <= 0) {
      this.laserCd = 2.5;
      this.laserActive = 0.35;
      this.audio.sfx('laser');
    }
  }

  render(renderer: CanvasRenderer): void {
    const ctx = renderer.context;
    renderer.clear(PaletteShade.Lightest);
    drawStarfield(ctx, this.scroll, this.stars);

    if (this.mode === 'title') {
      renderer.drawText('HORIZON', 80, 40, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 12,
      });
      renderer.drawText('MECH STRIKE', 80, 56, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      drawMech(ctx, 70, 72);
      renderer.drawText('A START', 80, 110, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A FIRE  B LASER', 80, 124, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
      return;
    }

    for (const p of this.powers) drawPowerup(ctx, p.x, p.y, this.anim);
    for (const e of this.enemies) {
      if (e.type === 'fighter') drawFighter(ctx, e.x, e.y);
      else drawEnemyMech(ctx, e.x, e.y, e.type === 'boss');
    }
    for (const b of this.bullets) drawBullet(ctx, b.x, b.y, b.enemy);
    if (this.laserActive > 0) drawLaser(ctx, this.px + 16, this.py + 7, GB_WIDTH - this.px);
    for (const f of this.fx) drawExplosion(ctx, f.x, f.y, Math.floor((0.35 - f.life) * 12));

    if (this.invuln <= 0 || Math.floor(this.anim * 20) % 2 === 0) {
      drawMech(ctx, this.px, this.py, this.flash > 0);
    }

    renderer.drawBar(4, 4, 40, 4, this.hp, this.maxHp, PaletteShade.Darkest, PaletteShade.Light);
    renderer.drawText(`P${this.power}`, 50, 2, { shade: PaletteShade.Dark, size: 6 });

    if (this.mode === 'paused') {
      renderer.fillRect(40, 60, 80, 24, PaletteShade.Lightest);
      renderer.strokeRect(40, 60, 80, 24, PaletteShade.Darkest);
      renderer.drawText('PAUSED', 80, 68, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 8,
      });
    }
    if (this.mode === 'dead') {
      renderer.drawText('DESTROYED', 80, 60, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 10,
      });
      renderer.drawText('A RETRY', 80, 80, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
    if (this.mode === 'win') {
      renderer.drawText('SECTOR CLEAR', 80, 56, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 9,
      });
      renderer.drawText('DEMO COMPLETE', 80, 72, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A TITLE', 80, 92, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
  }

  destroy(): void {
    this.audio.destroy();
  }
}

export function createHorizon(): Game {
  return new Horizon();
}
