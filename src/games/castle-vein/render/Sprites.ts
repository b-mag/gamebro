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

/** Draw Belard — gothic Belmont/Alucard hybrid, late-GB style (~16×18). */
export function drawBelard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  anim: number,
  backdashing: boolean,
): void {
  ctx.save();
  const flip = facing < 0;
  if (flip) {
    ctx.translate(x + 18, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  } else {
    ctx.translate(x, y);
    x = 0;
    y = 0;
  }

  const step = Math.floor(anim * 5) % 2;
  const legF = step;
  const legB = 1 - step;
  const capeFlare = backdashing ? 2 : Math.sin(anim * 6) * 0.5;

  // Cape — draped over shoulders, attached to coat (not a floating backpack)
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 5, y + 5, 8, 3);
  ctx.fillRect(x + 4, y + 7, 9, 8 + capeFlare);
  ctx.fillRect(x + 3, y + 14 + capeFlare, 3, 4);
  ctx.fillRect(x + 11, y + 15 + capeFlare, 2, 3);

  // Flowing hair (Alucard)
  ctx.fillStyle = PALETTE_HEX[S.Dark];
  ctx.fillRect(x + 8, y + 1, 5, 3);
  ctx.fillStyle = PALETTE_HEX[S.Light];
  ctx.fillRect(x + 10, y + 2, 2, 2);
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 11, y + 4, 4, 8);
  ctx.fillRect(x + 12, y + 10, 3, 4);

  // High collar + head
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 7, y + 3, 6, 2);
  ctx.fillStyle = PALETTE_HEX[S.Light];
  ctx.fillRect(x + 8, y + 1, 4, 4);
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 9, y + 2, 1, 1);

  // Long coat / tunic (overlaps cape at shoulders)
  ctx.fillStyle = PALETTE_HEX[S.Dark];
  ctx.fillRect(x + 6, y + 5, 9, 9);
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 6, y + 13, 9, 1);
  ctx.fillRect(x + 8, y + 6, 5, 1);
  ctx.fillRect(x + 7, y + 5, 7, 1);

  // Belt buckle
  ctx.fillStyle = PALETTE_HEX[S.Light];
  ctx.fillRect(x + 9, y + 10, 3, 2);

  // Boots
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 6, y + 14 + legF, 4, 4 - legF);
  ctx.fillRect(x + 11, y + 14 + legB, 4, 4 - legB);
  ctx.fillStyle = PALETTE_HEX[S.Dark];
  ctx.fillRect(x + 6, y + 16, 4, 1);
  ctx.fillRect(x + 11, y + 16, 4, 1);

  // Whip handle at hip
  ctx.fillStyle = PALETTE_HEX[S.Light];
  ctx.fillRect(x + 13, y + 9, 2, 4);
  ctx.fillStyle = PALETTE_HEX[S.Darkest];
  ctx.fillRect(x + 14, y + 11, 3, 1);

  ctx.restore();
}

/** Sub-weapon projectiles. */
export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
): void {
  if (kind === 'knife') {
    ctx.fillStyle = PALETTE_HEX[S.Lightest];
    ctx.fillRect(x, y + 1, 6, 2);
    ctx.fillStyle = PALETTE_HEX[S.Dark];
    ctx.fillRect(x + 5, y, 2, 4);
  } else if (kind === 'axe') {
    ctx.fillStyle = PALETTE_HEX[S.Darkest];
    ctx.fillRect(x + 2, y, 2, 6);
    ctx.fillStyle = PALETTE_HEX[S.Light];
    ctx.fillRect(x, y, 6, 3);
  }
}

/** Hourglass freeze flash overlay on enemy. */
export function drawFrozenEffect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = PALETTE_HEX[S.Lightest];
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE_HEX[S.Light];
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

/** Draw weapon attack animation (visible whip/sword/axe — not hitbox debug rect). */
export function drawWeaponAttack(
  ctx: CanvasRenderingContext2D,
  weapon: number,
  x: number,
  y: number,
  facing: number,
  progress: number,
): void {
  const extend = Math.min(1, progress / 0.12);
  const S = PaletteShade;

  if (weapon === 0) {
    // Whip — curved chain of segments
    const baseX = facing > 0 ? x + 10 : x + 6;
    const baseY = y + 8;
    const reach = 16 * extend;
    ctx.fillStyle = PALETTE_HEX[S.Darkest];
    const segments = 6;
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * extend;
      const segX = baseX + facing * (t * reach);
      const segY = baseY + Math.sin(t * Math.PI * 1.5) * 4 * facing;
      ctx.fillRect(Math.floor(segX), Math.floor(segY), 2, 2);
    }
    // Whip tip
    const tipX = baseX + facing * reach;
    const tipY = baseY - 2;
    ctx.fillStyle = PALETTE_HEX[S.Lightest];
    ctx.fillRect(Math.floor(tipX), Math.floor(tipY), 3, 3);
  } else if (weapon === 1) {
    // Sword slash arc
    const cx = facing > 0 ? x + 14 : x + 2;
    const cy = y + 6;
    ctx.fillStyle = PALETTE_HEX[S.Lightest];
    ctx.fillRect(cx, cy, facing * 14 * extend, 2);
    ctx.fillStyle = PALETTE_HEX[S.Light];
    ctx.fillRect(cx + facing * 4, cy - 2, facing * 8 * extend, 2);
  } else {
    // Axe swing
    const cx = facing > 0 ? x + 12 : x;
    const cy = y + 4;
    ctx.fillStyle = PALETTE_HEX[S.Dark];
    ctx.fillRect(cx, cy, 3, 10);
    ctx.fillStyle = PALETTE_HEX[S.Darkest];
    ctx.fillRect(cx + facing * 3, cy - 2, facing * 10 * extend, 6);
  }
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
    case 'boss_shoe': {
      const stomp = Math.floor(phase * 3) % 2;
      // Giant boot body
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x + 2, y + 4 + stomp, 20, 12);
      ctx.fillStyle = PALETTE_HEX[S.Dark];
      ctx.fillRect(x + 4, y + 6 + stomp, 16, 8);
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(x + 8, y + 2, 8, 4);
      ctx.fillRect(x + 10, y + 3, 4, 2);
      // Sole
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x, y + 14 + stomp, 24, 4);
      // Arms
      ctx.fillStyle = PALETTE_HEX[S.Light];
      ctx.fillRect(x - 2, y + 6, 4, 8);
      ctx.fillRect(x + 22, y + 6, 4, 8);
      ctx.fillStyle = PALETTE_HEX[S.Darkest];
      ctx.fillRect(x - 3, y + 12, 5, 3);
      ctx.fillRect(x + 22, y + 12, 5, 3);
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
  } else if (kind === 'energy') {
    ctx.fillStyle = PALETTE_HEX[S.Light];
    ctx.fillRect(x + 2, y + 2, 4, 4);
    ctx.fillStyle = PALETTE_HEX[S.Darkest];
    ctx.fillRect(x + 3, y + 3, 2, 2);
  } else if (kind === 'subweapon') {
    ctx.fillRect(x + 1, y + 1, 6, 6);
    ctx.fillStyle = PALETTE_HEX[S.Darkest];
    ctx.fillRect(x + 3, y + 3, 2, 2);
  } else {
    ctx.fillRect(x + 1, y + 3, 6, 4);
  }
}
