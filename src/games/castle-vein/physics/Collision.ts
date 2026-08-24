import type { TileMapData } from '@/engine';
import { TileMapRenderer, isSolidTile, isPlatformTile } from '@/engine';
import { SOLID_TILES, PLATFORM_TILES, HAZARD_TILES, TILE, type PlayerState } from '../types';

const mapRenderer = new TileMapRenderer(TILE);

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function resolveTileCollision(
  map: TileMapData,
  box: AABB,
  vx: number,
  vy: number,
): { x: number; y: number; vx: number; vy: number; grounded: boolean; onLadder: boolean; hitSpike: boolean } {
  let { x, y } = box;
  let grounded = false;
  let onLadder = false;
  let hitSpike = false;

  // Horizontal
  x += vx;
  for (let row = Math.floor(y / TILE); row <= Math.floor((y + box.h - 0.01) / TILE); row++) {
    for (let col = Math.floor(x / TILE); col <= Math.floor((x + box.w - 0.01) / TILE); col++) {
      const tile = mapRenderer.getTileAt(map, col * TILE, row * TILE);
      if (tile === 3) onLadder = true;
      if (isSolidTile(tile, SOLID_TILES)) {
        if (vx > 0) x = col * TILE - box.w;
        else if (vx < 0) x = (col + 1) * TILE;
      }
    }
  }

  // Vertical
  y += vy;
  for (let row = Math.floor(y / TILE); row <= Math.floor((y + box.h - 0.01) / TILE); row++) {
    for (let col = Math.floor(x / TILE); col <= Math.floor((x + box.w - 0.01) / TILE); col++) {
      const tile = mapRenderer.getTileAt(map, col * TILE, row * TILE);
      if (tile === 3) onLadder = true;
      if (HAZARD_TILES.has(tile)) hitSpike = true;
      if (isSolidTile(tile, SOLID_TILES)) {
        if (vy > 0) {
          y = row * TILE - box.h;
          grounded = true;
        } else if (vy < 0) {
          y = (row + 1) * TILE;
        }
      } else if (isPlatformTile(tile, PLATFORM_TILES) && vy > 0) {
        const prevBottom = y - vy + box.h;
        const platTop = row * TILE;
        if (prevBottom <= platTop + 2) {
          y = platTop - box.h;
          grounded = true;
        }
      }
    }
  }

  return { x, y, vx, vy, grounded, onLadder, hitSpike };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createPlayerState(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: 12,
    h: 14,
    facing: 1,
    grounded: false,
    onLadder: false,
    hp: 100,
    maxHp: 100,
    invuln: 0,
    knockback: 0,
    weapon: 0,
    armor: 0,
    relics: 0,
    gold: 0,
    bossesDefeated: 0,
    jumpCount: 0,
    attacking: 0,
    attackCooldown: 0,
    backdash: 0,
    backdashCooldown: 0,
    anim: 0,
  };
}

export { mapRenderer };
