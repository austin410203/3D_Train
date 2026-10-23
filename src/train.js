// Assembles a consist (front tip at x = 0, extending toward +x) from a catalogue model.
import * as THREE from 'three';
import { buildCar, buildFlatcar, buildSteam, BODIES } from './car.js';
import { boxSpan } from './ink.js';

const GAP = 0.7;

function recolor(liv, color) {
  if (!color || !liv) return liv;
  const out = { ...liv, bands: (liv.bands || []).map(b => b.slice()) };
  let key = liv.key;
  if (key === undefined) {
    let best = -1, bw = 0;
    out.bands.forEach((b, i) => { const w = b[1] - b[0]; if (w > bw && w < 0.9) { bw = w; best = i; } });
    key = best >= 0 ? best : 'base';
  }
  if (key === 'base') out.base = color; else if (out.bands[key]) out.bands[key][2] = color;
  if (liv.door && liv.door !== liv.base) out.door = color;
  if (liv.front && !['#2a2a2e', '#222326', '#1e1f22', '#2c2c30', '#f2f2f0'].includes(liv.front[2])) out.front = [...liv.front.slice(0, 2), color, ...liv.front.slice(3)];
  return out;
}

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function buildConsist(model, nShow, color) {
  const group = new THREE.Group();
  const cars = [];
  let off = 0;
  const NOWIN = { y: [0, 0], p: 1, w: 0.5 };
  const add = (car, flip, passenger) => {
    if (flip) { car.group.rotation.y = Math.PI; car.group.position.x = off + car.L; }
    else car.group.position.x = off;
    group.add(car.group);
    cars.push({ ...car, off, flip, passenger });
    off += car.L + GAP;
  };
  const emuCar = (o) => buildCar({
    body: model.body, liv: recolor(model.liv, color), doors: model.doors, doorW: model.doorW, doorY: model.doorY,
    win: model.win, skirt: model.skirt, ...o,
  });

  const kind = model.kind || 'emu';
  if (kind === 'emu') {
    const n = Math.max(2, nShow);
    for (let i = 0; i < n; i++) {
      const lead = i === 0, tail = i === n - 1;
      const pant = model.pant && ((n >= 3 && (i === 1 || (n >= 6 && i === n - 2))) || (n === 2 && i === 1));
      const car = emuCar({ nose: lead || tail ? model.nose : 'end', pant, openSide: tail ? -1 : 1, pantAt: 0.32 });
      add(car, tail, true);
    }
  } else if (kind === 'loco' || kind === 'freight') {
    const L = model.loco;
    const locoCar = (front, back) => buildCar({
      body: L.body, nose: front, noseBack: back, len: L.len, liv: recolor(L.liv, color), doors: 'none',
      win: NOWIN, pant: L.pant && model.pant !== false, pantAt: 0.3, double: !!back && back !== 'end',
    });
    if (model.twin) { add(locoCar(L.nose, 'end'), false, false); add(locoCar(L.nose, 'end'), true, false); }
    else if (model.emu) add(locoCar(L.nose, 'end'), false, false);
    else add(locoCar(L.nose, L.nose), false, false);
    if (kind === 'freight') {
      const rnd = mulberry(model.index * 977);
      const n = Math.max(3, nShow);
      for (let i = 0; i < n; i++) add(buildFlatcar(20.4, rnd), false, false);
      if (model.emu) add(locoCar(L.nose, 'end'), true, false);
    } else {
      const C = model.coach;
      const n = Math.max(1, nShow - 1 - (model.pushpull ? 1 : 0));
      for (let i = 0; i < n; i++) add(buildCar({ ...C, nose: 'end', liv: recolor(C.liv, color), pant: false }), false, true);
      if (model.pushpull) add(locoCar(L.nose, L.nose), true, false);
    }
  } else if (kind === 'steam') {
    const s = buildSteam(model.steam);
    add(s, false, false);
    const C = model.coach;
    const n = Math.max(1, nShow - 1);
    for (let i = 0; i < n; i++) add(buildCar({ ...C, nose: 'end', liv: recolor(C.liv, color), pant: false }), false, true);
  }
  const length = off - GAP;

  // gangway bellows between cars
  for (let i = 0; i < cars.length - 1; i++) {
    const a = cars[i], b = cars[i + 1];
    const W = Math.min(a.body.W, b.body.W);
    const top = Math.min(a.body.H, b.body.H) - 0.5;
    group.add(boxSpan(a.off + a.L - 0.05, b.off + 0.05, Math.max(a.body.F, 0.9) + 0.15, top, -W * 0.33, W * 0.33, '#3b3d42'));
  }

  // platform-side door positions (consist x)
  const doors = [];
  for (const c of cars) {
    if (!c.passenger) continue;
    for (const t of c.doorsT) doors.push(c.flip ? c.off + c.L - t : c.off + t);
  }
  doors.sort((p, q) => p - q);
  const W = Math.max(...cars.map(c => c.body.W));
  const steam = cars[0].steam || null;
  return { group, cars, length, doors, W, steam };
}

export function setDoors(consist, v) {
  for (const c of consist.cars) if (c.mat) c.mat.uniforms.uOpen.value = v;
}
