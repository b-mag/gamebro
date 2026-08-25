import type { Vec3, FaceIndices } from '@/engine';
import { solidBox, cylinderVertices, cylinderFaces, BOX_FACES } from '@/engine';
import { SeededRandom, levelSeed } from '../utils/rng';

export type ObstacleType = 'column' | 'rock' | 'wreck';
export type EnemyType = 'turret' | 'drifter' | 'pod';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  position: Vec3;
  radius: number;
  height: number;
  vertices: Vec3[];
  faces: FaceIndices[];
  collected?: boolean;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  position: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  turnSpeed: number;
  fireCooldown: number;
  lockProgress: number;
  vertices: Vec3[];
  faces: FaceIndices[];
  /** Pod activation radius. */
  aggroRange: number;
  active: boolean;
}

export interface LevelConfig {
  level: number;
  seed: number;
  arenaSize: number;
  columnCount: number;
  enemyCount: number;
  passiveDrain: number;
  floorY: number;
  ceilingY: number;
}

export interface GeneratedLevel {
  config: LevelConfig;
  obstacles: Obstacle[];
  enemies: Enemy[];
  triangleNode: { position: Vec3; vertices: Vec3[]; faces: FaceIndices[]; hp: number };
  playerStart: { x: number; y: number; z: number; yaw: number };
}

/** EOTD arena × 1.4 */
const LEVEL_PRESETS: Omit<LevelConfig, 'level' | 'seed'>[] = [
  { arenaSize: 98, columnCount: 10, enemyCount: 4, passiveDrain: 0.8, floorY: -8, ceilingY: 10 },
  { arenaSize: 119, columnCount: 14, enemyCount: 5, passiveDrain: 1.0, floorY: -9, ceilingY: 11 },
  { arenaSize: 133, columnCount: 18, enemyCount: 6, passiveDrain: 1.15, floorY: -10, ceilingY: 12 },
  { arenaSize: 147, columnCount: 22, enemyCount: 7, passiveDrain: 1.3, floorY: -11, ceilingY: 13 },
  { arenaSize: 168, columnCount: 28, enemyCount: 9, passiveDrain: 1.5, floorY: -12, ceilingY: 14 },
];

function configForLevel(level: number, seed: number): LevelConfig {
  const preset = LEVEL_PRESETS[Math.min(level - 1, LEVEL_PRESETS.length - 1)];
  return { level, seed, ...preset };
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
  const segments = rng.int(6, 8);
  const verts = cylinderVertices(x, y, z, radius, height, segments);
  return {
    id,
    type: 'column',
    position: { x, y, z },
    radius,
    height,
    vertices: verts,
    faces: cylinderFaces(segments),
  };
}

function enemyMesh(type: EnemyType, x: number, y: number, z: number): { vertices: Vec3[]; faces: FaceIndices[] } {
  if (type === 'turret') return solidBox(x, y, z, 1.2, 1.0, 1.2);
  if (type === 'drifter') return solidBox(x, y, z, 0.9, 0.7, 1.4);
  return solidBox(x, y, z, 0.8, 0.8, 0.8);
}

export function refreshEnemyMesh(enemy: Enemy): void {
  const mesh = enemyMesh(enemy.type, enemy.position.x, enemy.position.y, enemy.position.z);
  enemy.vertices = mesh.vertices;
  enemy.faces = mesh.faces;
}

export function generateLevel(level: number, baseSeed: number): GeneratedLevel {
  const seed = levelSeed(baseSeed, level);
  const rng = new SeededRandom(seed);
  const config = configForLevel(level, seed);
  const half = config.arenaSize / 2;
  const obstacles: Obstacle[] = [];
  let id = 0;

  const trianglePos: Vec3 = { x: 0, y: 2, z: 0 };
  const tri = solidBox(trianglePos.x, trianglePos.y, trianglePos.z, 2.5, 2.0, 2.5);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = half - rng.range(6, 14);
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    const r = rng.range(2, 4.5);
    const h = rng.range(8, 16);
    obstacles.push(makeColumn(id++, cx, h / 2 - 3, cz, r, h, rng));
  }

  let attempts = 0;
  while (obstacles.filter((o) => o.type === 'column').length < config.columnCount + 6 && attempts < 250) {
    attempts++;
    const x = rng.range(-half + 10, half - 10);
    const z = rng.range(-half + 10, half - 10);
    if (Math.hypot(x, z) < 14) continue;
    if (obstacles.some((o) => Math.hypot(o.position.x - x, o.position.z - z) < 9)) continue;
    const r = rng.range(1.5, 3.8);
    const h = rng.range(6, 20);
    obstacles.push(makeColumn(id++, x, h / 2 - 3, z, r, h, rng));
  }

  const wreckCount = 4 + Math.min(level, 3);
  for (let w = 0; w < wreckCount; w++) {
    const x = rng.range(-half + 12, half - 12);
    const z = rng.range(-half + 12, half - 12);
    const y = rng.range(config.floorY + 2, config.ceilingY - 3);
    const box = solidBox(x, y, z, 1.1, 0.7, 1.1);
    obstacles.push({
      id: id++,
      type: 'wreck',
      position: { x, y, z },
      radius: 1.4,
      height: 1.4,
      vertices: box.vertices,
      faces: BOX_FACES,
      collected: false,
    });
  }

  // Floor / ceiling slabs (sparse for solid occlusion feel)
  const gridStep = 14;
  for (let gx = -half; gx <= half; gx += gridStep) {
    for (let gz = -half; gz <= half; gz += gridStep) {
      const s = gridStep / 2 - 1.5;
      const floor = solidBox(gx, config.floorY, gz, s, 0.25, s);
      obstacles.push({
        id: id++,
        type: 'rock',
        position: { x: gx, y: config.floorY, z: gz },
        radius: s,
        height: 0.5,
        vertices: floor.vertices,
        faces: BOX_FACES,
      });
    }
  }

  const enemies: Enemy[] = [];
  const types: EnemyType[] = ['turret', 'drifter', 'pod'];
  attempts = 0;
  while (enemies.length < config.enemyCount && attempts < 300) {
    attempts++;
    const x = rng.range(-half + 15, half - 15);
    const z = rng.range(-half + 15, half - 15);
    if (Math.hypot(x, z) < 16) continue;
    if (enemies.some((e) => Math.hypot(e.position.x - x, e.position.z - z) < 12)) continue;
    const type = types[enemies.length % 3];
    const y =
      type === 'pod'
        ? rng.range(1, config.ceilingY - 3)
        : type === 'turret'
          ? config.floorY + 2.5
          : rng.range(config.floorY + 3, 4);
    const mesh = enemyMesh(type, x, y, z);
    const hp = type === 'turret' ? 3 : type === 'drifter' ? 2 : 2;
    enemies.push({
      id: id++,
      type,
      position: { x, y, z },
      yaw: rng.range(0, Math.PI * 2),
      hp,
      maxHp: hp,
      speed: type === 'drifter' ? 1.2 : type === 'pod' ? 0.8 : 0,
      turnSpeed: type === 'turret' ? 0.22 : 0.4,
      fireCooldown: rng.range(2.5, 4.5),
      lockProgress: 0,
      vertices: mesh.vertices,
      faces: mesh.faces,
      aggroRange: type === 'pod' ? 18 : 36,
      active: type !== 'pod',
    });
  }

  const startAngle = rng.range(0, Math.PI * 2);
  const startDist = half - 14;
  const playerStart = {
    x: Math.cos(startAngle) * startDist,
    y: 0,
    z: Math.sin(startAngle) * startDist,
    yaw: startAngle + Math.PI,
  };

  return {
    config,
    obstacles,
    enemies,
    triangleNode: {
      position: trianglePos,
      vertices: tri.vertices,
      faces: tri.faces,
      hp: 5 + level,
    },
    playerStart,
  };
}

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

export function hasLineOfSight(from: Vec3, to: Vec3, obstacles: Obstacle[]): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return true;
  const ndx = dx / dist;
  const ndz = dz / dist;
  for (const obs of obstacles) {
    if (rayHitsObstacle(from.x, from.z, ndx, ndz, dist, obs)) return false;
  }
  return true;
}
