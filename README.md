# GameBro

<img width="800" height="783" alt="eye_deep_1" src="https://github.com/user-attachments/assets/278f02a2-6f62-4ed0-afdb-9a812bc0bdc8" />


Authentic Game Boy–style game engine and multi-cart compilation.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — boot sequence → menu → select a game.

## Controls

| Game Boy | Keys |
|----------|------|
| D-Pad | Arrow keys / WASD |
| A | Z / Space / J |
| B | X / C / K |
| Start | Enter |
| Select | Tab / Backspace |

## Games

- **Eye of the Deep** — procedural wireframe stealth, 5 levels
- **Castle Vein** — Belard's metroidvania platformer
- **Hidden Temples** — top-down jungle action RPG (Link's Awakening–style)
- **War Pickle** — Contra / Metal Slug run-and-gun
- **Mighty Mudskipper** — Mario × Sonic mudfish platformer
- **Horizon** — horizontal mech shmup
- **Hooked** — fishing with visible fish, strike window, tension reel

## Per-game controls

### Castle Vein

| Action | Button |
|--------|--------|
| Move | D-Pad |
| Jump | A |
| Attack | B |
| Equip menu | Start |
| Save (save room) | A at candle |

### Hidden Temples

| Action | Button |
|--------|--------|
| Move | D-Pad |
| Sword / interact | B (or A) |
| Item / map screens | Start (Left/Right to switch) |

### War Pickle

| Action | Button |
|--------|--------|
| Move | D-Pad |
| Jump | A |
| Shoot | B |
| Pause | Start |

### Mighty Mudskipper

| Action | Button |
|--------|--------|
| Move | D-Pad |
| Jump | A |
| Dash | B |
| Pause | Start |

Mud tiles = Sonic-speed run. Dry land = Mario pace.

### Horizon

| Action | Button |
|--------|--------|
| Move | D-Pad |
| Fire | A |
| Laser | B |
| Pause | Start |

### Hooked

| Action | Button |
|--------|--------|
| Aim cast | D-Pad |
| Cast / reel | A |
| Set hook | B |
| Catch log | Start |
| Cycle lure depth | Select |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how to add new games.
