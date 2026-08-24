import type { GameBoyEngine } from './GameBoyEngine';
import type { CanvasRenderer } from '../renderer/CanvasRenderer';
import type { InputState } from './types';

/**
 * Contract every GameBro title must implement.
 * Register new games in `@/games/registry.ts`.
 */
export interface GameMetadata {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface Game extends GameMetadata {
  /** Called once when the game starts. Receives engine services. */
  init(engine: GameBoyEngine): void | Promise<void>;

  /** Fixed-timestep logic update (seconds). */
  update(dt: number): void;

  /** Draw the current frame to the native-resolution buffer. */
  render(renderer: CanvasRenderer): void;

  /** Handle edge-triggered input each frame. */
  onInput(input: InputState): void;

  /** Pause/resume hooks (optional). */
  onPause?(): void;
  onResume?(): void;

  /** Tear down listeners, timers, etc. */
  destroy(): void;
}

export type GameFactory = () => Game;
