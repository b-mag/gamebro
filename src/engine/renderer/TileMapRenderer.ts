import { PaletteShade, PALETTE_HEX } from '../core/types';

/** 8×8 tile IDs — games define their own tile palettes. */
export interface TileDef {
  /** Draw tile at pixel (px, py) in screen space. */
  draw(ctx: CanvasRenderingContext2D, px: number, py: number, shade?: PaletteShade): void;
}

export interface TileMapData {
  width: number;
  height: number;
  /** Row-major tile indices. */
  tiles: number[];
}

/**
 * Generic scrolling tilemap renderer for 2D platformers.
 * Camera is in pixel coordinates; tiles are 8×8 by default.
 */
export class TileMapRenderer {
  readonly tileSize: number;

  constructor(tileSize = 8) {
    this.tileSize = tileSize;
  }

  /** Draw visible tile layer with camera offset. */
  render(
    ctx: CanvasRenderingContext2D,
    map: TileMapData,
    tileDefs: TileDef[],
    cameraX: number,
    cameraY: number,
    screenW: number,
    screenH: number,
  ): void {
    const ts = this.tileSize;
    const startCol = Math.floor(cameraX / ts);
    const startRow = Math.floor(cameraY / ts);
    const endCol = startCol + Math.ceil(screenW / ts) + 1;
    const endRow = startRow + Math.ceil(screenH / ts) + 1;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (col < 0 || row < 0 || col >= map.width || row >= map.height) continue;
        const idx = row * map.width + col;
        const tileId = map.tiles[idx];
        if (tileId === 0) continue;
        const def = tileDefs[tileId];
        if (!def) continue;
        const px = col * ts - cameraX;
        const py = row * ts - cameraY;
        def.draw(ctx, px, py);
      }
    }
  }

  /** Get tile at world pixel coords. Returns 0 if out of bounds. */
  getTileAt(map: TileMapData, worldX: number, worldY: number): number {
    const col = Math.floor(worldX / this.tileSize);
    const row = Math.floor(worldY / this.tileSize);
    if (col < 0 || row < 0 || col >= map.width || row >= map.height) return 0;
    return map.tiles[row * map.width + col];
  }

  setTile(map: TileMapData, col: number, row: number, tile: number): void {
    if (col < 0 || row < 0 || col >= map.width || row >= map.height) return;
    map.tiles[row * map.width + col] = tile;
  }
}

/** Solid tile check — games pass their solid tile ID set. */
export function isSolidTile(tile: number, solidIds: Set<number>): boolean {
  return solidIds.has(tile);
}

export function isPlatformTile(tile: number, platformIds: Set<number>): boolean {
  return platformIds.has(tile);
}

export { PaletteShade, PALETTE_HEX };
