import { GB_WIDTH, GB_HEIGHT } from '../core/types';
import { CanvasRenderer } from './CanvasRenderer';

/**
 * Screen facade — owns renderer lifecycle and optional post-effects.
 */
export class Screen {
  readonly renderer: CanvasRenderer;
  scanlines = true;

  constructor() {
    this.renderer = new CanvasRenderer();
  }

  bind(canvas: HTMLCanvasElement, scale = 4): void {
    this.renderer.attach(canvas, scale);
  }

  get width(): number {
    return GB_WIDTH;
  }

  get height(): number {
    return GB_HEIGHT;
  }
}
