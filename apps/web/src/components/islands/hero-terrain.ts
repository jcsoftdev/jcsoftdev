/**
 * CPU mirror of the planet's cellular terrain (GLSL voronoi2D in SPHERE_FRAG),
 * used to displace the sphere's vertices and to sit nodes, tubes and pulses on
 * the surface. It runs ~40k times while the scene is built and again for every
 * pulse particle on every frame.
 *
 * Nearly all of its cost was Math.sin: 9 cell hashes per Voronoi lookup, six
 * lookups per call, two sines per hash. A hash depends only on the integer
 * cell, and the sphere spans a few dozen cells per axis at these scales, so
 * the hashes are memoised in a table keyed by cell. The arithmetic is
 * unchanged, operation for operation, so the output is bit-identical (see
 * hero-terrain.test.ts).
 */

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

// Memoised per-cell values for |x|, |y| <= HASH_SPAN (the sphere needs < 25):
// the Voronoi seed offsets 0.42 * (hash - 0.5) and the cell hash itself.
const HASH_SPAN = 64;
const HASH_SIDE = HASH_SPAN * 2 + 1;
const seedOffX = new Float64Array(HASH_SIDE * HASH_SIDE);
const seedOffY = new Float64Array(HASH_SIDE * HASH_SIDE);
const cellHashes = new Float64Array(HASH_SIDE * HASH_SIDE).fill(Number.NaN);

/** Fills the table slot for cell (x, y) on first use; returns its index. */
function cellIndex(x: number, y: number): number {
  const i = (x + HASH_SPAN) * HASH_SIDE + (y + HASH_SPAN);
  if (Number.isNaN(cellHashes[i] as number)) {
    // GLSL-style hash2 (mirror of the shader's).
    const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const b = Math.sin(x * 269.5 + y * 183.3) * 43758.5453;
    const hA = a - Math.floor(a);
    const hB = b - Math.floor(b);
    cellHashes[i] = hA;
    seedOffX[i] = 0.42 * (hA - 0.5);
    seedOffY[i] = 0.42 * (hB - 0.5);
  }
  return i;
}

/** Cell hash (first hash2 component) of an integer cell. */
function cellHash(x: number, y: number): number {
  if (Math.abs(x) > HASH_SPAN || Math.abs(y) > HASH_SPAN) {
    const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return a - Math.floor(a);
  }
  return cellHashes[cellIndex(x, y)] as number;
}

// Results of the last voronoi() call. Scratch state instead of a return object.
let vEdge = 0;
let vCellX = 0;
let vCellY = 0;

/** 2D Voronoi: writes F2 - F1 to vEdge and the nearest cell to vCellX/vCellY. */
function voronoi(px: number, py: number): void {
  const ix = Math.floor(px),
    iy = Math.floor(py);
  const fx = px - ix,
    fy = py - iy;
  const inTable = Math.abs(ix) < HASH_SPAN && Math.abs(iy) < HASH_SPAN;
  let F1 = 100,
    F2 = 100;
  let cellX = 0,
    cellY = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const hx = ix + dx,
        hy = iy + dy;
      let offX: number;
      let offY: number;
      if (inTable) {
        const i = cellIndex(hx, hy);
        offX = seedOffX[i] as number;
        offY = seedOffY[i] as number;
      } else {
        const a = Math.sin(hx * 127.1 + hy * 311.7) * 43758.5453;
        const b = Math.sin(hx * 269.5 + hy * 183.3) * 43758.5453;
        offX = 0.42 * (a - Math.floor(a) - 0.5);
        offY = 0.42 * (b - Math.floor(b) - 0.5);
      }
      const seedX = dx + 0.5 + offX;
      const seedY = dy + 0.5 + offY;
      const ddx = seedX - fx,
        ddy = seedY - fy;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < F1) {
        F2 = F1;
        F1 = d;
        cellX = hx;
        cellY = hy;
      } else if (d < F2) {
        F2 = d;
      }
    }
  }
  vEdge = F2 - F1;
  vCellX = cellX;
  vCellY = cellY;
}

/**
 * Triplanar Voronoi edge distance at `scale`, plus the dominant axis's cell
 * hash. Writes the edge to tEdge and the hash to tHash.
 */
let tEdge = 0;
let tHash = 0;
function triplanar(
  px: number,
  py: number,
  pz: number,
  scale: number,
  nWx: number,
  nWy: number,
  nWz: number
): void {
  // Dominant axis gives cleanest single-cell read without blending seams.
  const dominant = nWz >= nWx && nWz >= nWy ? 0 : nWx >= nWy ? 1 : 2;

  voronoi(px * scale, py * scale);
  const eXY = vEdge;
  if (dominant === 0) tHash = cellHash(vCellX, vCellY);
  voronoi(py * scale, pz * scale);
  const eYZ = vEdge;
  if (dominant === 1) tHash = cellHash(vCellX, vCellY);
  voronoi(px * scale, pz * scale);
  const eXZ = vEdge;
  if (dominant === 2) tHash = cellHash(vCellX, vCellY);

  tEdge = eXY * nWz + eYZ * nWx + eXZ * nWy;
}

/** Radial displacement of the planet surface along the unit normal (nx, ny, nz). */
export function terrainDisp(nx: number, ny: number, nz: number): number {
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
  triplanar(px, py, pz, VORONOI_SCALE, nWx, nWy, nWz);
  const bigEdge = tEdge;
  const cellHash = tHash;

  // Plateau profile: rises sharply from the groove wall, stays flat across
  // most of the cell interior — reads as architectural block, not organic bump.
  const wallRise = smoothstep01(bigEdge / CELL_EDGE_FADE);
  const plateauDrop = smoothstep01(
    (bigEdge - CELL_PLATEAU_START) / (CELL_PLATEAU_END - CELL_PLATEAU_START)
  );
  const plateauMask = wallRise * (1.0 - plateauDrop);

  // Tier classification: low-rise 60 %, mid-rise 30 %, tower 10 %
  const tierLift = cellHash >= 0.9 ? CELL_LIFT_T2 : cellHash >= 0.6 ? CELL_LIFT_T1 : CELL_LIFT_T0;

  // Cell plateau sticks out by tier height; groove edge dips to negative depth
  const bigLift = tierLift * plateauMask - CELL_GROOVE_DEPTH * (1.0 - wallRise);

  // ── MEDIUM sub-panels (matches SPHERE_FRAG SCALE_MED = 14.0) ─────────────
  triplanar(px, py, pz, VORONOI_SCALE_MED, nWx, nWy, nWz);
  const medMask = smoothstep01(tEdge / SUB_EDGE_FADE);

  // Stepped sub-cell: binary tier (0 or +SUB_LIFT_AMP) — architectural ledge,
  // not a smooth gradient.
  const subStep = tHash >= 0.5 ? 1.0 : 0.0;
  const medLift = subStep * SUB_LIFT_AMP * medMask;

  // Sub-panel relief only inside big panels (not in grooves)
  const totalDisp = bigLift + medLift * Math.max(wallRise, 0.0);

  // Silhouette safety clamp: cap at 0.085 (≤ 5.5 % of radius 1.55)
  return Math.min(totalDisp, 0.085);
}
