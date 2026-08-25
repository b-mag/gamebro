import { PaletteShade, PALETTE_HEX } from '../core/types';
import type { CanvasRenderer } from './CanvasRenderer';
import {
  type Vec3,
  type Vec2,
  type Camera,
  boxVertices,
  sub,
} from './WireframeRenderer';

/** Quad face as 4 vertex indices into a vertex array. */
export type FaceIndices = [number, number, number, number];

/** Projected solid face ready for painter's algorithm draw. */
export interface SolidFace {
  points: Vec2[];
  depth: number;
  shade: PaletteShade;
}

/** Box faces (CCW when viewed from outside, matching boxVertices order). */
export const BOX_FACES: FaceIndices[] = [
  [0, 1, 2, 3], // -Z
  [5, 4, 7, 6], // +Z
  [4, 0, 3, 7], // -X
  [1, 5, 6, 2], // +X
  [3, 2, 6, 7], // +Y
  [4, 5, 1, 0], // -Y
];

/**
 * Build a cone (pyramid) with base on XZ and tip above center.
 * Returns vertices + triangular side faces as quads (degenerate tip repeated).
 */
export function coneMesh(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments = 6,
): { vertices: Vec3[]; faces: FaceIndices[] } {
  const vertices: Vec3[] = [{ x: cx, y: cy + height, z: cz }];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    vertices.push({
      x: cx + Math.cos(a) * radius,
      y: cy,
      z: cz + Math.sin(a) * radius,
    });
  }
  const faces: FaceIndices[] = [];
  for (let i = 0; i < segments; i++) {
    const i0 = 1 + i;
    const i1 = 1 + ((i + 1) % segments);
    faces.push([0, i0, i1, i1]);
  }
  // Base
  if (segments >= 3) {
    faces.push([1, segments, Math.max(2, Math.floor(segments / 2) + 1), 2]);
  }
  return { vertices, faces };
}

/** Prism / column faces from cylinderVertices layout (bottom ring then top ring). */
export function cylinderFaces(segments: number): FaceIndices[] {
  const faces: FaceIndices[] = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const b0 = i;
    const b1 = next;
    const t0 = i + segments;
    const t1 = next + segments;
    faces.push([b0, b1, t1, t0]);
  }
  return faces;
}

/**
 * Solid-face 3D renderer for GB palette.
 * Back-face cull + painter's algorithm so flat surfaces occlude what is behind them.
 */
export class SolidMeshRenderer {
  projectFaces(
    camera: Camera,
    worldVerts: Vec3[],
    faces: FaceIndices[],
    screenW: number,
    screenH: number,
    horizonY = 0.5,
    maxDepth = 100,
    shadeBias = 0,
  ): SolidFace[] {
    const result: SolidFace[] = [];
    const cosY = Math.cos(camera.yaw);
    const sinY = Math.sin(camera.yaw);
    const cosP = Math.cos(camera.pitch);
    const sinP = Math.sin(camera.pitch);

    const camPos = camera.position;

    for (const face of faces) {
      const w0 = worldVerts[face[0]];
      const w1 = worldVerts[face[1]];
      const w2 = worldVerts[face[2]];
      if (!w0 || !w1 || !w2) continue;

      // Back-face cull in world space
      const e1 = sub(w1, w0);
      const e2 = sub(w2, w0);
      const nx = e1.y * e2.z - e1.z * e2.y;
      const ny = e1.z * e2.x - e1.x * e2.z;
      const nz = e1.x * e2.y - e1.y * e2.x;
      const toCam = sub(camPos, w0);
      if (nx * toCam.x + ny * toCam.y + nz * toCam.z <= 0) continue;

      const camVerts: Vec3[] = [];
      let avgDepth = 0;
      let behind = 0;
      for (let i = 0; i < 4; i++) {
        const wi = worldVerts[face[i]];
        if (!wi) continue;
        const cv = this.transformVertex(wi, camera, cosY, sinY, cosP, sinP);
        camVerts.push(cv);
        avgDepth += cv.z;
        if (cv.z < 0.5) behind++;
      }
      if (camVerts.length < 3 || behind === camVerts.length) continue;
      avgDepth /= camVerts.length;
      if (avgDepth < 0.5) continue;

      const points: Vec2[] = camVerts.map((v) =>
        this.project(v, camera.fov, screenW, screenH, horizonY),
      );

      // Lighting: facing camera + depth
      const nLen = Math.hypot(nx, ny, nz) || 1;
      const facing = Math.max(0, (nx * toCam.x + ny * toCam.y + nz * toCam.z) / nLen / (Math.hypot(toCam.x, toCam.y, toCam.z) || 1));
      const shade = this.faceShade(avgDepth, facing, maxDepth, shadeBias);

      result.push({ points, depth: avgDepth, shade });
    }

    result.sort((a, b) => b.depth - a.depth);
    return result;
  }

  /** Draw sorted faces into the view rectangle (y offset applied by caller via translate or point y). */
  drawFaces(
    renderer: CanvasRenderer,
    faces: SolidFace[],
    offsetY = 0,
    clip?: { x: number; y: number; w: number; h: number },
  ): void {
    const ctx = renderer.context;
    ctx.save();
    if (clip) {
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.w, clip.h);
      ctx.clip();
    }
    for (const face of faces) {
      if (face.points.length < 3) continue;
      ctx.fillStyle = PALETTE_HEX[face.shade];
      ctx.beginPath();
      ctx.moveTo(face.points[0].x, face.points[0].y + offsetY);
      for (let i = 1; i < face.points.length; i++) {
        ctx.lineTo(face.points[i].x, face.points[i].y + offsetY);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  depthToShade(depth: number, maxDepth = 100): PaletteShade {
    const t = Math.min(1, depth / maxDepth);
    if (t < 0.2) return PaletteShade.Darkest;
    if (t < 0.45) return PaletteShade.Dark;
    if (t < 0.7) return PaletteShade.Light;
    return PaletteShade.Lightest;
  }

  private faceShade(
    depth: number,
    facing: number,
    maxDepth: number,
    bias: number,
  ): PaletteShade {
    const t = Math.min(1, depth / maxDepth);
    let band = t < 0.22 ? 0 : t < 0.45 ? 1 : t < 0.7 ? 2 : 3;
    if (facing > 0.75) band = Math.max(0, band - 1);
    if (facing < 0.35) band = Math.min(3, band + 1);
    band = Math.max(0, Math.min(3, band + bias));
    return [PaletteShade.Darkest, PaletteShade.Dark, PaletteShade.Light, PaletteShade.Lightest][band];
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

    const tx = x * cosY - z * sinY;
    const tz = x * sinY + z * cosY;
    x = tx;
    z = tz;

    const ty = y * cosP - z * sinP;
    const tz2 = y * sinP + z * cosP;
    y = ty;
    z = tz2;

    return { x, y, z };
  }

  private project(v: Vec3, fov: number, w: number, h: number, horizonY: number): Vec2 {
    const scaleF = fov / Math.max(v.z, 0.5);
    return {
      x: w / 2 + v.x * scaleF,
      y: h * horizonY - v.y * scaleF,
    };
  }
}

/** Convenience: solid box mesh at center with half-extents. */
export function solidBox(
  cx: number,
  cy: number,
  cz: number,
  hw: number,
  hh: number,
  hd: number,
): { vertices: Vec3[]; faces: FaceIndices[] } {
  return { vertices: boxVertices(cx, cy, cz, hw, hh, hd), faces: BOX_FACES };
}

/** Cross product helper for games that need surface normals. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
