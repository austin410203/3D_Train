// Parametric rolling stock: lofted car bodies with livery drawn in the shader.
import * as THREE from 'three';
import { SHARED, VERT_HEAD, FRAG_HEAD, addOutN, hullMat, inkMat, box, boxSpan, cyl, inked } from './ink.js';

// ---------- body cross-section presets (metres, rail top = 0) ----------
export const BODIES = {
  SK:   { W: 3.38, H: 3.65, F: 0.95, rT: 1.05, rB: 0.35, L: 25 },     // Shinkansen
  SKR:  { W: 3.38, H: 3.6,  F: 0.95, rT: 1.55, rB: 0.6,  L: 25 },     // round-section (500)
  SKM:  { W: 2.95, H: 3.6,  F: 0.95, rT: 0.95, rB: 0.3,  L: 20.5 },   // mini-shinkansen
  SK2:  { W: 3.43, H: 4.45, F: 0.7,  rT: 0.85, rB: 0.3,  L: 25 },     // double deck (E1/E4)
  CM:   { W: 2.95, H: 3.62, F: 1.1,  rT: 0.32, rB: 0.12, L: 20 },     // wide commuter
  CN:   { W: 2.8,  H: 3.65, F: 1.1,  rT: 0.42, rB: 0.12, L: 20 },     // narrow commuter
  LE:   { W: 2.9,  H: 3.55, F: 1.05, rT: 0.75, rB: 0.25, L: 21 },     // limited express
  LEH:  { W: 2.95, H: 4.05, F: 0.95, rT: 0.7,  rB: 0.25, L: 21 },     // tall (Sunrise, sleepers)
  DMU:  { W: 2.9,  H: 3.6,  F: 1.15, rT: 0.55, rB: 0.2,  L: 20 },
  LO:   { W: 2.85, H: 3.9,  F: 1.25, rT: 0.28, rB: 0.08, L: 17 },     // locomotive
  PC:   { W: 2.9,  H: 3.75, F: 1.05, rT: 0.95, rB: 0.2,  L: 20 },     // passenger coach
  TW:   { W: 2.9,  H: 3.66, F: 1.15, rT: 0.45, rB: 0.14, L: 20 },     // Taiwan EMU
};

// ---------- nose presets: profiles from tip (t=0) to full body (t=1) ----------
// top/bot: fraction of body height (from F); wid: fraction of half-width.
// ws = windshield {t:[fraction of len], y:[yn], z:|zn|}; lt = headlights {t, y, z:[z0,z1]}
const BULLET_WS = { t: [0.5, 0.72], y: [0.74, 1.01], z: 0.52 };
const BULLET_LT = { t: [0.06, 0.2], y: [0.3, 0.46], z: [0.42, 0.78] };
export const NOSES = {
  end:   { len: 0.3, top: [[0, 0.96], [1, 1]], wid: [[0, 0.95], [1, 1]], bot: [[0, 0.03], [1, 0]] },
  flat:  { len: 0.9, top: [[0, 0.93], [1, 1]], wid: [[0, 0.9], [0.5, 0.975], [1, 1]], bot: [[0, 0.04], [1, 0]],
           ws: { t: [0, 0.6], y: [0.5, 0.86], z: 0.82 }, lt: { t: [0, 0.6], y: [0.2, 0.3], z: [0.55, 0.8] } },
  flatR: { len: 2.0, top: [[0, 0.84], [0.5, 0.97], [1, 1]], wid: [[0, 0.8], [0.6, 0.97], [1, 1]], bot: [[0, 0.06], [1, 0]],
           ws: { t: [0, 0.45], y: [0.48, 0.87], z: 0.8 }, lt: { t: [0, 0.35], y: [0.2, 0.3], z: [0.5, 0.78] } },
  slant: { len: 3.6, top: [[0, 0.5], [0.3, 0.72], [0.7, 0.97], [1, 1]], wid: [[0, 0.76], [0.5, 0.95], [1, 1]], bot: [[0, 0.06], [1, 0]],
           ws: { t: [0.12, 0.62], y: [0.6, 1.01], z: 0.8 }, lt: { t: [0, 0.2], y: [0.2, 0.33], z: [0.48, 0.78] } },
  slantL:{ len: 5.5, top: [[0, 0.36], [0.35, 0.62], [0.75, 0.96], [1, 1]], wid: [[0, 0.62], [0.5, 0.92], [1, 1]], bot: [[0, 0.1], [1, 0]],
           ws: { t: [0.32, 0.72], y: [0.62, 1.01], z: 0.72 }, lt: { t: [0.02, 0.2], y: [0.22, 0.38], z: [0.4, 0.75] } },
  pano:  { len: 4.2, top: [[0, 0.55], [0.25, 0.7], [0.6, 1.02], [1, 1]], wid: [[0, 0.82], [0.5, 0.97], [1, 1]], bot: [[0, 0.05], [1, 0]],
           ws: { t: [0.1, 0.55], y: [0.42, 1.01], z: 0.86 }, lt: { t: [0, 0.15], y: [0.18, 0.3], z: [0.5, 0.8] } },
  bonnet:{ len: 4.6, top: [[0, 0.56], [0.38, 0.62], [0.52, 0.8], [0.7, 1.02], [1, 1]], wid: [[0, 0.82], [0.4, 0.95], [1, 1]], bot: [[0, 0.06], [1, 0]],
           ws: { t: [0.5, 0.68], y: [0.66, 1.01], z: 0.82 }, lt: { t: [0, 0.3], y: [0.5, 0.62], z: [0, 0.22] } },
  loco:  { len: 0.5, top: [[0, 0.95], [1, 1]], wid: [[0, 0.94], [1, 1]], bot: [[0, 0.02], [1, 0]],
           ws: { t: [0, 0.9], y: [0.56, 0.84], z: 0.86 }, lt: { t: [0, 0.9], y: [0.24, 0.33], z: [0.58, 0.82] } },
  locoN: { len: 1.4, top: [[0, 0.86], [0.6, 0.98], [1, 1]], wid: [[0, 0.88], [1, 1]], bot: [[0, 0.03], [1, 0]],
           ws: { t: [0, 0.5], y: [0.56, 0.86], z: 0.84 }, lt: { t: [0, 0.4], y: [0.24, 0.33], z: [0.55, 0.8] } },
  // Shinkansen
  s0:    { len: 5.4, top: [[0, 0.3], [0.25, 0.52], [0.5, 0.75], [0.75, 0.94], [1, 1]], wid: [[0, 0.46], [0.3, 0.8], [0.65, 0.96], [1, 1]], bot: [[0, 0.16], [0.35, 0.04], [1, 0]],
           ws: { t: [0.62, 0.86], y: [0.72, 1.01], z: 0.62 }, lt: { t: [0, 0.12], y: [0.28, 0.44], z: [0, 0.3] } },
  s100:  { len: 6.6, top: [[0, 0.22], [0.3, 0.45], [0.62, 0.8], [0.85, 0.98], [1, 1]], wid: [[0, 0.42], [0.4, 0.86], [1, 1]], bot: [[0, 0.14], [0.4, 0.02], [1, 0]],
           ws: { t: [0.6, 0.84], y: [0.72, 1.01], z: 0.6 }, lt: { t: [0.05, 0.2], y: [0.3, 0.44], z: [0.45, 0.8] } },
  s300:  { len: 6.4, top: [[0, 0.18], [0.4, 0.55], [0.75, 0.92], [1, 1]], wid: [[0, 0.55], [0.5, 0.9], [1, 1]], bot: [[0, 0.1], [1, 0]],
           ws: { t: [0.52, 0.78], y: [0.7, 1.01], z: 0.6 }, lt: BULLET_LT },
  s400:  { len: 4.4, top: [[0, 0.38], [0.5, 0.75], [1, 1]], wid: [[0, 0.74], [0.6, 0.96], [1, 1]], bot: [[0, 0.08], [1, 0]],
           ws: { t: [0.42, 0.75], y: [0.66, 1.01], z: 0.7 }, lt: { t: [0, 0.25], y: [0.24, 0.38], z: [0.5, 0.8] } },
  s500:  { len: 15, top: [[0, 0.24], [0.5, 0.56], [0.85, 0.92], [1, 1]], wid: [[0, 0.24], [0.5, 0.62], [0.85, 0.93], [1, 1]], bot: [[0, 0.34], [0.5, 0.12], [1, 0]],
           ws: { t: [0.72, 0.86], y: [0.74, 1.01], z: 0.5 }, lt: { t: [0.05, 0.18], y: [0.3, 0.48], z: [0.3, 0.8] } },
  s700:  { len: 9.2, top: [[0, 0.14], [0.3, 0.24], [0.55, 0.5], [0.76, 0.86], [1, 1]], wid: [[0, 0.8], [0.4, 0.92], [1, 1]], bot: [[0, 0.07], [1, 0]],
           ws: { t: [0.56, 0.78], y: [0.72, 1.01], z: 0.56 }, lt: { t: [0.02, 0.14], y: [0.4, 0.62], z: [0.55, 0.85] } },
  sN700: { len: 10.7, top: [[0, 0.13], [0.28, 0.27], [0.5, 0.55], [0.7, 0.82], [0.86, 0.98], [1, 1]], wid: [[0, 0.74], [0.4, 0.92], [1, 1]], bot: [[0, 0.07], [1, 0]],
           ws: { t: [0.55, 0.76], y: [0.72, 1.01], z: 0.55 }, lt: { t: [0.02, 0.14], y: [0.42, 0.66], z: [0.55, 0.85] } },
  sN700S:{ len: 10.7, top: [[0, 0.15], [0.3, 0.3], [0.52, 0.58], [0.72, 0.85], [0.88, 0.99], [1, 1]], wid: [[0, 0.86], [0.4, 0.95], [1, 1]], bot: [[0, 0.06], [1, 0]],
           ws: { t: [0.55, 0.76], y: [0.72, 1.01], z: 0.55 }, lt: { t: [0.0, 0.1], y: [0.4, 0.62], z: [0.6, 0.9] } },
  s800:  { len: 9.0, top: [[0, 0.18], [0.35, 0.33], [0.6, 0.66], [0.85, 0.95], [1, 1]], wid: [[0, 0.7], [0.5, 0.92], [1, 1]], bot: [[0, 0.08], [1, 0]],
           ws: { t: [0.56, 0.78], y: [0.72, 1.01], z: 0.56 }, lt: BULLET_LT },
  sE2:   { len: 9.1, top: [[0, 0.2], [0.4, 0.5], [0.75, 0.88], [1, 1]], wid: [[0, 0.6], [0.5, 0.9], [1, 1]], bot: [[0, 0.1], [1, 0]],
           ws: { t: [0.55, 0.78], y: [0.72, 1.01], z: 0.56 }, lt: BULLET_LT },
  sE3:   { len: 6.0, top: [[0, 0.25], [0.4, 0.52], [0.72, 0.87], [1, 1]], wid: [[0, 0.6], [0.5, 0.9], [1, 1]], bot: [[0, 0.1], [1, 0]],
           ws: { t: [0.5, 0.76], y: [0.7, 1.01], z: 0.6 }, lt: BULLET_LT },
  sE5:   { len: 15, top: [[0, 0.16], [0.3, 0.3], [0.55, 0.6], [0.7, 0.82], [0.86, 0.94], [1, 1]], wid: [[0, 0.42], [0.3, 0.68], [0.6, 0.9], [1, 1]], bot: [[0, 0.12], [0.3, 0.03], [1, 0]],
           ws: { t: [0.55, 0.7], y: [0.76, 1.01], z: 0.48 }, lt: BULLET_LT },
  sE6:   { len: 13, top: [[0, 0.17], [0.3, 0.32], [0.55, 0.62], [0.72, 0.84], [0.88, 0.96], [1, 1]], wid: [[0, 0.45], [0.3, 0.7], [0.6, 0.92], [1, 1]], bot: [[0, 0.12], [0.3, 0.03], [1, 0]],
           ws: { t: [0.56, 0.72], y: [0.76, 1.01], z: 0.5 }, lt: BULLET_LT },
  sE7:   { len: 9.1, top: [[0, 0.2], [0.35, 0.38], [0.6, 0.7], [0.85, 0.96], [1, 1]], wid: [[0, 0.56], [0.5, 0.9], [1, 1]], bot: [[0, 0.08], [1, 0]],
           ws: { t: [0.56, 0.8], y: [0.72, 1.01], z: 0.58 }, lt: { t: [0.03, 0.2], y: [0.36, 0.5], z: [0.45, 0.82] } },
  sE8:   { len: 9.0, top: [[0, 0.2], [0.35, 0.4], [0.62, 0.72], [0.86, 0.96], [1, 1]], wid: [[0, 0.55], [0.5, 0.9], [1, 1]], bot: [[0, 0.1], [1, 0]],
           ws: { t: [0.55, 0.78], y: [0.72, 1.01], z: 0.56 }, lt: BULLET_LT },
  sE1:   { len: 9.4, top: [[0, 0.22], [0.35, 0.42], [0.6, 0.75], [0.85, 0.97], [1, 1]], wid: [[0, 0.74], [1, 1]], bot: [[0, 0.06], [1, 0]],
           ws: { t: [0.42, 0.62], y: [0.62, 0.85], z: 0.66 }, lt: { t: [0.02, 0.16], y: [0.26, 0.38], z: [0.5, 0.82] } },
  sE4:   { len: 11.5, top: [[0, 0.15], [0.35, 0.32], [0.55, 0.62], [0.8, 0.95], [1, 1]], wid: [[0, 0.6], [0.5, 0.9], [1, 1]], bot: [[0, 0.08], [1, 0]],
           ws: { t: [0.5, 0.68], y: [0.66, 0.9], z: 0.6 }, lt: BULLET_LT },
  sAlfa: { len: 22, top: [[0, 0.1], [0.45, 0.36], [0.78, 0.84], [1, 1]], wid: [[0, 0.3], [0.6, 0.8], [1, 1]], bot: [[0, 0.12], [0.4, 0.02], [1, 0]],
           ws: { t: [0.66, 0.8], y: [0.78, 1.01], z: 0.45 }, lt: BULLET_LT },
};

// Catmull-Rom style interpolation through [[t,v],...]
function prof(arr, t) {
  const n = arr.length;
  if (t <= arr[0][0]) return arr[0][1];
  if (t >= arr[n - 1][0]) return arr[n - 1][1];
  let i = 0; while (t > arr[i + 1][0]) i++;
  const p0 = arr[Math.max(i - 1, 0)], p1 = arr[i], p2 = arr[i + 1], p3 = arr[Math.min(i + 2, n - 1)];
  const h = p2[0] - p1[0], u = (t - p1[0]) / h;
  const m1 = (p2[1] - p0[1]) / ((p2[0] - p0[0]) || 1) * h;
  const m2 = (p3[1] - p1[1]) / ((p3[0] - p1[0]) || 1) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
}

function ring(hw, yb, yt, rt, rb) {
  const h = yt - yb;
  rt = Math.min(rt, hw * 0.98, h * 0.62);
  rb = Math.min(rb, hw * 0.5, h * 0.3);
  const half = [[0, yb]];
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI / 2; half.push([hw - rb + Math.cos(a) * rb, yb + rb + Math.sin(a) * rb]); }
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; half.push([hw - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt]); }
  half.push([0, yt]);
  const loop = half.slice();
  for (let i = half.length - 2; i >= 1; i--) loop.push([-half[i][0], half[i][1]]);
  return loop;
}

// Section parameters at x along a car (nose at front and/or back)
function sectionAt(b, nf, nb, L, x) {
  let n = null, t = 1;
  if (x < nf.len) { n = nf; t = x / nf.len; }
  else if (x > L - nb.len) { n = nb; t = (L - x) / nb.len; }
  const top = n ? prof(n.top, t) : 1, wid = n ? prof(n.wid, t) : 1, bot = n ? prof(n.bot, t) : 0;
  const hw = b.W / 2 * wid, yb = b.F + (b.H - b.F) * bot, yt = b.F + (b.H - b.F) * top;
  return { hw, yb, yt };
}

const geoCache = new Map();
export function carGeometry(b, nf, nb, L) {
  const key = JSON.stringify([b, nf.len, nf.top, nf.wid, nb.len, nb.top, nb.wid, L]);
  if (geoCache.has(key)) return geoCache.get(key);
  const xs = [];
  const NN = 22;
  for (let i = 0; i <= NN; i++) xs.push(Math.pow(i / NN, 1.45) * nf.len);
  const a = nf.len, e = L - nb.len;
  const nBody = Math.max(2, Math.ceil((e - a) / 2.5));
  for (let i = 1; i < nBody; i++) xs.push(a + (e - a) * i / nBody);
  for (let i = NN; i >= 0; i--) xs.push(L - Math.pow(i / NN, 1.45) * nb.len);

  const P = [], LIV = [], SEC = [], IDX = [];
  let rowLen = 0;
  const rows = [];
  for (const x of xs) {
    const s = sectionAt(b, nf, nb, L, x);
    const pts = ring(s.hw, s.yb, s.yt, b.rT, b.rB);
    rowLen = pts.length;
    const start = P.length / 3;
    for (const [z, y] of pts) {
      P.push(x, y, z);
      LIV.push(x, (y - s.yb) / (s.yt - s.yb), z / s.hw);
      SEC.push(s.hw, s.yt - s.yb);
    }
    rows.push({ start, s, x, pts });
  }
  for (let r = 0; r < rows.length - 1; r++) {
    const A = rows[r].start, B = rows[r + 1].start;
    for (let j = 0; j < rowLen; j++) {
      const j1 = (j + 1) % rowLen;
      const a0 = A + j, b0 = A + j1, c0 = B + j1, d0 = B + j;
      IDX.push(a0, d0, c0, a0, c0, b0);
    }
  }
  // caps
  const cap = (row, front) => {
    const { s, x, pts } = row;
    const cy = (s.yb + s.yt) / 2;
    const scales = [1, 0.66, 0.33];
    const base = P.length / 3;
    for (const sc of scales) for (const [z, y] of pts) {
      const yy = cy + (y - cy) * sc, zz = z * sc;
      P.push(x, yy, zz); LIV.push(x, (yy - s.yb) / (s.yt - s.yb), zz / s.hw); SEC.push(s.hw, s.yt - s.yb);
    }
    const c = P.length / 3; P.push(x, cy, 0); LIV.push(x, 0.5, 0); SEC.push(s.hw, s.yt - s.yb);
    for (let k = 0; k < scales.length; k++) for (let j = 0; j < rowLen; j++) {
      const j1 = (j + 1) % rowLen;
      const o0 = base + k * rowLen + j, o1 = base + k * rowLen + j1;
      if (k < scales.length - 1) {
        const i0 = base + (k + 1) * rowLen + j, i1 = base + (k + 1) * rowLen + j1;
        if (front) IDX.push(o0, o1, i1, o0, i1, i0); else IDX.push(o0, i1, o1, o0, i0, i1);
      } else {
        if (front) IDX.push(o0, o1, c); else IDX.push(o0, c, o1);
      }
    }
  };
  cap(rows[0], true); cap(rows[rows.length - 1], false);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aLiv', new THREE.Float32BufferAttribute(LIV, 3));
  g.setAttribute('aSec', new THREE.Float32BufferAttribute(SEC, 2));
  g.setIndex(IDX);
  g.computeVertexNormals();
  addOutN(g);
  g.userData.footprint = xs.map(x => [x, sectionAt(b, nf, nb, L, x).hw]);
  g.userData.keep = true;
  geoCache.set(key, g);
  return g;
}

// ---------- livery shader ----------
const carVert = /* glsl */`
${VERT_HEAD}
attribute vec3 aLiv; attribute vec2 aSec;
varying vec3 vLiv; varying vec2 vSec; varying vec3 vWN; varying vec3 vON;
void main(){
  vec3 p = position + jitter(position);
  vLiv = aLiv; vSec = aSec; vON = normal;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const carFrag = /* glsl */`
${FRAG_HEAD}
uniform vec3 uBase; uniform int uNB; uniform vec3 uBY[8]; uniform vec3 uBC[8];
uniform vec4 uWin; uniform vec2 uWinT; uniform vec2 uWin2; uniform vec3 uWinC;
uniform float uDoors[8]; uniform int uND; uniform float uDoorW; uniform vec2 uDoorY; uniform vec3 uDoorC; uniform float uOpen; uniform float uOpenSide;
uniform vec4 uWsT; uniform vec2 uWsY; uniform float uWsZ; uniform vec3 uWsC;
uniform vec4 uLtT; uniform vec2 uLtY; uniform vec2 uLtZ; uniform vec3 uLtC;
uniform vec4 uFront; uniform vec3 uFrontC;
uniform float uL, uDouble, uSteel, uNoseF, uNoseB;
varying vec3 vLiv; varying vec2 vSec; varying vec3 vWN; varying vec3 vON;

float sdBox(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float sdBox3(vec3 p, vec3 b){ vec3 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0); }

void main(){
  float t = vLiv.x, yn = vLiv.y, zn = vLiv.z, hw = vSec.x, hg = vSec.y;
  float az = abs(zn);
  float wb = (vnoise(vec3(t*0.9, yn*5.0, uBoil)) - 0.5) * uWob * 0.05;
  bool back = uDouble > 0.5 && t > uL*0.5;
  float tt = back ? uL - t : t;           // distance from the nearest cab end
  float noseLen = back ? uNoseB : uNoseF;
  vec3 col = uBase; float ink = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= uNB) break;
    vec3 b = uBY[i];
    if (yn >= b.x && yn < b.y) col = uBC[i];
    if (b.z > 0.5) {
      if (b.x > 0.005) ink = max(ink, inkLine((yn - b.x)*hg + wb, 0.6));
      if (b.y < 0.995) ink = max(ink, inkLine((yn - b.y)*hg + wb, 0.6));
    }
  }
  if (uFront.z > 0.0 && tt < uFront.z && yn > uFront.x && yn < uFront.y && az < uFront.w) col = uFrontC;

  if (uSteel > 0.5 && az > 0.8) col *= 0.97 + 0.04*step(0.55, fract(t*2.6));

  bool side = az > 0.86 && abs(vON.z) > 0.35;
  // windows
  if (side && t > uWinT.x && t < uWinT.y) {
    float p = uWin.z, w = uWin.w;
    float k = floor((t - uWinT.x)/p);
    float c = uWinT.x + (k + 0.5)*p;
    bool ok = c - w*0.5 > uWinT.x - 0.01 && c + w*0.5 < uWinT.y + 0.01;
    for (int i = 0; i < 8; i++) { if (i >= uND) break; if (abs(c - uDoors[i]) < uDoorW*0.5 + w*0.5 + 0.18) ok = false; }
    if (w >= p - 0.001) { c = t; ok = true; for (int i = 0; i < 8; i++) { if (i >= uND) break; if (abs(t - uDoors[i]) < uDoorW*0.5 + 0.3) ok = false; } }
    if (ok) {
      for (int r = 0; r < 2; r++) {
        vec2 wy = r == 0 ? uWin.xy : uWin2;
        if (wy.y <= wy.x) continue;
        float hh = (wy.y - wy.x)*0.5*hg;
        float sd = w >= p - 0.001 ? abs((yn - (wy.x+wy.y)*0.5)*hg + wb) - hh
                                  : sdBox(vec2(t - c + wb, (yn - (wy.x+wy.y)*0.5)*hg), vec2(w*0.5, hh), 0.1);
        if (sd < 0.0) {
          col = uWinC;
          float refl = step(0.82, fract((t + yn*hg)*0.45));
          col = mix(col, vec3(0.75, 0.82, 0.88), refl*0.25);
        }
        ink = max(ink, inkLine(sd, 0.7));
      }
    }
  }
  // doors
  if (side) {
    for (int i = 0; i < 8; i++) {
      if (i >= uND) break;
      float d = uDoors[i];
      vec2 q = vec2(t - d + wb, (yn - (uDoorY.x + uDoorY.y)*0.5)*hg);
      vec2 hb = vec2(uDoorW*0.5, (uDoorY.y - uDoorY.x)*0.5*hg);
      float sd = sdBox(q, hb, 0.06);
      if (sd < 0.0) {
        col = uDoorC;
        float sdw = sdBox(q - vec2(0.0, hb.y*0.42), vec2(uDoorW*0.36, hb.y*0.3), 0.06);
        if (sdw < 0.0) col = uWinC;
        ink = max(ink, inkLine(sdw, 0.5));
        if (uDoorW > 1.05) ink = max(ink, inkLine(t - d, 0.5));
        float open = (sign(zn) == uOpenSide) ? uOpen : 0.0;
        if (open > 0.0 && abs(t - d) < open*uDoorW*0.5) {
          col = vec3(0.32, 0.29, 0.25) * (0.85 + 0.15*step(0.0, q.y));
        }
      }
      ink = max(ink, inkLine(sd, 0.8));
    }
  }
  // windshield & lights (cab ends)
  if (noseLen > 0.0) {
    vec3 sp = vec3(tt, yn*hg, az*hw);
    if (uWsT.y > 0.0) {
      vec3 c = vec3((uWsT.x+uWsT.y)*0.5, (uWsY.x+uWsY.y)*0.5*hg, 0.0);
      vec3 hb = vec3((uWsT.y-uWsT.x)*0.5, (uWsY.y-uWsY.x)*0.5*hg, uWsZ*hw);
      float sd = sdBox3(sp - c + vec3(wb, 0.0, 0.0), hb);
      if (sd < 0.0) { col = uWsC; col = mix(col, vec3(0.7,0.8,0.86), step(0.86, fract((tt*0.7 + az*hw)*0.8))*0.22); }
      ink = max(ink, inkLine(sd, 0.8));
    }
    if (uLtT.y > 0.0) {
      vec3 c = vec3((uLtT.x+uLtT.y)*0.5, (uLtY.x+uLtY.y)*0.5*hg, (uLtZ.x+uLtZ.y)*0.5*hw);
      vec3 hb = vec3((uLtT.y-uLtT.x)*0.5, (uLtY.y-uLtY.x)*0.5*hg, (uLtZ.y-uLtZ.x)*0.5*hw);
      float sd = sdBox3(sp - c, hb);
      if (sd < 0.0) col = uLtC;
      ink = max(ink, inkLine(sd, 0.5));
    }
  }
  col = toon(col, vWN);
  col = mix(col, uInk, ink*0.88);
  gl_FragColor = vec4(col, 1.0);
}`;

const C = (c) => new THREE.Color(c);

// Door centres for one car (local t from front)
export function doorList(kind, a, b) {
  switch (kind) {
    case 'ends': return [a + 1.25, b - 1.25];
    case 'end1': return [b - 1.3];
    case 'front1': return [a + 1.3];
    case 'none': return [];
    default: {
      const n = +kind.replace('n', '');
      return Array.from({ length: n }, (_, i) => a + (b - a) * (2 * i + 1) / (2 * n));
    }
  }
}

export function makeCarMaterial(liv, opts) {
  const bands = (liv.bands || []).slice(0, 8);
  const BY = [], BC = [];
  for (let i = 0; i < 8; i++) {
    const bnd = bands[i];
    BY.push(new THREE.Vector3(bnd ? bnd[0] : 0, bnd ? bnd[1] : 0, bnd && bnd[3] === 0 ? 0 : 1));
    BC.push(C(bnd ? bnd[2] : '#000'));
  }
  const doors = opts.doors.concat(Array(8).fill(-99)).slice(0, 8);
  const nf = opts.nf, nb = opts.nb;
  const ws = nf.ws, lt = nf.lt;
  const fr = liv.front;
  const u = {
    ...SHARED,
    uBase: { value: C(liv.base) }, uNB: { value: bands.length }, uBY: { value: BY }, uBC: { value: BC },
    uWin: { value: new THREE.Vector4(opts.win.y[0], opts.win.y[1], opts.win.p, opts.win.w) },
    uWin2: { value: new THREE.Vector2(...(opts.win.y2 || [0, 0])) },
    uWinT: { value: new THREE.Vector2(opts.winT[0], opts.winT[1]) },
    uWinC: { value: C(liv.win || '#2a3542') },
    uDoors: { value: doors }, uND: { value: opts.doors.length }, uDoorW: { value: opts.doorW },
    uDoorY: { value: new THREE.Vector2(...opts.doorY) }, uDoorC: { value: C(liv.door || liv.base) },
    uOpen: { value: 0 }, uOpenSide: { value: opts.openSide },
    uWsT: { value: new THREE.Vector4(ws ? (ws.t[0] <= 0 ? -1 : ws.t[0] * nf.len) : 0, ws ? ws.t[1] * nf.len : 0, 0, 0) },
    uWsY: { value: new THREE.Vector2(ws ? ws.y[0] : 0, ws ? ws.y[1] : 0) }, uWsZ: { value: ws ? ws.z : 0 },
    uWsC: { value: C(liv.ws || '#1e2732') },
    uLtT: { value: new THREE.Vector4(lt ? (lt.t[0] <= 0 ? -1 : lt.t[0] * nf.len) : 0, lt ? lt.t[1] * nf.len : 0, 0, 0) },
    uLtY: { value: new THREE.Vector2(lt ? lt.y[0] : 0, lt ? lt.y[1] : 0) },
    uLtZ: { value: new THREE.Vector2(lt ? lt.z[0] : 0, lt ? lt.z[1] : 0) },
    uLtC: { value: C(liv.light || '#fff6c8') },
    uFront: { value: new THREE.Vector4(fr ? fr[0] : 0, fr ? fr[1] : 0, fr && ws ? (fr[3] ?? 1.2) : 0, fr ? (fr[4] ?? 1.1) : 0) },
    uFrontC: { value: C(fr ? fr[2] : '#000') },
    uL: { value: opts.L }, uDouble: { value: opts.double ? 1 : 0 }, uSteel: { value: liv.steel ? 1 : 0 },
    uNoseF: { value: ws || lt ? nf.len : 0 }, uNoseB: { value: opts.double && (nb.ws || nb.lt) ? nb.len : 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: carVert, fragmentShader: carFrag });
  mat.userData.own = true;
  return mat;
}

// ---------- detail parts ----------
const UNDER = '#4b4e55', BOGIE = '#3a3c42';

function bogie(x, b) {
  const g = new THREE.Group();
  g.add(boxSpan(x - 1.4, x + 1.4, 0.35, 0.8, -b.W * 0.36, b.W * 0.36, BOGIE));
  for (const dx of [-0.95, 0.95]) for (const z of [-0.72, 0.72]) {
    const w = cyl(0.43, 0.43, 0.14, '#2c2d31', 14);
    w.rotation.x = Math.PI / 2; w.position.set(x + dx, 0.43, z);
    g.add(w);
  }
  return g;
}

export function pantograph(x, roofY) {
  const g = new THREE.Group();
  const C1 = '#55585e';
  g.add(boxSpan(x - 0.6, x + 0.6, roofY, roofY + 0.12, -0.55, 0.55, C1));
  const arm1 = box(1.25, 0.06, 0.06, C1); arm1.position.set(x - 0.32, roofY + 0.42, 0); arm1.rotation.z = 0.62; g.add(arm1);
  const arm2 = box(1.25, 0.06, 0.06, C1); arm2.position.set(x - 0.3, roofY + 0.98, 0); arm2.rotation.z = -0.48; g.add(arm2);
  g.add(boxSpan(x + 0.15, x + 0.3, roofY + 1.22, roofY + 1.3, -0.9, 0.9, '#2c2d31'));
  return g;
}

function footprintShadow(fp, L) {
  const s = new THREE.Shape();
  s.moveTo(fp[0][0], 0);
  for (const [x, hw] of fp) s.lineTo(x, hw);
  for (let i = fp.length - 1; i >= 0; i--) s.lineTo(fp[i][0], -fp[i][1]);
  const g = new THREE.ShapeGeometry(s);
  const m = new THREE.Mesh(g, SHADOW_MAT);
  m.rotation.x = Math.PI / 2; // shape XY -> XZ (y becomes z)
  m.position.set(0.5, -0.17, -0.9);
  m.renderOrder = -1;
  return m;
}
export const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: '#5266b8', transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });

// One lofted car. spec: {body, nose(front), noseBack, liv, doors, len, pant, double, openSide}
export function buildCar(spec) {
  const b = { ...BODIES[spec.body || 'CM'], ...(spec.bodyOver || {}) };
  const L = spec.len || b.L;
  const nf = typeof spec.nose === 'object' ? spec.nose : NOSES[spec.nose || 'end'];
  const nb = typeof spec.noseBack === 'object' ? spec.noseBack : NOSES[spec.noseBack || 'end'];
  const geo = carGeometry(b, nf, nb, L);
  const a = nf.len, e = L - nb.len;
  const doorsT = doorList(spec.doors || 'none', a + (spec.doorPad || 0), e - (spec.doorPad || 0));
  const win = spec.win;
  const winT = spec.winT || [a + (nf.len > 1.5 ? 0.6 : 0.8), e - (nb.len > 1.5 ? 0.6 : 0.8)];
  const mat = makeCarMaterial(spec.liv, {
    nf, nb, L, doors: doorsT, doorW: spec.doorW || 1.3, doorY: spec.doorY || [0.07, 0.78],
    win, winT, openSide: spec.openSide ?? 1, double: spec.double,
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, mat);
  const hull = new THREE.Mesh(geo, hullMat);
  body.add(hull);
  group.add(body);
  // underframe + bogies
  const u0 = Math.max(nf.len * 0.55, 2.2), u1 = L - Math.max(nb.len * 0.55, 2.2);
  if (!spec.skirt) group.add(boxSpan(u0 + 1.6, u1 - 1.6, 0.5, b.F + 0.05, -b.W * 0.4, b.W * 0.4, UNDER, { edges: true }));
  const bx0 = Math.max(nf.len * 0.6, 2.6), bx1 = L - Math.max(nb.len * 0.6, 2.6);
  group.add(bogie(bx0, b)); group.add(bogie(bx1, b));
  if (spec.pant) group.add(pantograph(L * (spec.pantAt ?? 0.3), b.H - 0.05));
  group.add(footprintShadow(geo.userData.footprint, L));
  return { group, mat, L, doorsT, body: b };
}

// ---------- special cars ----------
export function buildFlatcar(L, rnd) {
  const group = new THREE.Group();
  const b = BODIES.LO;
  group.add(boxSpan(0.2, L - 0.2, 0.75, 1.15, -1.35, 1.35, '#3d3f45'));
  group.add(bogie(2.4, b)); group.add(bogie(L - 2.4, b));
  const cols = ['#a8402f', '#2f5ca8', '#3f8a52', '#8a8f96', '#c7a23a', '#a8402f'];
  const n = 3, cl = (L - 1.2) / n;
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.12) continue;
    const x0 = 0.6 + i * cl + 0.15;
    const c = boxSpan(x0, x0 + cl - 0.3, 1.15, 3.65, -1.22, 1.22, cols[Math.floor(rnd() * cols.length)]);
    group.add(c);
  }
  const fp = [[0, 1.35], [L, 1.35]];
  group.add(footprintShadow(fp, L));
  return { group, mat: null, L, doorsT: [], body: b };
}

// Steam locomotive + tender, built from primitives. Nose faces -x at x=0.
export function buildSteam(liv) {
  const group = new THREE.Group();
  const black = liv.base || '#2a2a2e', red = liv.wheel || '#b23a2e';
  const L = 20;
  group.add(boxSpan(0.3, L - 0.3, 0.95, 1.35, -1.25, 1.25, black));
  group.add(boxSpan(0.0, 0.35, 0.7, 1.3, -1.35, 1.35, red)); // buffer beam
  const boiler = cyl(0.88, 0.88, 11.5, black, 20); boiler.rotation.z = Math.PI / 2; boiler.position.set(6.6, 2.45, 0); group.add(boiler);
  const smoke = cyl(0.95, 0.95, 1.4, '#232326', 20); smoke.rotation.z = Math.PI / 2; smoke.position.set(1.4, 2.45, 0); group.add(smoke);
  const door = cyl(0.7, 0.7, 0.1, '#3a3a40', 20); door.rotation.z = Math.PI / 2; door.position.set(0.68, 2.45, 0); group.add(door);
  const chim = cyl(0.3, 0.26, 0.9, '#232326', 14); chim.position.set(1.5, 3.65, 0); group.add(chim);
  const dome1 = cyl(0.42, 0.48, 0.6, black, 14); dome1.position.set(5.2, 3.45, 0); group.add(dome1);
  const dome2 = cyl(0.42, 0.48, 0.6, black, 14); dome2.position.set(7.6, 3.45, 0); group.add(dome2);
  group.add(boxSpan(12.2, 15.2, 1.35, 4.0, -1.4, 1.4, black)); // cab
  group.add(boxSpan(12.0, 15.4, 4.0, 4.15, -1.5, 1.5, '#1e1e22')); // roof
  group.add(boxSpan(12.6, 13.6, 2.6, 3.4, 1.38, 1.42, '#e8d7a8')); // cab window
  group.add(boxSpan(12.6, 13.6, 2.6, 3.4, -1.42, -1.38, '#e8d7a8'));
  group.add(boxSpan(2.2, 12.2, 1.35, 1.55, -1.45, 1.45, black)); // running boards
  if (liv.stripe) group.add(boxSpan(2.2, 12.2, 1.47, 1.53, -1.46, 1.46, liv.stripe));
  const head = cyl(0.22, 0.22, 0.3, '#fff6c8', 12); head.rotation.z = Math.PI / 2; head.position.set(0.5, 3.4, 0); group.add(head);
  const drivers = [];
  for (const x of [5.6, 7.6, 9.6]) for (const z of [-1.05, 1.05]) {
    const w = cyl(0.88, 0.88, 0.16, red, 22); w.rotation.x = Math.PI / 2; w.position.set(x, 0.88, z); group.add(w); drivers.push(w);
  }
  for (const x of [2.4, 3.6]) for (const z of [-1.0, 1.0]) {
    const w = cyl(0.45, 0.45, 0.14, red, 14); w.rotation.x = Math.PI / 2; w.position.set(x, 0.45, z); group.add(w);
  }
  const rods = [];
  for (const z of [-1.17, 1.17]) { const r = boxSpan(5.6, 9.6, 0.62, 0.74, z - 0.03, z + 0.03, '#b9bcc2'); group.add(r); rods.push(r); }
  // tender
  group.add(boxSpan(15.9, L, 0.95, 3.55, -1.4, 1.4, black));
  group.add(boxSpan(16.2, L - 0.4, 3.55, 3.85, -1.2, 1.2, '#1b1b1e')); // coal
  group.add(bogie(17.2, BODIES.LO)); group.add(bogie(L - 1.6, BODIES.LO));
  group.add(footprintShadow([[0, 1.4], [L, 1.4]], L));
  return { group, mat: null, L, doorsT: [], body: { ...BODIES.LO, W: 2.9, H: 4.15 }, steam: { chimney: new THREE.Vector3(1.5, 4.1, 0), rods, drivers } };
}
