import type { TileMapData } from '@/engine';

const OW_W = 20;
const OW_H = 18;

function idx(c: number, r: number, w = OW_W): number {
  return r * w + c;
}

export interface RoomLink {
  tile: number; // door tile value to match
  target: string;
  spawnX: number;
  spawnY: number;
}

export interface AreaDef {
  id: string;
  name: string;
  map: TileMapData;
  music: 'overworld' | 'temple';
  enemies: { type: 'slime' | 'bat'; x: number; y: number }[];
  links: { col: number; row: number; target: string; sx: number; sy: number }[];
  chest?: { col: number; row: number; item: 'machete' | 'lantern' };
  dark?: boolean;
}

function grassMap(): number[] {
  const t = new Array(OW_W * OW_H).fill(0);
  // border trees
  for (let c = 0; c < OW_W; c++) {
    t[idx(c, 0)] = 1;
    t[idx(c, OW_H - 1)] = 1;
  }
  for (let r = 0; r < OW_H; r++) {
    t[idx(0, r)] = 1;
    t[idx(OW_W - 1, r)] = 1;
  }
  return t;
}

export function buildAreas(): Record<string, AreaDef> {
  const start = grassMap();
  // path
  for (let r = 4; r < 14; r++) start[idx(10, r)] = 4;
  for (let c = 4; c < 16; c++) start[idx(c, 8)] = 4;
  // bushes
  start[idx(6, 6)] = 2;
  start[idx(7, 6)] = 2;
  start[idx(12, 10)] = 2;
  start[idx(13, 5)] = 2;
  // water
  for (let c = 2; c < 5; c++) for (let r = 12; r < 15; r++) start[idx(c, r)] = 3;
  // temple 1 door north
  start[idx(10, 2)] = 5;
  // vines blocking east
  for (let r = 7; r < 10; r++) start[idx(16, r)] = 6;
  // east exit behind vines -> temple2 approach
  start[idx(17, 8)] = 4;

  const jungleE = grassMap();
  for (let c = 2; c < 18; c++) jungleE[idx(c, 8)] = 4;
  for (let r = 3; r < 15; r++) jungleE[idx(8, r)] = 4;
  jungleE[idx(8, 3)] = 5; // temple 2
  jungleE[idx(2, 8)] = 4; // back west
  jungleE[idx(3, 6)] = 2;
  jungleE[idx(12, 11)] = 2;
  jungleE[idx(14, 7)] = 1;
  jungleE[idx(15, 7)] = 1;

  // Temple 1 interior
  const TW = 16;
  const TH = 14;
  const t1 = new Array(TW * TH).fill(7);
  for (let c = 0; c < TW; c++) {
    t1[c] = 8;
    t1[(TH - 1) * TW + c] = 8;
  }
  for (let r = 0; r < TH; r++) {
    t1[r * TW] = 8;
    t1[r * TW + TW - 1] = 8;
  }
  t1[(TH - 1) * TW + 8] = 5; // exit south
  t1[3 * TW + 8] = 9; // chest machete
  t1[6 * TW + 4] = 8;
  t1[6 * TW + 5] = 8;
  t1[8 * TW + 11] = 8;

  // Temple 2 dark
  const t2 = new Array(TW * TH).fill(10);
  for (let c = 0; c < TW; c++) {
    t2[c] = 8;
    t2[(TH - 1) * TW + c] = 8;
  }
  for (let r = 0; r < TH; r++) {
    t2[r * TW] = 8;
    t2[r * TW + TW - 1] = 8;
  }
  // lit path when lantern - floor under player vision handled in render
  for (let r = 2; r < TH - 1; r++) t2[r * TW + 8] = 7;
  for (let c = 3; c < 13; c++) t2[5 * TW + c] = 7;
  t2[(TH - 1) * TW + 8] = 5;
  t2[3 * TW + 4] = 9; // lantern chest

  return {
    start: {
      id: 'start',
      name: 'Jungle Clear',
      map: { width: OW_W, height: OW_H, tiles: start },
      music: 'overworld',
      enemies: [
        { type: 'slime', x: 48, y: 80 },
        { type: 'slime', x: 100, y: 100 },
        { type: 'bat', x: 72, y: 48 },
      ],
      links: [
        { col: 10, row: 2, target: 'temple1', sx: 64, sy: 96 },
        { col: 17, row: 8, target: 'jungleE', sx: 24, sy: 64 },
      ],
    },
    jungleE: {
      id: 'jungleE',
      name: 'Deep Vine',
      map: { width: OW_W, height: OW_H, tiles: jungleE },
      music: 'overworld',
      enemies: [
        { type: 'slime', x: 90, y: 70 },
        { type: 'bat', x: 50, y: 40 },
        { type: 'bat', x: 110, y: 90 },
      ],
      links: [
        { col: 2, row: 8, target: 'start', sx: 120, sy: 64 },
        { col: 8, row: 3, target: 'temple2', sx: 64, sy: 96 },
      ],
    },
    temple1: {
      id: 'temple1',
      name: 'Moss Temple',
      map: { width: TW, height: TH, tiles: t1 },
      music: 'temple',
      enemies: [
        { type: 'slime', x: 40, y: 50 },
        { type: 'slime', x: 90, y: 60 },
      ],
      links: [{ col: 8, row: TH - 1, target: 'start', sx: 80, sy: 32 }],
      chest: { col: 8, row: 3, item: 'machete' },
    },
    temple2: {
      id: 'temple2',
      name: 'Shadow Shrine',
      map: { width: TW, height: TH, tiles: t2 },
      music: 'temple',
      enemies: [
        { type: 'bat', x: 40, y: 40 },
        { type: 'bat', x: 90, y: 50 },
        { type: 'slime', x: 70, y: 70 },
      ],
      links: [{ col: 8, row: TH - 1, target: 'jungleE', sx: 64, sy: 40 }],
      chest: { col: 4, row: 3, item: 'lantern' },
      dark: true,
    },
  };
}

export const SOLID_TILES = new Set([1, 3, 8]);
export const CUTTABLE = 6;
export const BUSH = 2;
export const DOOR = 5;
export const CHEST = 9;
