// Hand-drawn "ink" look: flat toon fill + inverted-hull outlines + boiling wobble.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const SHARED = {
  uBoil: { value: 0 },
  uWob: { value: 0.55 },
  uOutW: { value: 0.06 },
  uLightDir: { value: new THREE.Vector3(0.45, 1.0, 0.8).normalize() },
  uInk: { value: new THREE.Color('#1c1a1e') },
};

export const GLSL_NOISE = /* glsl */`
float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const GLSL_VERT_HEAD = /* glsl */`
uniform float uBoil, uWob, uOutW;
${GLSL_NOISE}
vec3 jitter(vec3 p){
  vec3 q = p*0.32 + uBoil;
  return (vec3(vnoise(q), vnoise(q+11.3), vnoise(q+23.7)) - 0.5) * uWob * 0.09;
}
`;

const GLSL_FRAG_HEAD = /* glsl */`
uniform float uBoil, uWob;
uniform vec3 uLightDir, uInk;
${GLSL_NOISE}
float inkLine(float sd, float w){ float px = abs(sd)/max(fwidth(sd), 1e-5); return 1.0 - smoothstep(w, w+1.0, px); }
vec3 toon(vec3 c, vec3 n){
  float d = dot(normalize(n), uLightDir);
  float s = d > 0.42 ? 1.0 : (d > -0.05 ? 0.87 : 0.74);
  vec3 col = c * s;
  if (d <= -0.05) { float h = step(0.72, fract((gl_FragCoord.x + gl_FragCoord.y)/6.0)); col *= 1.0 - 0.07*h; }
  col *= 0.975 + 0.035*vnoise(vec3(gl_FragCoord.xy*0.6, 3.0));
  return col;
}
`;

export const VERT_HEAD = GLSL_VERT_HEAD;
export const FRAG_HEAD = GLSL_FRAG_HEAD;

// ---------- generic ink material (boxes, cylinders, people) ----------
const inkVert = /* glsl */`
${GLSL_VERT_HEAD}
varying vec3 vWN; varying vec2 vUv;
void main(){
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  p.xyz += jitter(p.xyz);
  vUv = uv;
  vWN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;
const inkFrag = /* glsl */`
${GLSL_FRAG_HEAD}
uniform vec3 uColor; uniform float uEdges;
varying vec3 vWN; varying vec2 vUv;
void main(){
  vec3 col = toon(uColor, vWN);
  if (uEdges > 0.5) {
    float n = (vnoise(vec3(vUv*7.0, uBoil)) - 0.5) * uWob * 2.4;
    float dx = min(vUv.x, 1.0-vUv.x) / max(fwidth(vUv.x), 1e-5);
    float dy = min(vUv.y, 1.0-vUv.y) / max(fwidth(vUv.y), 1e-5);
    float e = 1.0 - smoothstep(1.1, 2.1, min(dx, dy) + n);
    col = mix(col, uInk, e*0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const hullVert = /* glsl */`
${GLSL_VERT_HEAD}
attribute vec3 aOutN;
void main(){
  vec4 p = vec4(position, 1.0); vec3 n = aOutN;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  p.xyz += jitter(p.xyz);
  vec3 wn = normalize(mat3(modelMatrix) * n);
  vec4 wp = modelMatrix * p;
  float w = uOutW * (0.75 + 0.6 * vnoise(wp.xyz*0.55 + uBoil*1.7) * (0.4 + uWob));
  wp.xyz += wn * w;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const hullFrag = /* glsl */`
uniform vec3 uInk;
void main(){ gl_FragColor = vec4(uInk, 1.0); }`;

const matCache = new Map();
export function inkMat(color, edges = true) {
  const key = color + '|' + edges;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...SHARED, uColor: { value: new THREE.Color(color) }, uEdges: { value: edges ? 1 : 0 } },
    vertexShader: inkVert, fragmentShader: inkFrag,
  });
  matCache.set(key, m);
  return m;
}

export const hullMat = new THREE.ShaderMaterial({
  uniforms: { ...SHARED }, vertexShader: hullVert, fragmentShader: hullFrag, side: THREE.BackSide,
});

// Averaged (position-welded) normals so the hull does not crack at hard edges.
export function addOutN(geo) {
  if (geo.getAttribute('aOutN')) return geo;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const acc = new Map(), keys = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    keys.push(k);
    let a = acc.get(k); if (!a) { a = [0, 0, 0]; acc.set(k, a); }
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(keys[i]); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('aOutN', new THREE.BufferAttribute(out, 3));
  return geo;
}

// Mesh + outline hull as one object.
export function inked(geo, mat, { hull = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (hull) { addOutN(geo); const h = new THREE.Mesh(geo, hullMat); h.raycast = () => {}; m.add(h); }
  return m;
}

export function box(sx, sy, sz, color, { edges = true, hull = true } = {}) {
  return inked(new THREE.BoxGeometry(sx, sy, sz), inkMat(color, edges), { hull });
}

// Box with min corner semantics: spans [x0,x1]x[y0,y1]x[z0,z1]
export function boxSpan(x0, x1, y0, y1, z0, z1, color, opts) {
  const b = box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, opts);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return b;
}

export function cyl(r0, r1, h, color, seg = 16, opts = {}) {
  return inked(new THREE.CylinderGeometry(r0, r1, h, seg), inkMat(color, false), opts);
}

let instHull = null;
export function instancedInk(geo, color, count, edges = true) {
  addOutN(geo);
  const m = new THREE.InstancedMesh(geo, inkMat(color, edges), count);
  if (!instHull) instHull = hullMat.clone(), instHull.uniforms = hullMat.uniforms;
  const h = new THREE.InstancedMesh(geo, instHull, count);
  h.instanceMatrix = m.instanceMatrix;
  return { mesh: m, hull: h };
}

// Free GPU buffers of a removed subtree. Shared geometry (userData.keep) and cached ink materials stay.
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (m.userData.own) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}
