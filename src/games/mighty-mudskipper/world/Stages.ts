import type { TileMapData } from '@/engine';

const W = 40;
const H = 18;

function rect(tiles: number[], c0: number, r0: number, c1: number, r1: number, v: number): void {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c >= 0 && c < W && r >= 0 && r < H) tiles[r * W + c] = v;
    }
  }
}

function buildBase(): number[] {
  const tiles = new Array(W * H).fill(0);
  // ground
  rect(tiles, 0, 15, W - 1, 17, 1);
  return tiles;
}

export interface StageDef {
  id: number;
  map: TileMapData;
  spawn: { x: number; y: number };
  crabs: { x: number; y: number }[];
  bugs: { x: number; y: number }[];
}

export function makeStage(id: number): StageDef {
  const tiles = buildBase();
  if (id === 1) {
    rect(tiles, 8, 12, 12, 14, 1);
    rect(tiles, 16, 10, 20, 14, 1);
    rect(tiles, 22, 13, 28, 14, 3); // mud run
    rect(tiles, 30, 11, 33, 14, 1);
    tiles[10 * W + 35] = 6; // goal
    tiles[14 * W + 14] = 5;
    return {
      id,
      map: { width: W, height: H, tiles },
      spawn: { x: 16, y: 100 },
      crabs: [
        { x: 80, y: 104 },
        { x: 160, y: 72 },
        { x: 220, y: 96 },
      ],
      bugs: [
        { x: 100, y: 80 },
        { x: 180, y: 60 },
        { x: 250, y: 90 },
      ],
    };
  }
  if (id === 2) {
    rect(tiles, 5, 13, 8, 14, 2);
    rect(tiles, 10, 11, 14, 14, 1);
    rect(tiles, 16, 14, 24, 14, 3);
    rect(tiles, 16, 15, 24, 17, 4); // deep under mud
    rect(tiles, 26, 10, 30, 14, 1);
    rect(tiles, 32, 12, 36, 14, 1);
    tiles[9 * W + 37] = 6;
    tiles[14 * W + 18] = 5;
    tiles[14 * W + 20] = 5;
    return {
      id,
      map: { width: W, height: H, tiles },
      spawn: { x: 16, y: 100 },
      crabs: [
        { x: 100, y: 80 },
        { x: 200, y: 104 },
        { x: 260, y: 72 },
      ],
      bugs: [
        { x: 70, y: 90 },
        { x: 150, y: 70 },
        { x: 280, y: 80 },
      ],
    };
  }
  // stage 3
  rect(tiles, 4, 12, 7, 14, 1);
  rect(tiles, 9, 14, 18, 14, 3);
  rect(tiles, 9, 15, 18, 17, 4);
  rect(tiles, 20, 9, 23, 14, 1);
  rect(tiles, 25, 12, 28, 14, 2);
  rect(tiles, 30, 14, 35, 14, 3);
  tiles[8 * W + 37] = 6;
  for (let c = 12; c < 16; c++) tiles[14 * W + c] = 5;
  return {
    id,
    map: { width: W, height: H, tiles },
    spawn: { x: 16, y: 90 },
    crabs: [
      { x: 90, y: 88 },
      { x: 170, y: 104 },
      { x: 210, y: 64 },
      { x: 270, y: 104 },
    ],
    bugs: [
      { x: 60, y: 70 },
      { x: 140, y: 90 },
      { x: 240, y: 80 },
      { x: 300, y: 90 },
    ],
  };
}

export const SOLID = new Set([1]);
export const PLATFORM = new Set([2]);
export const MUD = new Set([3]);
export const HAZARD = new Set([4, 5]);
export const GOAL = 6;
