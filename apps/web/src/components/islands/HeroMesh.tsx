/**
 * HeroMesh — neural circuit planet (hybrid: simple shader sphere + real geometry network).
 *
 * Sphere base (ShaderMaterial):
 *   - Fresnel rim glow (cyan → violet)
 *   - Subtle inner atmospheric haze
 *   - Drifting horizontal scan line
 * Circuit network (real Three.js geometry, rotates with sphere):
 *   - 140 nodes evenly distributed via Fibonacci sphere
 *   - ~280 edges (each node → 4 nearest neighbors, deduplicated)
 *   - Hub-aware node sizing (high-degree nodes are bigger)
 *   - Edges rendered as LineSegments2 with pixel-thick anti-aliased glow
 *   - Pulses with comet trails (4 points per edge: head + 3 fading tail)
 *   - Back-face fade so the back-of-sphere network is dimmer for depth perception
 * Orbital system:
 *   - Four torus rings (inner→outer, varying tilt & speed)
 *   - Ten orbiting satellite dots
 *   - Dual atmospheric bloom (inner blue, outer violet)
 * Ambient:
 *   - 2500 twinkling stars
 *   - UnrealBloomPass post-processing (skipped on coarse pointers for battery)
 * Interactions:
 *   - Subtle camera parallax on pointer move
 *   - Reduced-motion: static frame | Tab hidden: paused
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ─── Background ───────────────────────────────────────────────────────────────

const BG_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const BG_FRAG = `
  precision mediump float;
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  void main() {
    vec2 uv = vUv;
    vec3 col = vec3(0.008, 0.012, 0.045);
    float d = length(uv - vec2(0.58, 0.50));
    col += vec3(0.014, 0.022, 0.085) * smoothstep(0.8, 0.0, d);
    col += noise(uv * 220.0 + uTime * 0.008) * 0.018;
    col *= 0.55 + 0.45 * smoothstep(1.0, 0.1, length(uv - 0.5));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Sphere base — CPU-displaced terrain + PBR-lit + Fresnel ──────────────────
//
// Displacement is applied on the CPU before render (fbm3 in JS, vertices pushed
// along their direction, normals recomputed via geometry.computeVertexNormals()).
// The shader just consumes the resulting `normal` attribute + an `aHeight` we
// precompute per-vertex for the height-based color ramp. Much more stable than
// dFdx/dFdy reconstruction.

const SPHERE_VERT = `
  attribute float aHeight;
  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;
  varying vec3  vObjectPos;
  varying vec3  vObjectDir;     // undisplaced unit dir × radius — for voronoi sampling
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos    = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vObjectPos   = position;
    vObjectDir   = normalize(position) * 1.55;     // sphere radius
    vHeight      = aHeight;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

const SPHERE_FRAG = `
  precision highp float;

  uniform vec3  uLightDir;
  uniform float uTime;

  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;
  varying vec3  vObjectPos;
  varying vec3  vObjectDir;
  varying float vHeight;

  float hash1f(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  vec2 hash2(vec2 p) {
    return fract(sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
  }

  // 2D Voronoi — returns (F1, F2 - F1, cellHash)
  // F1 = distance to closest seed; F2 - F1 = distance to nearest cell border;
  // cellHash = stable 0..1 hash for the current cell.
  vec3 voronoi2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float F1 = 100.0, F2 = 100.0;
    vec2 cell1 = vec2(0.0);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 nb = vec2(float(dx), float(dy));
        vec2 seed = nb + 0.5 + 0.42 * (hash2(i + nb) - 0.5);
        float d = length(seed - f);
        if (d < F1)      { F2 = F1; F1 = d; cell1 = i + nb; }
        else if (d < F2) {           F2 = d; }
      }
    }
    return vec3(F1, F2 - F1, hash2(cell1).x);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float fr    = pow(1.0 - NdotV, 3.5);

    // Triplanar weights based on object-space normal
    vec3 absN = abs(normalize(vObjectPos));
    vec3 wT = pow(absN, vec3(8.0));
    wT /= dot(wT, vec3(1.0));

    vec3 op = vObjectPos;
    vec3 dp = vObjectDir;          // sample voronoi from undisplaced direction so
                                   // shader edges align with CPU panel boundaries

    // BIG PANELS — low-frequency Voronoi, dominant visual structure
    const float SCALE_BIG = 5.5;
    vec3 v_xy = voronoi2D(dp.xy * SCALE_BIG);
    vec3 v_yz = voronoi2D(dp.yz * SCALE_BIG);
    vec3 v_xz = voronoi2D(dp.xz * SCALE_BIG);
    float bigEdgeDist = v_xy.y * wT.z + v_yz.y * wT.x + v_xz.y * wT.y;
    float cellTone    = v_xy.z * wT.z + v_yz.z * wT.x + v_xz.z * wT.y;
    float bigF1       = v_xy.x * wT.z + v_yz.x * wT.x + v_xz.x * wT.y;

    // MEDIUM DETAIL — sub-panels inside big cells
    const float SCALE_MED = 14.0;
    vec3 m_xy = voronoi2D(dp.xy * SCALE_MED);
    vec3 m_yz = voronoi2D(dp.yz * SCALE_MED);
    vec3 m_xz = voronoi2D(dp.xz * SCALE_MED);
    float medEdgeDist = m_xy.y * wT.z + m_yz.y * wT.x + m_xz.y * wT.y;

    // Sharp emissive lines at panel borders (small F2-F1 = on edge)
    float bigTrace = smoothstep(0.030, 0.000, bigEdgeDist);
    float medTrace = smoothstep(0.025, 0.000, medEdgeDist) * 0.45;

    // Pulsing energy — phase shift per cell hash
    float pulse = 0.55 + 0.45 * sin(uTime * 1.4 + cellTone * 14.0);
    bigTrace *= 0.55 + 0.55 * pulse;

    // Chip indicators — sparse bright dots in cell interiors
    float dotPattern = step(0.984, hash1f(floor(op * 70.0)));
    dotPattern *= smoothstep(0.04, 0.08, bigEdgeDist);

    // MICRO CHIP PADS — high-freq grid of tiny rectangular pads (RAM/processor look)
    // Triplanar small grid: discrete cells that look like chip components on the panel
    vec2 chipUV_xy = fract(dp.xy * 55.0);
    vec2 chipUV_yz = fract(dp.yz * 55.0);
    vec2 chipUV_xz = fract(dp.xz * 55.0);
    // Each pad: rectangular footprint 0.30..0.70 in each axis
    float chip_xy = step(0.30, chipUV_xy.x) * step(chipUV_xy.x, 0.70)
                  * step(0.30, chipUV_xy.y) * step(chipUV_xy.y, 0.70);
    float chip_yz = step(0.30, chipUV_yz.x) * step(chipUV_yz.x, 0.70)
                  * step(0.30, chipUV_yz.y) * step(chipUV_yz.y, 0.70);
    float chip_xz = step(0.30, chipUV_xz.x) * step(chipUV_xz.x, 0.70)
                  * step(0.30, chipUV_xz.y) * step(chipUV_xz.y, 0.70);
    float chipPad = chip_xy * wT.z + chip_yz * wT.x + chip_xz * wT.y;
    // Random subset of pads are "active" (illuminated)
    float chipActive = step(0.88, hash1f(floor(dp * 55.0)));
    chipPad *= chipActive;
    chipPad *= smoothstep(0.04, 0.08, bigEdgeDist);  // inside big panels only

    // ── HUB MARKERS — concentric rings centered on rare cell seeds ───────────
    // bigF1 is the distance from fragment to the cell seed (center of the panel).
    // Use it to draw rings + a bright center dot.
    float isHub = step(0.92, cellTone);
    float hubCenter = smoothstep(0.030, 0.005, bigF1);                     // bright dot at seed
    float hubRing1  = smoothstep(0.012, 0.000, abs(bigF1 - 0.060));        // inner ring
    float hubRing2  = smoothstep(0.014, 0.000, abs(bigF1 - 0.110));        // outer ring
    float hubGlow   = smoothstep(0.180, 0.060, bigF1) * 0.35;              // soft halo
    float hubMask   = (hubCenter * 1.4 + hubRing1 * 0.85 + hubRing2 * 0.55 + hubGlow) * isHub;

    // Subtle micro-stripe inside cells (hint of internal traces)
    float micro = mix(0.94, 1.06, step(0.5, fract(op.x * 22.0 + op.y * 11.0)));

    // ── Base material — dark titanium with per-panel tone variation ──────────
    vec3 baseDark = vec3(0.010, 0.018, 0.038) * (0.55 + 0.55 * cellTone);
    baseDark *= micro;

    // Mostly dark even on lit side, lets emissives dominate
    float wrap = NdotL * 0.55 + 0.45;
    vec3 base = baseDark * wrap;

    // ── Emissive circuit colors (moderate HDR, ~1.5 max) ─────────────────────
    vec3 traceColCool = vec3(0.06, 0.50, 1.45);
    vec3 traceColWarm = vec3(0.30, 0.12, 1.10);
    vec3 dotCol       = vec3(0.32, 0.90, 1.60);
    vec3 hubCol       = vec3(1.20, 0.45, 1.40);

    float traceWarmness = step(0.85, cellTone) * 0.6;
    vec3 traceCol = mix(traceColCool, traceColWarm, traceWarmness);

    vec3 col = base;
    col += traceCol * bigTrace * 1.20;
    col += traceColCool * medTrace * 0.55;
    col += dotCol * dotPattern * 1.80;
    col += hubCol * hubMask * 1.40;
    // Chip pads — illuminated component squares on panels
    col += traceColCool * chipPad * 0.45;

    // Titanium sheen on cell interiors only (not on emissive edges)
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, V), 0.0), 80.0);
    spec = min(spec, 0.4);
    float specMask = smoothstep(0.08, 0.25, bigEdgeDist);
    col += vec3(0.18, 0.30, 0.55) * spec * NdotL * specMask;

    // Fresnel rim — toned down so the limb doesn't blow out under bloom
    vec3 rim = mix(vec3(0.00, 0.55, 0.95), vec3(0.45, 0.10, 0.90), fr * 0.55);
    col += rim * fr * 0.85;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Atmosphere shell (transparent outer sphere, fake scattering) ─────────────

const ATM_VERT = `
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ATM_FRAG = `
  precision highp float;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    vec3 V = normalize(-vViewPos);
    vec3 N = normalize(vNormalView);
    float dotNV = max(dot(N, V), 0.0);
    // Sharper falloff so atmosphere only shows at the very limb, not over the whole disk
    float intensity = pow(1.0 - dotNV, 5.0);

    vec3 col = mix(vec3(0.08, 0.32, 0.85), vec3(0.40, 0.14, 0.90), intensity * 0.5);
    gl_FragColor = vec4(col * intensity, intensity * 0.55);
  }
`;

// ─── Stars ────────────────────────────────────────────────────────────────────

const STAR_VERT = `
  attribute float aSize;
  attribute float aBri;
  attribute float aSpeed;
  varying  float vBri;
  uniform  float uTime;
  void main() {
    vBri = aBri;
    vec4  mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.8 + 0.2 * sin(uTime * aSpeed + aBri * 6.28318);
    gl_PointSize = min(aSize * (70.0 / -mv.z) * tw, 14.0);
    gl_Position  = projectionMatrix * mv;
  }
`;

const STAR_FRAG = `
  precision mediump float;
  varying float vBri;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(0.75, 0.88, 1.00), smoothstep(0.5, 0.06, d) * vBri * 0.60);
  }
`;

// ─── Tube surge shader (wave propagation when a hub fires) ────────────────────

const TUBE_VERT = `
  attribute vec3  color;
  attribute float aEdgeId;
  attribute float aTubeFrac;
  varying vec3   vColor;
  varying float  vEdgeId;
  varying float  vFrac;
  void main() {
    vColor  = color;
    vEdgeId = aEdgeId;
    vFrac   = aTubeFrac;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TUBE_FRAG = `
  precision highp float;
  uniform sampler2D uSurgeA;       // wave phase for surges from end A (R channel, 0..1.27)
  uniform sampler2D uSurgeB;       // wave phase for surges from end B
  uniform float     uEdgeCount;
  varying vec3   vColor;
  varying float  vEdgeId;
  varying float  vFrac;

  void main() {
    float u = (vEdgeId + 0.5) / uEdgeCount;
    float phaseA = texture2D(uSurgeA, vec2(u, 0.5)).r * 1.27;
    float phaseB = texture2D(uSurgeB, vec2(u, 0.5)).r * 1.27;

    const float WAVE_W = 0.15;
    float bA = 0.0;
    if (phaseA > 0.001 && phaseA < 1.27) {
      float d = phaseA - vFrac;
      bA = exp(-d*d / (WAVE_W*WAVE_W)) * smoothstep(1.27, 0.5, phaseA);
    }
    float bB = 0.0;
    if (phaseB > 0.001 && phaseB < 1.27) {
      float d = phaseB - (1.0 - vFrac);
      bB = exp(-d*d / (WAVE_W*WAVE_W)) * smoothstep(1.27, 0.5, phaseB);
    }
    float surge = max(bA, bB);

    vec3 col = mix(vColor, vec3(1.0), surge * 0.75);
    col *= 1.0 + surge * 1.4;        // big brightness boost at the wave head
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Circuit pulses (with back-face fade — comet trails handled in JS) ────────

const PULSE_VERT = `
  attribute float aSize;
  attribute vec3  aColor;
  varying   vec3  vColor;
  varying   float vBackFade;

  void main() {
    vColor = aColor;
    vec3 nView = normalize(normalMatrix * normalize(position));
    vBackFade = smoothstep(-0.35, 0.45, nView.z);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * (4.5 / max(-mv.z, 0.1)), 3.0, 18.0);
    gl_Position  = projectionMatrix * mv;
  }
`;

const PULSE_FRAG = `
  precision highp float;
  varying vec3  vColor;
  varying float vBackFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.08, 0.0, d);
    float halo = smoothstep(0.50, 0.04, d) * 0.45;
    vec3 col = mix(vColor, vColor + 0.55, core);
    gl_FragColor = vec4(col, (core + halo) * vBackFade);
  }
`;

// ─── Circuit network constants ─────────────────────────────────────────────────

const NODE_COUNT = 80;
const HUB_RATIO = 0.15; // % of nodes that are hubs (high degree)
const LEAF_RATIO = 0.25; // % of nodes that are leaves (degree 1)
const AXON_COUNT = 6; // long-range hub-to-far connections (axons)

// 3D tube + node sit slightly above the displaced terrain surface
const NODE_OFFSET = 0.022;
const TUBE_OFFSET = 0.014;
const TUBE_RADIUS = 0.009;
const TUBE_SAMPLES = 18; // path samples per edge (more = smoother arc)
const TUBE_RADIAL = 5; // tube cross-section segments (low for perf)

// Per-type instanced node radius (HUB / NORMAL / LEAF)
const NODE_RADII = [0.04, 0.022, 0.014] as const;

// Comet-trail layout: each edge gets head + 3 trail particles
const TRAIL_PER_EDGE = 4;
const TRAIL_OFFSET = [0.0, 0.05, 0.1, 0.16]; // step back along edge per trail point
const TRAIL_SIZE_MULT = [1.0, 0.72, 0.46, 0.26]; // intensity falloff

// ─── 2D Voronoi (mirror of GLSL voronoi2D) — for cellular displacement ─────

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

// Multi-scale cellular displacement — big panels + medium sub-panels + grooves.
// Total height range: ~−0.022 (groove) to +0.16 (raised panel + sub-panel peak).
const SPHERE_RADIUS_BAKE = 1.55;
const VORONOI_SCALE = 5.5; // matches SCALE_BIG in SPHERE_FRAG
const VORONOI_SCALE_MED = 14.0; // matches SCALE_MED in SPHERE_FRAG
const CELL_LIFT_AMP = 0.13; // max big-panel lift (~8.4 % of radius)
const CELL_EDGE_FADE = 0.028; // sharper transitions to groove
const CELL_GROOVE_DEPTH = 0.022; // edges dip BELOW base radius → real PCB grooves
const SUB_LIFT_AMP = 0.03; // sub-panel relief on top of big panels
const SUB_EDGE_FADE = 0.02;

function smoothstep01(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

function terrainDisp(nx: number, ny: number, nz: number): number {
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
  const bigTone = v_xy.cellHash * nWz + v_yz.cellHash * nWx + v_xz.cellHash * nWy;
  const bigEdge = v_xy.F2mF1 * nWz + v_yz.F2mF1 * nWx + v_xz.F2mF1 * nWy;
  const bigMask = smoothstep01(bigEdge / CELL_EDGE_FADE);
  // Cell center sticks out, edge dips to a NEGATIVE depth → physical groove
  const bigLift = bigTone * CELL_LIFT_AMP * bigMask - CELL_GROOVE_DEPTH * (1.0 - bigMask);

  // ── MEDIUM sub-panels (matches SPHERE_FRAG SCALE_MED = 14.0) ─────────────
  const m_xy = voronoi2DJS(px * VORONOI_SCALE_MED, py * VORONOI_SCALE_MED);
  const m_yz = voronoi2DJS(py * VORONOI_SCALE_MED, pz * VORONOI_SCALE_MED);
  const m_xz = voronoi2DJS(px * VORONOI_SCALE_MED, pz * VORONOI_SCALE_MED);
  const medTone = m_xy.cellHash * nWz + m_yz.cellHash * nWx + m_xz.cellHash * nWy;
  const medEdge = m_xy.F2mF1 * nWz + m_yz.F2mF1 * nWx + m_xz.F2mF1 * nWy;
  const medMask = smoothstep01(medEdge / SUB_EDGE_FADE);
  // ±half-amplitude: some sub-panels raised, others recessed
  const medLift = (medTone - 0.5) * SUB_LIFT_AMP * medMask;

  // Sub-panel relief only INSIDE big panels (not in grooves)
  return bigLift + medLift * Math.max(bigMask, 0.0);
}

// ─── Cinematic post-process — chromatic aberration + vignette + film grain ───

const CINEMATIC_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAberration: { value: 0.0035 },
    uVignette: { value: 0.85 },
    uGrain: { value: 0.045 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      vec2 offset = vUv - center;
      float dist  = length(offset);
      vec2 dir    = (dist > 1e-4) ? offset / dist : vec2(0.0);

      // Chromatic aberration — R/B shift radially outward, scales with distance from center
      float ab    = uAberration * dist;
      float r     = texture2D(tDiffuse, vUv + dir * ab).r;
      float g     = texture2D(tDiffuse, vUv).g;
      float b     = texture2D(tDiffuse, vUv - dir * ab).b;
      vec3 col    = vec3(r, g, b);

      // Vignette — corners darker for cinematic feel
      float vig   = 1.0 - smoothstep(0.40, 0.95, dist);
      col        *= mix(uVignette, 1.0, vig);

      // Film grain — high-freq noise, subtle, animated
      float grain = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      col        += (grain - 0.5) * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ─── Atmosphere glow texture ───────────────────────────────────────────────────

function makeGlowTex(r: number, g: number, b: number, op: number): THREE.CanvasTexture {
  const S = 256,
    cx = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, `rgba(${r},${g},${b},${op})`);
  grad.addColorStop(
    0.28,
    `rgba(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)},${(op * 0.45).toFixed(2)})`
  );
  grad.addColorStop(
    0.6,
    `rgba(${Math.round(r * 0.2)},${Math.round(g * 0.2)},${Math.round(b * 0.2)},${(op * 0.16).toFixed(2)})`
  );
  grad.addColorStop(1.0, 'rgba(0,0,0,0.00)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeroMesh() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    renderer.setPixelRatio(coarse ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020510, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // OES_standard_derivatives for dFdx/dFdy in WebGL1; no-op on WebGL2
    renderer.getContext().getExtension('OES_standard_derivatives');

    const bgUniforms = { uTime: { value: 0 } };
    const sphUniforms = {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.55, 0.65, 0.8).normalize() },
    };
    const starUniforms = { uTime: { value: 0 } };
    const nodeUniforms = { uTime: { value: 0 } };

    container.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();

    // ── Background plane ─────────────────────────────────────────────────────
    const bgGeo = new THREE.PlaneGeometry(26, 14);
    const bgMat = new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.z = -7;
    bgMesh.renderOrder = 0;
    scene.add(bgMesh);

    // ── Sphere — high-res icosphere with CPU vertex displacement ─────────────
    const SPHERE_POS = new THREE.Vector3(1.0, -0.1, 0);
    const SPHERE_RADIUS = 1.55;
    const SPHERE_DETAIL = coarse ? 4 : 6; // detail 6 = ~40k verts (desktop)

    // IcosahedronGeometry ships non-indexed (each tri has unique vertices), which
    // turns computeVertexNormals into flat shading. Merge vertices first so that
    // shared corners exist and the resulting per-vertex normals are smooth.
    let sphGeo = new THREE.IcosahedronGeometry(SPHERE_RADIUS, SPHERE_DETAIL);
    sphGeo = mergeVertices(sphGeo) as THREE.IcosahedronGeometry;

    // Apply terrain displacement on CPU and bake heights into an attribute
    const sphPos = sphGeo.attributes.position as THREE.BufferAttribute;
    const sphHeights = new Float32Array(sphPos.count);
    for (let i = 0; i < sphPos.count; i++) {
      const x = sphPos.getX(i),
        y = sphPos.getY(i),
        z = sphPos.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z);
      const nx = x / r,
        ny = y / r,
        nz = z / r;
      const d = terrainDisp(nx, ny, nz);
      sphPos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);
      sphHeights[i] = d;
    }
    sphPos.needsUpdate = true;
    sphGeo.setAttribute('aHeight', new THREE.BufferAttribute(sphHeights, 1));
    sphGeo.computeVertexNormals(); // smooth normals now that vertices are shared

    const sphMat = new THREE.ShaderMaterial({
      uniforms: sphUniforms,
      vertexShader: SPHERE_VERT,
      fragmentShader: SPHERE_FRAG,
      transparent: false,
      depthWrite: true,
      side: THREE.FrontSide,
    });
    const sphere = new THREE.Mesh(sphGeo, sphMat);
    sphere.position.copy(SPHERE_POS);
    sphere.renderOrder = 3;
    scene.add(sphere);

    // ── Atmosphere shell — transparent outer sphere, limb scattering ─────────
    const atmGeo = new THREE.IcosahedronGeometry(1.7, 4);
    const atmMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: ATM_VERT,
      fragmentShader: ATM_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    atmosphere.position.copy(SPHERE_POS);
    atmosphere.renderOrder = 7; // render after planet for proper additive layering
    scene.add(atmosphere);

    // ── Circuit network (rotates with sphere) ────────────────────────────────
    const circuitGroup = new THREE.Object3D();
    circuitGroup.position.copy(SPHERE_POS);
    scene.add(circuitGroup);

    // Generate uniform unit-direction distribution via Fibonacci spiral.
    // nodeDirs holds unit normals; nodeLocal holds the displaced 3D positions
    // (each node sits NODE_OFFSET above the displaced terrain surface).
    const nodeDirs: THREE.Vector3[] = [];
    const nodeLocal: THREE.Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const dir = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
      nodeDirs.push(dir);
      const disp = terrainDisp(dir.x, dir.y, dir.z);
      const radius = SPHERE_RADIUS + disp + NODE_OFFSET;
      nodeLocal.push(dir.clone().multiplyScalar(radius));
    }

    // Assign node types: 0 = HUB, 1 = NORMAL, 2 = LEAF (asymmetric distribution)
    const nodeType = new Int8Array(NODE_COUNT);
    const HUB_COUNT = Math.round(NODE_COUNT * HUB_RATIO);
    const LEAF_COUNT = Math.round(NODE_COUNT * LEAF_RATIO);
    const shuffled: number[] = [];
    for (let i = 0; i < NODE_COUNT; i++) shuffled.push(i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = tmp;
    }
    for (let i = 0; i < HUB_COUNT; i++) nodeType[shuffled[i]!] = 0;
    for (let i = HUB_COUNT; i < HUB_COUNT + LEAF_COUNT; i++) nodeType[shuffled[i]!] = 2;
    for (let i = HUB_COUNT + LEAF_COUNT; i < NODE_COUNT; i++) nodeType[shuffled[i]!] = 1;

    // Want-degree per node by type: hubs 7-9, normals 2-3, leaves 1
    const want = new Int16Array(NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) {
      const t = nodeType[i]!;
      if (t === 0) want[i] = 7 + Math.floor(Math.random() * 3);
      else if (t === 2) want[i] = 1;
      else want[i] = 2 + Math.floor(Math.random() * 2);
    }

    // Greedy capacity-based edge construction (hubs first → leaves last)
    const edges: Array<[number, number]> = [];
    const edgeKeys = new Set<string>();
    const currentDeg = new Int16Array(NODE_COUNT);
    const addEdge = (a: number, b: number): boolean => {
      const lo = Math.min(a, b),
        hi = Math.max(a, b);
      const key = `${lo}-${hi}`;
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
      edges.push([lo, hi]);
      currentDeg[lo] = currentDeg[lo]! + 1;
      currentDeg[hi] = currentDeg[hi]! + 1;
      return true;
    };

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < NODE_COUNT; i++) {
        if (nodeType[i] !== pass) continue;
        const pi = nodeLocal[i]!;
        while (currentDeg[i]! < want[i]!) {
          let best = -1;
          let bestD = Infinity;
          for (let j = 0; j < NODE_COUNT; j++) {
            if (j === i) continue;
            // Allow +1 slack so hubs don't starve when neighbors are full
            if (currentDeg[j]! >= want[j]! + 1) continue;
            const lo = Math.min(i, j),
              hi = Math.max(i, j);
            if (edgeKeys.has(`${lo}-${hi}`)) continue;
            const d = pi.distanceToSquared(nodeLocal[j]!);
            if (d < bestD) {
              bestD = d;
              best = j;
            }
          }
          if (best === -1) break;
          addEdge(i, best);
        }
      }
    }

    // Long-range axons: random hub → far node, gives sphere-spanning connections
    const hubIdx: number[] = [];
    for (let i = 0; i < NODE_COUNT; i++) if (nodeType[i] === 0) hubIdx.push(i);
    for (let a = 0; a < AXON_COUNT && hubIdx.length > 0; a++) {
      const hub = hubIdx[Math.floor(Math.random() * hubIdx.length)]!;
      const ph = nodeLocal[hub]!;
      const cands: Array<{ j: number; d: number }> = [];
      for (let j = 0; j < NODE_COUNT; j++) {
        if (j === hub) continue;
        const lo = Math.min(hub, j),
          hi = Math.max(hub, j);
        if (edgeKeys.has(`${lo}-${hi}`)) continue;
        cands.push({ j, d: ph.distanceToSquared(nodeLocal[j]!) });
      }
      if (cands.length === 0) continue;
      cands.sort((x, y) => y.d - x.d); // farthest first
      const top = Math.max(1, Math.floor(cands.length / 4));
      const pick = cands[Math.floor(Math.random() * top)]!;
      addEdge(hub, pick.j);
    }

    const EDGE_N = edges.length;

    // Per-edge color (lean cyan, occasional violet)
    const edgeColors: Array<[number, number, number]> = [];
    for (let e = 0; e < EDGE_N; e++) {
      edgeColors.push(Math.random() < 0.2 ? [0.32, 0.18, 1.0] : [0.05, 0.55, 1.0]);
    }

    // ── Edges as 3D tubes following the displaced terrain ────────────────────
    // Slerp along the great-circle arc, push each sample to (radius + disp + offset).
    // All per-edge tubes are merged into one geometry so it's a single draw call.
    const tubeGeos: THREE.BufferGeometry[] = [];
    for (let e = 0; e < EDGE_N; e++) {
      const [a, b] = edges[e]!;
      const dirA = nodeDirs[a]!,
        dirB = nodeDirs[b]!;
      const dot = Math.max(-1, Math.min(1, dirA.x * dirB.x + dirA.y * dirB.y + dirA.z * dirB.z));
      const angle = dot > 0.9999 ? 0 : Math.acos(dot);
      const sa = angle === 0 ? 1 : Math.sin(angle);

      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= TUBE_SAMPLES; s++) {
        const t = s / TUBE_SAMPLES;
        let dx: number, dy: number, dz: number;
        if (angle === 0) {
          dx = dirA.x;
          dy = dirA.y;
          dz = dirA.z;
        } else {
          const wa = Math.sin((1 - t) * angle) / sa;
          const wb = Math.sin(t * angle) / sa;
          dx = dirA.x * wa + dirB.x * wb;
          dy = dirA.y * wa + dirB.y * wb;
          dz = dirA.z * wa + dirB.z * wb;
          const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
          dx /= m;
          dy /= m;
          dz /= m;
        }
        const disp = terrainDisp(dx, dy, dz);
        const r = SPHERE_RADIUS + disp + TUBE_OFFSET;
        pts.push(new THREE.Vector3(dx * r, dy * r, dz * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(
        curve,
        TUBE_SAMPLES * 2,
        TUBE_RADIUS,
        TUBE_RADIAL,
        false
      );

      // Per-edge vertex color + edge id + tube fraction (0 at A, 1 at B)
      const vCount = tubeGeo.attributes.position!.count;
      const colorAttr = new Float32Array(vCount * 3);
      const edgeIdAttr = new Float32Array(vCount);
      const fracAttr = new Float32Array(vCount);
      const [cr, cg, cb] = edgeColors[e]!;
      const radialPlus1 = TUBE_RADIAL + 1;
      const tubularSegs = TUBE_SAMPLES * 2;
      for (let i = 0; i < vCount; i++) {
        colorAttr[i * 3] = cr;
        colorAttr[i * 3 + 1] = cg;
        colorAttr[i * 3 + 2] = cb;
        edgeIdAttr[i] = e;
        const tubularIdx = Math.floor(i / radialPlus1);
        fracAttr[i] = tubularIdx / tubularSegs;
      }
      tubeGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
      tubeGeo.setAttribute('aEdgeId', new THREE.BufferAttribute(edgeIdAttr, 1));
      tubeGeo.setAttribute('aTubeFrac', new THREE.BufferAttribute(fracAttr, 1));
      tubeGeos.push(tubeGeo);
    }
    const tubeMergedGeo = mergeGeometries(tubeGeos)!;
    tubeGeos.forEach((g) => {
      g.dispose();
    });

    // Surge texture pair: phase per edge per direction (0 = inactive)
    const surgeDataA = new Uint8Array(EDGE_N * 4);
    const surgeDataB = new Uint8Array(EDGE_N * 4);
    const surgeTexA = new THREE.DataTexture(
      surgeDataA,
      EDGE_N,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    const surgeTexB = new THREE.DataTexture(
      surgeDataB,
      EDGE_N,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    [surgeTexA, surgeTexB].forEach((tex) => {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    });

    const tubeMat = new THREE.ShaderMaterial({
      uniforms: {
        uSurgeA: { value: surgeTexA },
        uSurgeB: { value: surgeTexB },
        uEdgeCount: { value: EDGE_N },
      },
      vertexShader: TUBE_VERT,
      fragmentShader: TUBE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tubeMesh = new THREE.Mesh(tubeMergedGeo, tubeMat);
    tubeMesh.renderOrder = 4;
    tubeMesh.visible = false; // hidden — conflict with new circuit-board shader
    circuitGroup.add(tubeMesh);

    // Map each hub-node index to its outgoing edges (with which end the hub is on)
    const hubEdgeRefs = new Map<number, Array<{ e: number; fromA: boolean }>>();
    for (let i = 0; i < NODE_COUNT; i++) {
      if (nodeType[i] === 0) hubEdgeRefs.set(i, []);
    }
    for (let e = 0; e < EDGE_N; e++) {
      const [a, b] = edges[e]!;
      if (hubEdgeRefs.has(a)) hubEdgeRefs.get(a)!.push({ e, fromA: true });
      if (hubEdgeRefs.has(b)) hubEdgeRefs.get(b)!.push({ e, fromA: false });
    }

    const SURGE_DURATION = 0.85;
    const surgeStartA = new Float32Array(EDGE_N).fill(-10);
    const surgeStartB = new Float32Array(EDGE_N).fill(-10);

    const updateSurges = (t: number) => {
      for (let e = 0; e < EDGE_N; e++) {
        const phaseA = (t - surgeStartA[e]!) / SURGE_DURATION;
        const phaseB = (t - surgeStartB[e]!) / SURGE_DURATION;
        surgeDataA[e * 4] = phaseA <= 0 || phaseA > 1.27 ? 0 : Math.round((phaseA / 1.27) * 255);
        surgeDataB[e * 4] = phaseB <= 0 || phaseB > 1.27 ? 0 : Math.round((phaseB / 1.27) * 255);
      }
      surgeTexA.needsUpdate = true;
      surgeTexB.needsUpdate = true;
    };

    // ── Nodes as InstancedMesh of small icospheres ───────────────────────────
    const nodeBaseGeo = new THREE.IcosahedronGeometry(1, 1);
    const nodeBaseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nodeMesh = new THREE.InstancedMesh(nodeBaseGeo, nodeBaseMat, NODE_COUNT);

    // Hub firing state — random hubs flash bright + scale-up briefly (animated each frame)
    type HubFire = {
      nodeIdx: number;
      baseScale: number;
      baseR: number;
      baseG: number;
      baseB: number;
      nextFire: number;
      lastFire: number;
    };
    const hubFires: HubFire[] = [];

    const _dummy = new THREE.Object3D();
    const _color = new THREE.Color();
    const nodeRGB = new Float32Array(NODE_COUNT * 3); // cached for pulse color choice etc.
    for (let i = 0; i < NODE_COUNT; i++) {
      const p = nodeLocal[i]!;
      _dummy.position.copy(p);
      const t = nodeType[i]!;
      const baseScale = NODE_RADII[t]! * (0.85 + Math.random() * 0.3);
      _dummy.scale.setScalar(baseScale);
      _dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, _dummy.matrix);

      let r: number, g: number, bl: number;
      if (t === 0) {
        // HUB — bright cyan-white
        r = 0.55;
        g = 0.95;
        bl = 1.0;
      } else if (t === 2) {
        // LEAF — small, occasional pink
        if (Math.random() < 0.3) {
          r = 0.95;
          g = 0.3;
          bl = 1.0;
        } else {
          r = 0.3;
          g = 0.65;
          bl = 0.95;
        }
      } else {
        // NORMAL — medium cyan
        if (Math.random() < 0.18) {
          r = 0.95;
          g = 0.3;
          bl = 1.0;
        } else {
          r = 0.4;
          g = 0.85;
          bl = 1.0;
        }
      }
      nodeRGB[i * 3] = r;
      nodeRGB[i * 3 + 1] = g;
      nodeRGB[i * 3 + 2] = bl;
      _color.setRGB(r, g, bl);
      nodeMesh.setColorAt(i, _color);

      // Register hubs for firing animation; first fire happens 0-2 s in (staggered)
      if (t === 0) {
        hubFires.push({
          nodeIdx: i,
          baseScale,
          baseR: r,
          baseG: g,
          baseB: bl,
          nextFire: Math.random() * 2.0,
          lastFire: -10.0,
        });
      }
    }
    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    nodeMesh.renderOrder = 5;
    circuitGroup.add(nodeMesh);

    // Hub firing animation parameters
    const FIRE_DURATION = 0.55;
    const FIRE_GAP_MIN = 1.8;
    const FIRE_GAP_MAX = 4.0;
    const FIRE_SCALE_BOOST = 1.7; // peak adds +170 % → up to 2.7× scale
    const FIRE_COLOR_BOOST = 0.55; // peak shifts color 55 % toward white

    const updateHubFires = (t: number) => {
      for (let h = 0; h < hubFires.length; h++) {
        const hf = hubFires[h]!;
        if (t >= hf.nextFire) {
          hf.lastFire = t;
          hf.nextFire = t + FIRE_GAP_MIN + Math.random() * (FIRE_GAP_MAX - FIRE_GAP_MIN);
          // Trigger surge waves on every edge connected to this hub
          const refs = hubEdgeRefs.get(hf.nodeIdx);
          if (refs) {
            for (let r = 0; r < refs.length; r++) {
              const ref = refs[r]!;
              if (ref.fromA) surgeStartA[ref.e] = t;
              else surgeStartB[ref.e] = t;
            }
          }
        }
        const phase = (t - hf.lastFire) / FIRE_DURATION;
        const inten = phase < 0 || phase > 1 ? 0 : (1 - phase) * (1 - phase);

        _dummy.position.copy(nodeLocal[hf.nodeIdx]!);
        _dummy.scale.setScalar(hf.baseScale * (1 + inten * FIRE_SCALE_BOOST));
        _dummy.updateMatrix();
        nodeMesh.setMatrixAt(hf.nodeIdx, _dummy.matrix);

        const k = inten * FIRE_COLOR_BOOST;
        _color.setRGB(
          hf.baseR + (1 - hf.baseR) * k,
          hf.baseG + (1 - hf.baseG) * k,
          hf.baseB + (1 - hf.baseB) * k
        );
        nodeMesh.setColorAt(hf.nodeIdx, _color);
      }
      nodeMesh.instanceMatrix.needsUpdate = true;
      if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    };

    // ── Pulses with comet trails (TRAIL_PER_EDGE points per edge) ────────────
    const PULSE_TOTAL = EDGE_N * TRAIL_PER_EDGE;
    const pulseStart = new Int16Array(EDGE_N);
    const pulseEnd = new Int16Array(EDGE_N);
    const pulsePhase = new Float32Array(EDGE_N);
    const pulseSpeed = new Float32Array(EDGE_N);
    const pulsePos = new Float32Array(PULSE_TOTAL * 3);
    const pulseCol = new Float32Array(PULSE_TOTAL * 3);
    const pulseSize = new Float32Array(PULSE_TOTAL);
    for (let e = 0; e < EDGE_N; e++) {
      const [a, b] = edges[e]!;
      pulseStart[e] = a;
      pulseEnd[e] = b;
      pulsePhase[e] = Math.random();
      pulseSpeed[e] = 0.05 + Math.random() * 0.2;
      const pa = nodeLocal[a]!;

      const isWarm = Math.random() < 0.3;
      const rC = isWarm ? 1.0 : 0.3;
      const gC = isWarm ? 0.4 : 1.0;
      const bC = isWarm ? 0.92 : 1.0;
      const baseSize = 5 + Math.random() * 5;

      for (let k = 0; k < TRAIL_PER_EDGE; k++) {
        const idx = e * TRAIL_PER_EDGE + k;
        // Initial position: all stacked at start node
        pulsePos[idx * 3] = pa.x;
        pulsePos[idx * 3 + 1] = pa.y;
        pulsePos[idx * 3 + 2] = pa.z;
        pulseCol[idx * 3] = rC;
        pulseCol[idx * 3 + 1] = gC;
        pulseCol[idx * 3 + 2] = bC;
        pulseSize[idx] = baseSize * TRAIL_SIZE_MULT[k]!;
      }
    }
    const pulsePosAttr = new THREE.BufferAttribute(pulsePos, 3);
    pulsePosAttr.setUsage(THREE.DynamicDrawUsage);
    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute('position', pulsePosAttr);
    pulseGeo.setAttribute('aColor', new THREE.BufferAttribute(pulseCol, 3));
    pulseGeo.setAttribute('aSize', new THREE.BufferAttribute(pulseSize, 1));
    const pulseMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: PULSE_VERT,
      fragmentShader: PULSE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
    pulsePoints.renderOrder = 6;
    circuitGroup.add(pulsePoints);

    const updatePulses = (t: number) => {
      for (let e = 0; e < EDGE_N; e++) {
        let head = (t * pulseSpeed[e]! + pulsePhase[e]!) % 1.0;
        if (head < 0) head += 1;
        const a = pulseStart[e]!,
          b = pulseEnd[e]!;
        const dirA = nodeDirs[a]!,
          dirB = nodeDirs[b]!;
        const dot = Math.max(-1, Math.min(1, dirA.x * dirB.x + dirA.y * dirB.y + dirA.z * dirB.z));
        const angle = dot > 0.9999 ? 0 : Math.acos(dot);
        const sa = angle === 0 ? 1 : Math.sin(angle);

        for (let k = 0; k < TRAIL_PER_EDGE; k++) {
          let frac = head - TRAIL_OFFSET[k]!;
          if (frac < 0) frac = 0;
          const idx = e * TRAIL_PER_EDGE + k;

          let dx: number, dy: number, dz: number;
          if (angle === 0) {
            dx = dirA.x;
            dy = dirA.y;
            dz = dirA.z;
          } else {
            const wa = Math.sin((1 - frac) * angle) / sa;
            const wb = Math.sin(frac * angle) / sa;
            dx = dirA.x * wa + dirB.x * wb;
            dy = dirA.y * wa + dirB.y * wb;
            dz = dirA.z * wa + dirB.z * wb;
            const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
            dx /= m;
            dy /= m;
            dz /= m;
          }
          const disp = terrainDisp(dx, dy, dz);
          const r = SPHERE_RADIUS + disp + TUBE_OFFSET;
          pulsePos[idx * 3] = dx * r;
          pulsePos[idx * 3 + 1] = dy * r;
          pulsePos[idx * 3 + 2] = dz * r;
        }
      }
      pulsePosAttr.needsUpdate = true;
    };

    // ── JC Starship — wireframe vessel orbiting the planet ──────────────────
    // shipPivot lives at the planet center and rotates → ship orbits.
    // shipGroup is offset from the pivot by the orbit radius.
    const shipPivot = new THREE.Object3D();
    shipPivot.position.copy(SPHERE_POS);
    scene.add(shipPivot);

    const shipGroup = new THREE.Object3D();
    shipGroup.position.set(-2.5, 0.3, 0.0); // orbit radius ≈ 2.5 units (close orbit)
    shipGroup.scale.setScalar(0.45);
    shipPivot.add(shipGroup);

    // ── Body — solid box (titanium hull) + bright cyan edge accents ──────────
    const shipBodyGeo = new THREE.BoxGeometry(0.85, 0.22, 0.28);
    const shipBodyEdges = new THREE.EdgesGeometry(shipBodyGeo);
    const shipBodyEdgesMat = new THREE.LineBasicMaterial({
      color: 0x99ddff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shipBody = new THREE.LineSegments(shipBodyEdges, shipBodyEdgesMat);
    shipGroup.add(shipBody);

    // Solid hull — opaque dark titanium so the body reads as a real volume
    const shipBodySolidMat = new THREE.MeshBasicMaterial({
      color: 0x0a1a30,
      transparent: false,
      side: THREE.FrontSide,
      depthWrite: true,
    });
    const shipBodySolid = new THREE.Mesh(shipBodyGeo, shipBodySolidMat);
    shipGroup.add(shipBodySolid);

    // ── Inner panel detail — mid-section dividers visible on the hull ────────
    const panelDivVerts = new Float32Array([
      // Vertical dividers on the front face (z = +0.14)
      -0.2, 0.11, 0.141, -0.2, -0.11, 0.141, 0.0, 0.11, 0.141, 0.0, -0.11, 0.141, 0.2, 0.11, 0.141,
      0.2, -0.11, 0.141,
      // And the back face
      -0.2, 0.11, -0.141, -0.2, -0.11, -0.141, 0.0, 0.11, -0.141, 0.0, -0.11, -0.141, 0.2, 0.11,
      -0.141, 0.2, -0.11, -0.141,
      // Horizontal mid line front
      -0.42, 0.0, 0.141, 0.42, 0.0, 0.141,
      // Horizontal mid line back
      -0.42, 0.0, -0.141, 0.42, 0.0, -0.141,
    ]);
    const panelDivGeo = new THREE.BufferGeometry();
    panelDivGeo.setAttribute('position', new THREE.BufferAttribute(panelDivVerts, 3));
    const panelDivMat = new THREE.LineBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const panelDivs = new THREE.LineSegments(panelDivGeo, panelDivMat);
    shipGroup.add(panelDivs);

    // Engine factory — concentric tori, red→yellow gradient (additive glow)
    const engineRingGeos: THREE.TorusGeometry[] = [];
    const engineRingMats: THREE.MeshBasicMaterial[] = [];
    const ringDefs: Array<{ r: number; t: number; color: number; op: number }> = [
      { r: 0.45, t: 0.013, color: 0xff3300, op: 1.0 },
      { r: 0.36, t: 0.011, color: 0xff5500, op: 0.92 },
      { r: 0.27, t: 0.009, color: 0xff8800, op: 0.85 },
      { r: 0.18, t: 0.007, color: 0xffcc44, op: 0.78 },
    ];

    const makeShipEngine = (): THREE.Object3D => {
      const grp = new THREE.Object3D();
      for (const d of ringDefs) {
        const geo = new THREE.TorusGeometry(d.r, d.t, 6, 80);
        const mat = new THREE.MeshBasicMaterial({
          color: d.color,
          transparent: true,
          opacity: d.op,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        engineRingGeos.push(geo);
        engineRingMats.push(mat);
        grp.add(new THREE.Mesh(geo, mat));
      }
      // Inner spinning detail — small arc segments suggesting rotation
      const arcPts: THREE.Vector3[] = [];
      const arcSegs = 24;
      for (let i = 0; i <= arcSegs; i++) {
        const a = (i / arcSegs) * Math.PI * 1.5; // 270° arc
        arcPts.push(new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0));
      }
      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      engineRingGeos.push(arcGeo as unknown as THREE.TorusGeometry);
      engineRingMats.push(arcMat as unknown as THREE.MeshBasicMaterial);
      grp.add(new THREE.Line(arcGeo, arcMat));

      // Mechanical detail — 6 radial spokes from inner core to almost the outer ring
      const spokeVerts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const cosA = Math.cos(a),
          sinA = Math.sin(a);
        spokeVerts.push(cosA * 0.05, sinA * 0.05, 0);
        spokeVerts.push(cosA * 0.42, sinA * 0.42, 0);
      }
      const spokeGeo = new THREE.BufferGeometry();
      spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokeVerts, 3));
      const spokeMat = new THREE.LineBasicMaterial({
        color: 0xff8844,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      engineRingGeos.push(spokeGeo as unknown as THREE.TorusGeometry);
      engineRingMats.push(spokeMat as unknown as THREE.MeshBasicMaterial);
      grp.add(new THREE.LineSegments(spokeGeo, spokeMat));

      // Bright core — solid small icosphere at engine center (the exhaust glow)
      const coreGeo = new THREE.IcosahedronGeometry(0.04, 1);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffeeaa,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      engineRingGeos.push(coreGeo as unknown as THREE.TorusGeometry);
      engineRingMats.push(coreMat as unknown as THREE.MeshBasicMaterial);
      grp.add(new THREE.Mesh(coreGeo, coreMat));

      return grp;
    };

    const leftEngine = makeShipEngine();
    leftEngine.position.set(-0.55, 0, 0);
    leftEngine.rotation.y = Math.PI / 2;
    shipGroup.add(leftEngine);

    const rightEngine = makeShipEngine();
    rightEngine.position.set(0.55, 0, 0);
    rightEngine.rotation.y = -Math.PI / 2;
    shipGroup.add(rightEngine);

    // JC text — solid 3D tube letters (each stroke is a TubeGeometry, all merged)
    const JC_TUBE_RADIUS = 0.014;
    const jcTubeGeos: THREE.BufferGeometry[] = [];
    const jcAddTube = (p1: [number, number], p2: [number, number]) => {
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(p1[0], p1[1], 0),
        new THREE.Vector3(p2[0], p2[1], 0)
      );
      jcTubeGeos.push(new THREE.TubeGeometry(curve, 1, JC_TUBE_RADIUS, 8, false));
      // Cap each endpoint with a small sphere so segment joints don't show gaps
      const sphGeoA = new THREE.SphereGeometry(JC_TUBE_RADIUS, 8, 6);
      sphGeoA.translate(p1[0], p1[1], 0);
      jcTubeGeos.push(sphGeoA);
      const sphGeoB = new THREE.SphereGeometry(JC_TUBE_RADIUS, 8, 6);
      sphGeoB.translate(p2[0], p2[1], 0);
      jcTubeGeos.push(sphGeoB);
    };

    // J — vertical bar + bottom curl + top serif
    const jx = -0.16;
    jcAddTube([jx + 0.06, 0.18], [jx + 0.06, -0.05]);
    jcAddTube([jx + 0.06, -0.05], [jx + 0.04, -0.1]);
    jcAddTube([jx + 0.04, -0.1], [jx - 0.01, -0.13]);
    jcAddTube([jx - 0.01, -0.13], [jx - 0.07, -0.11]);
    jcAddTube([jx - 0.04, 0.18], [jx + 0.13, 0.18]);

    // C — open arc
    const cx = 0.13;
    const cR = 0.13;
    const cStart = Math.PI / 5;
    const cEnd = (Math.PI * 9) / 5;
    const cSegs = 18;
    for (let i = 0; i < cSegs; i++) {
      const a1 = cStart + (i / cSegs) * (cEnd - cStart);
      const a2 = cStart + ((i + 1) / cSegs) * (cEnd - cStart);
      jcAddTube(
        [cx + Math.cos(a1) * cR * 0.85, Math.sin(a1) * cR * 1.12],
        [cx + Math.cos(a2) * cR * 0.85, Math.sin(a2) * cR * 1.12]
      );
    }

    const jcGeo = mergeGeometries(jcTubeGeos)!;
    jcTubeGeos.forEach((g) => {
      g.dispose();
    });
    const jcMat = new THREE.MeshBasicMaterial({
      color: 0xaaeeff,
      transparent: false,
      side: THREE.FrontSide,
      depthWrite: true,
    });
    const jcMesh = new THREE.Mesh(jcGeo, jcMat);
    jcMesh.position.set(0, 0.24, 0);
    shipGroup.add(jcMesh);

    // ── Solar panel wings — flat panels extending sideways (Z+ and Z−) ──────
    const SOLAR_W = 0.5,
      SOLAR_H = 0.42;
    const solarBoxGeo = new THREE.BoxGeometry(SOLAR_W, SOLAR_H, 0.012);
    const solarBoxMat = new THREE.MeshBasicMaterial({
      color: 0x102448,
      transparent: false,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    // Build a grid pattern (cell dividers) on the wing face
    const solarGridVerts: number[] = [];
    const COLS = 5,
      ROWS = 6;
    for (let i = 1; i < COLS; i++) {
      const x = -SOLAR_W / 2 + (i / COLS) * SOLAR_W;
      solarGridVerts.push(x, -SOLAR_H / 2, 0.007, x, SOLAR_H / 2, 0.007);
      solarGridVerts.push(x, -SOLAR_H / 2, -0.007, x, SOLAR_H / 2, -0.007);
    }
    for (let i = 1; i < ROWS; i++) {
      const y = -SOLAR_H / 2 + (i / ROWS) * SOLAR_H;
      solarGridVerts.push(-SOLAR_W / 2, y, 0.007, SOLAR_W / 2, y, 0.007);
      solarGridVerts.push(-SOLAR_W / 2, y, -0.007, SOLAR_W / 2, y, -0.007);
    }
    // Outer border
    const wHalf = SOLAR_W / 2,
      hHalf = SOLAR_H / 2;
    for (const z of [0.007, -0.007]) {
      solarGridVerts.push(-wHalf, -hHalf, z, wHalf, -hHalf, z);
      solarGridVerts.push(wHalf, -hHalf, z, wHalf, hHalf, z);
      solarGridVerts.push(wHalf, hHalf, z, -wHalf, hHalf, z);
      solarGridVerts.push(-wHalf, hHalf, z, -wHalf, -hHalf, z);
    }
    const solarGridGeo = new THREE.BufferGeometry();
    solarGridGeo.setAttribute('position', new THREE.Float32BufferAttribute(solarGridVerts, 3));
    const solarGridMat = new THREE.LineBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Wing pivot keeps the connector arm + the panel together
    const wingFront = new THREE.Object3D();
    wingFront.position.set(0, 0, 0.45);
    const wingFrontPanel = new THREE.Mesh(solarBoxGeo, solarBoxMat);
    wingFront.add(wingFrontPanel);
    const wingFrontGrid = new THREE.LineSegments(solarGridGeo, solarGridMat);
    wingFront.add(wingFrontGrid);
    shipGroup.add(wingFront);

    const wingBack = new THREE.Object3D();
    wingBack.position.set(0, 0, -0.45);
    const wingBackPanel = new THREE.Mesh(solarBoxGeo, solarBoxMat);
    wingBack.add(wingBackPanel);
    const wingBackGrid = new THREE.LineSegments(solarGridGeo, solarGridMat);
    wingBack.add(wingBackGrid);
    shipGroup.add(wingBack);

    // Wing connector arms — thin struts from body to each wing
    const armVerts = new Float32Array([
      // Front-side arm
      -0.1, 0.05, 0.14, -0.1, 0.05, 0.3, 0.1, 0.05, 0.14, 0.1, 0.05, 0.3, -0.1, -0.05, 0.14, -0.1,
      -0.05, 0.3, 0.1, -0.05, 0.14, 0.1, -0.05, 0.3,
      // Back-side arm (mirror)
      -0.1, 0.05, -0.14, -0.1, 0.05, -0.3, 0.1, 0.05, -0.14, 0.1, 0.05, -0.3, -0.1, -0.05, -0.14,
      -0.1, -0.05, -0.3, 0.1, -0.05, -0.14, 0.1, -0.05, -0.3,
    ]);
    const armGeo = new THREE.BufferGeometry();
    armGeo.setAttribute('position', new THREE.BufferAttribute(armVerts, 3));
    const armMat = new THREE.LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wingArms = new THREE.LineSegments(armGeo, armMat);
    shipGroup.add(wingArms);

    // ── Top dish antenna — small parabolic dish above the body ───────────────
    const dishGeo = new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6);
    dishGeo.rotateX(-Math.PI / 2); // open dish facing up
    const dishMat = new THREE.MeshBasicMaterial({
      color: 0x113355,
      transparent: false,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(-0.2, 0.18, 0);
    shipGroup.add(dish);
    const dishEdges = new THREE.EdgesGeometry(dishGeo);
    const dishEdgesMat = new THREE.LineBasicMaterial({
      color: 0x99ddff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dishLines = new THREE.LineSegments(dishEdges, dishEdgesMat);
    dishLines.position.copy(dish.position);
    shipGroup.add(dishLines);
    // Dish stand (vertical strut)
    const dishStandVerts = new Float32Array([-0.2, 0.11, 0, -0.2, 0.16, 0]);
    const dishStandGeo = new THREE.BufferGeometry();
    dishStandGeo.setAttribute('position', new THREE.BufferAttribute(dishStandVerts, 3));
    const dishStandMat = new THREE.LineBasicMaterial({
      color: 0x99ddff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dishStand = new THREE.LineSegments(dishStandGeo, dishStandMat);
    shipGroup.add(dishStand);

    // ── Antennas — solid 3D cylinders extending up from body (sensor masts) ──
    const antennaConfigs: Array<{
      from: [number, number, number];
      to: [number, number, number];
      tipColor: number;
    }> = [
      { from: [0.06, 0.12, 0.0], to: [0.06, 0.34, 0.0], tipColor: 0x88eeff },
      { from: [-0.18, 0.12, 0.04], to: [-0.18, 0.28, 0.04], tipColor: 0xff88dd },
      { from: [0.22, 0.12, -0.03], to: [0.22, 0.22, -0.03], tipColor: 0xddddff },
    ];
    const antennaGeoList: Array<THREE.BufferGeometry> = [];
    const antennaMeshes: Array<THREE.Mesh> = [];
    for (const cfg of antennaConfigs) {
      const fv = new THREE.Vector3(cfg.from[0], cfg.from[1], cfg.from[2]);
      const tv = new THREE.Vector3(cfg.to[0], cfg.to[1], cfg.to[2]);
      const len = fv.distanceTo(tv);
      // Cylinder mast (tapered slightly toward top)
      const cylGeo = new THREE.CylinderGeometry(0.005, 0.008, len, 8);
      antennaGeoList.push(cylGeo);
      const cylMat = new THREE.MeshBasicMaterial({
        color: 0x4488bb,
        transparent: false,
        depthWrite: true,
      });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      cyl.position.copy(fv.clone().add(tv).multiplyScalar(0.5));
      const dir = tv.clone().sub(fv).normalize();
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      shipGroup.add(cyl);
      antennaMeshes.push(cyl);

      // Tip — small bright sphere at the top of the antenna
      const tipGeo = new THREE.SphereGeometry(0.018, 10, 8);
      antennaGeoList.push(tipGeo);
      const tipMat = new THREE.MeshBasicMaterial({
        color: cfg.tipColor,
        transparent: false,
        depthWrite: true,
      });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.copy(tv);
      shipGroup.add(tip);
      antennaMeshes.push(tip);
    }
    // Track materials for cleanup
    const antennaMatList: Array<THREE.MeshBasicMaterial> = antennaMeshes.map(
      (m) => m.material as THREE.MeshBasicMaterial
    );

    // ── Body greebles — small attached modules (sensors, thrusters, pods) ────
    type Greeble = { pos: [number, number, number]; size: [number, number, number]; color: number };
    const greebleDefs: Greeble[] = [
      { pos: [0.3, 0.13, 0.0], size: [0.06, 0.04, 0.1], color: 0x224466 }, // top-front sensor
      { pos: [-0.3, 0.13, 0.0], size: [0.05, 0.04, 0.08], color: 0x1a3354 }, // top-back sensor
      { pos: [0.34, -0.13, 0.0], size: [0.05, 0.05, 0.16], color: 0x1a3354 }, // bottom-front
      { pos: [-0.34, -0.13, 0.0], size: [0.05, 0.05, 0.16], color: 0x1a3354 }, // bottom-back
      { pos: [0.0, -0.13, 0.0], size: [0.1, 0.04, 0.08], color: 0x224466 }, // bottom-mid
      { pos: [0.0, 0.13, 0.1], size: [0.08, 0.03, 0.04], color: 0x224466 }, // top-port mid
      { pos: [0.0, 0.13, -0.1], size: [0.08, 0.03, 0.04], color: 0x224466 }, // top-stbd mid
    ];
    const greebleGeos: Array<THREE.BufferGeometry> = [];
    const greebleMats: Array<THREE.MeshBasicMaterial> = [];
    const greebleEdgesGeos: Array<THREE.BufferGeometry> = [];
    const greebleEdgesMats: Array<THREE.LineBasicMaterial> = [];
    for (const g of greebleDefs) {
      const geo = new THREE.BoxGeometry(g.size[0], g.size[1], g.size[2]);
      const mat = new THREE.MeshBasicMaterial({
        color: g.color,
        transparent: false,
        depthWrite: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(g.pos[0], g.pos[1], g.pos[2]);
      shipGroup.add(mesh);
      greebleGeos.push(geo);
      greebleMats.push(mat);
      // Glow edges on top of each greeble
      const eGeo = new THREE.EdgesGeometry(geo);
      const eMat = new THREE.LineBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const eLines = new THREE.LineSegments(eGeo, eMat);
      eLines.position.copy(mesh.position);
      shipGroup.add(eLines);
      greebleEdgesGeos.push(eGeo);
      greebleEdgesMats.push(eMat);
    }

    // ── Body portholes — small bright Points scattered along the hull sides ─
    const portholePos = new Float32Array([
      0.3, 0.05, 0.1, 0.1, 0.05, 0.1, -0.1, 0.05, 0.1, -0.3, 0.05, 0.1, 0.3, 0.05, -0.1, 0.1, 0.05,
      -0.1, -0.1, 0.05, -0.1, -0.3, 0.05, -0.1, 0.2, -0.1, 0.0, -0.2, -0.1, 0.0,
    ]);
    const portholeColors = new Float32Array(10 * 3);
    const portholeSizes = new Float32Array(10);
    for (let i = 0; i < 10; i++) {
      // Mostly cyan, occasional warm
      const warm = Math.random() < 0.25;
      portholeColors[i * 3] = warm ? 1.0 : 0.45;
      portholeColors[i * 3 + 1] = warm ? 0.55 : 0.85;
      portholeColors[i * 3 + 2] = warm ? 0.85 : 1.0;
      portholeSizes[i] = 4 + Math.random() * 3;
    }
    const portholeGeo = new THREE.BufferGeometry();
    portholeGeo.setAttribute('position', new THREE.BufferAttribute(portholePos, 3));
    portholeGeo.setAttribute('aColor', new THREE.BufferAttribute(portholeColors, 3));
    portholeGeo.setAttribute('aSize', new THREE.BufferAttribute(portholeSizes, 1));
    const portholeMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: PULSE_VERT,
      fragmentShader: PULSE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portholePoints = new THREE.Points(portholeGeo, portholeMat);
    shipGroup.add(portholePoints);

    // ── Accent glow line — single bright cyan stripe along the body axis ─────
    const accentVerts = new Float32Array([
      -0.42,
      0.12,
      0.0,
      0.42,
      0.12,
      0.0, // top center longitudinal
    ]);
    const accentGeo = new THREE.BufferGeometry();
    accentGeo.setAttribute('position', new THREE.BufferAttribute(accentVerts, 3));
    const accentMat = new THREE.LineBasicMaterial({
      color: 0x99eeff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const accentLine = new THREE.LineSegments(accentGeo, accentMat);
    shipGroup.add(accentLine);

    // ── Atmospheric glow sprites ─────────────────────────────────────────────
    const glowTex1 = makeGlowTex(15, 70, 190, 0.55);
    const glow1 = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex1,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      })
    );
    glow1.position.copy(SPHERE_POS);
    glow1.scale.set(7.5, 7.5, 1);
    glow1.renderOrder = 2;
    scene.add(glow1);

    const glowTex2 = makeGlowTex(80, 20, 200, 0.45);
    const glow2 = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex2,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.38,
      })
    );
    glow2.position.copy(SPHERE_POS);
    glow2.scale.set(11.5, 11.5, 1);
    glow2.renderOrder = 1;
    scene.add(glow2);

    // ── Stars ────────────────────────────────────────────────────────────────
    const N = 2500;
    const pA = new Float32Array(N * 3);
    const sA = new Float32Array(N);
    const bA = new Float32Array(N);
    const spA = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pA[i * 3] = (Math.random() - 0.5) * 22;
      pA[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pA[i * 3 + 2] = -7 + Math.random() * 3;
      const r = Math.random();
      sA[i] = 0.2 + r * r * 1.0;
      bA[i] = 0.2 + Math.random() * 0.55;
      spA[i] = 0.3 + Math.random() * 2.0;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pA, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sA, 1));
    starGeo.setAttribute('aBri', new THREE.BufferAttribute(bA, 1));
    starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(spA, 1));
    const starMat = new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    starPoints.renderOrder = 1;
    scene.add(starPoints);

    // ── Post-processing: bloom (skip on mobile/coarse for battery) ───────────
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let cinePass: ShaderPass | null = null;
    if (!coarse) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.35, // strength — moderate, lets structure read
        0.4, // radius
        0.78 // threshold — only the brightest pixels (HDR traces) bloom
      );
      composer.addPass(bloomPass);
      // Cinematic pass: chromatic aberration + vignette + film grain
      cinePass = new ShaderPass(CINEMATIC_SHADER);
      composer.addPass(cinePass);
    }

    const setSize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer?.setSize(w, h);
      bloomPass?.setSize(w, h);
    };

    setSize();
    window.addEventListener('resize', setSize, { passive: true });

    // ── Input ────────────────────────────────────────────────────────────────
    const mTgt = { x: 0, y: 0 };
    const mCur = { x: 0, y: 0 };
    const camTgt = { rx: 0, ry: 0 };
    const camCur = { rx: 0, ry: 0 };

    const onPointer = (e: PointerEvent) => {
      mTgt.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mTgt.y = -(e.clientY / window.innerHeight - 0.5) * 2;
      camTgt.ry = mTgt.x * 0.035;
      camTgt.rx = -mTgt.y * 0.022;
    };
    if (!reduced && !coarse) window.addEventListener('pointermove', onPointer, { passive: true });

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    const start = performance.now();

    updatePulses(0);

    const renderFrame = () => {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    };

    const tick = () => {
      if (!document.hidden) {
        const t = (performance.now() - start) / 1000;

        mCur.x += (mTgt.x - mCur.x) * 0.05;
        mCur.y += (mTgt.y - mCur.y) * 0.05;
        camCur.rx += (camTgt.rx - camCur.rx) * 0.04;
        camCur.ry += (camTgt.ry - camCur.ry) * 0.04;

        sphere.rotation.y = t * 0.09 + mCur.x * 0.35;
        sphere.rotation.x = mCur.y * 0.22;

        circuitGroup.rotation.copy(sphere.rotation);

        // Ship orbits the planet + rotates on its own axis + engines spin
        shipPivot.rotation.y = t * 0.12; // orbit speed (~52s per revolution)
        shipGroup.rotation.y = t * 0.18; // ship self-rotation
        leftEngine.rotation.z = t * 0.85;
        rightEngine.rotation.z = -t * 0.85;

        camera.rotation.x = camCur.rx;
        camera.rotation.y = camCur.ry;

        bgUniforms.uTime.value = t;
        sphUniforms.uTime.value = t;
        starUniforms.uTime.value = t;
        nodeUniforms.uTime.value = t;
        if (cinePass) cinePass.uniforms.uTime!.value = t;

        updatePulses(t);
        updateHubFires(t);
        updateSurges(t);

        renderFrame();
      }
      if (!reduced) raf = requestAnimationFrame(tick);
    };

    if (reduced) {
      renderFrame();
    } else {
      raf = requestAnimationFrame(tick);
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', setSize);
      window.removeEventListener('pointermove', onPointer);
      bgGeo.dispose();
      bgMat.dispose();
      sphGeo.dispose();
      sphMat.dispose();
      atmGeo.dispose();
      atmMat.dispose();
      nodeBaseGeo.dispose();
      nodeBaseMat.dispose();
      nodeMesh.dispose();
      tubeMergedGeo.dispose();
      tubeMat.dispose();
      surgeTexA.dispose();
      surgeTexB.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      shipBodyGeo.dispose();
      shipBodyEdges.dispose();
      shipBodyEdgesMat.dispose();
      shipBodySolidMat.dispose();
      panelDivGeo.dispose();
      panelDivMat.dispose();
      solarBoxGeo.dispose();
      solarBoxMat.dispose();
      solarGridGeo.dispose();
      solarGridMat.dispose();
      armGeo.dispose();
      armMat.dispose();
      dishGeo.dispose();
      dishMat.dispose();
      dishEdges.dispose();
      dishEdgesMat.dispose();
      dishStandGeo.dispose();
      dishStandMat.dispose();
      engineRingGeos.forEach((g) => {
        g.dispose();
      });
      engineRingMats.forEach((m) => {
        m.dispose();
      });
      jcGeo.dispose();
      jcMat.dispose();
      antennaGeoList.forEach((g) => {
        g.dispose();
      });
      antennaMatList.forEach((m) => {
        m.dispose();
      });
      greebleGeos.forEach((g) => {
        g.dispose();
      });
      greebleMats.forEach((m) => {
        m.dispose();
      });
      greebleEdgesGeos.forEach((g) => {
        g.dispose();
      });
      greebleEdgesMats.forEach((m) => {
        m.dispose();
      });
      portholeGeo.dispose();
      portholeMat.dispose();
      accentGeo.dispose();
      accentMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      glowTex1.dispose();
      (glow1.material as THREE.SpriteMaterial).dispose();
      glowTex2.dispose();
      (glow2.material as THREE.SpriteMaterial).dispose();
      composer?.dispose();
      bloomPass?.dispose();
      cinePass?.material.dispose();
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 'var(--z-orbs)' as unknown as number }}
    >
      <div ref={containerRef} className="absolute inset-0 opacity-40 md:opacity-100" />

      {/* HUD overlay — sci-fi branding labels (purely cosmetic, hidden on mobile to avoid overlap) */}
      <div className="absolute inset-0 hidden md:block font-mono text-[10px] tracking-[0.2em] text-cyan-200/70 mix-blend-screen">
        {/* Top-left bracketed title */}
        <div className="absolute left-6 top-6 border-l border-t border-cyan-300/40 pl-3 pt-2 pr-12 pb-1">
          <div className="text-[14px] tracking-[0.32em] text-cyan-100/90 font-bold">
            CIRCUIT&nbsp;PLANET
          </div>
          <div className="mt-0.5 text-[9px] tracking-[0.28em] text-cyan-200/55">
            DIGITAL&nbsp;CORE&nbsp;·&nbsp;LIMITLESS&nbsp;CONNECTIONS
          </div>
        </div>

        {/* System status (mid-left) */}
        <div className="absolute left-6 top-28 leading-relaxed">
          <div className="text-[9px] text-cyan-300/55 mb-1">SYSTEM&nbsp;STATUS</div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_4px_rgba(180,230,255,0.8)]" />{' '}
            ONLINE
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_4px_rgba(180,230,255,0.8)]" />{' '}
            SECURE
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_4px_rgba(180,230,255,0.8)]" />{' '}
            STABLE
          </div>
        </div>

        {/* Top-right node activity */}
        <div className="absolute right-6 top-6 border-r border-t border-cyan-300/40 pr-3 pt-2 pl-12 pb-1 text-right">
          <div className="text-[10px] tracking-[0.3em] text-cyan-200/70">NODE&nbsp;ACTIVITY</div>
          <div className="mt-1 text-[16px] font-bold text-cyan-100/95">98.7%</div>
        </div>

        {/* Bottom-left data flow */}
        <div className="absolute left-6 bottom-6 border-l border-b border-cyan-300/40 pl-3 pb-2 pr-12 pt-1">
          <div className="text-[9px] tracking-[0.3em] text-cyan-300/60">DATA&nbsp;FLOW</div>
          <div className="mt-0.5 text-[14px] tracking-[0.06em] text-cyan-100/90 font-bold">
            2.34&nbsp;PB/s
          </div>
        </div>

        {/* Bottom-right core temp */}
        <div className="absolute right-6 bottom-6 border-r border-b border-cyan-300/40 pr-3 pb-2 pl-12 pt-1 text-right">
          <div className="text-[9px] tracking-[0.3em] text-cyan-300/60">CORE&nbsp;TEMP</div>
          <div className="mt-0.5 text-[14px] tracking-[0.06em] text-cyan-100/90 font-bold">
            37.2°C
          </div>
        </div>
      </div>
    </div>
  );
}
