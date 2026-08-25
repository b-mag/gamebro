import { PaletteShade, PALETTE_HEX } from '@/engine';

const H = PALETTE_HEX;
const S = PaletteShade;

export type FishKind = 'minnow' | 'bass' | 'pike' | 'finfolk';

export function drawDockScene(ctx: CanvasRenderingContext2D): void {
  // sky
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(0, 0, 160, 40);
  // water
  ctx.fillStyle = H[S.Light];
  ctx.fillRect(0, 40, 160, 80);
  ctx.fillStyle = H[S.Dark];
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(i * 18 + 4, 48 + (i % 3) * 8, 8, 1);
  }
  // deep water bottom
  ctx.fillStyle = H[S.Dark];
  ctx.fillRect(0, 100, 160, 20);
  // dock
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(0, 120, 160, 24);
  ctx.fillStyle = H[S.Dark];
  for (let i = 0; i < 8; i++) ctx.fillRect(i * 22, 120, 18, 3);
  // posts
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(20, 100, 4, 24);
  ctx.fillRect(130, 100, 4, 24);
}

export function drawAngler(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x + 4, y, 8, 8);
  ctx.fillRect(x + 2, y + 8, 12, 10);
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(x + 6, y + 2, 2, 2);
  // rod
  ctx.fillStyle = H[S.Dark];
  ctx.fillRect(x + 14, y - 2, 2, 18);
  ctx.fillRect(x + 14, y - 2, 20, 1);
}

export function drawFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: FishKind,
  facing: number,
): void {
  const w = kind === 'minnow' ? 8 : kind === 'bass' ? 12 : kind === 'pike' ? 16 : 18;
  const h = kind === 'minnow' ? 4 : kind === 'finfolk' ? 8 : 6;
  ctx.fillStyle = kind === 'finfolk' ? H[S.Lightest] : H[S.Darkest];
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = H[S.Dark];
  const tx = facing > 0 ? x - 3 : x + w;
  ctx.fillRect(tx, y + 1, 3, h - 2);
  if (kind === 'finfolk') {
    ctx.fillStyle = H[S.Dark];
    ctx.fillRect(x + 4, y - 2, 2, 2);
    ctx.fillRect(x + 10, y - 2, 2, 2);
  }
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(facing > 0 ? x + w - 3 : x + 1, y + 1, 2, 2);
}

export function drawBobber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dipping: boolean,
): void {
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x, y + (dipping ? 2 : 0), 4, 4);
  ctx.fillStyle = H[S.Lightest];
  ctx.fillRect(x + 1, y + (dipping ? 2 : 0), 2, 2);
}

export function drawTensionBar(
  ctx: CanvasRenderingContext2D,
  tension: number,
  sweetMin: number,
  sweetMax: number,
): void {
  const x = 30;
  const y = 8;
  const w = 100;
  ctx.fillStyle = H[S.Light];
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = H[S.Dark];
  ctx.fillRect(x + sweetMin * w, y, (sweetMax - sweetMin) * w, 8);
  ctx.fillStyle = H[S.Darkest];
  ctx.fillRect(x + tension * w - 1, y - 1, 3, 10);
  ctx.strokeStyle = H[S.Darkest];
  ctx.strokeRect(x, y, w, 8);
}
