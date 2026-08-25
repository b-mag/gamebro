import type { GameBoyEngine, Game, CanvasRenderer, InputState, TileMapData } from '@/engine';
import { PaletteShade, PALETTE_HEX, TileMapRenderer, isSolidTile } from '@/engine';
import { TemplesAudio } from './audio/TemplesAudio';
import {
  TEMPLE_TILES,
  TILE,
  drawHero,
  drawSlime,
  drawBat,
  drawRain,
} from './render/Sprites';
import {
  buildAreas,
  SOLID_TILES,
  CUTTABLE,
  BUSH,
  CHEST,
  type AreaDef,
} from './world/Areas';

type Mode = 'rain' | 'title' | 'playing' | 'items' | 'map' | 'paused' | 'getitem' | 'win';

interface Enemy {
  x: number;
  y: number;
  hp: number;
  type: 'slime' | 'bat';
  t: number;
  alive: boolean;
}

export class HiddenTemples implements Game {
  readonly id = 'hidden-temples';
  readonly slug = 'hidden-temples';
  readonly name = 'Hidden Temples';
  readonly description = "Legend of the Hidden Temples. Jungle action RPG.";

  private engine: GameBoyEngine | null = null;
  private audio = new TemplesAudio();
  private tileR = new TileMapRenderer(TILE);
  private areas = buildAreas();
  private mode: Mode = 'rain';
  private area!: AreaDef;
  private map!: TileMapData;
  private px = 80;
  private py = 100;
  private facing = 2; // 0 up 1 right 2 down 3 left
  private slash = 0;
  private slashCd = 0;
  private hp = 6;
  private maxHp = 6;
  private invuln = 0;
  private machete = false;
  private lantern = false;
  private enemies: Enemy[] = [];
  private visited = new Set<string>();
  private openedChests = new Set<string>();
  private rainDrops: { x: number; y: number }[] = [];
  private rainT = 0;
  private anim = 0;
  private getItemName = '';
  private getItemT = 0;
  private camX = 0;
  private camY = 0;
  private held = { up: false, down: false, left: false, right: false };

  init(engine: GameBoyEngine): void {
    this.engine = engine;
    void engine.initAudio().then(() => {
      const ctx = engine.audio.getContext();
      const master = engine.audio.getMasterGain();
      if (ctx && master) this.audio.init(ctx, master);
      this.audio.playTrack('rain');
    });
    this.rainDrops = Array.from({ length: 50 }, () => ({
      x: Math.random() * 160,
      y: Math.random() * 144,
    }));
    this.mode = 'rain';
    this.rainT = 0;
  }

  private loadArea(id: string, sx: number, sy: number): void {
    this.area = this.areas[id];
    this.map = {
      width: this.area.map.width,
      height: this.area.map.height,
      tiles: [...this.area.map.tiles],
    };
    this.px = sx;
    this.py = sy;
    this.visited.add(id);
    this.enemies = this.area.enemies.map((e) => ({
      ...e,
      hp: e.type === 'bat' ? 2 : 3,
      t: Math.random() * 10,
      alive: true,
    }));
    this.audio.playTrack(this.area.music);
    this.audio.sfx('door');
  }

  private beginAdventure(): void {
    this.hp = 6;
    this.machete = false;
    this.lantern = false;
    this.openedChests.clear();
    this.visited.clear();
    this.loadArea('start', 80, 100);
    this.mode = 'playing';
  }

  private tileAt(wx: number, wy: number): number {
    return this.tileR.getTileAt(this.map, wx, wy);
  }

  private tryMove(dx: number, dy: number, dt: number): void {
    const spd = 55;
    let nx = this.px + dx * spd * dt;
    const ny = this.py + dy * spd * dt;
    const w = 12;
    const h = 12;

    const blocked = (x: number, y: number) => {
      for (let r = Math.floor(y / TILE); r <= Math.floor((y + h - 1) / TILE); r++) {
        for (let c = Math.floor(x / TILE); c <= Math.floor((x + w - 1) / TILE); c++) {
          const t = this.tileAt(c * TILE, r * TILE);
          if (isSolidTile(t, SOLID_TILES)) return true;
          if (t === CUTTABLE && !this.machete) return true;
          if (this.area.dark && !this.lantern && t === 10) {
            // can walk dark floor but limited vision only
          }
        }
      }
      return false;
    };

    if (!blocked(nx, this.py)) this.px = nx;
    else nx = this.px;
    if (!blocked(this.px, ny)) this.py = ny;

    // vines cut on walk with machete
    const tc = Math.floor((this.px + 6) / TILE);
    const tr = Math.floor((this.py + 6) / TILE);
    const under = this.tileAt(tc * TILE, tr * TILE);
    if (under === CUTTABLE && this.machete) {
      this.map.tiles[tr * this.map.width + tc] = 4;
      this.audio.sfx('bush');
    }
  }

  private slashAttack(): void {
    if (this.slashCd > 0) return;
    this.slash = 0.18;
    this.slashCd = 0.28;
    this.audio.sfx('slash');

    let sx = this.px;
    let sy = this.py;
    if (this.facing === 1) sx += 12;
    else if (this.facing === 3) sx -= 10;
    else if (this.facing === 0) sy -= 10;
    else sy += 12;

    // cut bush
    const bc = Math.floor((sx + 4) / TILE);
    const br = Math.floor((sy + 4) / TILE);
    const bt = this.tileAt(bc * TILE, br * TILE);
    if (bt === BUSH) {
      this.map.tiles[br * this.map.width + bc] = 0;
      this.audio.sfx('bush');
    }
    if (bt === CUTTABLE && this.machete) {
      this.map.tiles[br * this.map.width + bc] = 4;
      this.audio.sfx('bush');
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.x - sx) < 14 && Math.abs(e.y - sy) < 14) {
        e.hp -= 1;
        this.audio.sfx('hit');
        if (e.hp <= 0) e.alive = false;
      }
    }

    // chest
    if (bt === CHEST && this.area.chest) {
      const key = `${this.area.id}-chest`;
      if (!this.openedChests.has(key) && bc === this.area.chest.col && br === this.area.chest.row) {
        this.openedChests.add(key);
        this.map.tiles[br * this.map.width + bc] = 7;
        const item = this.area.chest.item;
        if (item === 'machete') this.machete = true;
        if (item === 'lantern') this.lantern = true;
        this.getItemName = item.toUpperCase();
        this.getItemT = 2.2;
        this.mode = 'getitem';
        this.audio.sfx('fanfare');
        this.audio.playTrack('item');
      }
    }
  }

  private checkLinks(): void {
    const c = Math.floor((this.px + 6) / TILE);
    const r = Math.floor((this.py + 6) / TILE);
    for (const link of this.area.links) {
      if (link.col === c && link.row === r) {
        if (this.area.id === 'start' && link.target === 'jungleE' && !this.machete) return;
        this.loadArea(link.target, link.sx, link.sy);
        return;
      }
    }
  }

  update(dt: number): void {
    this.anim += dt;

    if (this.mode === 'rain') {
      this.rainT += dt;
      for (const d of this.rainDrops) {
        d.y += 50 * dt;
        if (d.y > 144) {
          d.y = -4;
          d.x = Math.random() * 160;
        }
      }
      if (this.rainT > 3.5) {
        this.mode = 'title';
        this.audio.playTrack('overworld');
      }
      return;
    }

    if (this.mode === 'getitem') {
      this.getItemT -= dt;
      if (this.getItemT <= 0) {
        this.mode = 'playing';
        this.audio.playTrack(this.area.music);
        if (this.machete && this.lantern) {
          this.mode = 'win';
          this.audio.sfx('fanfare');
        }
      }
      return;
    }

    if (this.mode !== 'playing') return;

    if (this.invuln > 0) this.invuln -= dt;
    if (this.slash > 0) this.slash -= dt;
    if (this.slashCd > 0) this.slashCd -= dt;

    let dx = 0;
    let dy = 0;
    if (this.held.up) {
      dy = -1;
      this.facing = 0;
    }
    if (this.held.down) {
      dy = 1;
      this.facing = 2;
    }
    if (this.held.left) {
      dx = -1;
      this.facing = 3;
    }
    if (this.held.right) {
      dx = 1;
      this.facing = 1;
    }
    if (dx || dy) this.tryMove(dx, dy, dt);

    this.camX = Math.max(0, Math.min(this.map.width * TILE - 160, this.px - 76));
    this.camY = Math.max(0, Math.min(this.map.height * TILE - 144, this.py - 64));

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      if (e.type === 'slime') {
        e.x += Math.sin(e.t) * 15 * dt;
        e.y += Math.cos(e.t * 0.7) * 10 * dt;
      } else {
        e.x += Math.sin(e.t * 2) * 30 * dt;
        e.y += Math.cos(e.t * 1.5) * 25 * dt;
      }
      if (
        this.invuln <= 0 &&
        Math.abs(e.x - this.px) < 12 &&
        Math.abs(e.y - this.py) < 12
      ) {
        this.hp -= 1;
        this.invuln = 1;
        this.audio.sfx('hurt');
        if (this.hp <= 0) {
          this.hp = this.maxHp;
          this.loadArea('start', 80, 100);
        }
      }
    }

    this.checkLinks();
  }

  onInput(input: InputState): void {
    if (this.mode === 'rain') {
      if (input.pressed.has('a') || input.pressed.has('start')) {
        this.mode = 'title';
        this.audio.playTrack('overworld');
      }
      return;
    }
    if (this.mode === 'title') {
      if (input.pressed.has('a') || input.pressed.has('start')) this.beginAdventure();
      return;
    }
    if (this.mode === 'win') {
      if (input.pressed.has('a') || input.pressed.has('start')) {
        this.mode = 'title';
        this.audio.playTrack('overworld');
      }
      return;
    }
    if (this.mode === 'getitem') return;

    if (input.pressed.has('start')) {
      if (this.mode === 'playing') {
        this.mode = 'items';
        this.audio.sfx('select');
      } else if (this.mode === 'items' || this.mode === 'map') {
        this.mode = 'playing';
        this.audio.sfx('select');
      }
      return;
    }
    if (this.mode === 'items' || this.mode === 'map') {
      if (input.pressed.has('left') || input.pressed.has('right') || input.pressed.has('select')) {
        this.mode = this.mode === 'items' ? 'map' : 'items';
        this.audio.sfx('select');
      }
      if (input.pressed.has('b')) {
        this.mode = 'playing';
        this.audio.sfx('select');
      }
      return;
    }
    if (this.mode !== 'playing') return;

    this.held.up = input.held.has('up');
    this.held.down = input.held.has('down');
    this.held.left = input.held.has('left');
    this.held.right = input.held.has('right');

    if (input.pressed.has('b')) this.slashAttack();
    if (input.pressed.has('a')) {
      // interact chest / talk
      this.slashAttack();
    }
  }

  private drawHearts(renderer: CanvasRenderer): void {
    for (let i = 0; i < this.maxHp / 2; i++) {
      const filled = this.hp > i * 2;
      const half = this.hp === i * 2 + 1;
      renderer.fillRect(4 + i * 9, 2, 7, 6, filled || half ? PaletteShade.Darkest : PaletteShade.Light);
      if (half) renderer.fillRect(8 + i * 9, 2, 3, 6, PaletteShade.Light);
    }
  }

  render(renderer: CanvasRenderer): void {
    const ctx = renderer.context;
    renderer.clear(PaletteShade.Lightest);

    if (this.mode === 'rain') {
      renderer.fillRect(0, 0, 160, 144, PaletteShade.Dark);
      renderer.drawText('...', 80, 50, { shade: PaletteShade.Light, align: 'center', size: 8 });
      renderer.drawText('It was raining', 80, 70, {
        shade: PaletteShade.Lightest,
        align: 'center',
        size: 7,
      });
      renderer.drawText('in the jungle...', 80, 82, {
        shade: PaletteShade.Lightest,
        align: 'center',
        size: 7,
      });
      drawRain(ctx, this.rainDrops);
      return;
    }

    if (this.mode === 'title') {
      renderer.drawText('LEGEND OF THE', 80, 28, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 6,
      });
      renderer.drawText('HIDDEN TEMPLES', 80, 40, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 9,
      });
      drawHero(ctx, 72, 60, 2, 0);
      renderer.drawText('A START', 80, 100, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText('B SWORD  START MENU', 80, 118, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
      return;
    }

    // world
    this.tileR.render(ctx, this.map, TEMPLE_TILES, this.camX, this.camY, 160, 144);

    // darkness overlay for temple2 without lantern (lamp radius)
    if (this.area.dark && !this.lantern) {
      const lx = this.px - this.camX + 6;
      const ly = this.py - this.camY + 6;
      ctx.fillStyle = PALETTE_HEX[PaletteShade.Darkest];
      ctx.beginPath();
      ctx.rect(0, 0, 160, 144);
      ctx.arc(lx, ly, 32, 0, Math.PI * 2, true);
      ctx.fill();
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.type === 'slime') drawSlime(ctx, e.x - this.camX, e.y - this.camY);
      else drawBat(ctx, e.x - this.camX, e.y - this.camY, e.t);
    }

    if (this.invuln <= 0 || Math.floor(this.anim * 16) % 2 === 0) {
      drawHero(
        ctx,
        this.px - this.camX,
        this.py - this.camY,
        this.facing,
        this.slash,
        this.invuln > 0.7,
      );
    }

    this.drawHearts(renderer);
    renderer.drawText(this.area.name.slice(0, 12), 70, 2, {
      shade: PaletteShade.Dark,
      size: 5,
    });

    if (this.mode === 'getitem') {
      renderer.fillRect(20, 40, 120, 50, PaletteShade.Lightest);
      renderer.strokeRect(20, 40, 120, 50, PaletteShade.Darkest);
      renderer.drawText('YOU GOT', 80, 50, {
        shade: PaletteShade.Dark,
        align: 'center',
        size: 7,
      });
      renderer.drawText(this.getItemName, 80, 66, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 9,
      });
    }

    if (this.mode === 'items') {
      renderer.fillRect(8, 16, 144, 112, PaletteShade.Lightest);
      renderer.strokeRect(8, 16, 144, 112, PaletteShade.Darkest);
      renderer.drawText('ITEMS', 80, 22, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 8,
      });
      renderer.drawText(this.machete ? '* MACHETE' : '- ----', 20, 40, {
        shade: PaletteShade.Dark,
        size: 7,
      });
      renderer.drawText(this.lantern ? '* LANTERN' : '- ----', 20, 54, {
        shade: PaletteShade.Dark,
        size: 7,
      });
      renderer.drawText(`HEARTS ${this.hp}/${this.maxHp}`, 20, 74, {
        shade: PaletteShade.Dark,
        size: 7,
      });
      renderer.drawText('<> MAP   B BACK', 80, 112, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
    }

    if (this.mode === 'map') {
      renderer.fillRect(8, 16, 144, 112, PaletteShade.Lightest);
      renderer.strokeRect(8, 16, 144, 112, PaletteShade.Darkest);
      renderer.drawText('MAP', 80, 22, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 8,
      });
      const rooms = ['start', 'jungleE', 'temple1', 'temple2'];
      const labels = ['Clear', 'Vines', 'Moss', 'Shadow'];
      const positions = [
        { x: 40, y: 60 },
        { x: 100, y: 60 },
        { x: 40, y: 90 },
        { x: 100, y: 90 },
      ];
      rooms.forEach((id, i) => {
        const known = this.visited.has(id);
        const here = this.area.id === id;
        renderer.fillRect(
          positions[i].x,
          positions[i].y,
          20,
          12,
          here ? PaletteShade.Darkest : known ? PaletteShade.Dark : PaletteShade.Light,
        );
        if (known) {
          renderer.drawText(labels[i].slice(0, 4), positions[i].x + 10, positions[i].y + 3, {
            shade: here ? PaletteShade.Lightest : PaletteShade.Lightest,
            align: 'center',
            size: 5,
          });
        }
      });
      renderer.drawText('<> ITEMS  B BACK', 80, 112, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 5,
      });
    }

    if (this.mode === 'win') {
      renderer.fillRect(16, 40, 128, 60, PaletteShade.Lightest);
      renderer.strokeRect(16, 40, 128, 60, PaletteShade.Darkest);
      renderer.drawText('TEMPLES OPEN', 80, 52, {
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
  }

  destroy(): void {
    this.audio.destroy();
  }
}

export function createHiddenTemples(): Game {
  return new HiddenTemples();
}
