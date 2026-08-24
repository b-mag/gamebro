export type { Game, GameMetadata, GameFactory } from './core/Game';
export { GameBoyEngine } from './core/GameBoyEngine';
export type { GBButton, InputState, EngineConfig, EnginePhase } from './core/types';
export { GB_WIDTH, GB_HEIGHT, PaletteShade, PALETTE_HEX } from './core/types';
export { InputManager } from './input/InputManager';
export { AudioEngine } from './audio/AudioEngine';
export { CanvasRenderer } from './renderer/CanvasRenderer';
export { Screen } from './renderer/Screen';
export { WireframeRenderer } from './renderer/WireframeRenderer';
export type { Vec3, Vec2, Camera, WireEdge } from './renderer/WireframeRenderer';
export {
  rotateY,
  rotateX,
  add,
  sub,
  scale,
  length,
  normalize,
  dot,
  boxVertices,
  BOX_EDGES,
  cylinderVertices,
  cylinderEdges,
} from './renderer/WireframeRenderer';
export { TileMapRenderer, isSolidTile, isPlatformTile } from './renderer/TileMapRenderer';
export type { TileDef, TileMapData } from './renderer/TileMapRenderer';
export {
  encodeSave,
  decodeSave,
  decodeAnySave,
  encodeCastleVeinSave,
  formatSaveCode,
  GAME_SAVE_IDS,
} from './save/HexSaveSystem';
export type { SaveData, CastleVeinSaveData, DecodedSave, GameSaveId } from './save/HexSaveSystem';
