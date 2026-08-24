import { PaletteShade, PALETTE_HEX } from '@/engine';
import type { CanvasRenderer } from '@/engine';

/** Room node positions on the castle map (pixel coords on 160×144). */
export interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Connection between two rooms. */
export interface MapEdge {
  from: string;
  to: string;
  /** Horizontal or vertical corridor segment for drawing. */
  axis: 'h' | 'v';
}

/** Castle layout — metroidvania map graph. */
export const CASTLE_MAP_NODES: MapNode[] = [
  { id: 'entrance', label: 'ENT', x: 8, y: 100, w: 40, h: 18 },
  { id: 'vault', label: 'VLT', x: 8, y: 120, w: 28, h: 16 },
  { id: 'save', label: 'SAV', x: 52, y: 100, w: 24, h: 18 },
  { id: 'gallery', label: 'GAL', x: 88, y: 88, w: 32, h: 20 },
  { id: 'catacombs', label: 'CAT', x: 88, y: 112, w: 32, h: 18 },
  { id: 'upper_nave', label: 'NAV', x: 88, y: 56, w: 32, h: 20 },
  { id: 'shoe_boss', label: 'SHO', x: 128, y: 88, w: 28, h: 20 },
  { id: 'dungeon', label: 'DUN', x: 128, y: 112, w: 28, h: 18 },
  { id: 'tower', label: 'TOW', x: 128, y: 32, w: 28, h: 20 },
];

export const CASTLE_MAP_EDGES: MapEdge[] = [
  { from: 'entrance', to: 'save', axis: 'h' },
  { from: 'entrance', to: 'gallery', axis: 'h' },
  { from: 'entrance', to: 'vault', axis: 'v' },
  { from: 'gallery', to: 'shoe_boss', axis: 'h' },
  { from: 'gallery', to: 'upper_nave', axis: 'v' },
  { from: 'gallery', to: 'catacombs', axis: 'v' },
  { from: 'catacombs', to: 'dungeon', axis: 'h' },
  { from: 'upper_nave', to: 'tower', axis: 'v' },
];

export function doorKey(from: string, to: string): string {
  return `${from}->${to}`;
}

export function renderCastleMap(
  renderer: CanvasRenderer,
  visited: Set<string>,
  openedDoors: Set<string>,
  currentRoom: string,
  pulse: number,
): void {
  const ctx = renderer.context;
  renderer.clear(PaletteShade.Lightest);

  renderer.drawText('CASTLE MAP', 80, 4, {
    shade: PaletteShade.Darkest,
    align: 'center',
    size: 8,
  });

  const nodeById = Object.fromEntries(CASTLE_MAP_NODES.map((n) => [n.id, n]));

  // Draw corridors / doors between rooms
  for (const edge of CASTLE_MAP_EDGES) {
    const a = nodeById[edge.from];
    const b = nodeById[edge.to];
    if (!a || !b) continue;

    const opened = openedDoors.has(doorKey(edge.from, edge.to)) ||
      openedDoors.has(doorKey(edge.to, edge.from));
    const eitherVisited = visited.has(edge.from) || visited.has(edge.to);

    if (!eitherVisited && !opened) continue;

    const shade = opened ? PaletteShade.Dark : PaletteShade.Light;
    const lines = opened ? 1 : 3;
    const gap = opened ? 0 : 2;

    drawCorridor(ctx, a, b, edge.axis, shade, lines, gap);
  }

  // Draw room boxes
  for (const node of CASTLE_MAP_NODES) {
    if (!visited.has(node.id)) continue;

    const isCurrent = node.id === currentRoom;
    const fill = isCurrent ? PaletteShade.Light : PaletteShade.Dark;
    renderer.fillRect(node.x, node.y, node.w, node.h, fill);
    renderer.strokeRect(node.x, node.y, node.w, node.h, PaletteShade.Darkest);

    renderer.drawText(node.label, node.x + node.w / 2, node.y + 6, {
      shade: isCurrent ? PaletteShade.Darkest : PaletteShade.Lightest,
      align: 'center',
      size: 6,
    });

    // Pulsing player marker on current room
    if (isCurrent) {
      const pulseSize = 4 + Math.sin(pulse * 4) * 2;
      const px = node.x + node.w / 2 - pulseSize / 2;
      const py = node.y + node.h - 8;
      renderer.fillRect(px, py, pulseSize, pulseSize, PaletteShade.Darkest);
      renderer.strokeRect(px, py, pulseSize, pulseSize, PaletteShade.Darkest);
    }
  }

  renderer.drawText('B=BACK  START=MAP', 80, 136, {
    shade: PaletteShade.Light,
    align: 'center',
    size: 6,
  });
}

function drawCorridor(
  ctx: CanvasRenderingContext2D,
  a: MapNode,
  b: MapNode,
  axis: 'h' | 'v',
  shade: PaletteShade,
  lineCount: number,
  gap: number,
): void {
  ctx.strokeStyle = PALETTE_HEX[shade];
  ctx.lineWidth = 1;

  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;

  for (let i = 0; i < lineCount; i++) {
    const offset = lineCount === 1 ? 0 : (i - 1) * gap;
    ctx.beginPath();
    if (axis === 'h') {
      const y = (acy + bcy) / 2 + offset;
      ctx.moveTo(acx + 0.5, y + 0.5);
      ctx.lineTo(bcx + 0.5, y + 0.5);
    } else {
      const x = (acx + bcx) / 2 + offset;
      ctx.moveTo(x + 0.5, acy + 0.5);
      ctx.lineTo(x + 0.5, bcy + 0.5);
    }
    ctx.stroke();
  }
}
