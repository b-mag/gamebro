/** Castle Vein tile IDs. */
export enum Tile {
  Empty = 0,
  Solid = 1,
  Platform = 2,
  Ladder = 3,
  Cracked = 4,
  Spike = 5,
  Door = 6,
  SavePoint = 7,
  Candle = 8,
  Drawbridge = 9,
  Background = 10,
}

export const SOLID_TILES = new Set([Tile.Solid, Tile.Cracked, Tile.Door, Tile.Drawbridge]);
export const PLATFORM_TILES = new Set([Tile.Platform]);
export const HAZARD_TILES = new Set([Tile.Spike]);

export enum Weapon {
  Whip = 0,
  Sword = 1,
  Axe = 2,
}

export enum Armor {
  Cloak = 0,
  Leather = 1,
  Plate = 2,
}

export enum Relic {
  None = 0,
  VeinWings = 1, // double jump
  BloodSigil = 2, // break cracked floors
}

export interface RoomDef {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: number[];
  /** Room transitions: tile col/row → target room + spawn */
  doors: RoomDoor[];
  enemies: EnemySpawn[];
  pickups: PickupSpawn[];
  isSaveRoom?: boolean;
  music: 'castle' | 'dungeon' | 'boss' | 'intro';
}

export interface RoomDoor {
  col: number;
  row: number;
  targetRoom: string;
  spawnX: number;
  spawnY: number;
}

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  y: number;
}

export interface PickupSpawn {
  kind: 'weapon' | 'armor' | 'relic' | 'gold' | 'heart';
  id: number;
  x: number;
  y: number;
  collected?: boolean;
}

export type EnemyType = 'bat' | 'skeleton' | 'knight' | 'wraith' | 'boss_guard' | 'boss_wraith';

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  grounded: boolean;
  onLadder: boolean;
  hp: number;
  maxHp: number;
  invuln: number;
  knockback: number;
  weapon: Weapon;
  armor: Armor;
  relics: number;
  gold: number;
  bossesDefeated: number;
  jumpCount: number;
  attacking: number;
  attackCooldown: number;
  backdash: number;
  backdashCooldown: number;
  anim: number;
}

export interface EnemyState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  phase: number;
  alive: boolean;
  invuln: number;
}

export type GameMode =
  | 'intro'
  | 'playing'
  | 'menu'
  | 'save'
  | 'paused'
  | 'dead'
  | 'victory';

export const TILE = 8;
export const GRAVITY = 420;
export const JUMP_FORCE = -145;
export const MOVE_SPEED = 52;
export const BACKDASH_SPEED = 120;
export const BACKDASH_DURATION = 0.18;
