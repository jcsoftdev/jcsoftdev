import { describe, expect, it } from 'vitest';
import { terrainDisp } from './hero-terrain';

// Verbatim copy of the allocation-heavy implementation hero-terrain.ts
// replaced. The planet must not move by a single ulp.
function hash2JS(x: number, y: number): [number, number] {
  const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const b = Math.sin(x * 269.5 + y * 183.3) * 43758.5453;
  return [a - Math.floor(a), b - Math.floor(b)];
}

function voronoi2DJS(px: number, py: number): { F2mF1: number; cellHash: number } {
  const ix = Math.floor(px),
    iy = Math.floor(py);
  const fx = px - ix,
    fy = py - iy;
  let F1 = 100,
    F2 = 100;
  let cellX = 0,
    cellY = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const h = hash2JS(ix + dx, iy + dy);
      const seedX = dx + 0.5 + 0.42 * (h[0] - 0.5);
      const seedY = dy + 0.5 + 0.42 * (h[1] - 0.5);
      const ddx = seedX - fx,
        ddy = seedY - fy;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < F1) {
        F2 = F1;
        F1 = d;
        cellX = ix + dx;
        cellY = iy + dy;
      } else if (d < F2) {
        F2 = d;
      }
    }
  }
  return { F2mF1: F2 - F1, cellHash: hash2JS(cellX, cellY)[0] };
}

// Multi-scale cellular displacement — tech-city architecture: flat plateaus,
// tiered block heights (low-rise / mid-rise / tower), stepped sub-panels, deep
// avenue grooves.  Silhouette stays clean (≤ 5.5 % of radius 1.55).
const SPHERE_RADIUS_BAKE = 1.55;
const VORONOI_SCALE = 5.5; // matches SCALE_BIG in SPHERE_FRAG
const VORONOI_SCALE_MED = 14.0; // matches SCALE_MED in SPHERE_FRAG
// Per-tier lift amplitudes (replaces single CELL_LIFT_AMP)
const CELL_LIFT_T0 = 0.02; // low-rise  (~60 % of cells, cellHash < 0.60)
const CELL_LIFT_T1 = 0.045; // mid-rise  (~30 % of cells, cellHash 0.60–0.90)
const CELL_LIFT_T2 = 0.075; // tower     (~10 % of cells, cellHash ≥ 0.90) — clamped below 0.085
const CELL_EDGE_FADE = 0.018; // sharper wall onset (was 0.028)
const CELL_PLATEAU_START = 0.6; // plateau begins at 60 % of half-edge
const CELL_PLATEAU_END = 0.8; // plateau fully flat beyond 80 %
const CELL_GROOVE_DEPTH = 0.014; // avenue-width groove (was 0.008)
const SUB_LIFT_AMP = 0.005; // sub-panel micro-relief (unchanged)
const SUB_EDGE_FADE = 0.012; // crisper sub-cell edges (was 0.02)

function smoothstep01(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

function referenceTerrainDisp(nx: number, ny: number, nz: number): number {
  const px = nx * SPHERE_RADIUS_BAKE;
  const py = ny * SPHERE_RADIUS_BAKE;
  const pz = nz * SPHERE_RADIUS_BAKE;

  // Triplanar weights — matches SPHERE_FRAG `pow(abs(N), vec3(8.0))`
  const ax = Math.abs(nx),
    ay = Math.abs(ny),
    az = Math.abs(nz);
  const wx = ax ** 8,
    wy = ay ** 8,
    wz = az ** 8;
  const wSum = Math.max(wx + wy + wz, 1e-6);
  const nWx = wx / wSum,
    nWy = wy / wSum,
    nWz = wz / wSum;

  // ── BIG panels (matches SPHERE_FRAG SCALE_BIG = 5.5) ─────────────────────
  const v_xy = voronoi2DJS(px * VORONOI_SCALE, py * VORONOI_SCALE);
  const v_yz = voronoi2DJS(py * VORONOI_SCALE, pz * VORONOI_SCALE);
  const v_xz = voronoi2DJS(px * VORONOI_SCALE, pz * VORONOI_SCALE);
  const bigEdge = v_xy.F2mF1 * nWz + v_yz.F2mF1 * nWx + v_xz.F2mF1 * nWy;

  // Plateau profile: rises sharply from the groove wall, stays flat across
  // most of the cell interior — reads as architectural block, not organic bump.
  // wallRise: 0 at groove edge → 1 within CELL_EDGE_FADE of the edge.
  // plateauDrop: 1 inside CELL_PLATEAU_START → 0 past CELL_PLATEAU_END (unused
  // at this scale — bigEdge rarely exceeds 0.5, so plateau stays fully raised).
  const wallRise = smoothstep01(bigEdge / CELL_EDGE_FADE);
  const plateauDrop = smoothstep01(
    (bigEdge - CELL_PLATEAU_START) / (CELL_PLATEAU_END - CELL_PLATEAU_START)
  );
  const plateauMask = wallRise * (1.0 - plateauDrop);

  // Per-cell tier from dominant-axis cellHash (use highest triplanar weight).
  // Dominant axis gives cleanest single-cell read without blending seams.
  let cellHash: number;
  if (nWz >= nWx && nWz >= nWy) {
    cellHash = v_xy.cellHash;
  } else if (nWx >= nWy) {
    cellHash = v_yz.cellHash;
  } else {
    cellHash = v_xz.cellHash;
  }

  // Tier classification: low-rise 60 %, mid-rise 30 %, tower 10 %
  const tierLift = cellHash >= 0.9 ? CELL_LIFT_T2 : cellHash >= 0.6 ? CELL_LIFT_T1 : CELL_LIFT_T0;

  // Cell plateau sticks out by tier height; groove edge dips to negative depth
  const bigLift = tierLift * plateauMask - CELL_GROOVE_DEPTH * (1.0 - wallRise);

  // ── MEDIUM sub-panels (matches SPHERE_FRAG SCALE_MED = 14.0) ─────────────
  const m_xy = voronoi2DJS(px * VORONOI_SCALE_MED, py * VORONOI_SCALE_MED);
  const m_yz = voronoi2DJS(py * VORONOI_SCALE_MED, pz * VORONOI_SCALE_MED);
  const m_xz = voronoi2DJS(px * VORONOI_SCALE_MED, pz * VORONOI_SCALE_MED);
  const medEdge = m_xy.F2mF1 * nWz + m_yz.F2mF1 * nWx + m_xz.F2mF1 * nWy;
  const medMask = smoothstep01(medEdge / SUB_EDGE_FADE);

  // Stepped sub-cell: binary tier (0 or +SUB_LIFT_AMP) — architectural ledge,
  // not a smooth gradient.  Uses dominant-axis sub-cell hash via fract trick.
  let subHash: number;
  if (nWz >= nWx && nWz >= nWy) {
    subHash = m_xy.cellHash;
  } else if (nWx >= nWy) {
    subHash = m_yz.cellHash;
  } else {
    subHash = m_xz.cellHash;
  }
  const subStep = subHash >= 0.5 ? 1.0 : 0.0;
  const medLift = subStep * SUB_LIFT_AMP * medMask;

  // Sub-panel relief only inside big panels (not in grooves)
  const totalDisp = bigLift + medLift * Math.max(wallRise, 0.0);

  // Silhouette safety clamp: cap at 0.085 (≤ 5.5 % of radius 1.55)
  return Math.min(totalDisp, 0.085);
}

/** Deterministic PRNG (mulberry32) so a failure is reproducible. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('terrainDisp', () => {
  it('is bit-identical to the reference implementation', () => {
    const next = rng(42);
    for (let i = 0; i < 20000; i++) {
      const x = next() * 2 - 1;
      const y = next() * 2 - 1;
      const z = next() * 2 - 1;
      const r = Math.hypot(x, y, z) || 1;
      const nx = x / r;
      const ny = y / r;
      const nz = z / r;
      expect(Object.is(terrainDisp(nx, ny, nz), referenceTerrainDisp(nx, ny, nz))).toBe(true);
    }
  });

  it('matches on the axes, where the triplanar weights tie', () => {
    const dirs = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [Math.SQRT1_2, Math.SQRT1_2, 0],
      [0, Math.SQRT1_2, -Math.SQRT1_2],
      [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
    ] as const;
    for (const [x, y, z] of dirs) {
      expect(Object.is(terrainDisp(x, y, z), referenceTerrainDisp(x, y, z))).toBe(true);
    }
  });
});
