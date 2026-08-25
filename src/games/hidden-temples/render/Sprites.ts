import { PaletteShade, PALETTE_HEX } from '@/engine';
import type { TileDef } from '@/engine';

const H = PALETTE_HEX;
const S = PaletteShade;

export const TILE = 8;

/** 0 grass, 1 tree/solid, 2 bush, 3 water, 4 path, 5 temple door, 6 vine (machete), 7 floor, 8 wall, 9 chest, 10 dark */
export const TEMPLE_TILES: TileDef[] = [
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Dark];
      if ((px + py) % 16 === 0) ctx.fillRect(px + 3, py + 3, 1, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px + 2, py + 1, 4, 5);
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px + 1, py, 6, 2);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px + 2, py + 2, 4, 4);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px + 3, py + 3, 2, 2);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Lightest];
      ctx.fillRect(px + 1, py + 2, 2, 1);
      ctx.fillRect(px + 5, py + 5, 2, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Lightest];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py + 3, 8, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px + 2, py + 2, 4, 6);
      ctx.fillStyle = H[S.Lightest];
      ctx.fillRect(px + 3, py + 4, 2, 4);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px + 1, py, 1, 8);
      ctx.fillRect(px + 4, py, 1, 8);
      ctx.fillRect(px + 6, py, 1, 8);
      ctx.fillRect(px, py + 2, 8, 1);
      ctx.fillRect(px, py + 5, 8, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px + 1, py + 1, 1, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Dark];
      ctx.fillRect(px + 1, py + 1, 6, 6);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Light];
      ctx.fillRect(px, py, 8, 8);
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px + 1, py + 2, 6, 5);
      ctx.fillStyle = H[S.Lightest];
      ctx.fillRect(px + 3, py + 4, 2, 1);
    },
  },
  {
    draw(ctx, px, py) {
      ctx.fillStyle = H[S.Darkest];
      ctx.fillRect(px, py, 8, 8);
    },
  },
];

export function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  slash: number,
  flash = false,
): void {
  const body = flash ? H[S.Lightest] : H[S.Darkest];
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y + 2, 8, 10);
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(x + 4, y + 3, 2, 2);
  // tunic
  ctx.fillStyle = H[S.Dark];
  ctx.fillRect(x + 3, y + 7, 8, 5);
  // sword slash
  if (slash > 0) {
    ctx.fillStyle = H[S.Lightest];
    if (facing === 1) ctx.fillRect(x + 11, y + 4, 8, 3);
    else if (facing === 3) ctx.fillRect(x - 5, y + 4, 8, 3);
    else if (facing === 0) ctx.fillRect(x + 4, y - 5, 3, 8);
    else ctx.fillRect(x + 4, y + 11, 3, 8);
  }
}

export function drawSlime(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[S.Dark];
  ctx.fillRect(x + 2, y + 4, 10, 8);
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x + 4, y + 6, 2, 2);
  ctx.fillRect(x + 8, y + 6, 2, 2);
}

export function drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const flap = Math.sin(t * 12) > 0 ? 0 : 2;
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x + 4, y + 4, 6, 4);
  ctx.fillRect(x, y + 3 + flap, 4, 2);
  ctx.fillRect(x + 10, y + 3 + flap, 4, 2);
}

export function drawRain(ctx: CanvasRenderingContext2D, drops: { x: number; y: number }[]): void {
  ctx.fillStyle = H[S.Dark];
  for (const d of drops) {
    ctx.fillRect(d.x, d.y, 1, 3);
  }
}
