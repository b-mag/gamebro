import type { GameBoyEngine, Game, CanvasRenderer, InputState, TileMapData } from '@/engine';
import { PaletteShade, TileMapRenderer, isSolidTile, isPlatformTile } from '@/engine';
import { MudskipperAudio } from './audio/MudskipperAudio';
import { MUD_TILES, TILE, drawMudskipper, drawCrab, drawBug } from './render/Sprites';
import { makeStage, SOLID, PLATFORM, MUD, HAZARD, GOAL, type StageDef } from './world/Stages';

type Mode = 'title' | 'playing' | 'paused' | 'dead' | 'clear';

interface Crab {
  x: number;
  y: number;
  vx: number;
  alive: boolean;
}

interface Bug {
  x: number;
  y: number;
  taken: boolean;
}

const GRAVITY = 480;
const JUMP_DRY = -175;
const JUMP_MUD = -210;
const SPD_DRY = 55;
const SPD_MUD = 120;

export class MightyMudskipper implements Game {
  readonly id = 'mighty-mudskipper';
  readonly slug = 'mighty-mudskipper';
  readonly name = 'Mighty Mudskipper';
  readonly description = 'Mario x Sonic mudfish. Zoom in the shallows!';

  private engine: GameBoyEngine | null = null;
  private audio = new MudskipperAudio();
  private tiles = new TileMapRenderer(TILE);
  private mode: Mode = 'title';
  private stageId = 1;
  private stage!: StageDef;
  private map!: TileMapData;
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private facing = 1;
  private grounded = false;
  private inMud = false;
  private lives = 3;
  private coins = 0;
  private invuln = 0;
  private dash = 0;
  private camX = 0;
  private crabs: Crab[] = [];
  private bugs: Bug[] = [];
  private anim = 0;
  private wasMud = false;
  private held = { left: false, right: false };

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

  private loadStage(id: number): void {
    this.stageId = id;
    this.stage = makeStage(id);
    this.map = {
      width: this.stage.map.width,
      height: this.stage.map.height,
      tiles: [...this.stage.map.tiles],
    };
    this.px = this.stage.spawn.x;
    this.py = this.stage.spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.invuln = 0;
    this.dash = 0;
    this.crabs = this.stage.crabs.map((c) => ({ ...c, vx: -20, alive: true }));
    this.bugs = this.stage.bugs.map((b) => ({ ...b, taken: false }));
    this.audio.playTrack('land');
  }

  private startGame(): void {
    this.lives = 3;
    this.coins = 0;
    this.loadStage(1);
    this.mode = 'playing';
    this.audio.sfx('select');
  }

  private tileAt(wx: number, wy: number): number {
    return this.tiles.getTileAt(this.map, wx, wy);
  }

  private resolve(dt: number): void {
    let x = this.px;
    let y = this.py;
    const w = 14;
    const h = 14;

    x += this.vx * dt;
    for (let row = Math.floor(y / TILE); row <= Math.floor((y + h - 0.01) / TILE); row++) {
      for (let col = Math.floor(x / TILE); col <= Math.floor((x + w - 0.01) / TILE); col++) {
        const tile = this.tileAt(col * TILE, row * TILE);
        if (isSolidTile(tile, SOLID)) {
          if (this.vx > 0) x = col * TILE - w;
          else if (this.vx < 0) x = (col + 1) * TILE;
        }
      }
    }

    this.grounded = false;
    y += this.vy * dt;
    for (let row = Math.floor(y / TILE); row <= Math.floor((y + h - 0.01) / TILE); row++) {
      for (let col = Math.floor(x / TILE); col <= Math.floor((x + w - 0.01) / TILE); col++) {
        const tile = this.tileAt(col * TILE, row * TILE);
        if (isSolidTile(tile, SOLID)) {
          if (this.vy > 0) {
            y = row * TILE - h;
            this.grounded = true;
            this.vy = 0;
          } else if (this.vy < 0) {
            y = (row + 1) * TILE;
            this.vy = 0;
          }
        } else if (isPlatformTile(tile, PLATFORM) && this.vy > 0) {
          const prevBottom = y - this.vy * dt + h;
          const platTop = row * TILE;
          if (prevBottom <= platTop + 2) {
            y = platTop - h;
            this.grounded = true;
            this.vy = 0;
          }
        }
      }
    }

    this.px = x;
    this.py = y;

    // mud / hazard under feet
    const foot = this.tileAt(this.px + 7, this.py + h + 1);
    const mid = this.tileAt(this.px + 7, this.py + h / 2);
    this.inMud = MUD.has(foot) || MUD.has(mid);
    if (HAZARD.has(mid) || HAZARD.has(foot)) this.hurt();
    if (foot === GOAL || mid === GOAL) this.goal();
  }

  private hurt(): void {
    if (this.invuln > 0) return;
    this.lives -= 1;
    this.invuln = 1.2;
    this.vx = -this.facing * 40;
    this.vy = -80;
    this.audio.sfx('hurt');
    if (this.lives < 0) {
      this.mode = 'dead';
      this.audio.playTrack('title');
    }
  }

  private goal(): void {
    this.audio.sfx('goal');
    if (this.stageId >= 3) {
      this.mode = 'clear';
      this.audio.playTrack('title');
    } else {
      this.loadStage(this.stageId + 1);
    }
  }

  update(dt: number): void {
    this.anim += dt;
    if (this.mode !== 'playing') return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dash > 0) this.dash -= dt;

    const spd = this.inMud ? SPD_MUD : SPD_DRY;
    this.vx = 0;
    if (this.held.left) {
      this.vx = -spd;
      this.facing = -1;
    }
    if (this.held.right) {
      this.vx = spd;
      this.facing = 1;
    }
    if (this.dash > 0) this.vx = this.facing * SPD_MUD * 1.2;

    this.vy += GRAVITY * dt;
    this.resolve(dt);

    if (this.inMud && !this.wasMud) this.audio.sfx('splash');
    if (this.inMud !== this.wasMud) {
      this.audio.playTrack(this.inMud ? 'water' : 'land');
    }
    this.wasMud = this.inMud;

    this.camX = Math.max(0, Math.min(this.map.width * TILE - 160, this.px - 60));

    for (const c of this.crabs) {
      if (!c.alive) continue;
      c.x += c.vx * dt;
      if (c.x < 20 || c.x > this.map.width * TILE - 20) c.vx *= -1;
      // stomp
      if (
        this.vy > 0 &&
        this.px + 12 > c.x &&
        this.px < c.x + 14 &&
        this.py + 14 > c.y &&
        this.py + 14 < c.y + 8
      ) {
        c.alive = false;
        this.vy = JUMP_DRY * 0.7;
        this.audio.sfx('stomp');
      } else if (
        this.invuln <= 0 &&
        this.px + 12 > c.x &&
        this.px < c.x + 14 &&
        this.py + 14 > c.y &&
        this.py < c.y + 10
      ) {
        this.hurt();
      }
    }

    for (const b of this.bugs) {
      if (b.taken) continue;
      if (Math.abs(this.px - b.x) < 12 && Math.abs(this.py - b.y) < 12) {
        b.taken = true;
        this.coins += 1;
        this.audio.sfx('coin');
      }
    }
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

    if (input.pressed.has('a') && this.grounded) {
      this.vy = this.inMud ? JUMP_MUD : JUMP_DRY;
      this.grounded = false;
      this.audio.sfx('jump');
    }
    if (input.pressed.has('b') && this.dash <= 0) {
      this.dash = 0.25;
      this.audio.sfx('dash');
    }
  }

  render(renderer: CanvasRenderer): void {
    const ctx = renderer.context;
    renderer.clear(PaletteShade.Lightest);

    if (this.mode === 'title') {
      renderer.drawText('MIGHTY', 80, 28, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 10,
      });
      renderer.drawText('MUDSKIPPER', 80, 42, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 10,
      });
      drawMudskipper(ctx, 72, 60, 1, true);
      renderer.drawText('A START', 80, 100, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A JUMP  B DASH', 80, 114, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
      renderer.drawText('MUD = SPEED', 80, 126, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
      return;
    }

    this.tiles.render(ctx, this.map, MUD_TILES, this.camX, 0, 160, 144);

    for (const b of this.bugs) {
      if (!b.taken) drawBug(ctx, b.x - this.camX, b.y, this.anim);
    }
    for (const c of this.crabs) {
      if (c.alive) drawCrab(ctx, c.x - this.camX, c.y);
    }

    if (this.invuln <= 0 || Math.floor(this.anim * 16) % 2 === 0) {
      drawMudskipper(
        ctx,
        this.px - this.camX,
        this.py,
        this.facing,
        this.inMud || this.dash > 0,
        this.invuln > 1,
      );
    }

    renderer.drawText(`L${Math.max(0, this.lives)}`, 4, 2, { shade: PaletteShade.Darkest, size: 7 });
    renderer.drawText(`*${this.coins}`, 28, 2, { shade: PaletteShade.Dark, size: 7 });
    renderer.drawText(`S${this.stageId}`, 60, 2, { shade: PaletteShade.Dark, size: 7 });
    if (this.inMud) {
      renderer.drawText('ZOOM!', 120, 2, { shade: PaletteShade.Darkest, size: 6 });
    }

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
      renderer.drawText('BEACHED', 80, 56, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 10,
      });
      renderer.drawText('A TITLE', 80, 76, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
    if (this.mode === 'clear') {
      renderer.drawText('SHORE CLEAR!', 80, 52, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 9,
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

export function createMightyMudskipper(): Game {
  return new MightyMudskipper();
}
