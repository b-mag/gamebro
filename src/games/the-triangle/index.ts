import type { GameBoyEngine, Game, CanvasRenderer, InputState } from '@/engine';
import {
  SolidMeshRenderer,
  PaletteShade,
  encodePrefixedLevelSave,
  formatSaveCode,
  normalize,
  sub,
  dot,
  solidBox,
  type SolidFace,
} from '@/engine';
import {
  generateLevel,
  hasLineOfSight,
  refreshEnemyMesh,
  type GeneratedLevel,
  type Enemy,
} from './levels/LevelGenerator';

type GameState = 'playing' | 'dying' | 'levelComplete' | 'showCode' | 'paused';

interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  fromPlayer: boolean;
}

/**
 * The Triangle — Descent-inspired solid submarine shooter.
 *
 * Controls:
 * - Left/Right: turn
 * - Up/Down: thrust (when B not held)
 * - B+Up/Down: ascend / descend
 * - A: fire
 * - Start: pause
 */
export class TheTriangleGame implements Game {
  readonly id = 'the-triangle';
  readonly slug = 'the-triangle';
  readonly name = 'The Triangle';
  readonly description = 'Slow dogfight in the deep. Watch the lock monitor.';

  private engine: GameBoyEngine | null = null;
  private solid = new SolidMeshRenderer();

  private level = 1;
  private score = 0;
  private baseSeed = (Date.now() & 0xffffffff) >>> 0;
  private world: GeneratedLevel | null = null;

  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private yaw = 0;
  private pitch = 0;

  private energy = 100;
  private maxEnergy = 100;

  private threatPhase = 0;
  private threatSpeed = 0.4;
  private lockedOn = false;
  private lockingEnemy: Enemy | null = null;

  private state: GameState = 'playing';
  private deathTimer = 0;
  private completeTimer = 0;
  private shakeAmount = 0;
  private lastSaveCode = '';

  private moveSpeed = 11;
  private turnSpeed = 1.7;
  private verticalSpeed = 7;
  private fireCooldown = 0;
  private projectiles: Projectile[] = [];

  private hudFlash = false;

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
      default:
        break;
    }

    this.hudFlash = this.lockedOn && Math.floor(performance.now() / 200) % 2 === 0;
  }

  private updatePlaying(dt: number): void {
    if (!this.world) return;
    const cfg = this.world.config;

    this.energy -= cfg.passiveDrain * dt;
    if (this.energy <= 0) {
      this.triggerDeath();
      return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateThreat(dt);
    this.autoPickupWrecks();

    // Win: all enemies dead AND triangle node destroyed
    if (
      this.world.enemies.every((e) => e.hp <= 0) &&
      this.world.triangleNode.hp <= 0
    ) {
      this.score += 600 * this.level;
      this.engine?.audio.stopSiren();
      this.engine?.audio.play('success');
      this.state = 'levelComplete';
      this.completeTimer = 0;
      this.lastSaveCode = encodePrefixedLevelSave(3, {
        level: this.level + 1,
        score: this.score,
        seed: this.baseSeed,
      });
    }
  }

  private autoPickupWrecks(): void {
    if (!this.world) return;
    for (const obs of this.world.obstacles) {
      if (obs.type !== 'wreck' || obs.collected) continue;
      const d = Math.hypot(
        obs.position.x - this.playerX,
        obs.position.y - this.playerY,
        obs.position.z - this.playerZ,
      );
      if (d < 3.5) {
        obs.collected = true;
        this.energy = Math.min(this.maxEnergy, this.energy + 18);
        this.score += 80;
        this.engine?.audio.play('beepHigh');
      }
    }
  }

  private updateEnemies(dt: number): void {
    if (!this.world) return;
    const playerPos = { x: this.playerX, y: this.playerY, z: this.playerZ };

    for (const e of this.world.enemies) {
      if (e.hp <= 0) continue;

      const toP = sub(playerPos, e.position);
      const dist = Math.hypot(toP.x, toP.y, toP.z);

      if (e.type === 'pod' && !e.active) {
        if (dist < e.aggroRange) e.active = true;
        else continue;
      }

      const los = hasLineOfSight(e.position, playerPos, this.world.obstacles);
      const wantYaw = Math.atan2(toP.x, toP.z);
      let dyaw = wantYaw - e.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const turn = Math.sign(dyaw) * Math.min(Math.abs(dyaw), e.turnSpeed * dt);
      e.yaw += turn;

      if (e.type === 'drifter' && e.active) {
        const fwd = { x: Math.sin(e.yaw), y: 0, z: Math.cos(e.yaw) };
        e.position.x += fwd.x * e.speed * dt;
        e.position.z += fwd.z * e.speed * dt;
        // Slow vertical chase
        e.position.y += Math.sign(this.playerY - e.position.y) * 0.6 * dt;
        e.position.y = Math.max(
          this.world.config.floorY + 1.5,
          Math.min(this.world.config.ceilingY - 1.5, e.position.y),
        );
      }

      if (e.type === 'pod' && e.active) {
        e.position.x += Math.sin(e.yaw) * e.speed * 0.5 * dt;
        e.position.z += Math.cos(e.yaw) * e.speed * 0.5 * dt;
        e.position.y += Math.sign(this.playerY - e.position.y) * 0.4 * dt;
      }

      refreshEnemyMesh(e);

      // Lock + fire (very slow)
      const facing = Math.cos(dyaw);
      if (los && facing > 0.88 && dist < 40) {
        e.lockProgress = Math.min(1, e.lockProgress + dt * 0.22);
      } else {
        e.lockProgress = Math.max(0, e.lockProgress - dt * 0.45);
      }

      e.fireCooldown -= dt;
      if (e.lockProgress >= 1 && e.fireCooldown <= 0 && los) {
        e.fireCooldown = 3.5 + Math.random() * 1.5;
        const dir = normalize(toP);
        this.projectiles.push({
          x: e.position.x,
          y: e.position.y,
          z: e.position.z,
          vx: dir.x * 14,
          vy: dir.y * 14,
          vz: dir.z * 14,
          life: 2.5,
          fromPlayer: false,
        });
        this.engine?.audio.play('beep');
      }
    }
  }

  private updateProjectiles(dt: number): void {
    if (!this.world) return;
    const next: Projectile[] = [];

    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      if (p.life <= 0) continue;

      if (p.fromPlayer) {
        // Hit enemies
        let hit = false;
        for (const e of this.world.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.position.x - p.x, e.position.y - p.y, e.position.z - p.z);
          if (d < 2.2) {
            e.hp -= 1;
            hit = true;
            this.score += 40;
            this.engine?.audio.play('beepHigh');
            if (e.hp <= 0) this.score += 120;
            break;
          }
        }
        if (!hit) {
          const n = this.world.triangleNode;
          if (n.hp > 0) {
            const d = Math.hypot(n.position.x - p.x, n.position.y - p.y, n.position.z - p.z);
            if (d < 3.5) {
              n.hp -= 1;
              hit = true;
              this.score += 60;
              this.engine?.audio.play('beepHigh');
            }
          }
        }
        if (hit) continue;
      } else {
        const d = Math.hypot(this.playerX - p.x, this.playerY - p.y, this.playerZ - p.z);
        if (d < 1.8) {
          this.energy -= 22;
          this.shakeAmount = 2;
          this.engine?.audio.play('explosion');
          if (this.energy <= 0) this.triggerDeath();
          continue;
        }
      }

      next.push(p);
    }

    this.projectiles = next;
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 4);
  }

  private updateThreat(dt: number): void {
    if (!this.world) return;

    let bestLock = 0;
    let locker: Enemy | null = null;
    for (const e of this.world.enemies) {
      if (e.hp <= 0 || e.lockProgress <= 0) continue;
      if (e.lockProgress > bestLock) {
        bestLock = e.lockProgress;
        locker = e;
      }
    }

    const wasLocked = this.lockedOn;
    this.lockingEnemy = locker;
    this.lockedOn = bestLock >= 0.85;

    this.threatSpeed = 0.3 + bestLock * bestLock * 10;
    if (this.lockedOn) this.threatSpeed = 12;

    this.threatPhase += this.threatSpeed * dt;
    if (this.threatPhase > 2) this.threatPhase -= 2;

    if (this.lockedOn && !wasLocked) this.engine?.audio.startSiren();
    else if (!this.lockedOn && wasLocked) this.engine?.audio.stopSiren();
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
    this.yaw += turn * this.turnSpeed * dt;

    const depthMode = input.held.has('b');
    const up = input.held.has('up');
    const down = input.held.has('down');

    if (depthMode) {
      const vert = (up ? 1 : 0) - (down ? 1 : 0);
      this.playerY += vert * this.verticalSpeed * dt;
      this.pitch = vert * 0.12;
    } else {
      const thrust = (up ? 1 : 0) - (down ? 1 : 0);
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      this.playerX += fx * thrust * this.moveSpeed * dt;
      this.playerZ += fz * thrust * this.moveSpeed * dt;
      this.pitch = thrust * 0.08;
    }

    const half = this.world.config.arenaSize / 2 - 4;
    this.playerX = Math.max(-half, Math.min(half, this.playerX));
    this.playerZ = Math.max(-half, Math.min(half, this.playerZ));
    this.playerY = Math.max(
      this.world.config.floorY + 1.2,
      Math.min(this.world.config.ceilingY - 1.2, this.playerY),
    );

    if (input.pressed.has('a') || (input.held.has('a') && this.fireCooldown <= 0)) {
      this.tryFire();
    }
  }

  private tryFire(): void {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = 0.38;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const fy = this.pitch * 0.5;
    const speed = 28;
    this.projectiles.push({
      x: this.playerX + fx * 1.5,
      y: this.playerY,
      z: this.playerZ + fz * 1.5,
      vx: fx * speed,
      vy: fy * speed,
      vz: fz * speed,
      life: 1.4,
      fromPlayer: true,
    });
    this.engine?.audio.play('beep');
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
    const s = this.world.playerStart;
    this.playerX = s.x;
    this.playerY = s.y;
    this.playerZ = s.z;
    this.yaw = s.yaw;
    this.pitch = 0;
    this.energy = this.maxEnergy;
    this.projectiles = [];
    this.fireCooldown = 0;
    this.threatPhase = 0;
    this.lockedOn = false;
    this.lockingEnemy = null;
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
      renderer.fillRect(0, 55, 160, 34, PaletteShade.Dark);
      renderer.drawText('PAUSED', 80, 68, { shade: PaletteShade.Lightest, align: 'center', size: 10 });
      renderer.drawText('START=RESUME', 80, 82, { shade: PaletteShade.Light, align: 'center', size: 7 });
      return;
    }

    this.renderWorld(renderer);
    this.renderHUD(renderer);

    if (this.state === 'dying') {
      renderer.drawText('HULL BREACH', 80, 60, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
      if (this.deathTimer > 0.8) renderer.clear(PaletteShade.Darkest);
    }

    if (this.state === 'levelComplete') {
      renderer.drawText('TRIANGLE DOWN', 80, 58, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
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
      fov: 110,
    };

    const viewH = 100;
    const viewY = 8;
    const allFaces: SolidFace[] = [];

    for (const obs of this.world.obstacles) {
      if (obs.type === 'wreck' && obs.collected) continue;
      const faces = this.solid.projectFaces(
        camera,
        obs.vertices,
        obs.faces,
        160,
        viewH,
        0.5,
        120,
        obs.type === 'wreck' ? -1 : 0,
      );
      allFaces.push(...faces);
    }

    if (this.world.triangleNode.hp > 0) {
      allFaces.push(
        ...this.solid.projectFaces(
          camera,
          this.world.triangleNode.vertices,
          this.world.triangleNode.faces,
          160,
          viewH,
          0.5,
          120,
          -1,
        ),
      );
    }

    for (const e of this.world.enemies) {
      if (e.hp <= 0) continue;
      allFaces.push(
        ...this.solid.projectFaces(camera, e.vertices, e.faces, 160, viewH, 0.5, 120, -1),
      );
    }

    // Projectiles as tiny boxes
    for (const p of this.projectiles) {
      const box = solidBox(p.x, p.y, p.z, 0.25, 0.25, 0.25);
      allFaces.push(
        ...this.solid.projectFaces(camera, box.vertices, box.faces, 160, viewH, 0.5, 120, -1),
      );
    }

    allFaces.sort((a, b) => b.depth - a.depth);

    const ctx = renderer.context;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.solid.drawFaces(renderer, allFaces, viewY, { x: 0, y: viewY, w: 160, h: viewH });
    ctx.restore();

    renderer.drawLine(0, viewY, 160, viewY, PaletteShade.Darkest);
    renderer.drawLine(0, viewY + viewH, 160, viewY + viewH, PaletteShade.Darkest);
    renderer.drawLine(18, viewY, 0, viewY + viewH, PaletteShade.Dark);
    renderer.drawLine(142, viewY, 160, viewY + viewH, PaletteShade.Dark);

    // Reticle
    const cx = 80;
    const cy = viewY + 50;
    renderer.drawLine(cx - 5, cy, cx - 2, cy, PaletteShade.Darkest);
    renderer.drawLine(cx + 2, cy, cx + 5, cy, PaletteShade.Darkest);
    renderer.drawLine(cx, cy - 5, cx, cy - 2, PaletteShade.Darkest);
    renderer.drawLine(cx, cy + 2, cx, cy + 5, PaletteShade.Darkest);
  }

  private renderHUD(renderer: CanvasRenderer): void {
    if (!this.world) return;
    const hudY = 112;
    renderer.fillRect(0, hudY, 160, 32, PaletteShade.Lightest);

    renderer.drawText('HULL', 4, hudY + 2, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawBar(26, hudY + 2, 36, 6, this.energy, this.maxEnergy, PaletteShade.Dark);

    const depth = Math.floor((-this.playerY + 8) * 8);
    renderer.drawText(`D:${depth}m`, 4, hudY + 12, { shade: PaletteShade.Darkest, size: 6 });

    const alive = this.world.enemies.filter((e) => e.hp > 0).length;
    renderer.drawText(`E:${alive}`, 4, hudY + 22, { shade: PaletteShade.Darkest, size: 6 });

    const threatVal = this.threatPhase <= 1 ? this.threatPhase * 100 : (2 - this.threatPhase) * 100;
    renderer.drawText('THR', 68, hudY + 2, { shade: PaletteShade.Darkest, size: 6 });
    const threatFill = this.hudFlash && this.lockedOn ? PaletteShade.Darkest : PaletteShade.Dark;
    renderer.drawBar(86, hudY + 2, 36, 6, threatVal, 100, threatFill);
    renderer.drawText(String(Math.floor(threatVal)).padStart(3, ' '), 126, hudY + 2, {
      shade: this.lockedOn ? PaletteShade.Darkest : PaletteShade.Dark,
      size: 6,
    });

    if (this.lockedOn) {
      renderer.drawText('LOCK!', 68, hudY + 14, { shade: PaletteShade.Darkest, size: 6 });
    } else if (this.lockingEnemy && this.lockingEnemy.lockProgress > 0.3) {
      renderer.drawText('TRACK', 68, hudY + 14, { shade: PaletteShade.Dark, size: 6 });
    } else {
      renderer.drawText('A:FIRE B:DEPTH', 68, hudY + 14, { shade: PaletteShade.Dark, size: 6 });
    }

    const nodeHp = Math.max(0, this.world.triangleNode.hp);
    renderer.drawText(`TRI:${nodeHp}`, 68, hudY + 22, { shade: PaletteShade.Darkest, size: 6 });

    renderer.drawText(`L${this.level}`, 130, hudY + 14, { shade: PaletteShade.Darkest, size: 6 });
    renderer.drawText(`${this.score}`, 130, hudY + 22, { shade: PaletteShade.Dark, size: 6 });

    if (this.lockedOn) {
      const lampShade = this.hudFlash ? PaletteShade.Darkest : PaletteShade.Light;
      renderer.fillRect(148, hudY + 20, 8, 8, lampShade);
      renderer.strokeRect(148, hudY + 20, 8, 8, PaletteShade.Darkest);
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

export function createTheTriangle(): TheTriangleGame {
  return new TheTriangleGame();
}
