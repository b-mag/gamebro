import type { Vec3 } from '@/engine';
import { boxVertices, BOX_EDGES, cylinderVertices, cylinderEdges } from '@/engine';
import { SeededRandom, levelSeed } from '../utils/rng';

export interface Obstacle {
  id: number;
  type: 'column' | 'rock' | 'wreck';
  position: Vec3;
  radius: number;
  height: number;
  vertices: Vec3[];
  edges: [number, number][];
  collected?: boolean;
}

export interface LevelConfig {
  level: number;
  seed: number;
  arenaSize: number;
  columnCount: number;
  mcuRotationSpeed: number;
  mcuMoves: boolean;
  mcuMoveSpeed: number;
  passiveDrain: number;
  beamDrain: number;
}

export interface GeneratedLevel {
  config: LevelConfig;
  obstacles: Obstacle[];
  mcuPosition: Vec3;
  playerStart: { x: number; z: number; yaw: number };
}

const LEVEL_PRESETS: Omit<LevelConfig, 'level' | 'seed'>[] = [
  { arenaSize: 70, columnCount: 8, mcuRotationSpeed: 0.35, mcuMoves: false, mcuMoveSpeed: 0, passiveDrain: 1.2, beamDrain: 18 },
  { arenaSize: 85, columnCount: 12, mcuRotationSpeed: 0.5, mcuMoves: false, mcuMoveSpeed: 0, passiveDrain: 1.4, beamDrain: 22 },
  { arenaSize: 95, columnCount: 16, mcuRotationSpeed: 0.65, mcuMoves: false, mcuMoveSpeed: 0, passiveDrain: 1.6, beamDrain: 26 },
  { arenaSize: 105, columnCount: 20, mcuRotationSpeed: 0.8, mcuMoves: true, mcuMoveSpeed: 1.5, passiveDrain: 1.8, beamDrain: 30 },
  { arenaSize: 120, columnCount: 26, mcuRotationSpeed: 1.0, mcuMoves: true, mcuMoveSpeed: 2.5, passiveDrain: 2.0, beamDrain: 35 },
];

function configForLevel(level: number, seed: number): LevelConfig {
  const preset = LEVEL_PRESETS[Math.min(level - 1, LEVEL_PRESETS.length - 1)];
  return { level, seed, ...preset };
}

export function generateLevel(level: number, baseSeed: number): GeneratedLevel {
  const seed = levelSeed(baseSeed, level);
  const rng = new SeededRandom(seed);
  const config = configForLevel(level, seed);
  const half = config.arenaSize / 2;
  const obstacles: Obstacle[] = [];
  let id = 0;

  const mcuPosition: Vec3 = { x: 0, y: 4, z: 0 };

  // Perimeter rocks
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = half - rng.range(5, 12);
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    const r = rng.range(2, 5);
    const h = rng.range(6, 14);
    obstacles.push(makeColumn(id++, cx, h / 2 - 2, cz, r, h, rng));
  }

  // Interior columns — avoid MCU center
  let attempts = 0;
  while (obstacles.filter((o) => o.type !== 'wreck').length < config.columnCount + 6 && attempts < 200) {
    attempts++;
    const x = rng.range(-half + 8, half - 8);
    const z = rng.range(-half + 8, half - 8);
    if (Math.hypot(x, z) < 12) continue;

    const tooClose = obstacles.some((o) => Math.hypot(o.position.x - x, o.position.z - z) < 8);
    if (tooClose) continue;

    const r = rng.range(1.5, 4);
    const h = rng.range(5, 18);
    obstacles.push(makeColumn(id++, x, h / 2 - 2, z, r, h, rng));
  }

  // Wreckage collectibles
  const wreckCount = 3 + Math.min(level, 3);
  for (let w = 0; w < wreckCount; w++) {
    const x = rng.range(-half + 10, half - 10);
    const z = rng.range(-half + 10, half - 10);
    const verts = boxVertices(x, -1, z, 1.2, 0.8, 1.2);
    obstacles.push({
      id: id++,
      type: 'wreck',
      position: { x, y: -1, z },
      radius: 1.5,
      height: 1.6,
      vertices: verts,
      edges: BOX_EDGES,
      collected: false,
    });
  }

  // Floor grid segments (visual seabed)
  const gridStep = 10;
  for (let gx = -half; gx <= half; gx += gridStep) {
    for (let gz = -half; gz <= half; gz += gridStep) {
      const y = -3 + rng.range(-0.3, 0.3);
      const s = gridStep / 2 - 1;
      const verts = boxVertices(gx, y, gz, s, 0.1, s);
      obstacles.push({
        id: id++,
        type: 'rock',
        position: { x: gx, y, z: gz },
        radius: s,
        height: 0.2,
        vertices: verts,
        edges: BOX_EDGES,
      });
    }
  }

  const startAngle = rng.range(0, Math.PI * 2);
  const startDist = half - 10;
  const playerStart = {
    x: Math.cos(startAngle) * startDist,
    z: Math.sin(startAngle) * startDist,
    yaw: startAngle + Math.PI,
  };

  return { config, obstacles, mcuPosition, playerStart };
}

function makeColumn(
  id: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  rng: SeededRandom,
): Obstacle {
  const segments = rng.int(6, 10);
  const verts = cylinderVertices(x, y, z, radius, height, segments);
  return {
    id,
    type: 'column',
    position: { x, y, z },
    radius,
    height,
    vertices: verts,
    edges: cylinderEdges(segments),
  };
}

/** Ray vs vertical cylinder (column) for line-of-sight. */
export function rayHitsObstacle(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  maxDist: number,
  obstacle: Obstacle,
): boolean {
  if (obstacle.type === 'wreck' && obstacle.collected) return false;
  if (obstacle.type === 'rock') return false;

  const cx = obstacle.position.x;
  const cz = obstacle.position.z;
  const r = obstacle.radius + 0.5;

  // 2D ray-circle intersection
  const fx = ox - cx;
  const fz = oz - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / (2 * a);
  const t2 = (-b + sqrt) / (2 * a);
  const t = t1 >= 0 ? t1 : t2;
  return t >= 0 && t <= maxDist;
}

export function hasLineOfSight(
  from: Vec3,
  to: Vec3,
  obstacles: Obstacle[],
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return true;
  const ndx = dx / dist;
  const ndz = dz / dist;

  for (const obs of obstacles) {
    if (rayHitsObstacle(from.x, from.z, ndx, ndz, dist, obs)) {
      return false;
    }
  }
  return true;
}
