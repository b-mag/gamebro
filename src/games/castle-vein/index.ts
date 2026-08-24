import type { GameBoyEngine, Game, CanvasRenderer, InputState, TileMapData } from '@/engine';
import {
  PaletteShade,
  TileMapRenderer,
  encodeCastleVeinSave,
  formatSaveCode,
  type CastleVeinSaveData,
} from '@/engine';
import {
  GRAVITY,
  JUMP_FORCE,
  MOVE_SPEED,
  BACKDASH_SPEED,
  BACKDASH_DURATION,
  Relic,
  TILE,
  type GameMode,
  type PlayerState,
  type EnemyState,
  type RoomDef,
} from './types';
import { CASTLE_TILES, drawBelard, drawEnemy, drawPickup } from './render/Sprites';
import { createPlayerState, resolveTileCollision, aabbOverlap } from './physics/Collision';
import { getRoom } from './world/Rooms';
import { CastleVeinAudio } from './audio/CastleVeinAudio';

let enemyIdCounter = 0;

export class CastleVein implements Game {
  readonly id = 'castle-vein';
  readonly slug = 'castle-vein';
  readonly name = 'Castle Vein';
  readonly description = 'Belard explores the cursed castle. A GB metroidvania.';

  private engine: GameBoyEngine | null = null;
  private audio = new CastleVeinAudio();
  private tileRenderer = new TileMapRenderer(TILE);

  private mode: GameMode = 'intro';
  private player!: PlayerState;
  private enemies: EnemyState[] = [];
  private room!: RoomDef;
  private map!: TileMapData;
  private camera = { x: 0, y: 0 };

  // Intro state
  private introX = 0;
  private introTimer = 0;
  private introJumped = false;
  private drawbridgeY = 0;

  // Menu state
  private menuCursor = 0;
  private menuPage: 'main' | 'weapon' | 'armor' = 'main';
  private lastSaveCode = '';

  // Save overlay
  private saveTimer = 0;

  init(engine: GameBoyEngine): void {
    this.engine = engine;
    void engine.initAudio().then(() => {
      const ctx = engine.audio.getContext();
      const master = engine.audio.getMasterGain();
      if (ctx && master) this.audio.init(ctx, master);
      this.audio.playTrack('intro');
    });
    this.player = createPlayerState(0, 0);
    this.mode = 'intro';
    this.introX = 0;
    this.introTimer = 0;
    this.drawbridgeY = 0;
  }

  loadFromSave(data: CastleVeinSaveData): void {
    this.player = createPlayerState(data.x, data.y);
    this.player.hp = data.hp;
    this.player.maxHp = data.maxHp;
    this.player.weapon = data.weapon;
    this.player.armor = data.armor;
    this.player.relics = data.relics;
    this.player.gold = data.gold;
    this.player.bossesDefeated = data.bosses;
    this.loadRoom(data.room, data.x, data.y);
    this.mode = 'playing';
  }

  private loadRoom(id: string, spawnX: number, spawnY: number): void {
    this.room = getRoom(id);
    this.map = { width: this.room.width, height: this.room.height, tiles: [...this.room.tiles] };
    // Snap spawn to standing on floor row
    const floorY = (this.room.height - 3) * TILE - 14;
    this.player.x = spawnX;
    this.player.y = spawnY > 0 ? spawnY : floorY;
    if (this.player.y > floorY) this.player.y = floorY;
    this.player.vx = 0;
    this.player.vy = 0;
    this.enemies = this.room.enemies.map((e) => this.spawnEnemy(e.type, e.x, e.y));
    this.audio.playTrack(this.room.music);
  }

  private spawnEnemy(type: EnemyState['type'], x: number, y: number): EnemyState {
    const boss = type.startsWith('boss');
    return {
      id: enemyIdCounter++,
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      w: boss ? 16 : 12,
      h: boss ? 14 : 12,
      hp: boss ? 40 : type === 'knight' ? 8 : type === 'skeleton' ? 4 : 3,
      maxHp: boss ? 40 : type === 'knight' ? 8 : type === 'skeleton' ? 4 : 3,
      facing: -1,
      phase: 0,
      alive: true,
      invuln: 0,
    };
  }

  update(dt: number): void {
    switch (this.mode) {
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'save':
        this.saveTimer += dt;
        break;
      case 'dead':
        this.introTimer += dt;
        if (this.introTimer > 2) {
          this.loadRoom('entrance', 48, 100);
          this.player.hp = this.player.maxHp;
          this.mode = 'playing';
        }
        break;
    }
    this.player.anim += dt;
  }

  private updateIntro(dt: number): void {
    this.introTimer += dt;
    this.introX += 90 * dt;
    this.drawbridgeY = Math.min(40, this.introTimer * 12);

    // Auto jump at drawbridge
    if (this.introX > 100 && !this.introJumped) {
      this.introJumped = true;
      this.audio.sfx('jump');
    }
    if (this.introJumped && this.introTimer < 2.5) {
      // parabolic jump arc
    }

    if (this.introTimer > 3.2) {
      this.loadRoom('entrance', 48, 0);
      this.mode = 'playing';
    }
  }

  private updatePlaying(dt: number): void {
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.attacking > 0) p.attacking -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.backdash > 0) p.backdash -= dt;
    if (p.backdashCooldown > 0) p.backdashCooldown -= dt;

    // Gravity / ladder
    if (p.onLadder && !p.backdash) {
      p.vx *= 0.8;
      // vy set by onInput for ladder climb; don't apply gravity
      if (!p.grounded) p.vy = Math.min(Math.max(p.vy, -MOVE_SPEED), MOVE_SPEED);
    } else if (p.backdash <= 0) {
      p.vy += GRAVITY * dt;
    }

    // Apply velocity
    if (p.backdash > 0) {
      p.vx = -p.facing * BACKDASH_SPEED;
      p.vy = 0;
    }

    const result = resolveTileCollision(this.map, { x: p.x, y: p.y, w: p.w, h: p.h }, p.vx * dt, p.vy * dt);
    p.x = result.x;
    p.y = result.y;
    p.grounded = result.grounded;
    p.onLadder = result.onLadder;
    if (result.hitSpike && p.invuln <= 0) this.damagePlayer(15);

    // Reset vertical velocity when grounded — prevents tunneling through floors
    if (p.grounded) {
      p.vy = 0;
      p.jumpCount = 0;
    } else {
      p.vy = Math.min(p.vy, 200);
    }

    // Break cracked floors with Blood Sigil
    if (p.grounded && (p.relics & Relic.BloodSigil) && p.vy >= 0) {
      const col = Math.floor((p.x + p.w / 2) / TILE);
      const row = Math.floor((p.y + p.h) / TILE);
      const idx = row * this.map.width + col;
      if (this.map.tiles[idx] === 4) {
        this.map.tiles[idx] = 0;
        this.audio.sfx('hit');
      }
    }

    // Room transitions via doors
    for (const door of this.room.doors) {
      const dx = door.col * TILE;
      const dy = door.row * TILE;
      if (aabbOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, { x: dx, y: dy, w: TILE, h: TILE })) {
        this.loadRoom(door.targetRoom, door.spawnX, door.spawnY);
        break;
      }
    }

    // Save room candle
    if (this.room.isSaveRoom) {
      const cx = 10 * TILE;
      const cy = 6 * TILE;
      if (aabbOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, { x: cx, y: cy, w: TILE * 2, h: TILE * 2 })) {
        // proximity indicator handled in render
      }
    }

    // Pickups
    for (const pickup of this.room.pickups) {
      if (pickup.collected) continue;
      if (aabbOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, { x: pickup.x, y: pickup.y, w: 8, h: 8 })) {
        pickup.collected = true;
        this.collectPickup(pickup.kind, pickup.id);
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.phase += dt;
      if (e.invuln > 0) e.invuln -= dt;
      this.updateEnemy(e, dt);
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    // Camera follow
    const roomPxW = this.room.width * TILE;
    const roomPxH = this.room.height * TILE;
    this.camera.x = Math.max(0, Math.min(roomPxW - 160, p.x + p.w / 2 - 80));
    this.camera.y = Math.max(0, Math.min(roomPxH - 144, p.y + p.h / 2 - 72));

    if (p.hp <= 0) {
      this.mode = 'dead';
      this.introTimer = 0;
      this.audio.sfx('hurt');
    }
  }

  private updateEnemy(e: EnemyState, dt: number): void {
    const p = this.player;
    const dist = p.x - e.x;

    switch (e.type) {
      case 'bat':
        e.vy = Math.sin(e.phase * 3) * 30;
        e.vx = dist > 0 ? 20 : -20;
        e.facing = dist > 0 ? 1 : -1;
        break;
      case 'skeleton':
        if (Math.abs(dist) < 100) e.vx = dist > 0 ? 25 : -25;
        else e.vx = 0;
        e.vy += GRAVITY * dt;
        e.facing = dist > 0 ? 1 : -1;
        break;
      case 'knight':
        if (Math.abs(dist) < 80 && Math.abs(dist) > 20) e.vx = dist > 0 ? 35 : -35;
        else e.vx = 0;
        e.vy += GRAVITY * dt;
        e.facing = dist > 0 ? 1 : -1;
        break;
      case 'boss_guard':
        if (e.phase % 3 < 1.5) e.vx = dist > 0 ? 45 : -45;
        else e.vx = 0;
        e.vy += GRAVITY * dt;
        e.facing = dist > 0 ? 1 : -1;
        break;
      case 'wraith':
      case 'boss_wraith':
        e.vx = Math.sin(e.phase * 2) * 40;
        e.vy = Math.cos(e.phase * 1.5) * 20;
        e.facing = dist > 0 ? 1 : -1;
        break;
    }

    const er = resolveTileCollision(this.map, { x: e.x, y: e.y, w: e.w, h: e.h }, e.vx * dt, e.vy * dt);
    e.x = er.x;
    e.y = er.y;
    if (er.grounded) e.vy = 0;
    else e.vy = er.vy / dt;

    if (aabbOverlap({ x: e.x, y: e.y, w: e.w, h: e.h }, { x: p.x, y: p.y, w: p.w, h: p.h })) {
      if (p.invuln <= 0 && p.backdash <= 0) {
        const dmg = e.type.startsWith('boss') ? 20 : e.type === 'knight' ? 12 : 8;
        this.damagePlayer(dmg);
        p.vx = (p.x < e.x ? -1 : 1) * 80;
        p.vy = -60;
        p.knockback = 0.2;
      }
    }
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    const reduction = p.armor === 2 ? 0.5 : p.armor === 1 ? 0.75 : 1;
    p.hp -= amount * reduction;
    p.invuln = 1.0;
    this.audio.sfx('hurt');
  }

  private collectPickup(kind: string, id: number): void {
    const p = this.player;
    this.audio.sfx('pickup');
    switch (kind) {
      case 'weapon':
        p.weapon = id;
        break;
      case 'armor':
        p.armor = id;
        break;
      case 'relic':
        p.relics |= id;
        break;
      case 'heart':
        p.hp = Math.min(p.maxHp, p.hp + 30);
        break;
      case 'gold':
        p.gold += 50;
        break;
    }
  }

  private performAttack(): void {
    const p = this.player;
    if (p.attackCooldown > 0 || p.attacking > 0) return;
    p.attacking = 0.25;
    p.attackCooldown = 0.35;
    this.audio.sfx(p.weapon === 1 ? 'sword' : 'whip');

    const reach = p.weapon === 2 ? 28 : p.weapon === 1 ? 22 : 18;
    const ax = p.facing > 0 ? p.x + p.w : p.x - reach;
    const hitBox = { x: ax, y: p.y, w: reach, h: p.h };

    for (const e of this.enemies) {
      if (!e.alive || e.invuln > 0) continue;
      if (aabbOverlap(hitBox, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        const dmg = p.weapon === 2 ? 6 : p.weapon === 1 ? 4 : 3;
        e.hp -= dmg;
        e.invuln = 0.15;
        e.x += p.facing * 10;
        this.audio.sfx('hit');
        if (e.hp <= 0) {
          e.alive = false;
          p.gold += e.type.startsWith('boss') ? 200 : 20;
          if (e.type.startsWith('boss')) {
            p.bossesDefeated++;
            if (p.bossesDefeated >= 2) this.mode = 'victory';
          }
        }
      }
    }
  }

  private saveGame(): void {
    this.lastSaveCode = encodeCastleVeinSave({
      room: this.room.id,
      x: Math.floor(this.player.x),
      y: Math.floor(this.player.y),
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      weapon: this.player.weapon,
      armor: this.player.armor,
      relics: this.player.relics,
      gold: this.player.gold,
      bosses: this.player.bossesDefeated,
    });
    this.mode = 'save';
    this.saveTimer = 0;
    this.audio.sfx('save');
  }

  onInput(input: InputState): void {
    if (this.mode === 'menu') {
      this.handleMenuInput(input);
      return;
    }
    if (this.mode === 'save') {
      if (input.pressed.has('a') || input.pressed.has('b') || input.pressed.has('start')) {
        this.mode = 'playing';
        this.engine?.audio.play('beep');
      }
      return;
    }
    if (this.mode === 'intro' || this.mode === 'dead' || this.mode === 'victory') return;
    if (this.mode !== 'playing') return;

    const p = this.player;

    if (input.pressed.has('start')) {
      this.mode = 'menu';
      this.menuPage = 'main';
      this.menuCursor = 0;
      this.engine?.audio.play('beep');
      return;
    }

    if (p.backdash > 0) return;

    // Backdash: hold opposite direction + jump (A)
    const left = input.held.has('left');
    const right = input.held.has('right');
    if (input.pressed.has('a') && p.backdashCooldown <= 0) {
      const oppLeft = p.facing > 0 && left;
      const oppRight = p.facing < 0 && right;
      if (oppLeft || oppRight) {
        p.backdash = BACKDASH_DURATION;
        p.backdashCooldown = 0.5;
        p.invuln = BACKDASH_DURATION;
        this.audio.sfx('dash');
        return;
      }
      // Normal jump
      const canJump = p.grounded || p.onLadder;
      const canDouble = (p.relics & Relic.VeinWings) && p.jumpCount === 1;
      if (canJump || canDouble) {
        p.vy = JUMP_FORCE;
        p.grounded = false;
        p.onLadder = false;
        p.jumpCount++;
        this.audio.sfx('jump');
      }
    }

    if (input.pressed.has('b')) {
      this.performAttack();
    }

    if (p.backdash <= 0) {
      if (left) {
        p.vx = -MOVE_SPEED;
        p.facing = -1;
      } else if (right) {
        p.vx = MOVE_SPEED;
        p.facing = 1;
      } else {
        p.vx = 0;
      }

      if (p.onLadder) {
        if (input.held.has('up')) p.vy = -MOVE_SPEED;
        else if (input.held.has('down')) p.vy = MOVE_SPEED;
      }
    }

    // Save at candle in save room
    if (this.room.isSaveRoom && input.pressed.has('a')) {
      const cx = 10 * TILE;
      const cy = 6 * TILE;
      if (aabbOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, { x: cx - 8, y: cy, w: 32, h: 16 })) {
        this.saveGame();
      }
    }
  }

  private handleMenuInput(input: InputState): void {
    if (input.pressed.has('start') || input.pressed.has('b')) {
      this.mode = 'playing';
      this.engine?.audio.play('beep');
      return;
    }
    if (input.pressed.has('up')) {
      this.menuCursor = Math.max(0, this.menuCursor - 1);
      this.engine?.audio.play('beep');
    }
    if (input.pressed.has('down')) {
      this.menuCursor = Math.min(2, this.menuCursor + 1);
      this.engine?.audio.play('beep');
    }
    if (input.pressed.has('a')) {
      if (this.menuCursor === 0) this.menuPage = 'weapon';
      else if (this.menuCursor === 1) this.menuPage = 'armor';
      else this.mode = 'playing';
      this.engine?.audio.play('select');
    }
    if (this.menuPage !== 'main') {
      if (input.pressed.has('left') || input.pressed.has('right')) {
        if (this.menuPage === 'weapon') {
          this.player.weapon = ((this.player.weapon + (input.pressed.has('right') ? 1 : 2)) % 3) as 0 | 1 | 2;
        } else {
          this.player.armor = ((this.player.armor + (input.pressed.has('right') ? 1 : 2)) % 3) as 0 | 1 | 2;
        }
        this.engine?.audio.play('beepHigh');
      }
      if (input.pressed.has('a')) this.menuPage = 'main';
    }
  }

  render(renderer: CanvasRenderer): void {
    if (this.mode === 'intro') {
      this.renderIntro(renderer);
      return;
    }
    if (this.mode === 'menu') {
      this.renderWorld(renderer);
      this.renderMenu(renderer);
      return;
    }
    if (this.mode === 'save') {
      this.renderWorld(renderer);
      this.renderSaveScreen(renderer);
      return;
    }
    if (this.mode === 'dead') {
      renderer.clear(PaletteShade.Darkest);
      renderer.drawText('BELARD FELL', 80, 60, { shade: PaletteShade.Light, align: 'center', size: 9 });
      renderer.drawText('...rising again', 80, 76, { shade: PaletteShade.Dark, align: 'center', size: 7 });
      return;
    }
    if (this.mode === 'victory') {
      renderer.clear(PaletteShade.Lightest);
      renderer.drawText('CASTLE VEIN', 80, 50, { shade: PaletteShade.Darkest, align: 'center', size: 9 });
      renderer.drawText('CONQUERED', 80, 66, { shade: PaletteShade.Dark, align: 'center', size: 8 });
      renderer.drawText(`GOLD:${this.player.gold}`, 80, 90, { shade: PaletteShade.Darkest, align: 'center', size: 7 });
      return;
    }

    this.renderWorld(renderer);
    this.renderHUD(renderer);
  }

  private renderIntro(renderer: CanvasRenderer): void {
    renderer.clear(PaletteShade.Lightest);
    const ctx = renderer.context;

    // Sky / ground
    renderer.fillRect(0, 96, 160, 48, PaletteShade.Dark);
    renderer.fillRect(0, 88, 160, 8, PaletteShade.Light);

    // Trees (parallax)
    for (let i = 0; i < 6; i++) {
      const tx = ((i * 40 - this.introX * 0.5) % 200 + 200) % 200 - 20;
      renderer.fillRect(tx, 60, 6, 28, PaletteShade.Darkest);
      renderer.fillRect(tx - 4, 52, 14, 12, PaletteShade.Dark);
    }

    // Castle silhouette
    renderer.fillRect(110, 20, 50, 68, PaletteShade.Darkest);
    renderer.fillRect(120, 10, 20, 12, PaletteShade.Darkest);
    // Drawbridge gap
    renderer.fillRect(118, 88 - this.drawbridgeY, 24, 4 + this.drawbridgeY, PaletteShade.Lightest);
    renderer.fillRect(118, 92, 24, 8, PaletteShade.Darkest);

    // Belard running
    const belardX = Math.min(130, 20 + this.introX * 0.6);
    const belardY = this.introJumped
      ? 76 - Math.sin(Math.min(1, (this.introTimer - 1.2) * 2) * Math.PI) * 24
      : 76;
    drawBelard(ctx, belardX, belardY, 1, this.introTimer * 10, false);

    renderer.drawText('CASTLE VEIN', 80, 4, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
  }

  private renderWorld(renderer: CanvasRenderer): void {
    renderer.clear(PaletteShade.Lightest);
    const ctx = renderer.context;
    const cam = this.camera;

    this.tileRenderer.render(ctx, this.map, CASTLE_TILES, cam.x, cam.y, 160, 144);

    for (const pickup of this.room.pickups) {
      if (pickup.collected) continue;
      drawPickup(ctx, pickup.kind, pickup.x - cam.x, pickup.y - cam.y, this.player.anim);
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      drawEnemy(ctx, e.type, e.x - cam.x, e.y - cam.y, e.facing, e.phase);
    }

    const p = this.player;
    // Only flicker when damaged, not during backdash (backdash uses brief alpha instead)
    const dmgFlash = p.invuln > 0 && p.backdash <= 0 && Math.floor(p.invuln * 12) % 2 === 0;
    if (!dmgFlash) {
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      // Only draw when on screen
      if (sx > -20 && sx < 170 && sy > -20 && sy < 160) {
        drawBelard(ctx, sx, sy, p.facing, p.anim, p.attacking > 0);
      }
    }

    // Attack arc
    if (p.attacking > 0) {
      const reach = p.weapon === 2 ? 28 : p.weapon === 1 ? 22 : 18;
      const ax = p.facing > 0 ? p.x + p.w - cam.x : p.x - reach - cam.x;
      renderer.strokeRect(ax, p.y - cam.y, reach, p.h, PaletteShade.Light);
    }
  }

  private renderHUD(renderer: CanvasRenderer): void {
    const p = this.player;
    const weapons = ['WHIP', 'SWORD', 'AXE'];
    renderer.drawText(`HP:${Math.ceil(p.hp)}`, 2, 2, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawBar(30, 2, 40, 5, p.hp, p.maxHp, PaletteShade.Dark);
    renderer.drawText(`${weapons[p.weapon]}`, 2, 10, { shade: PaletteShade.Dark, size: 6 });
    renderer.drawText(`G:${p.gold}`, 2, 18, { shade: PaletteShade.Dark, size: 6 });
    renderer.drawText(this.room.name.slice(0, 14), 80, 2, { shade: PaletteShade.Darkest, align: 'center', size: 6 });

    if (p.relics & Relic.VeinWings) {
      renderer.drawText('WG', 140, 2, { shade: PaletteShade.Darkest, size: 6 });
    }
    if (p.relics & Relic.BloodSigil) {
      renderer.drawText('SG', 140, 10, { shade: PaletteShade.Darkest, size: 6 });
    }

    if (this.room.isSaveRoom) {
      renderer.drawText('A AT CANDLE', 80, 136, { shade: PaletteShade.Dark, align: 'center', size: 6 });
    }
  }

  private renderMenu(renderer: CanvasRenderer): void {
    renderer.fillRect(20, 24, 120, 96, PaletteShade.Dark);
    renderer.strokeRect(20, 24, 120, 96, PaletteShade.Darkest);
    renderer.drawText('EQUIP', 80, 30, { shade: PaletteShade.Lightest, align: 'center', size: 8 });

    const weapons = ['WHIP', 'SWORD', 'AXE'];
    const armors = ['CLOAK', 'LEATHER', 'PLATE'];

    if (this.menuPage === 'main') {
      const items = [`WEAPON: ${weapons[this.player.weapon]}`, `ARMOR: ${armors[this.player.armor]}`, 'CLOSE'];
      items.forEach((item, i) => {
        const prefix = i === this.menuCursor ? '>' : ' ';
        renderer.drawText(prefix + item, 30, 48 + i * 14, {
          shade: i === this.menuCursor ? PaletteShade.Lightest : PaletteShade.Light,
          size: 7,
        });
      });
    } else if (this.menuPage === 'weapon') {
      renderer.drawText('< ' + weapons[this.player.weapon] + ' >', 80, 60, {
        shade: PaletteShade.Lightest,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A=OK', 80, 100, { shade: PaletteShade.Light, align: 'center', size: 6 });
    } else {
      renderer.drawText('< ' + armors[this.player.armor] + ' >', 80, 60, {
        shade: PaletteShade.Lightest,
        align: 'center',
        size: 7,
      });
      renderer.drawText('A=OK', 80, 100, { shade: PaletteShade.Light, align: 'center', size: 6 });
    }
  }

  private renderSaveScreen(renderer: CanvasRenderer): void {
    renderer.fillRect(10, 40, 140, 64, PaletteShade.Dark);
    renderer.drawText('GAME SAVED', 80, 48, { shade: PaletteShade.Lightest, align: 'center', size: 8 });
    renderer.drawText(formatSaveCode(this.lastSaveCode), 80, 64, {
      shade: PaletteShade.Light,
      align: 'center',
      size: 6,
    });
    renderer.drawText('A=CONTINUE', 80, 90, { shade: PaletteShade.Light, align: 'center', size: 6 });
  }

  destroy(): void {
    this.audio.destroy();
    this.engine = null;
  }
}

export function createCastleVein(): CastleVein {
  return new CastleVein();
}

export type { CastleVeinSaveData };
