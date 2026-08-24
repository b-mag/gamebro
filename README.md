# GameBro

Authentic Game Boy–style game engine + **Eye of the Deep** (Sentinel-inspired wireframe underwater stealth).

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — boot sequence → menu → select **Eye of the Deep**.

## Controls

| Game Boy | Keys |
|----------|------|
| D-Pad | Arrow keys / WASD |
| A | Z / Space |
| B | X / Shift |
| Start | Enter |

## Features

- Reusable `/src/engine` — loop, input, audio, 160×144 renderer, wireframe 3D, HEX saves
- Classic 4-shade green palette + DMG boot jingle
- **Eye of the Deep** — 5 procedural levels, MCU stealth, threat indicator, continue codes

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how to add new games.
