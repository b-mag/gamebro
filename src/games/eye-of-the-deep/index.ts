import type { GameBoyEngine, Game, CanvasRenderer, InputState } from '@/engine';
import {
  WireframeRenderer,
  PaletteShade,
  encodeSave,
  formatSaveCode,
  normalize,
  sub,
  dot,
  boxVertices,
  BOX_EDGES,
} from '@/engine';
import {
  generateLevel,
  hasLineOfSight,
  type GeneratedLevel,
} from './levels/LevelGenerator';

/** Game states within Eye of the Deep. */
type GameState =
  | 'playing'
  | 'dying'
  | 'levelComplete'
  | 'showCode'
  | 'paused';

/**
 * Eye of the Deep — Sentinel-inspired underwater wireframe stealth.
 *
 * Controls (arcade-submarine hybrid):
 * - Turn in place with Left/Right (realistic pivot steering)
 * - Forward/Back along heading (no strafe — submarine thrust)
 * - Up/Down adjust depth slightly (pitch + vertical drift)
 * - A: interact with MCU when in range / confirm codes
 * - B: collect nearby wreckage
 * - Start: pause
 */
export class EyeOfTheDeep implements Game {
  readonly id = 'eye-of-the-deep';
  readonly slug = 'eye-of-the-deep';
  readonly name = 'Eye of the Deep';
  readonly description =
    'Disable the Mobile Construction Unit before its eye finds you.';

  private engine: GameBoyEngine | null = null;
  private wireframe = new WireframeRenderer();

  private level = 1;
  private score = 0;
  private baseSeed = (Date.now() & 0xffffffff) >>> 0;
  private world: GeneratedLevel | null = null;

  private playerX = 0;
  private playerZ = 0;
  private playerY = -1;
  private yaw = 0;
  private pitch = 0;

  private energy = 100;
  private maxEnergy = 100;

  private mcuYaw = 0;
  private mcuMoveAngle = 0;

  private threatPhase = 0;
  private threatSpeed = 0.4;
  private lockedOn = false;
  private spotted = false;

  private state: GameState = 'playing';
  private deathTimer = 0;
  private completeTimer = 0;
  private shakeAmount = 0;
  private lastSaveCode = '';

  private moveSpeed = 12;
  private turnSpeed = 1.8;

  private hudFlash = false;
  private codeInput = '';
  private codeInputMode = false;

  init(engine: GameBoyEngine): void {
    this.engine = engine;
    engine.audio.startAmbient();
    this.loadLevel(this.level);
  }

  /** Resume from HEX continue code. */
  loadFromSave(level: number, score: number, seed: number): void {
    this.level = level;
    this.score = score;
    this.baseSeed = seed;
    this.loadLevel(level);
  }

  update(dt: number): void {
    if (!this.world || !this.engine) return;

    const cfg = this.world.config;

    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt, cfg);
        break;
      case 'dying':
        this.deathTimer += dt;
        this.shakeAmount = 3;
        if (this.deathTimer > 1.5) {
          this.shakeAmount = 0;
          this.energy = this.maxEnergy;
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
      case 'showCode':
        break;
    }

    this.hudFlash = this.lockedOn && Math.floor(performance.now() / 200) % 2 === 0;
  }

  private updatePlaying(dt: number, cfg: GeneratedLevel['config']): void {
    if (!this.engine || !this.world) return;

    // Passive energy drain
    this.energy -= cfg.passiveDrain * dt;
    if (this.energy <= 0) {
      this.triggerDeath();
      return;
    }

    // MCU rotation
    this.mcuYaw += cfg.mcuRotationSpeed * dt;
    if (cfg.mcuMoves) {
      this.mcuMoveAngle += dt * 0.15;
      const r = 8;
      this.world.mcuPosition.x = Math.cos(this.mcuMoveAngle) * r;
      this.world.mcuPosition.z = Math.sin(this.mcuMoveAngle) * r;
    }

    // Movement handled in onInput via held keys — apply physics
    this.updateThreat(dt);

    if (this.lockedOn && this.spotted) {
      this.energy -= cfg.beamDrain * dt;
      if (this.energy <= 0) {
        this.triggerDeath();
      }
    }
  }

  private updateThreat(dt: number): void {
    if (!this.world) return;
    const mcu = this.world.mcuPosition;
    const toPlayer = normalize(sub({ x: this.playerX, y: 0, z: this.playerZ }, { x: mcu.x, y: 0, z: mcu.z }));
    const eyeDir = { x: Math.sin(this.mcuYaw), y: 0, z: Math.cos(this.mcuYaw) };

    const angleDot = dot(toPlayer, eyeDir);
    const los = hasLineOfSight(mcu, { x: this.playerX, y: this.playerY, z: this.playerZ }, this.world.obstacles);

    const lockThreshold = 0.92; // ~23° cone
    const wasLocked = this.lockedOn;
    this.lockedOn = los && angleDot > lockThreshold;
    this.spotted = los && angleDot > 0.5;

    // Threat cycle speed: slow when far, fast when near lock
    const proximity = Math.max(0, (angleDot - 0.3) / 0.7);
    this.threatSpeed = 0.3 + proximity * proximity * 8;
    if (this.lockedOn) this.threatSpeed = 12;

    this.threatPhase += this.threatSpeed * dt;
    if (this.threatPhase > 2) this.threatPhase -= 2;

    if (this.lockedOn && !wasLocked) {
      this.engine?.audio.startSiren();
    } else if (!this.lockedOn && wasLocked) {
      this.engine?.audio.stopSiren();
    }
  }

  onInput(input: InputState): void {
    if (!this.world || !this.engine) return;

    if (input.pressed.has('start')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.engine.pause();
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.engine.resume();
      }
      this.engine.audio.play('beep');
      return;
    }

    if (this.state === 'showCode') {
      this.handleCodeScreenInput(input);
      return;
    }

    if (this.state !== 'playing') return;

    const turn = (input.held.has('left') ? 1 : 0) - (input.held.has('right') ? 1 : 0);
    const thrust = (input.held.has('up') ? 1 : 0) - (input.held.has('down') ? 1 : 0);
    const dt = 1 / 59.73;
    this.yaw += turn * this.turnSpeed * dt;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.playerX += fx * thrust * this.moveSpeed * dt;
    this.playerZ += fz * thrust * this.moveSpeed * dt;
    // Subtle depth bob from thrust (cockpit depth gauge)
    this.playerY = -1 + Math.sin(performance.now() * 0.001) * 0.15;
    this.pitch = thrust * 0.08;

    // Arena bounds
    const half = this.world.config.arenaSize / 2 - 4;
    this.playerX = Math.max(-half, Math.min(half, this.playerX));
    this.playerZ = Math.max(-half, Math.min(half, this.playerZ));

    if (input.pressed.has('b')) {
      this.tryCollectWreck();
    }

    if (input.pressed.has('a')) {
      this.tryInteractMCU();
    }
  }

  private tryCollectWreck(): void {
    if (!this.world) return;
    for (const obs of this.world.obstacles) {
      if (obs.type !== 'wreck' || obs.collected) continue;
      const d = Math.hypot(obs.position.x - this.playerX, obs.position.z - this.playerZ);
      if (d < 4) {
        obs.collected = true;
        this.energy = Math.min(this.maxEnergy, this.energy + 15);
        this.score += 100;
        this.engine?.audio.play('beepHigh');
      }
    }
  }

  private tryInteractMCU(): void {
    if (!this.world) return;
    const mcu = this.world.mcuPosition;
    const d = Math.hypot(mcu.x - this.playerX, mcu.z - this.playerZ);
    if (d < 8) {
      this.score += 500 * this.level;
      this.engine?.audio.stopSiren();
      this.engine?.audio.play('success');
      this.state = 'levelComplete';
      this.completeTimer = 0;
      this.lastSaveCode = encodeSave({
        level: this.level + 1,
        score: this.score,
        seed: this.baseSeed,
      });
    } else {
      this.engine?.audio.play('beep');
    }
  }

  private handleCodeScreenInput(input: InputState): void {
    if (input.pressed.has('a')) {
      this.level++;
      this.state = 'playing';
      this.engine?.audio.play('wormhole');
      this.loadLevel(this.level);
      return;
    }
    if (input.pressed.has('b')) {
      this.codeInputMode = !this.codeInputMode;
      this.codeInput = '';
      this.engine?.audio.play('beep');
    }
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
    const start = this.world.playerStart;
    this.playerX = start.x;
    this.playerZ = start.z;
    this.yaw = start.yaw;
    this.playerY = -1;
    this.energy = this.maxEnergy;
    this.mcuYaw = 0;
    this.threatPhase = 0;
    this.lockedOn = false;
    this.spotted = false;
    this.engine?.audio.stopSiren();
  }

  render(renderer: CanvasRenderer): void {
    if (!this.world) return;

    const ctx = renderer.context;
    ctx.lineWidth = 1;

    if (this.state === 'showCode') {
      this.renderCodeScreen(renderer);
      return;
    }

    if (this.state === 'paused') {
      this.renderWorld(renderer);
      renderer.fillRect(0, 55, 160, 34, PaletteShade.Dark);
      renderer.drawText('PAUSED', 80, 68, { shade: PaletteShade.Lightest, align: 'center', size: 10 });
      renderer.drawText('START=RESUME', 80, 82, { shade: PaletteShade.Light, align: 'center', size: 7 });
      return;
    }

    this.renderWorld(renderer);
    this.renderHUD(renderer);

    if (this.state === 'dying') {
      const t = this.deathTimer;
      renderer.drawText('CRITICAL FAILURE', 80, 60, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 8,
      });
      if (t > 0.8) {
        renderer.clear(PaletteShade.Darkest);
      }
    }

    if (this.state === 'levelComplete') {
      renderer.drawText('MCU DISABLED', 80, 58, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
      renderer.drawText('WORMHOLE OPEN', 80, 72, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    }
  }

  private renderWorld(renderer: CanvasRenderer): void {
    if (!this.world) return;

    renderer.clear(PaletteShade.Lightest);
    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;

    const camera = {
      position: { x: this.playerX, y: this.playerY + 1.5, z: this.playerZ },
      yaw: this.yaw,
      pitch: this.pitch,
      fov: 110,
    };

    const viewH = 100;
    const viewY = 8;

    // Collect all wireframe geometry
    const allEdges: ReturnType<WireframeRenderer['projectWorldEdges']> = [];

    for (const obs of this.world.obstacles) {
      if (obs.type === 'wreck' && obs.collected) continue;
      const edges = this.wireframe.projectWorldEdges(
        camera,
        obs.vertices,
        obs.edges,
        160,
        viewH,
        0.5,
      );
      allEdges.push(...edges);
    }

    // MCU structure
    const mcu = this.world.mcuPosition;
    const mcuBase = boxVertices(mcu.x, mcu.y, mcu.z, 3, 2, 3);
    const mcuEdges = this.wireframe.projectWorldEdges(camera, mcuBase, BOX_EDGES, 160, viewH, 0.5);
    allEdges.push(...mcuEdges);

    // Eye stalk
    const eyeX = mcu.x + Math.sin(this.mcuYaw) * 4;
    const eyeZ = mcu.z + Math.cos(this.mcuYaw) * 4;
    const eyeVerts = boxVertices(eyeX, mcu.y + 2, eyeZ, 1, 1, 1);
    allEdges.push(...this.wireframe.projectWorldEdges(camera, eyeVerts, BOX_EDGES, 160, viewH, 0.5));

    // Beam line when locked
    if (this.lockedOn && this.spotted) {
      const eyeScreen = this.wireframe.projectWorldEdges(
        camera,
        [{ x: eyeX, y: mcu.y + 2, z: eyeZ }, { x: this.playerX, y: this.playerY, z: this.playerZ }],
        [[0, 1]],
        160,
        viewH,
        0.5,
      );
      allEdges.push(...eyeScreen);
    }

    // Cockpit frame
    renderer.drawLine(0, viewY, 160, viewY, PaletteShade.Darkest);
    renderer.drawLine(0, viewY + viewH, 160, viewY + viewH, PaletteShade.Darkest);
    renderer.drawLine(20, viewY, 0, viewY + viewH, PaletteShade.Dark);
    renderer.drawLine(140, viewY, 160, viewY + viewH, PaletteShade.Dark);

    const ctx = renderer.context;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    for (const edge of allEdges) {
      const shade = this.wireframe.depthToShade(edge.depth);
      renderer.drawLine(edge.x0, edge.y0 + viewY, edge.x1, edge.y1 + viewY, shade);
    }

    ctx.restore();
  }

  private renderHUD(renderer: CanvasRenderer): void {
    if (!this.world) return;

    const hudY = 112;
    renderer.fillRect(0, hudY, 160, 32, PaletteShade.Light);

    // Energy
    renderer.drawText('NRG', 4, hudY + 2, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawBar(22, hudY + 2, 40, 6, this.energy, this.maxEnergy, PaletteShade.Dark);

    // Depth
    const depth = Math.floor((-this.playerY + 4) * 10);
    renderer.drawText(`D:${depth}m`, 4, hudY + 12, { shade: PaletteShade.Darkest, size: 6 });

    // Compass
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round((((this.yaw % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8);
    renderer.drawText(`HDG:${dirs[idx]}`, 4, hudY + 22, { shade: PaletteShade.Darkest, size: 6 });

    // Threat indicator (cycles 0→100→0)
    const threatVal = this.threatPhase <= 1 ? this.threatPhase * 100 : (2 - this.threatPhase) * 100;
    renderer.drawText('THR', 68, hudY + 2, { shade: PaletteShade.Darkest, size: 6 });
    const threatFill = this.hudFlash && this.lockedOn ? PaletteShade.Darkest : PaletteShade.Dark;
    renderer.drawBar(86, hudY + 2, 40, 6, threatVal, 100, threatFill);
    renderer.drawText(String(Math.floor(threatVal)).padStart(3, ' '), 130, hudY + 2, {
      shade: this.lockedOn ? PaletteShade.Darkest : PaletteShade.Dark,
      size: 6,
    });

    // MCU bearing
    const mcu = this.world.mcuPosition;
    const bearing = Math.atan2(mcu.x - this.playerX, mcu.z - this.playerZ);
    const rel = bearing - this.yaw;
    const arrow = rel > 0.2 ? '>' : rel < -0.2 ? '<' : '^';
    renderer.drawText(`MCU${arrow}`, 68, hudY + 14, {
      shade: this.spotted ? PaletteShade.Darkest : PaletteShade.Dark,
      size: 6,
    });

    // Level / score
    renderer.drawText(`L${this.level}`, 130, hudY + 14, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawText(`${this.score}`, 130, hudY + 22, { shade: PaletteShade.Dark, size: 6 });

    // Alert lamp
    if (this.lockedOn) {
      const lampShade = this.hudFlash ? PaletteShade.Darkest : PaletteShade.Light;
      renderer.fillRect(148, hudY + 20, 8, 8, lampShade);
      renderer.strokeRect(148, hudY + 20, 8, 8, PaletteShade.Darkest);
    }
  }

  private renderCodeScreen(renderer: CanvasRenderer): void {
    renderer.clear(PaletteShade.Lightest);
    renderer.drawText('LEVEL CLEAR', 80, 20, { shade: PaletteShade.Darkest, align: 'center', size: 9 });
    renderer.drawText('CONTINUE CODE', 80, 38, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    renderer.drawText(formatSaveCode(this.lastSaveCode), 80, 52, {
      shade: PaletteShade.Darkest,
      align: 'center',
      size: 7,
    });
    renderer.drawText('A=NEXT LEVEL', 80, 72, { shade: PaletteShade.Dark, align: 'center', size: 7 });
    renderer.drawText('B=ENTER CODE', 80, 84, { shade: PaletteShade.Light, align: 'center', size: 6 });

    if (this.codeInputMode) {
      renderer.drawText(`>${this.codeInput}_`, 80, 100, {
        shade: PaletteShade.Darkest,
        align: 'center',
        size: 7,
      });
    }
  }

  destroy(): void {
    this.engine?.audio.stopSiren();
    this.engine?.audio.stopAmbient();
    this.engine = null;
    this.world = null;
  }
}

export function createEyeOfTheDeep(): EyeOfTheDeep {
  return new EyeOfTheDeep();
}
