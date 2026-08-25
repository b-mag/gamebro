import { PaletteShade, PALETTE_HEX } from '@/engine';
import type { TileDef } from '@/engine';

const H = PALETTE_HEX;
const S = PaletteShade;

export const TILE = 8;

/** 0 empty, 1 solid, 2 platform, 3 mud (fast), 4 deep water (hazard), 5 spike, 6 goal, 7 coin marker handled in entities */
export const MUD_TILES: TileDef[] = [
  { draw: () => {} },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px, py, 8, 1);
      ctx.fillRect(px + 1, py + 3, 2, 2);
      ctx.fillRect(px + 5, py + 5, 2, 2);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px, py, 8, 3);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px, py, 8, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px + 1, py + 2, 2, 1);
      ctx.fillRect(px + 5, py + 5, 2, 1);
      ctx.fillRect(px + 3, py + 4, 1, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Lightest];
      ctx.fillRect(px + 2, py + 1, 1, 1);
      ctx.fillRect(px + 5, py + 4, 1, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Darkest];
      for (let i = 0; i < 4; i++) ctx.fillRect(px + i * 2, py + 4 - (i % 2), 2, 4 + (i % 2));
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Lightest];
      ctx.fillRect(px + 2, py, 4, 8);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px + 3, py + 1, 2, 6);
    },
  },
];

export function drawMudskipper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  fast: boolean,
  flash = false,
): void {
  const body = flash ? H[S.Lightest] : H[S.Darkest];
  ctx.fillStyle = body;
  // body
  ctx.fillRect(x + 2, y + 4, 12, 7);
  // head
  ctx.fillRect(facing > 0 ? x + 10 : x, y + 2, 6, 6);
  // eye
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(facing > 0 ? x + 13 : x + 1, y + 3, 2, 2);
  // fins / legs
  ctx.fillStyle = H[S.Dark];
  ctx.fillRect(x + 3, y + 11, 3, 3);
  ctx.fillRect(x + 9, y + 11, 3, 3);
  if (fast) {
    ctx.fillStyle = H[S.Light];
    ctx.fillRect(x - 4, y + 6, 3, 1);
    ctx.fillRect(x - 6, y + 8, 4, 1);
  }
}

export function drawCrab(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x + 2, y + 4, 10, 6);
  ctx.fillRect(x, y + 6, 3, 2);
  ctx.fillRect(x + 11, y + 6, 3, 2);
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(x + 4, y + 5, 2, 2);
  ctx.fillRect(x + 8, y + 5, 2, 2);
}

export function drawBug(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const bob = Math.sin(t * 8) * 1;
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(x + 2, y + 2 + bob, 6, 6);
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x + 3, y + 3 + bob, 2, 2);
}
