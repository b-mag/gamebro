import type { RoomDef } from '../types';
import { Tile as T } from '../types';

function parseMap(rows: string[]): number[] {
  const charMap: Record<string, number> = {
    '.': T.Empty,
    '#': T.Solid,
    '=': T.Platform,
    '^': T.Spike,
    L: T.Ladder,
    C: T.Cracked,
    D: T.Door,
    S: T.SavePoint,
    '*': T.Candle,
    P: T.Background,
  };
  const tiles: number[] = [];
  for (const row of rows) {
    for (const ch of row) {
      tiles.push(charMap[ch] ?? T.Empty);
    }
  }
  return tiles;
}

function fillFloor(tiles: number[], width: number, row: number): void {
  for (let col = 0; col < width; col++) tiles[row * width + col] = T.Solid;
}

function fillCeiling(tiles: number[], width: number, row: number): void {
  for (let col = 0; col < width; col++) tiles[row * width + col] = T.Solid;
}

export const CASTLE_ROOMS: Record<string, RoomDef> = {
  /** Long straight entrance corridor — SOTN-style hall. */
  entrance: {
    id: 'entrance',
    name: 'Entrance Hall',
    width: 64,
    height: 14,
    music: 'castle',
    tiles: parseMap([
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '................................................................',
      '....................CCCCC....................................D..',
      '################################################################',
    ]),
    doors: [
      { id: 'to_gallery', col: 60, row: 12, targetRoom: 'gallery', spawnX: 24, spawnY: 0, type: 'door' },
      { id: 'to_save', col: 6, row: 12, targetRoom: 'save', spawnX: 120, spawnY: 0, type: 'door' },
      {
        id: 'to_vault',
        col: 20,
        row: 12,
        targetRoom: 'vault',
        spawnX: 80,
        spawnY: 0,
        type: 'secret',
        width: 5,
      },
    ],
    enemies: [{ type: 'bat', x: 280, y: 60 }],
    pickups: [
      { kind: 'subweapon', id: 1, x: 160, y: 80 },
      { kind: 'energy', id: 0, x: 320, y: 80 },
    ],
  },

  /** Secret bonus room — floor breaks after axe hits center hall tiles. */
  vault: {
    id: 'vault',
    name: 'Hidden Vault',
    width: 24,
    height: 12,
    music: 'dungeon',
    tiles: parseMap([
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '.........**.............',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
    ]),
    doors: [
      { id: 'vault_up', col: 10, row: 0, targetRoom: 'entrance', spawnX: 232, spawnY: 0, type: 'up', width: 4 },
    ],
    enemies: [],
    pickups: [
      { kind: 'gold', id: 0, x: 80, y: 60 },
      { kind: 'heart', id: 0, x: 120, y: 60 },
      { kind: 'energy', id: 0, x: 100, y: 60 },
      { kind: 'armor', id: 1, x: 140, y: 60 },
    ],
  },

  /** Main hub — platforms, ceiling exit, jumpable floor pit. */
  gallery: {
    id: 'gallery',
    name: 'Marble Gallery',
    width: 52,
    height: 24,
    music: 'castle',
    tiles: parseMap(Array(24).fill('....................................................')),
    doors: [
      { id: 'gallery_entrance', col: 0, row: 22, targetRoom: 'entrance', spawnX: 440, spawnY: 0, type: 'door' },
      { id: 'gallery_shoe', col: 50, row: 22, targetRoom: 'shoe_boss', spawnX: 24, spawnY: 0, type: 'door' },
      { id: 'gallery_up', col: 22, row: 0, targetRoom: 'upper_nave', spawnX: 120, spawnY: 0, type: 'up', width: 4 },
      { id: 'gallery_down', col: 22, row: 22, targetRoom: 'catacombs', spawnX: 120, spawnY: 0, type: 'down', width: 4 },
    ],
    enemies: [
      { type: 'skeleton', x: 200, y: 140 },
      { type: 'bat', x: 320, y: 80 },
    ],
    pickups: [{ kind: 'energy', id: 0, x: 280, y: 140 }],
  },

  /** Below gallery — pit fall; ladder back up. */
  catacombs: {
    id: 'catacombs',
    name: 'Catacombs',
    width: 36,
    height: 18,
    music: 'dungeon',
    tiles: parseMap(Array(18).fill('....................................')),
    doors: [
      { id: 'catacombs_up', col: 16, row: 0, targetRoom: 'gallery', spawnX: 184, spawnY: 0, type: 'up', width: 4 },
      { id: 'catacombs_dungeon', col: 34, row: 15, targetRoom: 'dungeon', spawnX: 16, spawnY: 0, type: 'door' },
    ],
    enemies: [
      { type: 'skeleton', x: 120, y: 100 },
      { type: 'knight', x: 220, y: 100 },
    ],
    pickups: [{ kind: 'subweapon', id: 2, x: 180, y: 100 }],
  },

  /** Above gallery — requires platform jump. */
  upper_nave: {
    id: 'upper_nave',
    name: 'Upper Nave',
    width: 40,
    height: 16,
    music: 'castle',
    tiles: parseMap(Array(16).fill('........................................')),
    doors: [
      { id: 'nave_down', col: 18, row: 14, targetRoom: 'gallery', spawnX: 184, spawnY: 0, type: 'down', width: 4 },
      { id: 'nave_tower', col: 38, row: 14, targetRoom: 'tower', spawnX: 16, spawnY: 0, type: 'door' },
    ],
    enemies: [{ type: 'bat', x: 160, y: 80 }],
    pickups: [{ kind: 'gold', id: 0, x: 240, y: 90 }],
  },

  /** First boss — Giant Shoe (grants double jump / Vein Wings). */
  shoe_boss: {
    id: 'shoe_boss',
    name: 'Boot Chamber',
    width: 36,
    height: 16,
    music: 'boss',
    tiles: parseMap(Array(16).fill('....................................')),
    doors: [
      { id: 'shoe_out', col: 0, row: 14, targetRoom: 'gallery', spawnX: 380, spawnY: 0, type: 'door' },
    ],
    enemies: [{ type: 'boss_shoe', x: 180, y: 72 }],
    pickups: [],
  },

  save: {
    id: 'save',
    name: 'Save Room',
    width: 20,
    height: 14,
    music: 'castle',
    isSaveRoom: true,
    tiles: parseMap([
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.........**.........',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      'D...................',
      '####################',
    ]),
    doors: [{ id: 'save_out', col: 0, row: 12, targetRoom: 'entrance', spawnX: 56, spawnY: 0, type: 'door' }],
    enemies: [],
    pickups: [{ kind: 'heart', id: 0, x: 72, y: 80 }],
  },

  dungeon: {
    id: 'dungeon',
    name: 'Dungeon',
    width: 36,
    height: 20,
    music: 'dungeon',
    tiles: parseMap(Array(20).fill('....................................')),
    doors: [{ id: 'dungeon_out', col: 0, row: 17, targetRoom: 'catacombs', spawnX: 260, spawnY: 0, type: 'door' }],
    enemies: [{ type: 'knight', x: 160, y: 130 }],
    pickups: [
      { kind: 'relic', id: 2, x: 280, y: 120 },
      { kind: 'subweapon', id: 3, x: 200, y: 120 },
    ],
  },

  tower: {
    id: 'tower',
    name: 'Clock Tower',
    width: 28,
    height: 28,
    music: 'castle',
    tiles: parseMap(Array(28).fill('............................')),
    doors: [{ id: 'tower_out', col: 0, row: 26, targetRoom: 'upper_nave', spawnX: 300, spawnY: 0, type: 'door' }],
    enemies: [
      { type: 'bat', x: 100, y: 80 },
      { type: 'knight', x: 80, y: 180 },
    ],
    pickups: [{ kind: 'weapon', id: 1, x: 180, y: 160 }],
  },
};

function finalizeRooms(): void {
  for (const room of Object.values(CASTLE_ROOMS)) {
    const { width, height, tiles } = room;

    if (room.id === 'vault') {
      fillFloor(tiles, width, height - 1);
      fillFloor(tiles, width, height - 2);
      for (let col = 10; col <= 13; col++) tiles[col] = T.Empty;
      for (let col = 0; col < width; col++) {
        if (col === 0 || col === width - 1) {
          for (let row = 0; row < height - 2; row++) tiles[row * width + col] = T.Solid;
        }
      }
    } else if (room.id === 'entrance') {
      fillFloor(tiles, width, height - 1);
      for (let col = 0; col < width; col++) {
        tiles[(height - 2) * width + col] = col >= 20 && col <= 24 ? T.Cracked : T.Solid;
      }
      tiles[(height - 2) * width + 60] = T.Door;
      tiles[(height - 2) * width + 6] = T.Door;
    } else if (room.id === 'gallery') {
      fillFloor(tiles, width, height - 1);
      fillCeiling(tiles, width, 0);
      for (let col = 22; col <= 25; col++) tiles[col] = T.Empty;
      for (let col = 22; col <= 25; col++) tiles[(height - 1) * width + col] = T.Empty;
      tiles[(height - 1) * width + 21] = T.Solid;
      tiles[(height - 1) * width + 26] = T.Solid;
      for (let col = 8; col < 14; col++) tiles[14 * width + col] = T.Platform;
      for (let col = 32; col < 38; col++) tiles[10 * width + col] = T.Platform;
      for (let col = 20; col < 28; col++) tiles[6 * width + col] = T.Platform;
      tiles[22 * width + 0] = T.Door;
      tiles[22 * width + 50] = T.Door;
      for (let row = 1; row < height - 1; row++) {
        tiles[row * width + 0] = T.Solid;
        tiles[row * width + width - 1] = T.Solid;
      }
    } else if (room.id === 'catacombs') {
      fillFloor(tiles, width, height - 1);
      for (let row = 0; row < height - 1; row++) {
        tiles[row * width + 18] = T.Ladder;
        tiles[row * width + 19] = T.Ladder;
      }
      tiles[15 * width + 34] = T.Door;
    } else if (room.id === 'upper_nave') {
      fillFloor(tiles, width, height - 1);
      for (let col = 18; col <= 21; col++) tiles[(height - 1) * width + col] = T.Empty;
      tiles[14 * width + 38] = T.Door;
    } else if (room.id === 'shoe_boss') {
      fillFloor(tiles, width, height - 1);
      tiles[14 * width + 0] = T.Door;
    } else if (room.id === 'tower') {
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const i = row * width + col;
          if (tiles[i] !== 0) continue;
          if (row >= height - 3) tiles[i] = T.Solid;
          if (col === 0 || col === width - 1) tiles[i] = T.Solid;
        }
      }
      for (let col = 6; col < 12; col++) tiles[16 * width + col] = T.Platform;
      for (let col = 18; col < 24; col++) tiles[10 * width + col] = T.Platform;
      tiles[26 * width + 0] = T.Door;
    } else if (room.id === 'dungeon') {
      for (let col = 8; col < 28; col++) tiles[(height - 4) * width + col] = T.Cracked;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const i = row * width + col;
          if (tiles[i] !== 0) continue;
          if (row >= height - 3) tiles[i] = T.Solid;
        }
      }
      tiles[17 * width + 0] = T.Door;
    } else {
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const i = row * width + col;
          if (tiles[i] !== 0) continue;
          if (row >= height - 3) tiles[i] = T.Solid;
          if ((col === 0 || col === width - 1) && row > 2 && row < height - 3) {
            tiles[i] = T.Solid;
          }
        }
      }
    }

    for (const door of room.doors) {
      if (door.type === 'door' || !door.type) {
        tiles[door.row * width + door.col] = T.Door;
      }
    }
  }
}

finalizeRooms();

export function getRoom(id: string): RoomDef {
  const legacy: Record<string, string> = {
    hall: 'gallery',
    stairwell: 'catacombs',
    alchemy: 'upper_nave',
    boss1: 'shoe_boss',
    throne: 'tower',
  };
  const resolved = legacy[id] ?? id;
  return CASTLE_ROOMS[resolved] ?? CASTLE_ROOMS.entrance;
}
