import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SHARED, inked, inkMat } from './ink.js';
import { MODELS, MODEL_BY_ID, OPS } from './trains.js';
import { buildConsist, setDoors } from './train.js';
import { buildStation } from './station.js';
import { Person } from './people.js';

// ---------- renderer / camera ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 1000);
const VIEW_DIR = new THREE.Vector3(-1.3, 0.95, 0.85).normalize();
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.maxPolarAngle = Math.PI * 0.47; controls.minZoom = 0.5; controls.maxZoom = 8;
let viewHalfH = 20;

// Phones (portrait or landscape): drawer overlays the scene and the info card starts collapsed.
const compact = () => innerWidth < 720 || innerHeight < 500;
// Width covered by the open drawer: the scene is centred in the remaining area.
const drawerPx = () => (document.body.classList.contains('drawer') && !compact() ? 312 : 0);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  const upp = 2 * viewHalfH / h, D = drawerPx(), wa = w - D;
  camera.left = -(D + wa / 2) * upp; camera.right = (wa / 2) * upp; camera.top = viewHalfH; camera.bottom = -viewHalfH;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => { fitCamera(false); resize(); });

function fitCamera(resetView = true) {
  if (!S.station) return;
  const b = S.station.info.bounds;
  const target = b.getCenter(new THREE.Vector3()); target.y = 1.2;
  if (resetView) {
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(VIEW_DIR, 200);
    camera.zoom = 1;
  }
  camera.lookAt(controls.target); camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  let hw = 0, hh = 0;
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(controls.target);
    hw = Math.max(hw, Math.abs(c.dot(right))); hh = Math.max(hh, Math.abs(c.dot(up)));
  }
  const a = (innerWidth - drawerPx()) / innerHeight;
  const mobile = innerWidth < 720;
  viewHalfH = Math.max(hh * (mobile ? 1.45 : 1.16), hw / a * (mobile ? 1.0 : 1.02));
  resize();
  controls.update();
}

// ---------- simulation state ----------
const S = {
  model: null, consist: null, station: null, people: [], boarded: 0,
  phase: 'gap', t: 0, frontX: 0, doorOpen: 0, paused: false, cycle: true,
  nShow: null, color: null, slots: [], boardStart: -1, smoke: [], time: 0,
};
const world = new THREE.Group(); scene.add(world);

function clearPeople() { for (const p of S.people) world.remove(p.obj); S.people = []; }

function loadModel(model, { keepCount = false } = {}) {
  if (S.consist) world.remove(S.consist.group);
  if (S.station) world.remove(S.station.group);
  for (const s of S.smoke) world.remove(s.obj); S.smoke = [];
  clearPeople();
  S.model = model;
  const n = keepCount && S.nShow ? S.nShow : model.show;
  S.nShowUsed = n;
  S.consist = buildConsist(model, n, S.color);
  S.station = buildStation(model, S.consist);
  world.add(S.station.group, S.consist.group);
  makeSlots();
  S.phase = 'gap'; S.t = 0.4; S.boardStart = -1; S.doorOpen = 0; S.alighted = false; S.closing = false;
  S.frontX = 1e4; S.consist.group.position.x = S.frontX;
  const pre = Math.round(S.targetWaiting * 0.6);
  for (let i = 0; i < pre; i++) spawnWaiting(true);
  fitCamera(true);
  updateUI();
  history.replaceState(null, '', '?m=' + model.id);
}

function makeSlots() {
  const I = S.station.info;
  S.slots = [];
  let xs = S.model.kind === 'freight' ? [] : I.doorsX.filter(x => x > I.X0 + 1.2 && x < I.X1 - 1.2 && (x < I.xs0 - 1 || x > I.xs1 + 1));
  const pass = xs.length === 0;
  if (pass) xs = Array.from({ length: 6 }, (_, i) => I.X0 + I.Lp * (0.12 + i * 0.12));
  for (const d of xs) {
    const col = [];
    for (let k = 0; k < 4; k++) for (const side of [-1, 1]) col.push({ x: d + side * 0.42, z: I.ze + (pass ? 2.2 : 1.55) + k * 0.62, door: d, k, who: null });
    S.slots.push(col);
  }
  S.targetWaiting = Math.min(16, Math.max(6, xs.length * 2 + 2));
}

function freeSlot() {
  let best = null;
  for (const col of S.slots) {
    const s = col.find(c => !c.who);
    if (s && (!best || s.k < best.k || (s.k === best.k && Math.random() < 0.4))) best = s;
  }
  return best;
}

function waitingCount() { return S.people.filter(p => p.role === 'wait' || p.role === 'board').length; }

function spawnWaiting(instant = false) {
  const slot = freeSlot(); if (!slot) return;
  const I = S.station.info;
  const p = new Person(); p.role = 'wait'; p.slot = slot; slot.who = p;
  world.add(p.obj); S.people.push(p);
  const target = new THREE.Vector3(slot.x, 0, slot.z);
  if (instant) { p.obj.position.copy(target); p.face.set(0, 0, -1); p.arrived = true; return; }
  p.obj.position.set(I.stairBottom.x, 0, I.stairBottom.z);
  const path = [new THREE.Vector3(I.xs0 + 0.2, 0, I.zc), I.stairTop.clone(), new THREE.Vector3(I.stairTop.x - 1, 0, I.lane), new THREE.Vector3(slot.x, 0, I.lane), target];
  p.go(path, (pp) => { pp.face.set(0, 0, -1); pp.arrived = true; if (S.boardStart >= 0 && S.phase === 'dwell' && !S.closing) board(pp, 0.2); });
}

function requeue(p) {
  const slot = freeSlot();
  if (!slot) return;
  const I = S.station.info;
  p.role = 'wait'; p.arrived = false; p.slot = slot; slot.who = p; p.speed /= 1.6;
  p.go([new THREE.Vector3(p.obj.position.x, 0, I.lane), new THREE.Vector3(slot.x, 0, I.lane), new THREE.Vector3(slot.x, 0, slot.z)],
    (pp) => { pp.face.set(0, 0, -1); pp.arrived = true; });
}

function board(p, delay) {
  if (p.role !== 'wait') return;
  p.role = 'board'; p.boardAt = S.time + delay; p.boardGo = false;
}

function startBoarding() {
  S.boardStart = S.t;
  // queued passengers board front-first; late arrivals still walking hurry straight to their door
  for (const p of S.people) if (p.role === 'wait') board(p, p.arrived ? 0.3 + p.slot.k * 0.75 + Math.random() * 0.35 : 0);
}

function spawnAlighting() {
  const I = S.station.info;
  const doors = S.slots.map(c => c[0].door);
  if (!doors.length) return;
  const n = 2 + Math.floor(Math.random() * Math.min(8, doors.length * 2));
  for (let i = 0; i < n; i++) {
    const d = doors[Math.floor(Math.random() * doors.length)];
    const p = new Person(); p.role = 'alight';
    p.obj.position.set(d, 0, I.ze - 0.8); world.add(p.obj); S.people.push(p);
    p.delay = i * 0.45 + Math.random() * 0.3;
    const off = (Math.random() - 0.5) * 0.6;
    p.pendingPath = [new THREE.Vector3(d + off, 0, I.ze + 1.0), new THREE.Vector3(d + off * 2, 0, I.lane + 0.3), new THREE.Vector3(I.stairTop.x - 1, 0, I.lane + 0.3), I.stairTop.clone(), new THREE.Vector3(I.xs0 + 0.2, 0, I.zc), I.stairBottom.clone()];
    p.obj.visible = false;
  }
}

function removePerson(p) { world.remove(p.obj); S.people = S.people.filter(q => q !== p); if (p.slot) p.slot.who = null; }

const APPROACH_T = 6.0, DEPART_T = 7.0, DOOR_T = 0.9;

function updateSim(dt) {
  S.t += dt; S.time += dt;
  const I = S.station.info, C = S.consist, M = S.model;
  const pass = M.kind === 'freight';
  const D = C.length + I.Lp / 2 + 45;
  switch (S.phase) {
    case 'gap':
      if (S.t > 1.2) { S.phase = pass ? 'pass' : 'approach'; S.t = 0; chime(pass ? 'pass' : 'arrive'); }
      break;
    case 'approach': {
      const u = Math.min(1, S.t / APPROACH_T);
      S.frontX = I.stopFront + D * (1 - u) * (1 - u);
      if (u >= 1) { S.phase = 'dwell'; S.t = 0; S.boardStart = -1; S.closing = false; }
      break;
    }
    case 'dwell': {
      if (!S.closing) {
        if (S.t > 0.5) S.doorOpen = Math.min(1, S.doorOpen + dt / DOOR_T);
        if (S.t > 0.5 && !S.alighted) { S.alighted = true; spawnAlighting(); chime('door'); }
        if (S.t > 2.2 && S.boardStart < 0) startBoarding();
        const busy = S.people.some(p => (p.role === 'board' && p.arrived) || (p.role === 'alight' && (p.delay > 0 || p.obj.position.z < I.ze + 1.2)));
        if ((S.boardStart >= 0 && !busy && S.t > 5.0) || S.t > 22) {
          S.closing = true; S.tc = S.t; chime('close');
          // latecomers still running for the train miss it and queue up again
          for (const p of S.people) if (p.role === 'board' && !p.arrived && p.obj.position.z > I.ze + 0.4) requeue(p);
        }
      } else {
        S.doorOpen = Math.max(0, S.doorOpen - dt / DOOR_T);
        if (S.t - S.tc > 1.8) { S.phase = 'depart'; S.t = 0; S.alighted = false; }
      }
      break;
    }
    case 'depart': {
      const a = 2 * (D + 20) / (DEPART_T * DEPART_T);
      S.frontX = I.stopFront - 0.5 * a * S.t * S.t;
      if (S.t > DEPART_T) nextTrain();
      break;
    }
    case 'pass': {
      const v = 26;
      S.frontX = I.X1 + 60 - v * S.t;
      if (S.frontX < I.X0 - C.length - 60) nextTrain();
      break;
    }
  }
  C.group.position.x = S.frontX;
  setDoors(C, S.doorOpen);

  // waiting arrivals
  S.spawnT = (S.spawnT || 0) - dt;
  if (S.phase !== 'dwell' && S.spawnT <= 0 && waitingCount() < S.targetWaiting) { spawnWaiting(); S.spawnT = 0.9 + Math.random() * 1.6; }

  // people
  for (const p of S.people.slice()) {
    if (p.role === 'alight' && p.delay > 0) {
      p.delay -= dt;
      if (p.delay <= 0) { p.obj.visible = true; p.go(p.pendingPath, removePerson); }
      continue;
    }
    if (p.role === 'board' && !p.boardGo) {
      if (S.time >= p.boardAt) {
        p.boardGo = true;
        let d = p.slot.door, sx = p.slot.x;
        if (!p.arrived) { // run for the nearest door
          const px = p.obj.position.x;
          d = S.slots.map(c => c[0].door).reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a), d);
          sx = d;
        }
        p.slot.who = null; p.slot = null;
        if (!p.arrived) p.speed *= 1.6;
        p.go([new THREE.Vector3(d + (sx - d) * 0.4, 0, I.ze + 0.7), new THREE.Vector3(d, 0, I.ze - 0.9)], (pp) => { S.boarded++; removePerson(pp); });
      }
    }
    p.update(dt, (x, z) => (z < I.ze ? I.Hp : I.floorY(x, z)));
    if (p.role === 'board' && p.obj.position.z < I.ze + 0.1) p.obj.visible = p.obj.position.z > I.ze - 0.5;
  }

  // steam smoke
  if (C.steam) {
    const moving = S.phase === 'approach' || S.phase === 'depart';
    S.puffT = (S.puffT || 0) - dt;
    if (S.puffT <= 0 && C.group.position.x < I.X1 + 40 && C.group.position.x > I.X0 - C.length - 20) {
      S.puffT = moving ? 0.22 : 0.9;
      const puff = inked(PUFF_GEO, inkMat('#f4f2ee', false));
      puff.position.copy(C.steam.chimney).add(C.group.position);
      world.add(puff); S.smoke.push({ obj: puff, age: 0, life: 2.6 + Math.random() });
    }
    const spin = S.phase === 'depart' ? S.t * 4 : S.phase === 'approach' ? (1 - S.t / APPROACH_T) * 6 : 0;
    for (const w of C.steam.drivers) w.rotation.y = -spin * 2;
  }
  for (const s of S.smoke.slice()) {
    s.age += dt; const u = s.age / s.life;
    s.obj.position.y += dt * 1.6; s.obj.position.x += dt * 0.8;
    s.obj.scale.setScalar((0.5 + u * 2.6) * Math.sin(Math.min(1, u) * Math.PI) + 0.01);
    if (u >= 1) { world.remove(s.obj); S.smoke.splice(S.smoke.indexOf(s), 1); }
  }
}
const PUFF_GEO = new THREE.IcosahedronGeometry(0.7, 1);

function nextTrain() {
  if (S.cycle) {
    const list = filteredModels();
    const i = list.indexOf(S.model);
    loadModel(list[(i + 1) % list.length] || MODELS[0], { keepCount: !!S.nShow });
  } else {
    S.phase = 'gap'; S.t = 0; S.frontX = 1e4; S.boardStart = -1;
    S.consist.group.position.x = S.frontX;
  }
}

// ---------- sound ----------
let actx = null;
function chime(kind) {
  if (!S.sound) return;
  actx = actx || new AudioContext();
  const seq = { arrive: [[659, 0], [523, 0.32]], door: [[784, 0], [988, 0.18]], close: [[988, 0], [784, 0.18], [988, 0.36], [784, 0.54]], pass: [[440, 0], [440, 0.25], [440, 0.5]] }[kind] || [];
  for (const [f, t0] of seq) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = actx.currentTime + t0;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.65);
  }
}

// ---------- UI ----------
const $ = (s) => document.querySelector(s);
let filter = { op: 'all', q: '' };
function filteredModels() {
  const q = filter.q.trim().toLowerCase();
  return MODELS.filter(m => (filter.op === 'all' || m.op === filter.op) &&
    (!q || [m.name, m.nick, m.en, m.st.name, m.st.ro, OPS[m.op].name].join(' ').toLowerCase().includes(q)));
}

function updateUI() {
  const m = S.model, op = OPS[m.op];
  $('#fig').textContent = `Fig. ${String(m.index).padStart(2, '0')} — ${m.en} at ${m.st.ro}`;
  $('#title').innerHTML = `<b>${m.name}</b> ${m.nick !== m.name ? `「${m.nick}」` : ''}`;
  $('#meta').innerHTML = `<span class="chip" style="--c:${op.color}">${op.name}</span><span>${m.catLabel}</span><span>${m.year} 年</span><span>${m.speed} km/h</span><span>編組 ${m.cars} 輛 · 圖示 ${S.nShowUsed} 輛</span>`;
  $('#desc').textContent = m.desc;
  $('#cars').value = S.nShowUsed; $('#carsV').textContent = S.nShowUsed;
  document.querySelectorAll('#list .item').forEach(el => el.classList.toggle('on', el.dataset.id === m.id));
}

function buildList() {
  const tabs = $('#tabs');
  tabs.innerHTML = [['all', '全部'], ...Object.entries(OPS).map(([k, v]) => [k, v.name])]
    .map(([k, n]) => `<button data-op="${k}" class="${filter.op === k ? 'on' : ''}">${n}</button>`).join('');
  tabs.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; filter.op = b.dataset.op; buildList(); };
  const list = filteredModels();
  const groups = {};
  for (const m of list) (groups[m.op] ||= []).push(m);
  $('#list').innerHTML = Object.entries(groups).map(([op, ms]) => `<div class="grp"><h4 style="--c:${OPS[op].color}">${OPS[op].name}<small>${OPS[op].en}</small></h4>` +
    ms.map(m => `<button class="item" data-id="${m.id}"><i style="background:${swatchOf(m)}"></i><b>${m.name}</b><span>${m.nick}</span><em>${m.catLabel}</em></button>`).join('') + '</div>').join('') || '<p class="empty">找不到符合的車型</p>';
  $('#count').textContent = `${list.length} / ${MODELS.length} 款`;
  updateUIListOn();
}
function updateUIListOn() { if (S.model) document.querySelectorAll('#list .item').forEach(el => el.classList.toggle('on', el.dataset.id === S.model.id)); }
function swatchOf(m) {
  const liv = m.liv || (m.coach && m.coach.liv) || (m.loco && m.loco.liv) || { base: '#333' };
  const k = liv.key;
  if (k === 'base' || !liv.bands || !liv.bands.length) return liv.base;
  if (typeof k === 'number') return liv.bands[k][2];
  let best = liv.bands[0]; for (const b of liv.bands) if (b[1] - b[0] > best[1] - best[0] && b[1] - b[0] < 0.9) best = b;
  return best[2];
}

$('#list').onclick = (e) => {
  const b = e.target.closest('.item'); if (!b) return;
  loadModel(MODEL_BY_ID[b.dataset.id], { keepCount: false });
  S.nShow = null;
  if (compact()) document.body.classList.remove('drawer');
};
$('#search').oninput = (e) => { filter.q = e.target.value; buildList(); };
$('#toggleList').onclick = () => { document.body.classList.toggle('drawer'); fitCamera(false); };
$('#closeList').onclick = () => { document.body.classList.remove('drawer'); fitCamera(false); };
if (compact()) $('#card').classList.add('mini');
else document.body.classList.add('drawer');
$('#card').onclick = () => $('#card').classList.toggle('mini');
$('#pause').onclick = () => { S.paused = !S.paused; $('#pause').textContent = S.paused ? '繼續' : '暫停'; };
$('#cycle').onchange = (e) => { S.cycle = e.target.checked; };
$('#prev').onclick = () => { const l = filteredModels(); const i = l.indexOf(S.model); loadModel(l[(i - 1 + l.length) % l.length] || MODELS[0], { keepCount: !!S.nShow }); };
$('#next').onclick = () => { const l = filteredModels(); const i = l.indexOf(S.model); loadModel(l[(i + 1) % l.length] || MODELS[0], { keepCount: !!S.nShow }); };
$('#wob').oninput = (e) => { SHARED.uWob.value = +e.target.value; };
$('#cars').oninput = (e) => { $('#carsV').textContent = e.target.value; };
$('#cars').onchange = (e) => { S.nShow = +e.target.value; loadModel(S.model, { keepCount: true }); };
$('#resetView').onclick = () => fitCamera(true);
$('#sound').onclick = () => { S.sound = !S.sound; $('#sound').classList.toggle('on', S.sound); $('#sound').textContent = S.sound ? '音效 開' : '音效 關'; };
const SW = [null, '#f2b33d', '#e0574a', '#7fc8a9', '#5b8fd9', '#f0a6c0', '#1aa78f', '#6b4c9a'];
$('#swatches').innerHTML = SW.map((c, i) => `<button data-i="${i}" class="${i ? '' : 'on orig'}" style="${c ? `background:${c}` : ''}" title="${c ? c : '原廠塗裝'}">${c ? '' : '原'}</button>`).join('');
$('#swatches').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#swatches button').forEach(x => x.classList.toggle('on', x === b));
  S.color = SW[+b.dataset.i];
  // rebuild only the consist, keeping its position and door state
  const x = S.frontX, d = S.doorOpen;
  world.remove(S.consist.group);
  S.consist = buildConsist(S.model, S.nShowUsed, S.color);
  world.add(S.consist.group); S.consist.group.position.x = x; setDoors(S.consist, d);
};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') $('#next').click();
  if (e.key === 'ArrowLeft') $('#prev').click();
  if (e.key === ' ') { e.preventDefault(); $('#pause').click(); }
});

// ---------- loop ----------
let last = performance.now();
function frame(dt) {
  if (!S.paused) updateSim(dt);
  if (SHARED.uWob.value > 0.001) SHARED.uBoil.value = Math.floor(S.time * 6) * 1.37;
  $('#waiting').textContent = S.people.filter(p => p.role === 'wait' || p.role === 'board').length;
  $('#boarded').textContent = S.boarded;
  controls.update();
  const worldPerPx = (camera.top - camera.bottom) / camera.zoom / innerHeight;
  SHARED.uOutW.value = worldPerPx * 1.7;
  renderer.render(scene, camera);
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  frame(dt);
  requestAnimationFrame(loop);
}

await document.fonts.ready.catch(() => {});
buildList();
const init = MODEL_BY_ID[new URLSearchParams(location.search).get('m')] || MODEL_BY_ID.e5;
loadModel(init);
requestAnimationFrame(loop);

window.__app = { S, frame: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) frame(dt); }, load: (id) => loadModel(MODEL_BY_ID[id]), MODELS,
  focus(x, zoom = 3) { // debug: look closely at consist x position
    const p = new THREE.Vector3(S.frontX + x, 2, 0);
    camera.position.add(p.clone().sub(controls.target)); controls.target.copy(p); camera.zoom = zoom; camera.updateProjectionMatrix(); frame(0);
  } };
