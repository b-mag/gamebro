# GameBro Architecture

GameBro is a modular, Game Boy–authentic game engine built on Next.js 14 (App Router) with a fully client-side runtime. The engine is game-agnostic; individual titles live under `/src/games` and plug in via a simple `Game` interface.

## Directory Layout

```
src/
├── app/                    # Next.js routes
│   ├── page.tsx            # Boot → menu
│   └── games/[slug]/       # Per-game routes
├── components/             # Shell UI (canvas wrapper, boot, menu)
├── engine/                 # Reusable GameBoy engine (extractable)
│   ├── core/               # GameBoyEngine, types, Game interface
│   ├── input/              # Keyboard → GB button mapping
│   ├── audio/              # Web Audio chiptune synthesizer
│   ├── renderer/           # 160×144 canvas, wireframe 3D, tilemaps
│   └── save/               # Multi-game HEX continue codes
├── games/                  # Individual game implementations
│   ├── registry.ts         # Central game list
│   ├── eye-of-the-deep/    # Wireframe stealth title
│   └── castle-vein/        # Metroidvania platformer
└── styles/
    └── gameboy.css         # 4-shade palette + shell chrome
```

## Engine Overview

### `GameBoyEngine`

Central loop (~59.73 Hz fixed timestep), owns:

- **Screen** / **CanvasRenderer** — native 160×144 buffer, nearest-neighbor scale
- **InputManager** — D-Pad, A/B, Start/Select
- **AudioEngine** — procedural DMG-style SFX (boot, siren, explosion, ambient)

### `Game` Interface

Every game implements:

| Method | Purpose |
|--------|---------|
| `init(engine)` | Setup; receive engine services |
| `update(dt)` | Fixed-timestep logic |
| `render(renderer)` | Draw to native buffer |
| `onInput(input)` | Edge-triggered button handling |
| `destroy()` | Cleanup |

Metadata (`id`, `slug`, `name`, `description`) is co-located on the same object.

## Adding a New Game

1. **Create a folder** under `src/games/your-game/`.

2. **Implement `Game`**:

```typescript
import type { Game, GameBoyEngine, CanvasRenderer, InputState } from '@/engine';

export class YourGame implements Game {
  readonly id = 'your-game';
  readonly slug = 'your-game';
  readonly name = 'Your Game';
  readonly description = '...';

  init(engine: GameBoyEngine) { /* ... */ }
  update(dt: number) { /* ... */ }
  render(renderer: CanvasRenderer) { /* ... */ }
  onInput(input: InputState) { /* ... */ }
  destroy() { /* ... */ }
}

export function createYourGame() {
  return new YourGame();
}
```

3. **Register** in `src/games/registry.ts`:

```typescript
{
  id: 'your-game',
  slug: 'your-game',
  name: 'Your Game',
  description: '...',
  factory: createYourGame,
},
```

4. **Add route** — `generateStaticParams` in `src/app/games/[slug]/page.tsx` picks up any registered slug automatically if you add it to the registry return value.

That’s it. No engine changes required.

## Input Mapping

| Game Boy | Keys |
|----------|------|
| D-Pad | Arrow keys, WASD |
| A | Z, Space, J |
| B | X, C, K, Shift |
| Start | Enter |
| Select | Tab, Backspace |

## Palette

Four shades only (CSS variables in `gameboy.css`):

- `--gb-darkest` `#0f380f`
- `--gb-dark` `#306230`
- `--gb-light` `#8bac0f`
- `--gb-lightest` `#9bbc0f`

## HEX Continue Codes

`encodeSave` / `decodeSave` — Eye of the Deep (legacy, 15 chars)  
`encodeCastleVeinSave` / `decodeAnySave` — multi-game decoder with game ID prefix  
Castle Vein codes start with `1` and are 17 chars. Menu routes to the correct game via `decodeAnySave`.

## Eye of the Deep

Sentinel-inspired first-person wireframe submarine game:

- **WireframeRenderer** — Star Fox / Faceball-style 3D lines with depth-based 4-shade coloring
- **LevelGenerator** — seeded procedural columns, wreckage, 5 difficulty presets
- **MCU** — stationary (early levels) or slow orbit; rotating eye with line-of-sight beam
- **Threat HUD** — cycling 0→100→0 bar; speed scales with eye proximity; siren + flash when locked

### Controls (documented choice)

**Arcade-submarine hybrid**: turn-in-place steering (Left/Right), forward/back thrust along heading (no strafe). Depth adjusts subtly with A+Up/Down. This reads clearly on keyboard while suggesting underwater inertia.

## Extracting the Engine

The `src/engine` folder has zero imports from `games/` or `app/`. To publish as a package:

1. Move `engine/` to its own npm package
2. Export from `engine/index.ts`
3. Games depend on `@gamebro/engine`

## Running

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```
