/**
 * Multi-game HEX save system.
 *
 * Legacy (Eye of the Deep): 15 chars, no game prefix
 * Extended: starts with game ID nibble
 *   0 = eye-of-the-deep (legacy format)
 *   1 = castle-vein
 */

export const GAME_SAVE_IDS = {
  'eye-of-the-deep': 0,
  'castle-vein': 1,
} as const;

export type GameSaveId = (typeof GAME_SAVE_IDS)[keyof typeof GAME_SAVE_IDS];

export interface SaveData {
  level: number;
  score: number;
  seed: number;
}

export interface CastleVeinSaveData {
  room: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  weapon: number;
  armor: number;
  relics: number;
  gold: number;
  bosses: number;
}

export interface DecodedSave {
  gameId: GameSaveId;
  slug: string;
  eyeOfTheDeep?: SaveData;
  castleVein?: CastleVeinSaveData;
}

function nibbleChecksum(hex: string): string {
  let xor = 0;
  for (const ch of hex) {
    xor ^= parseInt(ch, 16);
  }
  return xor.toString(16).toUpperCase().padStart(2, '0').slice(-2);
}

/** Eye of the Deep save (legacy format). */
export function encodeSave(data: SaveData): string {
  const level = Math.max(1, Math.min(15, data.level));
  const score = Math.max(0, Math.min(0xffffffff, Math.floor(data.score)));
  const seed = data.seed >>> 0;
  const levelHex = (level - 1).toString(16).toUpperCase();
  const scoreHex = score.toString(16).toUpperCase().padStart(8, '0');
  const seedHex = (seed & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const payload = `${levelHex}${scoreHex}${seedHex}`;
  return `${payload}${nibbleChecksum(payload)}`;
}

export function decodeSave(code: string): SaveData | null {
  const result = decodeAnySave(code);
  return result?.eyeOfTheDeep ?? null;
}

/** Castle Vein save — 17 hex chars with game ID prefix. */
const ROOM_IDS: Record<string, number> = {
  entrance: 1,
  gallery: 2,
  catacombs: 3,
  upper_nave: 4,
  dungeon: 5,
  save: 6,
  tower: 7,
  shoe_boss: 8,
  vault: 9,
  hall: 2,
  stairwell: 3,
  alchemy: 4,
  boss1: 8,
  throne: 7,
};
const ID_TO_ROOM: Record<number, string> = {
  1: 'entrance',
  2: 'gallery',
  3: 'catacombs',
  4: 'upper_nave',
  5: 'dungeon',
  6: 'save',
  7: 'tower',
  8: 'shoe_boss',
  9: 'vault',
};

export function encodeCastleVeinSave(data: CastleVeinSaveData): string {
  const gameId = 1;
  const roomId = ROOM_IDS[data.room] ?? 1;
  const x = Math.max(0, Math.min(255, Math.floor(data.x)));
  const y = Math.max(0, Math.min(255, Math.floor(data.y)));
  const hp = Math.max(0, Math.min(15, Math.floor(data.hp / 10)));
  const weapon = data.weapon & 0x3;
  const armor = data.armor & 0x3;
  const relics = data.relics & 0x3;
  const bosses = data.bosses & 0x3;
  const flags = (weapon << 6) | (armor << 4) | (relics << 2) | bosses;
  const gold = Math.max(0, Math.min(0xffff, data.gold));

  const payload =
    gameId.toString(16).toUpperCase() +
    roomId.toString(16).toUpperCase().padStart(2, '0') +
    x.toString(16).toUpperCase().padStart(2, '0') +
    y.toString(16).toUpperCase().padStart(2, '0') +
    hp.toString(16).toUpperCase() +
    flags.toString(16).toUpperCase().padStart(2, '0') +
    gold.toString(16).toUpperCase().padStart(4, '0');

  return `${payload}${nibbleChecksum(payload)}`;
}

function decodeCastleVein(payload: string): CastleVeinSaveData | null {
  if (payload.length < 15) return null;
  const roomId = parseInt(payload.slice(1, 3), 16);
  const x = parseInt(payload.slice(3, 5), 16);
  const y = parseInt(payload.slice(5, 7), 16);
  const hpN = parseInt(payload.slice(7, 8), 16);
  const flags = parseInt(payload.slice(8, 10), 16);
  const gold = parseInt(payload.slice(10, 14), 16);
  if ([roomId, x, y, hpN, flags, gold].some(Number.isNaN)) return null;

  return {
    room: ID_TO_ROOM[roomId] ?? 'entrance',
    x,
    y,
    hp: hpN * 10,
    maxHp: 100,
    weapon: (flags >> 6) & 0x3,
    armor: (flags >> 4) & 0x3,
    relics: (flags >> 2) & 0x3,
    bosses: flags & 0x3,
    gold,
  };
}

/** Decode any GameBro save code and identify target game. */
export function decodeAnySave(code: string): DecodedSave | null {
  const cleaned = code.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  if (cleaned.length < 13) return null;

  const firstNibble = parseInt(cleaned[0], 16);

  // Castle Vein extended format
  if (firstNibble === 1 && cleaned.length >= 15) {
    const payload = cleaned.slice(0, 15);
    const checksum = cleaned.slice(15, 17) || nibbleChecksum(payload);
    if (checksum !== nibbleChecksum(payload)) return null;
    const cv = decodeCastleVein(payload);
    if (!cv) return null;
    return { gameId: 1, slug: 'castle-vein', castleVein: cv };
  }

  // Legacy Eye of the Deep
  const payload = cleaned.slice(0, 13);
  const checksum = cleaned.slice(13, 15) || nibbleChecksum(payload);
  if (checksum !== nibbleChecksum(payload)) return null;

  const level = parseInt(payload.slice(0, 1), 16) + 1;
  const score = parseInt(payload.slice(1, 9), 16);
  const seedLo = parseInt(payload.slice(9, 13), 16);
  if ([level, score, seedLo].some(Number.isNaN)) return null;

  const seed = ((level * 0x9e3779b9) ^ seedLo) >>> 0;
  return {
    gameId: 0,
    slug: 'eye-of-the-deep',
    eyeOfTheDeep: { level, score, seed },
  };
}

export function formatSaveCode(code: string): string {
  const c = code.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  return c.match(/.{1,4}/g)?.join('-') ?? c;
}
