import { PaletteShade, PALETTE_HEX } from '@/engine';

const H = PALETTE_HEX;

export function drawPickle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  flash = false,
): void {
  const body = flash ? H[PaletteShade.Lightest] : H[PaletteShade.Dark];
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y + 2, 8, 12);
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x + 4, y + 4, 2, 2);
  ctx.fillRect(x + 8, y + 4, 2, 2);
  ctx.fillRect(x + 5, y + 8, 4, 1);
  ctx.fillStyle = H[PaletteShade.Lightest];
  // helmet bump
  ctx.fillRect(x + 4, y, 6, 3);
  // gun
  const gx = facing > 0 ? x + 10 : x - 2;
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(gx, y + 7, 6, 2);
  // legs
  ctx.fillRect(x + 4, y + 14, 2, 3);
  ctx.fillRect(x + 8, y + 14, 2, 3);
}

export function drawSoldier(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x + 3, y + 2, 7, 10);
  ctx.fillRect(x + 2, y + 12, 3, 4);
  ctx.fillRect(x + 8, y + 12, 3, 4);
  ctx.fillStyle = H[PaletteShade.Dark];
  ctx.fillRect(x + 4, y + 4, 2, 2);
}

export function drawTurret(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[PaletteShade.Dark];
  ctx.fillRect(x, y + 8, 12, 8);
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x + 2, y + 2, 8, 8);
  ctx.fillRect(x - 4, y + 4, 6, 3);
}

export function drawTank(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x, y + 6, 28, 14);
  ctx.fillRect(x + 6, y, 16, 10);
  ctx.fillRect(x + 20, y + 4, 12, 4);
  ctx.fillStyle = H[PaletteShade.Dark];
  ctx.fillRect(x + 2, y + 16, 6, 4);
  ctx.fillRect(x + 12, y + 16, 6, 4);
  ctx.fillRect(x + 20, y + 16, 6, 4);
}

export function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, enemy = false): void {
  ctx.fillStyle = enemy ? H[PaletteShade.Darkest] : H[PaletteShade.Lightest];
  ctx.fillRect(x, y, 4, 2);
}

export function drawPickup(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const blink = Math.floor(t * 6) % 2 === 0;
  ctx.fillStyle = blink ? H[PaletteShade.Lightest] : H[PaletteShade.Light];
  ctx.fillRect(x, y, 10, 10);
  ctx.fillStyle = H[PaletteShade.Darkest];
  ctx.fillRect(x + 2, y + 3, 6, 2);
  ctx.fillRect(x + 4, y + 2, 2, 6);
}

export function drawGround(ctx: CanvasRenderingContext2D, scroll: number): void {
  ctx.fillStyle = H[PaletteShade.Dark];
  ctx.fillRect(0, 120, 160, 24);
  ctx.fillStyle = H[PaletteShade.Darkest];
  for (let i = 0; i < 20; i++) {
    const bx = ((i * 16 - (scroll % 16)) + 160) % 160;
    ctx.fillRect(bx, 120, 14, 2);
    ctx.fillRect(bx + 2, 128, 10, 1);
  }
  // skyline
  ctx.fillStyle = H[PaletteShade.Light];
  for (let i = 0; i < 8; i++) {
    const bx = ((i * 28 - scroll * 0.3) % 200 + 200) % 200 - 20;
    const h = 20 + (i % 3) * 12;
    ctx.fillRect(bx, 120 - h, 18, h);
  }
}
