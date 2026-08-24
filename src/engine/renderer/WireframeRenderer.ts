import { PaletteShade } from '../core/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface WireEdge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  depth: number;
}

/** 3×3 rotation matrices (column-major flat arrays). */
export function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: v.x * c + v.z * s,
    y: v.y,
    z: -v.x * s + v.z * c,
  };
}

export function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: v.x,
    y: v.y * c - v.z * s,
    z: v.y * s + v.z * c,
  };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Build axis-aligned box wireframe vertices (8 corners). */
export function boxVertices(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number): Vec3[] {
  return [
    { x: cx - hw, y: cy - hh, z: cz - hd },
    { x: cx + hw, y: cy - hh, z: cz - hd },
    { x: cx + hw, y: cy + hh, z: cz - hd },
    { x: cx - hw, y: cy + hh, z: cz - hd },
    { x: cx - hw, y: cy - hh, z: cz + hd },
    { x: cx + hw, y: cy - hh, z: cz + hd },
    { x: cx + hw, y: cy + hh, z: cz + hd },
    { x: cx - hw, y: cy + hh, z: cz + hd },
  ];
}

/** 12 edges of a box by vertex index pairs. */
export const BOX_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Cylinder approximated as N-sided prism wireframe. */
export function cylinderVertices(cx: number, cy: number, cz: number, radius: number, height: number, segments = 8): Vec3[] {
  const verts: Vec3[] = [];
  const halfH = height / 2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    verts.push({ x: cx + Math.cos(a) * radius, y: cy - halfH, z: cz + Math.sin(a) * radius });
  }
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    verts.push({ x: cx + Math.cos(a) * radius, y: cy + halfH, z: cz + Math.sin(a) * radius });
  }
  return verts;
}

export function cylinderEdges(segments: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    edges.push([i, next]);
    edges.push([i + segments, next + segments]);
    edges.push([i, i + segments]);
  }
  return edges;
}

export interface Camera {
  position: Vec3;
  yaw: number;
  pitch: number;
  fov: number;
}

/**
 * Star Fox / Faceball-style wireframe renderer.
 * Projects world-space edges to screen with depth-based 4-shade palette.
 */
export class WireframeRenderer {
  private edges: WireEdge[] = [];

  /** Project and collect edges for sorting. Camera looks down -Z after rotation. */
  projectWorldEdges(
    camera: Camera,
    worldVerts: Vec3[],
    edgePairs: [number, number][],
    screenW: number,
    screenH: number,
    horizonY = 0.55,
  ): WireEdge[] {
    const result: WireEdge[] = [];
    const cosY = Math.cos(camera.yaw);
    const sinY = Math.sin(camera.yaw);
    const cosP = Math.cos(camera.pitch);
    const sinP = Math.sin(camera.pitch);

    for (const [i0, i1] of edgePairs) {
      const v0 = worldVerts[i0];
      const v1 = worldVerts[i1];
      if (!v0 || !v1) continue;

      const p0 = this.transformVertex(v0, camera, cosY, sinY, cosP, sinP);
      const p1 = this.transformVertex(v1, camera, cosY, sinY, cosP, sinP);

      if (p0.z < 0.5 && p1.z < 0.5) continue;

      const s0 = this.project(p0, camera.fov, screenW, screenH, horizonY);
      const s1 = this.project(p1, camera.fov, screenW, screenH, horizonY);
      const depth = (p0.z + p1.z) / 2;

      result.push({
        x0: s0.x,
        y0: s0.y,
        x1: s1.x,
        y1: s1.y,
        depth,
      });
    }

    result.sort((a, b) => b.depth - a.depth);
    return result;
  }

  depthToShade(depth: number, maxDepth = 80): PaletteShade {
    const t = Math.min(1, depth / maxDepth);
    if (t < 0.25) return PaletteShade.Darkest;
    if (t < 0.5) return PaletteShade.Dark;
    if (t < 0.75) return PaletteShade.Light;
    return PaletteShade.Lightest;
  }

  private transformVertex(
    v: Vec3,
    cam: Camera,
    cosY: number,
    sinY: number,
    cosP: number,
    sinP: number,
  ): Vec3 {
    let x = v.x - cam.position.x;
    let y = v.y - cam.position.y;
    let z = v.z - cam.position.z;

    // Yaw (Y axis)
    const tx = x * cosY - z * sinY;
    const tz = x * sinY + z * cosY;
    x = tx;
    z = tz;

    // Pitch (X axis)
    const ty = y * cosP - z * sinP;
    const tz2 = y * sinP + z * cosP;
    y = ty;
    z = tz2;

    return { x, y, z };
  }

  private project(v: Vec3, fov: number, w: number, h: number, horizonY: number): Vec2 {
    const scale = fov / Math.max(v.z, 0.5);
    return {
      x: w / 2 + v.x * scale,
      y: h * horizonY - v.y * scale,
    };
  }
}
