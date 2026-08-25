import type { Vec3, FaceIndices } from '@/engine';
import { solidBox, coneMesh, BOX_FACES, BOX_EDGES } from '@/engine';
import { SeededRandom, levelSeed } from '../utils/rng';

export type WorldObjectType = 'terrain' | 'cone' | 'platform' | 'husk' | 'sentinel';

export interface WorldObject {
  id: number;
  type: WorldObjectType;
  cellX: number;
  cellZ: number;
  position: Vec3;
  /** Standing / absorb height (tile altitude). */
  height: number;
  absorbValue: number;
  vertices: Vec3[];
  faces: FaceIndices[];
  edges: [number, number][];
  owned?: boolean;
  stack?: number;
}

export interface LevelConfig {
  level: number;
  seed: number;
  arenaSize: number;
  gridSize: number;
  cellSize: number;
  coneCount: number;
  sentinelRotationSpeed: number;
  passiveDrain: number;
  beamDrain: number;
}

export interface GeneratedLevel {
  config: LevelConfig;
  heights: number[][];
  objects: WorldObject[];
  sentinel: WorldObject;
  playerStart: { cellX: number; cellZ: number; yaw: number };
}

/**
 * Readable chessboard-scale field (Sentinel is 31×31; we keep a smaller GB-friendly board).
 * Arena kept compact so tiles read clearly at 160×144.
 */
const LEVEL_PRESETS: Omit<LevelConfig, 'level' | 'seed' | 'gridSize' | 'cellSize'>[] = [
  { arenaSize: 64, coneCount: 12, sentinelRotationSpeed: 0.2, passiveDrain: 0.25, beamDrain: 11 },
  { arenaSize: 70, coneCount: 14, sentinelRotationSpeed: 0.28, passiveDrain: 0.35, beamDrain: 15 },
  { arenaSize: 76, coneCount: 16, sentinelRotationSpeed: 0.36, passiveDrain: 0.45, beamDrain: 18 },
  { arenaSize: 82, coneCount: 18, sentinelRotationSpeed: 0.44, passiveDrain: 0.5, beamDrain: 22 },
  { arenaSize: 90, coneCount: 22, sentinelRotationSpeed: 0.52, passiveDrain: 0.6, beamDrain: 26 },
];

/** One B on a locked tile = pedestal + warp shell. B with no lock = raise under self. */
const CREATE_COST = 4;
const BOOST_COST = 2;
const CONE_ENERGY = 1;
/** Vertical units per height step. */
export const HEIGHT_SCALE = 1.25;

export { CREATE_COST, BOOST_COST, CONE_ENERGY };

function configForLevel(level: number, seed: number): LevelConfig {
  const preset = LEVEL_PRESETS[Math.min(level - 1, LEVEL_PRESETS.length - 1)];
  // Odd sizes read more like Sentinel's tile board
  const gridSize = 15 + Math.min(level, 2) * 2;
  const cellSize = preset.arenaSize / gridSize;
  return { level, seed, gridSize, cellSize, ...preset };
}

export function cellWorldPos(
  cellX: number,
  cellZ: number,
  gridSize: number,
  cellSize: number,
  heights: number[][],
  stack = 0,
): { x: number; y: number; z: number } {
  const half = (gridSize * cellSize) / 2;
  const x = -half + (cellX + 0.5) * cellSize;
  const z = -half + (cellZ + 0.5) * cellSize;
  const baseH = (heights[cellZ]?.[cellX] ?? 0) + stack;
  const y = baseH * HEIGHT_SCALE;
  return { x, y, z };
}

function coneEdges(segments: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const i0 = 1 + i;
    const i1 = 1 + ((i + 1) % segments);
    edges.push([0, i0], [i0, i1]);
  }
  return edges;
}

/**
 * Chessboard terraces into the screen (BBC Sentinel vibe):
 * low near edge for the player, stepped plateaus rising toward a far Sentinel peak.
 * Trees stay below Sentinel altitude; create-clear tiles reserved around the start.
 */
export function generateLevel(level: number, baseSeed: number): GeneratedLevel {
  const seed = levelSeed(baseSeed, level);
  const rng = new SeededRandom(seed);
  const config = configForLevel(level, seed);
  const { gridSize, cellSize } = config;

  // Near edge of board (into-screen = decreasing z)
  const startX = Math.floor(gridSize / 2) - 1;
  const startZ = gridSize - 2;
  const bestX = Math.floor(gridSize / 2) + rng.int(0, 1);
  const bestZ = 2;
  const maxH = 4 + Math.min(level, 2);

  const heights: number[][] = [];
  for (let z = 0; z < gridSize; z++) {
    heights[z] = [];
    for (let x = 0; x < gridSize; x++) {
      // Contour rings from the far Sentinel — plateaus, not one spike
      const into = (startZ - z) / Math.max(1, startZ - bestZ);
      const side = Math.abs(x - bestX) / Math.max(1, gridSize * 0.45);
      const band = into * maxH - side * 1.4 + rng.range(-0.25, 0.25);
      let h = Math.max(0, Math.min(maxH, Math.floor(band)));
      // Flat apron near the player (Sentinel keeps player low with open tiles)
      const cheb = Math.max(Math.abs(x - startX), Math.abs(z - startZ));
      if (cheb <= 3) h = Math.min(h, cheb <= 1 ? 0 : 1);
      heights[z][x] = h;
    }
  }

  // One smoothing pass for wider plateaus
  const smoothed = heights.map((row) => row.slice());
  for (let z = 1; z < gridSize - 1; z++) {
    for (let x = 1; x < gridSize - 1; x++) {
      const cheb = Math.max(Math.abs(x - startX), Math.abs(z - startZ));
      if (cheb <= 2) continue;
      const avg =
        (heights[z][x] * 2 +
          heights[z][x - 1] +
          heights[z][x + 1] +
          heights[z - 1][x] +
          heights[z + 1][x]) /
        6;
      smoothed[z][x] = Math.max(0, Math.min(maxH, Math.round(avg)));
    }
  }
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) heights[z][x] = smoothed[z][x];
  }

  heights[startZ][startX] = 0;
  heights[bestZ][bestX] = maxH;
  // Stepped ridge toward Sentinel (climb path)
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const x = Math.round(startX + (bestX - startX) * t);
    const z = Math.round(startZ + (bestZ - startZ) * t);
    if (x === startX && z === startZ) continue;
    if (x < 0 || z < 0 || x >= gridSize || z >= gridSize) continue;
    heights[z][x] = Math.max(heights[z][x], Math.min(maxH - 1, Math.floor(t * maxH)));
  }

  const objects: WorldObject[] = [];
  let id = 0;

  // Terrain: flat-top slabs (chessboard tiles)
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const h = heights[z][x];
      const pos = cellWorldPos(x, z, gridSize, cellSize, heights);
      const topY = Math.max(h, 0) * HEIGHT_SCALE;
      const hh = Math.max(topY / 2, 0.1);
      const hw = cellSize * 0.49;
      const box = solidBox(pos.x, hh - 0.01, pos.z, hw, hh, hw);
      objects.push({
        id: id++,
        type: 'terrain',
        cellX: x,
        cellZ: z,
        position: { x: pos.x, y: hh, z: pos.z },
        height: h,
        absorbValue: 0,
        vertices: box.vertices,
        faces: box.faces,
        edges: BOX_EDGES,
      });
    }
  }

  const occupied = new Set<string>([`${bestX},${bestZ}`, `${startX},${startZ}`]);
  // Reserve create-clear tiles around the player (guaranteed warp spots)
  const reserved: [number, number][] = [
    [startX, startZ - 1],
    [startX + 1, startZ - 1],
    [startX - 1, startZ - 1],
    [startX + 1, startZ],
    [startX - 1, startZ],
    [startX, startZ - 2],
  ];
  for (const [rx, rz] of reserved) {
    if (rx >= 0 && rz >= 0 && rx < gridSize && rz < gridSize) {
      occupied.add(`${rx},${rz}`);
      heights[rz][rx] = Math.min(heights[rz][rx], 1);
    }
  }

  const sentinelH = heights[bestZ][bestX];

  const placeCone = (cx: number, cz: number) => {
    const key = `${cx},${cz}`;
    if (occupied.has(key)) return false;
    if (cx < 0 || cz < 0 || cx >= gridSize || cz >= gridSize) return false;
    if (heights[cz][cx] >= sentinelH) return false;
    occupied.add(key);
    const pos = cellWorldPos(cx, cz, gridSize, cellSize, heights);
    const segs = 6;
    const treeH = 2.6 + rng.range(0, 0.5);
    const mesh = coneMesh(pos.x, pos.y, pos.z, cellSize * 0.3, treeH, segs);
    objects.push({
      id: id++,
      type: 'cone',
      cellX: cx,
      cellZ: cz,
      position: { x: pos.x, y: pos.y + treeH * 0.45, z: pos.z },
      height: heights[cz][cx],
      absorbValue: CONE_ENERGY,
      vertices: mesh.vertices,
      faces: mesh.faces,
      edges: coneEdges(segs),
    });
    return true;
  };

  let cones = 0;
  // Trees a bit further out so the apron stays clear for create
  const nearTargets: [number, number][] = [];
  for (let dz = -5; dz <= -2; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      nearTargets.push([startX + dx, startZ + dz]);
    }
  }
  for (let i = nearTargets.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [nearTargets[i], nearTargets[j]] = [nearTargets[j], nearTargets[i]];
  }
  for (const [cx, cz] of nearTargets) {
    if (cones >= Math.min(6, config.coneCount)) break;
    if (placeCone(cx, cz)) cones++;
  }

  let attempts = 0;
  while (cones < config.coneCount && attempts < 500) {
    attempts++;
    if (placeCone(rng.int(0, gridSize - 1), rng.int(0, gridSize - 1))) cones++;
  }

  const sPos = cellWorldPos(bestX, bestZ, gridSize, cellSize, heights);
  const sH = heights[bestZ][bestX];
  const sBody = solidBox(sPos.x, sPos.y + 2.0, sPos.z, 1.2, 1.8, 1.2);
  const sentinel: WorldObject = {
    id: id++,
    type: 'sentinel',
    cellX: bestX,
    cellZ: bestZ,
    position: { x: sPos.x, y: sPos.y + 2.0, z: sPos.z },
    height: sH,
    absorbValue: 0,
    vertices: sBody.vertices,
    faces: sBody.faces,
    edges: BOX_EDGES,
  };
  objects.push(sentinel);

  const startPos = cellWorldPos(startX, startZ, gridSize, cellSize, heights);
  const playerStart = {
    cellX: startX,
    cellZ: startZ,
    yaw: Math.atan2(sPos.x - startPos.x, sPos.z - startPos.z),
  };

  return { config, heights, objects, sentinel, playerStart };
}

export function makePlatform(
  id: number,
  cellX: number,
  cellZ: number,
  gridSize: number,
  cellSize: number,
  heights: number[][],
  stack: number,
): WorldObject {
  const pos = cellWorldPos(cellX, cellZ, gridSize, cellSize, heights, stack);
  const y = pos.y + 0.5;
  const box = solidBox(pos.x, y, pos.z, cellSize * 0.36, 0.45, cellSize * 0.36);
  return {
    id,
    type: 'platform',
    cellX,
    cellZ,
    position: { x: pos.x, y, z: pos.z },
    height: (heights[cellZ]?.[cellX] ?? 0) + stack + 1,
    absorbValue: 0,
    vertices: box.vertices,
    faces: box.faces,
    edges: BOX_EDGES,
    stack,
  };
}

export function makeHusk(
  id: number,
  cellX: number,
  cellZ: number,
  gridSize: number,
  cellSize: number,
  heights: number[][],
  stack: number,
  owned: boolean,
): WorldObject {
  const pos = cellWorldPos(cellX, cellZ, gridSize, cellSize, heights, stack);
  const y = pos.y + 1.05;
  const box = solidBox(pos.x, y, pos.z, 0.65, 0.95, 0.65);
  return {
    id,
    type: 'husk',
    cellX,
    cellZ,
    position: { x: pos.x, y, z: pos.z },
    height: (heights[cellZ]?.[cellX] ?? 0) + stack,
    absorbValue: CREATE_COST - 1,
    vertices: box.vertices,
    faces: BOX_FACES,
    edges: BOX_EDGES,
    owned,
    stack,
  };
}

export function hasHeightmapLOS(
  fromX: number,
  fromZ: number,
  fromH: number,
  toX: number,
  toZ: number,
  toH: number,
  heights: number[][],
): boolean {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toZ - fromZ), 1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.round(fromX + (toX - fromX) * t);
    const cz = Math.round(fromZ + (toZ - fromZ) * t);
    const h = heights[cz]?.[cx] ?? 0;
    const beamH = fromH + (toH - fromH) * t;
    if (h > beamH + 0.2) return false;
  }
  return true;
}
