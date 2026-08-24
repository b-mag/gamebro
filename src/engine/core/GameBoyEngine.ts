import type { Game } from './Game';
import type { EngineConfig, EnginePhase, InputState } from './types';
import { Screen } from '../renderer/Screen';
import { InputManager } from '../input/InputManager';
import { AudioEngine } from '../audio/AudioEngine';

type UpdateCallback = (dt: number) => void;
type RenderCallback = () => void;

/**
 * Core GameBoy engine — game loop, timing, input, audio, screen.
 * Game-agnostic: hosts any `Game` implementation.
 */
export class GameBoyEngine {
  readonly screen: Screen;
  readonly input: InputManager;
  readonly audio: AudioEngine;

  phase: EnginePhase = 'boot';
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private targetFps: number;
  private fixedDt: number;

  private activeGame: Game | null = null;
  private onUpdate: UpdateCallback | null = null;
  private onRender: RenderCallback | null = null;

  constructor(config: EngineConfig = {}) {
    this.screen = new Screen();
    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.targetFps = config.targetFps ?? 59.73;
    this.fixedDt = 1 / this.targetFps;
    if (config.scanlines !== undefined) {
      this.screen.scanlines = config.scanlines;
    }
  }

  /** Bind visible canvas element. */
  bindCanvas(canvas: HTMLCanvasElement, scale = 4): void {
    this.screen.bind(canvas, scale);
  }

  async initAudio(): Promise<void> {
    await this.audio.init();
  }

  /** Register host-level update/render (boot, menu) when no Game is active. */
  setHostCallbacks(onUpdate: UpdateCallback | null, onRender: RenderCallback | null): void {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  /** Load and start a registered game. */
  async startGame(game: Game): Promise<void> {
    this.stopGame();
    this.activeGame = game;
    this.phase = 'game';
    await game.init(this);
    this.input.attach();
  }

  stopGame(): void {
    if (this.activeGame) {
      this.activeGame.destroy();
      this.activeGame = null;
    }
  }

  getActiveGame(): Game | null {
    return this.activeGame;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.input.attach();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.stopGame();
    this.input.detach();
    this.audio.destroy();
  }

  pause(): void {
    if (this.phase === 'game') {
      this.phase = 'paused';
      this.activeGame?.onPause?.();
    }
  }

  resume(): void {
    if (this.phase === 'paused') {
      this.phase = 'game';
      this.activeGame?.onResume?.();
    }
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const frameDt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.accumulator += frameDt;

    while (this.accumulator >= this.fixedDt) {
      this.tick(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.draw();
  };

  private tick(dt: number): void {
    const input = this.input.poll();

    if (this.activeGame && this.phase === 'game') {
      this.activeGame.onInput(input);
      this.activeGame.update(dt);
    } else if (this.onUpdate) {
      this.onUpdate(dt);
      this.handleHostInput(input);
    }
  }

  private handleHostInput(input: InputState): void {
    // Host layers can read input via engine.input.peek() in their update
    void input;
  }

  private draw(): void {
    if (this.activeGame && (this.phase === 'game' || this.phase === 'paused')) {
      this.activeGame.render(this.screen.renderer);
    } else if (this.onRender) {
      this.onRender();
    }
    this.screen.renderer.present();
  }
}
