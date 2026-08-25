import type { GameBoyEngine, Game, CanvasRenderer, InputState } from '@/engine';
import {
  SolidMeshRenderer,
  WireframeRenderer,
  PaletteShade,
  encodePrefixedLevelSave,
  formatSaveCode,
  normalize,
  sub,
  dot,
  solidBox,
  BOX_EDGES,
  type SolidFace,
} from '@/engine';
import {
  generateLevel,
  makePlatform,
  makeHusk,
  hasHeightmapLOS,
  cellWorldPos,
  CREATE_COST,
  BOOST_COST,
  type GeneratedLevel,
  type WorldObject,
} from './levels/LevelGenerator';

type GameState = 'playing' | 'dying' | 'levelComplete' | 'showCode' | 'paused';

const CREATE_COST_N = CREATE_COST;
const BOOST_COST_N = BOOST_COST;

/**
 * SENTRY — Sentinel remake with solid terrain, absorb/build/transfer.
 *
 * Controls:
 * - Left/Right: turn · Up/Down: pitch
 * - A: absorb / transfer into your shell / absorb Sentinel
 * - B: raise under yourself (tap repeatedly), or create warp shell when aiming at a tile
 * - Start: pause (A toggles wireframe)
 */
export class SentryGame implements Game {
  readonly id = 'sentry';
  readonly slug = 'sentry';
  readonly name = 'SENTRY';
  readonly description = 'Absorb. Build. Transfer. Silence the Sentinel.';

  private engine: GameBoyEngine | null = null;
  private solid = new SolidMeshRenderer();
  private wireframe = new WireframeRenderer();

  private level = 1;
  private score = 0;
  private baseSeed = (Date.now() & 0xffffffff) >>> 0;
  private world: GeneratedLevel | null = null;

  private cellX = 0;
  private cellZ = 0;
  private stack = 0;
  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private yaw = 0;
  private pitch = -0.2;

  private energy = 8;
  private maxEnergy = 30;

  private sentinelYaw = 0;
  private threatPhase = 0;
  private threatSpeed = 0.4;
  private lockedOn = false;
  private spotted = false;

  private state: GameState = 'playing';
  private deathTimer = 0;
  private completeTimer = 0;
  private shakeAmount = 0;
  private lastSaveCode = '';
  private nextId = 1000;

  private turnSpeed = 1.6;
  private pitchSpeed = 1.2;
  private hudFlash = false;
  private aimHint = '';
  /** false = solid filled (default); true = wireframe overlay/replace. */
  private wireframeMode = false;
  init(engine: GameBoyEngine): void {
    this.engine = engine;
    engine.audio.startAmbient();
    this.loadLevel(this.level);
  }

  loadFromSave(level: number, score: number, seed: number): void {
    this.level = level;
    this.score = score;
    this.baseSeed = seed;
    this.loadLevel(level);
  }

  update(dt: number): void {
    if (!this.world || !this.engine) return;

    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        this.deathTimer += dt;
        this.shakeAmount = 3;
        if (this.deathTimer > 1.5) {
          this.shakeAmount = 0;
          this.energy = Math.max(4, Math.floor(this.maxEnergy * 0.35));
          this.state = 'playing';
          this.loadLevel(this.level);
        }
        break;
      case 'levelComplete':
        this.completeTimer += dt;
        if (this.completeTimer > 2) {
          this.state = 'showCode';
          this.completeTimer = 0;
        }
        break;
      default:
        break;
    }

    this.hudFlash = this.lockedOn && Math.floor(performance.now() / 200) % 2 === 0;
    this.updateAimHint();
  }

  private updatePlaying(dt: number): void {
    if (!this.world) return;
    const cfg = this.world.config;

    this.energy -= cfg.passiveDrain * dt * 0.15;
    if (this.energy <= 0) {
      this.triggerDeath();
      return;
    }

    this.sentinelYaw += cfg.sentinelRotationSpeed * dt;
    this.updateThreat(dt);

    if (this.lockedOn && this.spotted) {
      this.energy -= cfg.beamDrain * dt * 0.08;
      if (this.energy <= 0) this.triggerDeath();
    }
  }

  private playerHeight(): number {
    if (!this.world) return 0;
    return (this.world.heights[this.cellZ]?.[this.cellX] ?? 0) + this.stack;
  }

  private syncPlayerPos(): void {
    if (!this.world) return;
    const pos = cellWorldPos(
      this.cellX,
      this.cellZ,
      this.world.config.gridSize,
      this.world.config.cellSize,
      this.world.heights,
      this.stack,
    );
    this.playerX = pos.x;
    this.playerY = pos.y + 1.6;
    this.playerZ = pos.z;
  }

  private updateThreat(dt: number): void {
    if (!this.world) return;
    const s = this.world.sentinel;
    const toPlayer = normalize(
      sub({ x: this.playerX, y: 0, z: this.playerZ }, { x: s.position.x, y: 0, z: s.position.z }),
    );
    const eyeDir = { x: Math.sin(this.sentinelYaw), y: 0, z: Math.cos(this.sentinelYaw) };
    const angleDot = dot(toPlayer, eyeDir);
    const los = hasHeightmapLOS(
      s.cellX,
      s.cellZ,
      s.height + 1,
      this.cellX,
      this.cellZ,
      this.playerHeight() + 0.5,
      this.world.heights,
    );

    const wasLocked = this.lockedOn;
    this.lockedOn = los && angleDot > 0.9;
    this.spotted = los && angleDot > 0.45;

    const proximity = Math.max(0, (angleDot - 0.3) / 0.7);
    this.threatSpeed = 0.25 + proximity * proximity * 7;
    if (this.lockedOn) this.threatSpeed = 11;

    this.threatPhase += this.threatSpeed * dt;
    if (this.threatPhase > 2) this.threatPhase -= 2;

    if (this.lockedOn && !wasLocked) this.engine?.audio.startSiren();
    else if (!this.lockedOn && wasLocked) this.engine?.audio.stopSiren();
  }

  private lookRay(): { dir: { x: number; y: number; z: number }; origin: { x: number; y: number; z: number } } {
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    // Camera looks along +forward after yaw/pitch (matches wireframe: after transform look +Z)
    const dir = {
      x: sy * cp,
      y: sp,
      z: cy * cp,
    };
    return {
      origin: { x: this.playerX, y: this.playerY, z: this.playerZ },
      dir: normalize(dir),
    };
  }

  /** Find closest object under crosshair (screen-center aim). */
  private findAimedObject(): WorldObject | null {
    if (!this.world) return null;
    const { origin, dir } = this.lookRay();
    let best: WorldObject | null = null;
    let bestScore = Infinity;

    for (const obj of this.world.objects) {
      if (obj.type === 'terrain') continue;
      if (obj.type === 'husk' && obj.cellX === this.cellX && obj.cellZ === this.cellZ && obj.owned) {
        continue; // current body
      }
      const to = sub(obj.position, origin);
      const dist = Math.hypot(to.x, to.y, to.z);
      if (dist < 1.5 || dist > 90) continue;
      const nd = normalize(to);
      const aim = dot(nd, dir);
      if (aim < 0.92) continue;
      const score = dist * (1.05 - aim);
      if (score < bestScore) {
        bestScore = score;
        best = obj;
      }
    }
    return best;
  }

  /** Strong crosshair lock on a buildable tile (no forward fallback). */
  private findAimedCell(): { cellX: number; cellZ: number; stack: number; aim: number } | null {
    if (!this.world) return null;
    const { origin, dir } = this.lookRay();
    const { gridSize, cellSize } = this.world.config;

    let bestScore = Infinity;
    let best: { cellX: number; cellZ: number; stack: number; aim: number } | null = null;

    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        if (x === this.cellX && z === this.cellZ) continue;
        if (!this.canBuildOn(x, z)) continue;

        const stackExtra = this.stackOnCell(x, z);
        const pos = cellWorldPos(x, z, gridSize, cellSize, this.world.heights, stackExtra);
        const topY = pos.y + 0.15;
        const to = sub({ x: pos.x, y: topY, z: pos.z }, origin);
        const dist = Math.hypot(to.x, to.y, to.z);
        if (dist < 1.2 || dist > 55) continue;
        const nd = normalize(to);
        const aim = dot(nd, dir);
        if (aim < 0.82) continue;
        const score = dist * (1.15 - aim);
        if (score < bestScore) {
          bestScore = score;
          best = { cellX: x, cellZ: z, stack: stackExtra, aim };
        }
      }
    }
    return best;
  }

  private canBuildOn(x: number, z: number): boolean {
    if (!this.world) return false;
    for (const o of this.world.objects) {
      if (o.cellX !== x || o.cellZ !== z) continue;
      if (o.type === 'cone' || o.type === 'husk' || o.type === 'sentinel') return false;
    }
    return true;
  }

  private stackOnCell(cx: number, cz: number): number {
    if (!this.world) return 0;
    let max = 0;
    for (const o of this.world.objects) {
      if (o.type === 'platform' && o.cellX === cx && o.cellZ === cz) {
        max = Math.max(max, (o.stack ?? 0) + 1);
      }
    }
    return max;
  }

  private updateAimHint(): void {
    if (this.state !== 'playing' || !this.world) {
      this.aimHint = '';
      return;
    }
    const aimed = this.findAimedObject();
    if (aimed?.type === 'cone') {
      this.aimHint = 'A:ABSORB';
      return;
    }
    if (aimed?.type === 'husk' && aimed.owned) {
      this.aimHint = 'A:TRANSFER';
      return;
    }
    if (aimed?.type === 'husk' && !aimed.owned) {
      this.aimHint = 'A:ABSORB';
      return;
    }
    if (aimed?.type === 'sentinel') {
      const canWin = this.playerHeight() >= this.world.sentinel.height;
      this.aimHint = canWin ? 'A:ABSORB SENTRY' : 'NEED HEIGHT';
      return;
    }
    const cell = this.findAimedCell();
    if (cell) {
      this.aimHint = this.energy >= CREATE_COST_N ? 'B:CREATE SHELL' : 'NEED ENERGY';
      return;
    }
    this.aimHint = this.energy >= BOOST_COST_N ? 'B:RAISE SELF' : 'NEED ENERGY';
  }

  onInput(input: InputState): void {
    if (!this.world || !this.engine) return;

    if (input.pressed.has('start')) {
      if (this.state === 'playing') {
        this.state = 'paused';
      } else if (this.state === 'paused') {
        this.state = 'playing';
      }
      this.engine.audio.play('beep');
      return;
    }

    if (this.state === 'paused') {
      if (input.pressed.has('a') || input.pressed.has('b')) {
        this.wireframeMode = !this.wireframeMode;
        this.engine.audio.play('beepHigh');
      }
      return;
    }

    if (this.state === 'showCode') {
      if (input.pressed.has('a')) {
        this.level++;
        this.state = 'playing';
        this.engine.audio.play('wormhole');
        this.loadLevel(this.level);
      }
      return;
    }

    if (this.state !== 'playing') return;

    const dt = 1 / 59.73;
    const turn = (input.held.has('left') ? 1 : 0) - (input.held.has('right') ? 1 : 0);
    const pitchIn = (input.held.has('up') ? 1 : 0) - (input.held.has('down') ? 1 : 0);
    this.yaw += turn * this.turnSpeed * dt;
    this.pitch += pitchIn * this.pitchSpeed * dt;
    this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch));

    if (input.pressed.has('a')) this.tryAbsorbOrTransfer();
    if (input.pressed.has('b')) this.tryBuild();
  }

  private tryAbsorbOrTransfer(): void {
    if (!this.world) return;
    const aimed = this.findAimedObject();
    if (!aimed) {
      this.engine?.audio.play('beep');
      return;
    }

    if (aimed.type === 'cone') {
      this.energy = Math.min(this.maxEnergy, this.energy + aimed.absorbValue);
      this.score += 50;
      this.world.objects = this.world.objects.filter((o) => o.id !== aimed.id);
      this.engine?.audio.play('beepHigh');
      return;
    }

    if (aimed.type === 'husk' && aimed.owned) {
      const old = makeHusk(
        this.nextId++,
        this.cellX,
        this.cellZ,
        this.world.config.gridSize,
        this.world.config.cellSize,
        this.world.heights,
        this.stack,
        false,
      );
      this.world.objects.push(old);
      this.world.objects = this.world.objects.filter((o) => o.id !== aimed.id);
      this.cellX = aimed.cellX;
      this.cellZ = aimed.cellZ;
      this.stack = aimed.stack ?? 0;
      this.syncPlayerPos();
      this.score += 25;
      this.engine?.audio.play('wormhole');
      return;
    }

    if (aimed.type === 'husk' && !aimed.owned) {
      this.energy = Math.min(this.maxEnergy, this.energy + aimed.absorbValue);
      this.score += 40;
      this.world.objects = this.world.objects.filter((o) => o.id !== aimed.id);
      this.engine?.audio.play('beepHigh');
      return;
    }

    if (aimed.type === 'sentinel') {
      if (this.playerHeight() < this.world.sentinel.height) {
        this.engine?.audio.play('beep');
        return;
      }
      const los = hasHeightmapLOS(
        this.cellX,
        this.cellZ,
        this.playerHeight() + 0.5,
        aimed.cellX,
        aimed.cellZ,
        aimed.height + 1,
        this.world.heights,
      );
      if (!los) {
        this.engine?.audio.play('beep');
        return;
      }
      this.score += 800 * this.level;
      this.engine?.audio.stopSiren();
      this.engine?.audio.play('success');
      this.state = 'levelComplete';
      this.completeTimer = 0;
      this.lastSaveCode = encodePrefixedLevelSave(2, {
        level: this.level + 1,
        score: this.score,
        seed: this.baseSeed,
      });
    }
  }

  /**
   * B context:
   * - Aim locked on a free tile → create warp shell there
   * - Otherwise → stack a platform under the player and raise them (tap to climb)
   */
  private tryBuild(): void {
    const cell = this.findAimedCell();
    if (cell) {
      this.tryCreateShell(cell);
      return;
    }
    this.tryBoostUnderSelf();
  }

  private tryBoostUnderSelf(): void {
    if (!this.world) return;
    if (this.energy < BOOST_COST_N) {
      this.engine?.audio.play('beep');
      return;
    }
    // Cap so you can't cheese infinitely past the Sentinel without absorbing
    const maxBoost = this.world.sentinel.height + 2;
    if (this.playerHeight() >= maxBoost) {
      this.engine?.audio.play('beep');
      return;
    }

    this.energy -= BOOST_COST_N;
    const { gridSize, cellSize } = this.world.config;
    const plat = makePlatform(
      this.nextId++,
      this.cellX,
      this.cellZ,
      gridSize,
      cellSize,
      this.world.heights,
      this.stack,
    );
    this.world.objects.push(plat);
    this.stack += 1;
    this.syncPlayerPos();
    this.score += 5;
    this.engine?.audio.play('beepHigh');
  }

  private tryCreateShell(cell: { cellX: number; cellZ: number; stack: number }): void {
    if (!this.world) return;
    if (this.energy < CREATE_COST_N) {
      this.engine?.audio.play('beep');
      return;
    }

    this.energy -= CREATE_COST_N;
    const { gridSize, cellSize } = this.world.config;
    const plat = makePlatform(
      this.nextId++,
      cell.cellX,
      cell.cellZ,
      gridSize,
      cellSize,
      this.world.heights,
      cell.stack,
    );
    this.world.objects.push(plat);
    const husk = makeHusk(
      this.nextId++,
      cell.cellX,
      cell.cellZ,
      gridSize,
      cellSize,
      this.world.heights,
      cell.stack + 1,
      true,
    );
    this.world.objects.push(husk);
    this.score += 20;
    this.engine?.audio.play('beepHigh');
  }

  private triggerDeath(): void {
    if (this.state === 'dying') return;
    this.state = 'dying';
    this.deathTimer = 0;
    this.engine?.audio.stopSiren();
    this.engine?.audio.play('explosion');
  }

  private loadLevel(level: number): void {
    this.world = generateLevel(level, this.baseSeed);
    this.cellX = this.world.playerStart.cellX;
    this.cellZ = this.world.playerStart.cellZ;
    this.stack = 0;
    this.yaw = this.world.playerStart.yaw;
    this.pitch = -0.18;
    this.syncPlayerPos();
    // Enough for a few self-raises plus a shell
    this.energy = Math.max(BOOST_COST_N * 3 + CREATE_COST_N, 10 + Math.min(level, 4));
    this.sentinelYaw = 0;
    this.threatPhase = 0;
    this.lockedOn = false;
    this.spotted = false;
    this.nextId = 1000;
    this.engine?.audio.stopSiren();
  }

  render(renderer: CanvasRenderer): void {
    if (!this.world) return;

    if (this.state === 'showCode') {
      this.renderCodeScreen(renderer);
      return;
    }

    if (this.state === 'paused') {
      this.renderWorld(renderer);
      renderer.fillRect(20, 40, 120, 52, PaletteShade.Dark);
      renderer.strokeRect(20, 40, 120, 52, PaletteShade.Darkest);
      renderer.drawText('PAUSED', 80, 46, { shade: PaletteShade.Lightest, align: 'center', size: 9 });
      renderer.drawText(
        this.wireframeMode ? 'A:WIREFRAME ON' : 'A:WIREFRAME OFF',
        80,
        60,
        { shade: PaletteShade.Lightest, align: 'center', size: 7 },
      );
      renderer.drawText('START=RESUME', 80, 76, { shade: PaletteShade.Light, align: 'center', size: 7 });
      return;
    }

    this.renderWorld(renderer);
    this.renderHUD(renderer);

    if (this.state === 'dying') {
      renderer.drawText('ABSORBED', 80, 60, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
      if (this.deathTimer > 0.8) renderer.clear(PaletteShade.Darkest);
    }

    if (this.state === 'levelComplete') {
      renderer.drawText('SENTINEL DOWN', 80, 58, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
      renderer.drawText('SECTOR CLEAR', 80, 72, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
  }

  private renderWorld(renderer: CanvasRenderer): void {
    if (!this.world) return;

    renderer.clear(PaletteShade.Light);
    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;

    const camera = {
      position: { x: this.playerX, y: this.playerY, z: this.playerZ },
      yaw: this.yaw,
      pitch: this.pitch,
      fov: 105,
    };

    const viewH = 100;
    const viewY = 8;

    const ctx = renderer.context;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (this.wireframeMode) {
      const allEdges: ReturnType<WireframeRenderer['projectWorldEdges']> = [];
      for (const obj of this.world.objects) {
        if (obj.type === 'husk' && obj.owned && obj.cellX === this.cellX && obj.cellZ === this.cellZ) {
          continue;
        }
        allEdges.push(
          ...this.wireframe.projectWorldEdges(camera, obj.vertices, obj.edges, 160, viewH, 0.55),
        );
      }
      const s = this.world.sentinel;
      const eyeX = s.position.x + Math.sin(this.sentinelYaw) * 2.2;
      const eyeZ = s.position.z + Math.cos(this.sentinelYaw) * 2.2;
      const eye = solidBox(eyeX, s.position.y + 1.5, eyeZ, 0.55, 0.55, 0.55);
      allEdges.push(...this.wireframe.projectWorldEdges(camera, eye.vertices, BOX_EDGES, 160, viewH, 0.55));
      allEdges.sort((a, b) => b.depth - a.depth);
      for (const edge of allEdges) {
        const shade = this.wireframe.depthToShade(edge.depth, 110);
        renderer.drawLine(edge.x0, edge.y0 + viewY, edge.x1, edge.y1 + viewY, shade);
      }
    } else {
      const allFaces: SolidFace[] = [];
      // Terrain first (far), then objects with stronger contrast
      for (const obj of this.world.objects) {
        if (obj.type === 'husk' && obj.owned && obj.cellX === this.cellX && obj.cellZ === this.cellZ) {
          continue;
        }
        const bias = obj.type === 'cone' || obj.type === 'sentinel' || obj.type === 'husk' ? -1 : 0;
        allFaces.push(
          ...this.solid.projectFaces(camera, obj.vertices, obj.faces, 160, viewH, 0.55, 110, bias),
        );
      }
      const s = this.world.sentinel;
      const eyeX = s.position.x + Math.sin(this.sentinelYaw) * 2.2;
      const eyeZ = s.position.z + Math.cos(this.sentinelYaw) * 2.2;
      const eye = solidBox(eyeX, s.position.y + 1.5, eyeZ, 0.55, 0.55, 0.55);
      allFaces.push(
        ...this.solid.projectFaces(camera, eye.vertices, eye.faces, 160, viewH, 0.55, 110, -1),
      );
      allFaces.sort((a, b) => b.depth - a.depth);
      this.solid.drawFaces(renderer, allFaces, viewY, { x: 0, y: viewY, w: 160, h: viewH });
    }

    ctx.restore();

    // Cockpit + crosshair
    renderer.drawLine(0, viewY, 160, viewY, PaletteShade.Darkest);
    renderer.drawLine(0, viewY + viewH, 160, viewY + viewH, PaletteShade.Darkest);
    const cx = 80;
    const cy = viewY + viewH * 0.55;
    renderer.drawLine(cx - 4, cy, cx - 1, cy, PaletteShade.Darkest);
    renderer.drawLine(cx + 1, cy, cx + 4, cy, PaletteShade.Darkest);
    renderer.drawLine(cx, cy - 4, cx, cy - 1, PaletteShade.Darkest);
    renderer.drawLine(cx, cy + 1, cx, cy + 4, PaletteShade.Darkest);
  }

  private renderHUD(renderer: CanvasRenderer): void {
    if (!this.world) return;
    const hudY = 112;
    renderer.fillRect(0, hudY, 160, 32, PaletteShade.Lightest);

    renderer.drawText('NRG', 4, hudY + 2, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawBar(22, hudY + 2, 36, 6, this.energy, this.maxEnergy, PaletteShade.Dark);

    renderer.drawText(`H:${this.playerHeight()}`, 4, hudY + 12, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawText(`S:${this.world.sentinel.height}`, 4, hudY + 22, { shade: PaletteShade.Darkest, size: 6 });

    const threatVal = this.threatPhase <= 1 ? this.threatPhase * 100 : (2 - this.threatPhase) * 100;
    renderer.drawText('THR', 64, hudY + 2, { shade: PaletteShade.Darkest, size: 6 });
    const threatFill = this.hudFlash && this.lockedOn ? PaletteShade.Darkest : PaletteShade.Dark;
    renderer.drawBar(82, hudY + 2, 36, 6, threatVal, 100, threatFill);

    renderer.drawText(`B:${BOOST_COST_N}/${CREATE_COST_N}`, 64, hudY + 12, {
      shade: PaletteShade.Dark,
      size: 6,
    });

    if (this.aimHint) {
      renderer.drawText(this.aimHint, 64, hudY + 22, { shade: PaletteShade.Darkest, size: 6 });
    } else if (this.playerHeight() >= this.world.sentinel.height) {
      renderer.drawText('EQUAL HEIGHT', 64, hudY + 22, { shade: PaletteShade.Dark, size: 6 });
    }

    renderer.drawText(`L${this.level}`, 130, hudY + 12, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawText(`${this.score}`, 130, hudY + 22, { shade: PaletteShade.Dark, size: 6 });

    if (this.lockedOn) {
      const lampShade = this.hudFlash ? PaletteShade.Darkest : PaletteShade.Light;
      renderer.fillRect(148, hudY + 2, 8, 8, lampShade);
      renderer.strokeRect(148, hudY + 2, 8, 8, PaletteShade.Darkest);
    }
  }

  private renderCodeScreen(renderer: CanvasRenderer): void {
    renderer.clear(PaletteShade.Lightest);
    renderer.drawText('SECTOR CLEAR', 80, 24, { shade: PaletteShade.Darkest, align: 'center', size: 9 });
    renderer.drawText('CONTINUE CODE', 80, 42, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    renderer.drawText(formatSaveCode(this.lastSaveCode), 80, 56, {
      shade: PaletteShade.Darkest,
      align: 'center',
      size: 7,
    });
    renderer.drawText('A=NEXT LEVEL', 80, 80, { shade: PaletteShade.Dark, align: 'center', size: 7 });
  }

  destroy(): void {
    this.engine?.audio.stopSiren();
    this.engine?.audio.stopAmbient();
    this.engine = null;
    this.world = null;
  }
}

export function createSentry(): SentryGame {
  return new SentryGame();
}
