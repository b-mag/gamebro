import { PaletteShade, PALETTE_HEX } from '@/engine';
import type { TileDef } from '@/engine';

const S = PaletteShade;

function fill8(
  ctx: CanvasRenderingContext2D,
  px0: number,
  py0: number,
  shade: PaletteShade,
): void {
  ctx.fillStyle = PALETTE_HEX[shade];
  ctx.fillRect(px0, py0, 8, 8);
}

/** Procedural 8×8 tile art in 4-shade GB palette. */
export const CASTLE_TILES: TileDef[] = [
  { draw: () => {} }, // 0 empty
  {
    // Solid stone brick
    draw(ctx, px, py) {
      fill8(ctx, px, py, S.Dark);
      for (let y = 0; y < 8; y += 4) {
        for (let x = 0; x < 8; x += 4) {
          ctx.fillStyle = PALETTE_HEX[(x + y) % 8 === 0 ? S.Darkest : S.Light];
          ctx.fillRect(px + x, py + y, 3, 3);
        }
      }
    },
  },
  {
    // Platform (one-way)
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(px, py + 5, 8, 3);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(px, py + 5, 8, 1);
    },
  },
  {
    // Ladder
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(px + 2, py, 1, 8);
      ctx.fillRect(px + 5, py, 1, 8);
      for (let y = 1; y < 8; y += 3) {
        ctx.fillRect(px + 2, py + y, 4, 1);
      }
    },
  },
  {
    // Cracked floor
    draw(ctx, px, py) {
      fill8(ctx, px, py, S.Dark);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(px + 2, py + 3, 4, 1);
      ctx.fillRect(px + 4, py + 1, 1, 6);
    },
  },
  {
    // Spike
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + i * 2, py + 4 - i, 2, 4 + i);
      }
    },
  },
  {
    // Door arch
    draw(ctx, px, py) {
      fill8(ctx, px, py, S.Darkest);
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(px + 1, py + 2, 6, 6);
      ctx.fillStyle = PALETTE_HEX[S.Lightest];
      ctx.fillRect(px + 3, py + 4, 2, 4);
    },
  },
  {
    // Save point tile (floor marker)
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(px + 1, py + 6, 6, 2);
    },
  },
  {
    // Save candle
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Lightest];
      ctx.fillRect(px + 3, py + 2, 2, 4);
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(px + 2, py, 4, 2);
    },
  },
  {
    // Drawbridge plank
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(px, py + 4, 8, 4);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      for (let x = 0; x < 8; x += 2) ctx.fillRect(px + x, py + 4, 1, 4);
    },
  },
  {
    // Background pillar
    draw(ctx, px, py) {
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(px + 2, py, 4, 8);
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(px + 3, py, 1, 8);
    },
  },
];

/** Draw Belard sprite (16×16). */
export function drawBelard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  anim: number,
  attacking: boolean,
): void {
  ctx.save();
  if (facing < 0) {
    ctx.translate(x + 16, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  } else {
    ctx.translate(x, y);
    x = 0;
    y = 0;
  }

  const bob = Math.floor(anim * 4) % 2;
  const leg = bob;

  // Cape
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 2, y + 4, 5, 8);
  // Body
  ctx.fillStyle = PALETTE_HEX[S.Dark];
  ctx.fillRect(x + 4, y + 5 + leg, 8, 7);
  // Head
  ctx.fillStyle = PALETTE_HEX[S.Light];
  ctx.fillRect(x + 5, y + 1, 6, 5);
  // Hair
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 5, y, 6, 2);
  // Legs
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 5, y + 12 + leg, 3, 4 - leg);
  ctx.fillRect(x + 9, y + 12 + (1 - leg), 3, 4 - (1 - leg));

  if (attacking) {
    ctx.fillStyle = PALETTE_HEX[S.Lightest];
    ctx.fillRect(x + 12, y + 6, 6, 2);
    ctx.fillRect(x + 16, y + 4, 2, 6);
  }

  ctx.restore();
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  facing: number,
  phase: number,
): void {
  const f = facing;
  switch (type) {
    case 'bat': {
      const wing = Math.floor(phase * 8) % 2;
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x + 4, y + 4, 4, 3);
      ctx.fillRect(x + (wing ? 0 : 1), y + 2, 3, 3);
      ctx.fillRect(x + (wing ? 9 : 8), y + 2, 3, 3);
      break;
    }
    case 'skeleton': {
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(x + 3, y + 1, 4, 4);
      ctx.fillRect(x + 2, y + 6, 6, 6);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x + 4, y + 2, 1, 1);
      ctx.fillRect(x + 6, y + 2, 1, 1);
      break;
    }
    case 'knight': {
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(x + 1, y + 2, 10, 10);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x + 3, y, 6, 4);
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(x + (f > 0 ? 10 : -2), y + 5, 4, 2);
      break;
    }
    case 'wraith':
    case 'boss_wraith': {
      const pulse = Math.sin(phase * 4) * 0.5 + 0.5;
      ctx.fillStyle = PALETTE_HEX[pulse > 0.5 ? S.Light : S.Dark];
      ctx.fillRect(x + 2, y + 1, 8, 12);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + 7, y + 4, 2, 2);
      break;
    }
    case 'boss_guard': {
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x, y, 16, 14);
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(x + 2, y + 2, 12, 10);
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(x + 5, y + 4, 6, 2);
      ctx.fillRect(x + (f > 0 ? 14 : -4), y + 6, 5, 3);
      break;
    }
  }
}

export function drawPickup(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  t: number,
): void {
  const bob = Math.sin(t * 5) * 2;
  y += bob;
  ctx.fillStyle = PALETTE_HEX[S.Lightest];
  if (kind === 'relic') {
    ctx.fillRect(x + 2, y + 2, 4, 4);
    ctx.fillStyle = PALETTE_HEX[S.Darkest];
    ctx.fillRect(x + 3, y + 3, 2, 2);
  } else if (kind === 'heart') {
    ctx.fillRect(x + 1, y + 2, 3, 3);
    ctx.fillRect(x + 4, y + 2, 3, 3);
    ctx.fillRect(x + 2, y + 5, 4, 2);
  } else {
    ctx.fillRect(x + 1, y + 3, 6, 4);
  }
}
