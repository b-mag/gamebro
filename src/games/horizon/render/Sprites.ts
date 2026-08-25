import { PaletteShade, PALETTE_HEX } from '@/engine';

const H = PALETTE_HEX;

export function drawMech(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flash = false,
): void {
  const body = flash ? H[PaletteShade.Lightest] : H[PaletteShade.Darkest];
  const accent = flash ? H[PaletteShade.Light] : H[PaletteShade.Dark];
  ctx.fillStyle = body;
  ctx.fillRect(x + 4, y + 2, 10, 12);
  ctx.fillRect(x + 2, y + 6, 4, 6);
  ctx.fillRect(x + 12, y + 4, 6, 4);
  ctx.fillRect(x + 6, y + 14, 3, 4);
  ctx.fillRect(x + 10, y + 14, 3, 4);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 6, y + 4, 4, 3);
  ctx.fillRect(x + 14, y + 5, 4, 2);
}

export function drawFighter(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[PaletteShade.Dark];
  ctx.fillRect(x + 2, y + 3, 10, 5);
  ctx.fillRect(x, y + 4, 3, 3);
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x + 8, y + 2, 4, 2);
  ctx.fillRect(x + 4, y + 8, 6, 2);
}

export function drawEnemyMech(ctx: CanvasRenderingContext2D, x: number, y: number, big = false): void {
  const s = big ? 1.5 : 1;
  const w = Math.floor(16 * s);
  const h = Math.floor(18 * s);
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x, y + 2, w, h - 4);
  ctx.fillRect(x - 2, y + 6, 4, 6);
  ctx.fillRect(x + w - 2, y + 6, 6, 4);
  ctx.fillStyle = H[PaletteShade.Dark];
  ctx.fillRect(x + 4, y + 4, w - 8, 4);
  ctx.fillStyle = H[PaletteShade.Light];
  ctx.fillRect(x + w / 2 - 2, y + 6, 4, 2);
}

export function drawBullet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  enemy = false,
): void {
  ctx.fillStyle = enemy ? H[PaletteShade.Darkest] : H[PaletteShade.Lightest];
  ctx.fillRect(x, y, enemy ? 3 : 4, 2);
}

export function drawLaser(ctx: CanvasRenderingContext2D, x: number, y: number, len: number): void {
  ctx.fillStyle = H[PaletteShade.Lightest];
  ctx.fillRect(x, y, len, 3);
  ctx.fillStyle = H[PaletteShade.Light];
  ctx.fillRect(x, y + 1, len, 1);
}

export function drawPowerup(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const blink = Math.floor(t * 8) % 2 === 0;
  ctx.fillStyle = blink ? H[PaletteShade.Lightest] : H[PaletteShade.Light];
  ctx.fillRect(x, y, 8, 8);
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x + 2, y + 2, 4, 4);
}

export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
): void {
  const r = 2 + frame * 2;
  ctx.fillStyle = frame < 3 ? H[PaletteShade.Lightest] : H[PaletteShade.Dark];
  ctx.fillRect(x - r, y - 1, r * 2, 2);
  ctx.fillRect(x - 1, y - r, 2, r * 2);
}

export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  scroll: number,
  stars: { x: number; y: number; s: number }[],
): void {
  ctx.fillStyle = H[PaletteShade.Dark];
  for (const st of stars) {
    const sx = ((st.x - scroll * st.s) % 160 + 160) % 160;
    ctx.fillRect(sx, st.y, st.s > 0.6 ? 2 : 1, 1);
  }
}
