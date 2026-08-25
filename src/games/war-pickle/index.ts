import type { GameBoyEngine, Game, CanvasRenderer, InputState } from '@/engine';
import { PaletteShade } from '@/engine';
import { WarPickleAudio } from './audio/WarPickleAudio';
import {
  drawPickle,
  drawSoldier,
  drawTurret,
  drawTank,
  drawBullet,
  drawPickup,
  drawGround,
} from './render/Sprites';

type Mode = 'title' | 'playing' | 'paused' | 'dead' | 'clear';
type Weapon = 'normal' | 'spread' | 'rapid';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  enemy: boolean;
}

interface Enemy {
  x: number;
  y: number;
  hp: number;
  type: 'soldier' | 'turret' | 'tank';
  shootCd: number;
  facing: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: Weapon;
}

const GROUND = 104;
const GRAVITY = 420;
const JUMP = -170;

export class WarPickle implements Game {
  readonly id = 'war-pickle';
  readonly slug = 'war-pickle';
  readonly name = 'War Pickle';
  readonly description = 'Contra / Metal Slug mashup. Pickle go boom.';

  private engine: GameBoyEngine | null = null;
  private audio = new WarPickleAudio();
  private mode: Mode = 'title';
  private px = 30;
  private py = GROUND;
  private vx = 0;
  private vy = 0;
  private grounded = true;
  private facing = 1;
  private lives = 3;
  private invuln = 0;
  private shotCd = 0;
  private weapon: Weapon = 'normal';
  private stage = 1;
  private scroll = 0;
  private progress = 0;
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private spawnT = 0;
  private anim = 0;
  private held = { left: false, right: false, up: false };

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

  private resetStage(): void {
    this.px = 30;
    this.py = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.invuln = 0;
    this.shotCd = 0;
    this.scroll = 0;
    this.progress = 0;
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.spawnT = 0;
    this.weapon = 'normal';
  }

  private startGame(): void {
    this.lives = 3;
    this.stage = 1;
    this.resetStage();
    this.mode = 'playing';
    this.audio.playTrack('stage');
    this.audio.sfx('select');
  }

  update(dt: number): void {
    this.anim += dt;
    if (this.mode !== 'playing') return;

    if (this.invuln > 0) this.invuln -= dt;
    if (this.shotCd > 0) this.shotCd -= dt;

    const spd = 70;
    this.vx = 0;
    if (this.held.left) {
      this.vx = -spd;
      this.facing = -1;
    }
    if (this.held.right) {
      this.vx = spd;
      this.facing = 1;
    }

    this.vy += GRAVITY * dt;
    this.px += this.vx * dt;
    this.py += this.vy * dt;
    if (this.py >= GROUND) {
      this.py = GROUND;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    this.px = Math.max(8, Math.min(90, this.px));

    this.scroll += 28 * dt;
    this.progress += 28 * dt;

    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.progress < (this.stage === 1 ? 700 : 900)) {
      this.spawnT = this.stage === 1 ? 1.4 : 1.1;
      const roll = Math.random();
      if (roll < 0.55) {
        this.enemies.push({
          x: 170,
          y: GROUND,
          hp: 2,
          type: 'soldier',
          shootCd: 1,
          facing: -1,
        });
      } else if (roll < 0.85) {
        this.enemies.push({
          x: 170,
          y: GROUND - 4,
          hp: 5,
          type: 'turret',
          shootCd: 1.5,
          facing: -1,
        });
      }
    }

    // stage boss
    if (
      this.progress >= (this.stage === 1 ? 700 : 900) &&
      !this.enemies.some((e) => e.type === 'tank')
    ) {
      if (this.enemies.length === 0 && this.progress < (this.stage === 1 ? 710 : 910)) {
        this.enemies.push({
          x: 140,
          y: GROUND - 6,
          hp: this.stage === 1 ? 28 : 40,
          type: 'tank',
          shootCd: 0.8,
          facing: -1,
        });
        this.audio.playTrack('boss');
        this.progress += 20;
      }
    }

    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);

    if (
      this.progress >= (this.stage === 1 ? 700 : 900) &&
      this.enemies.length === 0 &&
      this.progress > (this.stage === 1 ? 720 : 920)
    ) {
      if (this.stage === 1) {
        this.stage = 2;
        this.resetStage();
        this.audio.playTrack('stage');
        this.audio.sfx('pickup');
      } else {
        this.mode = 'clear';
        this.audio.playTrack('title');
        this.audio.sfx('pickup');
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.type === 'soldier') e.x -= 25 * dt;
      else if (e.type === 'tank') e.x -= 8 * dt;
      e.shootCd -= dt;
      if (e.shootCd <= 0 && e.x < 160 && e.x > 0) {
        e.shootCd = e.type === 'tank' ? 0.7 : e.type === 'turret' ? 1.2 : 1.6;
        this.bullets.push({
          x: e.x,
          y: e.y + 6,
          vx: -80,
          vy: e.type === 'tank' ? -20 + Math.random() * 40 : 0,
          enemy: true,
        });
      }
      if (
        this.invuln <= 0 &&
        Math.abs(e.x - this.px) < (e.type === 'tank' ? 20 : 12) &&
        Math.abs(e.y - this.py) < 14
      ) {
        this.hurt();
      }
    }
    this.enemies = this.enemies.filter((e) => e.x > -40 && e.hp > 0);
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.enemy) {
        if (
          this.invuln <= 0 &&
          Math.abs(b.x - (this.px + 6)) < 8 &&
          Math.abs(b.y - (this.py + 8)) < 10
        ) {
          b.x = -999;
          this.hurt();
        }
      } else {
        for (const e of this.enemies) {
          const w = e.type === 'tank' ? 28 : 12;
          if (b.x > e.x && b.x < e.x + w && b.y > e.y && b.y < e.y + 16) {
            e.hp -= 1;
            b.x = -999;
            this.audio.sfx('hit');
            if (e.hp <= 0) {
              this.audio.sfx('explode');
              if (Math.random() < 0.35) {
                const kinds: Weapon[] = ['spread', 'rapid'];
                this.pickups.push({
                  x: e.x,
                  y: e.y,
                  kind: kinds[Math.floor(Math.random() * kinds.length)],
                });
              }
            }
            break;
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.bullets = this.bullets.filter((b) => b.x > -20 && b.x < 180 && b.y > 0 && b.y < 140);
  }

  private updatePickups(dt: number): void {
    for (const p of this.pickups) {
      p.x -= 20 * dt;
      if (Math.abs(p.x - this.px) < 12 && Math.abs(p.y - this.py) < 14) {
        this.weapon = p.kind;
        p.x = -99;
        this.audio.sfx('pickup');
      }
    }
    this.pickups = this.pickups.filter((p) => p.x > -10);
  }

  private hurt(): void {
    this.lives -= 1;
    this.invuln = 1.2;
    this.audio.sfx('hurt');
    if (this.lives < 0) {
      this.mode = 'dead';
      this.audio.playTrack('title');
    }
  }

  private shoot(): void {
    if (this.shotCd > 0) return;
    this.shotCd = this.weapon === 'rapid' ? 0.08 : 0.18;
    const dir = this.facing;
    const baseY = this.py + 7;
    const bx = this.px + (dir > 0 ? 14 : -2);
    this.bullets.push({ x: bx, y: baseY, vx: 160 * dir, vy: 0, enemy: false });
    if (this.weapon === 'spread') {
      this.bullets.push({ x: bx, y: baseY, vx: 150 * dir, vy: -35, enemy: false });
      this.bullets.push({ x: bx, y: baseY, vx: 150 * dir, vy: 35, enemy: false });
    }
    this.audio.sfx('shoot');
  }

  onInput(input: InputState): void {
    if (this.mode === 'title') {
      if (input.pressed.has('a') || input.pressed.has('start')) this.startGame();
      return;
    }
    if (this.mode === 'dead' || this.mode === 'clear') {
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

    this.held.left = input.held.has('left');
    this.held.right = input.held.has('right');
    this.held.up = input.held.has('up');

    if (input.pressed.has('a') && this.grounded) {
      this.vy = JUMP;
      this.grounded = false;
      this.audio.sfx('jump');
    }
    if (input.held.has('b')) this.shoot();
  }

  render(renderer: CanvasRenderer): void {
    const ctx = renderer.context;
    renderer.clear(PaletteShade.Lightest);
    drawGround(ctx, this.scroll);

    if (this.mode === 'title') {
      renderer.drawText('WAR PICKLE', 80, 36, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 11,
      });
      renderer.drawText('GO! GO! PICKLE!', 80, 52, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      drawPickle(ctx, 72, 70, 1);
      renderer.drawText('A START', 80, 110, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A JUMP  B SHOOT', 80, 124, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
      return;
    }

    for (const p of this.pickups) drawPickup(ctx, p.x, p.y, this.anim);
    for (const e of this.enemies) {
      if (e.type === 'soldier') drawSoldier(ctx, e.x, e.y);
      else if (e.type === 'turret') drawTurret(ctx, e.x, e.y);
      else drawTank(ctx, e.x, e.y);
    }
    for (const b of this.bullets) drawBullet(ctx, b.x, b.y, b.enemy);

    if (this.invuln <= 0 || Math.floor(this.anim * 16) % 2 === 0) {
      drawPickle(ctx, this.px, this.py, this.facing, this.invuln > 1);
    }

    renderer.drawText(`L${Math.max(0, this.lives)}`, 4, 2, { shade: PaletteShade.Darkest, size: 7 });
    renderer.drawText(`S${this.stage}`, 28, 2, { shade: PaletteShade.Dark, size: 7 });
    renderer.drawText(this.weapon.toUpperCase().slice(0, 3), 50, 2, {
      shade: PaletteShade.Dark,
      size: 6,
    });

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
      renderer.drawText('MISSION FAIL', 80, 56, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 9,
      });
      renderer.drawText('A TITLE', 80, 76, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
    if (this.mode === 'clear') {
      renderer.drawText('AREA CLEAR!', 80, 52, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 10,
      });
      renderer.drawText('DEMO COMPLETE', 80, 70, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A TITLE', 80, 90, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
  }

  destroy(): void {
    this.audio.destroy();
  }
}

export function createWarPickle(): Game {
  return new WarPickle();
}
