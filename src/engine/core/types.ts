/** Native Game Boy LCD resolution (DMG-01). */
export const GB_WIDTH = 160;
export const GB_HEIGHT = 144;

/** Four-shade palette indices matching DMG green LCD. */
export enum PaletteShade {
  Lightest = 0,
  Light = 1,
  Dark = 2,
  Darkest = 3,
}

export const PALETTE_HEX: Record<PaletteShade, string> = {
  [PaletteShade.Lightest]: '#9bbc0f',
  [PaletteShade.Light]: '#8bac0f',
  [PaletteShade.Dark]: '#306230',
  [PaletteShade.Darkest]: '#0f380f',
};

/** Game Boy button identifiers. */
export type GBButton =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'start'
  | 'select';

export interface InputState {
  /** Currently held buttons this frame. */
  held: Set<GBButton>;
  /** Buttons pressed this frame (edge-triggered). */
  pressed: Set<GBButton>;
  /** Buttons released this frame. */
  released: Set<GBButton>;
  /** Shift held — secondary actions (backdash, sub-weapons). */
  altHeld: boolean;
}

export interface EngineConfig {
  /** Canvas scale factor (integer multiples only for crisp pixels). */
  scale?: number;
  /** Enable CRT-style scanline overlay. */
  scanlines?: boolean;
  /** Target logic updates per second (Game Boy ≈ 59.73 Hz). */
  targetFps?: number;
}

export type EnginePhase = 'boot' | 'menu' | 'game' | 'paused';
