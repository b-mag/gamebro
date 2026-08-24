import { GB_WIDTH, GB_HEIGHT, PaletteShade, PALETTE_HEX } from '../core/types';

export interface DrawTextOptions {
  shade?: PaletteShade;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  size?: number;
}

/**
 * Renders to a native 160×144 offscreen buffer, scaled with nearest-neighbor.
 */
export class CanvasRenderer {
  readonly width = GB_WIDTH;
  readonly height = GB_HEIGHT;

  private buffer: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayCanvas: HTMLCanvasElement | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;
  private scale = 4;

  constructor() {
    this.buffer = document.createElement('canvas');
    this.buffer.width = GB_WIDTH;
    this.buffer.height = GB_HEIGHT;
    const ctx = this.buffer.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Bind to the visible DOM canvas and set integer scale. */
  attach(displayCanvas: HTMLCanvasElement, scale = 4): void {
    this.displayCanvas = displayCanvas;
    displayCanvas.width = GB_WIDTH * scale;
    displayCanvas.height = GB_HEIGHT * scale;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) throw new Error('Display 2D context unavailable');
    this.displayCtx = ctx;
    this.displayCtx.imageSmoothingEnabled = false;
    this.scale = scale;
  }

  /** Raw buffer context for direct drawing. */
  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  clear(shade: PaletteShade = PaletteShade.Lightest): void {
    this.ctx.fillStyle = PALETTE_HEX[shade];
    this.ctx.fillRect(0, 0, GB_WIDTH, GB_HEIGHT);
  }

  setShade(shade: PaletteShade): void {
    this.ctx.fillStyle = PALETTE_HEX[shade];
    this.ctx.strokeStyle = PALETTE_HEX[shade];
  }

  fillRect(x: number, y: number, w: number, h: number, shade?: PaletteShade): void {
    if (shade !== undefined) this.setShade(shade);
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  strokeRect(x: number, y: number, w: number, h: number, shade?: PaletteShade): void {
    if (shade !== undefined) this.setShade(shade);
    this.ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.floor(w), Math.floor(h));
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, shade?: PaletteShade): void {
    if (shade !== undefined) this.setShade(shade);
    this.ctx.beginPath();
    this.ctx.moveTo(x0 + 0.5, y0 + 0.5);
    this.ctx.lineTo(x1 + 0.5, y1 + 0.5);
    this.ctx.stroke();
  }

  drawText(text: string, x: number, y: number, opts: DrawTextOptions = {}): void {
    const {
      shade = PaletteShade.Darkest,
      align = 'left',
      baseline = 'top',
      size = 8,
    } = opts;
    this.ctx.font = `${size}px "Courier New", monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.setShade(shade);
    this.ctx.fillText(text, x, y);
  }

  /** Horizontal bar (energy, threat, etc.). */
  drawBar(
    x: number,
    y: number,
    w: number,
    h: number,
    value: number,
    max: number,
    fillShade: PaletteShade,
    bgShade: PaletteShade = PaletteShade.Light,
  ): void {
    this.fillRect(x, y, w, h, bgShade);
    const fillW = Math.max(0, Math.min(w, (value / max) * w));
    if (fillW > 0) {
      this.fillRect(x, y, fillW, h, fillShade);
    }
    this.strokeRect(x, y, w, h, PaletteShade.Darkest);
  }

  /** Blit scaled buffer to display canvas. */
  present(): void {
    if (!this.displayCtx || !this.displayCanvas) return;
    this.displayCtx.imageSmoothingEnabled = false;
    this.displayCtx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
    this.displayCtx.drawImage(
      this.buffer,
      0,
      0,
      this.displayCanvas.width,
      this.displayCanvas.height,
    );
  }

  /** Offscreen buffer for readback / effects. */
  getBuffer(): HTMLCanvasElement {
    return this.buffer;
  }
}
