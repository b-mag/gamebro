/**
 * HEX continue codes — encodes level, score, and procedural seed.
 *
 * Format (16 hex chars = 64 bits):
 *   [0-3]   level (0–15, stored as level-1)
 *   [4-11]  score (32-bit, capped)
 *   [12-15] seed fragment (16-bit; full seed reconstructed with level salt)
 *   [16-17] checksum (XOR nibbles of above)
 *
 * Example: `3A4F8912B7C6D5E4F2`
 */

export interface SaveData {
  level: number;
  score: number;
  seed: number;
}

const MAX_LEVEL = 15;
const MAX_SCORE = 0xffffffff;

function nibbleChecksum(hex: string): string {
  let xor = 0;
  for (const ch of hex) {
    xor ^= parseInt(ch, 16);
  }
  return xor.toString(16).toUpperCase().padStart(2, '0').slice(-2);
}

export function encodeSave(data: SaveData): string {
  const level = Math.max(1, Math.min(MAX_LEVEL, data.level));
  const score = Math.max(0, Math.min(MAX_SCORE, Math.floor(data.score)));
  const seed = data.seed >>> 0;

  const levelHex = (level - 1).toString(16).toUpperCase().padStart(1, '0');
  const scoreHex = score.toString(16).toUpperCase().padStart(8, '0');
  const seedHex = (seed & 0xffff).toString(16).toUpperCase().padStart(4, '0');

  const payload = `${levelHex}${scoreHex}${seedHex}`;
  const checksum = nibbleChecksum(payload);
  return `${payload}${checksum}`;
}

export function decodeSave(code: string): SaveData | null {
  const cleaned = code.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  if (cleaned.length < 13) return null;

  const payload = cleaned.slice(0, 13);
  const checksum = cleaned.slice(13, 15) || nibbleChecksum(payload);

  if (checksum !== nibbleChecksum(payload)) {
    return null;
  }

  const level = parseInt(payload.slice(0, 1), 16) + 1;
  const score = parseInt(payload.slice(1, 9), 16);
  const seedLo = parseInt(payload.slice(9, 13), 16);

  if (Number.isNaN(level) || Number.isNaN(score) || Number.isNaN(seedLo)) {
    return null;
  }

  // Reconstruct full 32-bit seed from level salt + low 16 bits
  const seed = ((level * 0x9e3779b9) ^ seedLo) >>> 0;

  return { level, score, seed };
}

export function formatSaveCode(code: string): string {
  const c = code.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  return c.match(/.{1,4}/g)?.join('-') ?? c;
}
