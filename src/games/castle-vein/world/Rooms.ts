import type { RoomDef } from '../types';
import { Tile as T } from '../types';

/** Build tile array from ASCII rows. */
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

export const CASTLE_ROOMS: Record<string, RoomDef> = {
  entrance: {
    id: 'entrance',
    name: 'Entrance Hall',
    width: 40,
    height: 18,
    music: 'castle',
    tiles: parseMap([
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '....PP............................PP....',
      '....PP............................PP....',
      '....PP..............**............PP....',
      '....PP............................PP....',
      '....PP............................PP....',
      '....PP............................PP....',
      '....PP............................PP....',
      '....PP............................PP....',
      '....PP............................PP....',
      '....PP............................PP....',
      '################################D#######',
      '#######################################',
      '#######################################',
    ]),
    doors: [{ col: 33, row: 15, targetRoom: 'hall', spawnX: 16, spawnY: 100 }],
    enemies: [{ type: 'bat', x: 200, y: 80 }],
    pickups: [],
  },

  hall: {
    id: 'hall',
    name: 'Grand Hall',
    width: 48,
    height: 18,
    music: 'castle',
    tiles: parseMap([
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      '................................................',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'PP..........................................PP',
      'D##########################################D',
      '##########################################',
      '##########################################',
    ]),
    doors: [
      { col: 0, row: 15, targetRoom: 'entrance', spawnX: 240, spawnY: 100 },
      { col: 47, row: 15, targetRoom: 'stairwell', spawnX: 16, spawnY: 100 },
    ],
    enemies: [
      { type: 'skeleton', x: 160, y: 96 },
      { type: 'bat', x: 280, y: 60 },
    ],
    pickups: [{ kind: 'gold', id: 0, x: 320, y: 100 }],
  },

  stairwell: {
    id: 'stairwell',
    name: 'Stairwell',
    width: 24,
    height: 28,
    music: 'castle',
    tiles: parseMap(Array(28).fill('........................')),
    doors: [
      { col: 0, row: 26, targetRoom: 'hall', spawnX: 320, spawnY: 100 },
      { col: 0, row: 4, targetRoom: 'tower', spawnX: 80, spawnY: 180 },
      { col: 23, row: 14, targetRoom: 'alchemy', spawnX: 16, spawnY: 80 },
      { col: 23, row: 22, targetRoom: 'dungeon', spawnX: 16, spawnY: 140 },
    ],
    enemies: [{ type: 'knight', x: 80, y: 180 }],
    pickups: [],
  },

  alchemy: {
    id: 'alchemy',
    name: 'Alchemy Lab',
    width: 32,
    height: 16,
    music: 'dungeon',
    tiles: parseMap(Array(16).fill('................................')),
    doors: [{ col: 0, row: 14, targetRoom: 'stairwell', spawnX: 280, spawnY: 100 }],
    enemies: [
      { type: 'skeleton', x: 120, y: 96 },
      { type: 'bat', x: 200, y: 50 },
    ],
    pickups: [{ kind: 'relic', id: 1, x: 220, y: 90 }],
  },

  dungeon: {
    id: 'dungeon',
    name: 'Dungeon',
    width: 36,
    height: 20,
    music: 'dungeon',
    tiles: parseMap(Array(20).fill('....................................')),
    doors: [
      { col: 0, row: 17, targetRoom: 'stairwell', spawnX: 280, spawnY: 120 },
      { col: 35, row: 17, targetRoom: 'boss1', spawnX: 16, spawnY: 100 },
    ],
    enemies: [
      { type: 'knight', x: 160, y: 130 },
      { type: 'skeleton', x: 240, y: 130 },
    ],
    pickups: [
      { kind: 'relic', id: 2, x: 280, y: 120 },
      { kind: 'weapon', id: 1, x: 100, y: 120 },
    ],
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
      'D###################',
      '####################',
    ]),
    doors: [{ col: 0, row: 12, targetRoom: 'entrance', spawnX: 80, spawnY: 100 }],
    enemies: [],
    pickups: [{ kind: 'heart', id: 0, x: 72, y: 80 }],
  },

  tower: {
    id: 'tower',
    name: 'Clock Tower',
    width: 28,
    height: 32,
    music: 'castle',
    tiles: parseMap(Array(32).fill('............................')),
    doors: [
      { col: 0, row: 30, targetRoom: 'stairwell', spawnX: 80, spawnY: 40 },
      { col: 27, row: 8, targetRoom: 'throne', spawnX: 16, spawnY: 200 },
    ],
    enemies: [
      { type: 'bat', x: 100, y: 80 },
      { type: 'bat', x: 140, y: 120 },
      { type: 'knight', x: 80, y: 220 },
    ],
    pickups: [{ kind: 'armor', id: 1, x: 180, y: 200 }],
  },

  boss1: {
    id: 'boss1',
    name: 'Guard Chamber',
    width: 32,
    height: 16,
    music: 'boss',
    tiles: parseMap(Array(16).fill('................................')),
    doors: [{ col: 0, row: 14, targetRoom: 'dungeon', spawnX: 240, spawnY: 100 }],
    enemies: [{ type: 'boss_guard', x: 180, y: 96 }],
    pickups: [],
  },

  throne: {
    id: 'throne',
    name: 'Throne Room',
    width: 36,
    height: 18,
    music: 'boss',
    tiles: parseMap(Array(18).fill('....................................')),
    doors: [{ col: 0, row: 15, targetRoom: 'tower', spawnX: 200, spawnY: 40 }],
    enemies: [{ type: 'boss_wraith', x: 220, y: 110 }],
    pickups: [],
  },
};

function finalizeRooms(): void {
  for (const room of Object.values(CASTLE_ROOMS)) {
    const { width, height, tiles } = room;
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
    // Door row markers
    for (const door of room.doors) {
      tiles[door.row * width + door.col] = T.Door;
    }
    if (room.id === 'dungeon') {
      for (let col = 8; col < 28; col++) tiles[(height - 4) * width + col] = T.Cracked;
    }
    if (room.id === 'tower') {
      for (let col = 6; col < 12; col++) tiles[18 * width + col] = T.Platform;
      for (let col = 18; col < 24; col++) tiles[12 * width + col] = T.Platform;
      for (let col = 8; col < 20; col++) tiles[6 * width + col] = T.Platform;
    }
    if (room.id === 'stairwell') {
      for (let row = 4; row < 26; row++) {
        tiles[row * width + 12] = T.Ladder;
        tiles[row * width + 13] = T.Ladder;
      }
    }
    if (room.id === 'alchemy') {
      for (let col = 10; col < 22; col++) tiles[(height - 4) * width + col] = T.Spike;
    }
    if (room.id === 'entrance') {
      tiles[15 * width + 20] = T.Door;
      if (!room.doors.find((d) => d.targetRoom === 'save')) {
        room.doors.push({ col: 20, row: 15, targetRoom: 'save', spawnX: 80, spawnY: 80 });
      }
    }
  }
}

finalizeRooms();

export function getRoom(id: string): RoomDef {
  return CASTLE_ROOMS[id] ?? CASTLE_ROOMS.entrance;
}
