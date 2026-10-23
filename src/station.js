// Diorama station: track slab, platform with stairwell, fences, signs.
import * as THREE from 'three';
import { boxSpan, inkMat, instancedInk, hullMat, addOutN } from './ink.js';

const PLAT = {
  sk:  { Hp: 1.25, gauge: 1.435, fence: true },
  hsr: { Hp: 1.25, gauge: 1.435, fence: true },
  jr:  { Hp: 1.1,  gauge: 1.067, fence: false },
  tw:  { Hp: 1.15, gauge: 1.067, fence: false },
};

const FONT = '"Noto Sans TC","Noto Sans JP","Microsoft JhengHei","Hiragino Sans",sans-serif';

export function signTexture(model) {
  const s = model.st;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 300;
  const g = cv.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 1024, 300);
  g.fillStyle = s.color; g.fillRect(0, 205, 1024, 95);
  g.fillStyle = '#1c1a1e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${s.name.length > 4 ? 92 : 118}px ${FONT}`; g.fillText(s.name, 512, 88);
  g.font = `700 44px ${FONT}`; g.fillText(s.ro, 512, 170);
  g.fillStyle = '#fff'; g.font = `700 46px ${FONT}`;
  g.textAlign = 'left'; g.fillText('◀ ' + s.prev, 28, 254);
  g.textAlign = 'right'; g.fillText(s.next + ' ▶', 996, 254);
  g.strokeStyle = '#1c1a1e'; g.lineWidth = 10; g.strokeRect(5, 5, 1014, 290);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
  return t;
}

function ledTexture(model) {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#16171a'; g.fillRect(0, 0, 768, 192);
  g.textBaseline = 'middle';
  g.fillStyle = '#ffae2b'; g.font = `700 50px ${FONT}`; g.textAlign = 'left';
  g.fillText(model.nick, 26, 56);
  g.fillStyle = '#66e08a'; g.textAlign = 'right';
  const hh = 6 + (model.index * 7) % 17, mm = (model.index * 13) % 60;
  g.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 742, 56);
  g.fillStyle = '#ffd36b'; g.textAlign = 'left'; g.font = `700 40px ${FONT}`;
  const dest = model.kind === 'freight' ? '通過列車 ／ 請勿靠近' : `${model.name}　${model.st.next !== '—' ? '往 ' + model.st.next : '終點站'}`;
  g.fillText(dest, 26, 140);
  return new THREE.CanvasTexture(cv);
}

export function texturedBoard(w, h, d, tex) {
  const side = inkMat('#f3f1ea');
  const face = new THREE.MeshBasicMaterial({ map: tex });
  face.userData.own = true;
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, [side, side, side, side, face, face]);
  addOutN(geo);
  m.add(new THREE.Mesh(geo, hullMat));
  return m;
}

export function buildStation(model, consist) {
  const P = PLAT[model.plat] || PLAT.jr;
  const group = new THREE.Group();
  const Hp = P.Hp, Wp = 7.5;
  const ze = consist.W / 2 + 0.2;
  const Lp = Math.round(Math.min(Math.max(consist.length * 0.88, 46), 200));
  const X0 = -Lp / 2, X1 = Lp / 2;

  // slab + ballast
  const ext = 26;
  group.add(boxSpan(X0 - ext, X1 + ext, -0.75, -0.25, -3.8, ze + Wp + 0.6, '#ddd7ca'));
  group.add(boxSpan(X0 - ext, X1 + ext, -0.25, -0.17, -2.0, 2.0, '#cbc4b5'));
  const g2 = P.gauge / 2;
  for (const z of [-g2, g2]) group.add(boxSpan(X0 - ext, X1 + ext, -0.17, 0, z - 0.04, z + 0.04, '#7d8188', { edges: false }));
  const nSl = Math.floor((Lp + ext * 2) / 0.65);
  const sl = instancedInk(new THREE.BoxGeometry(0.24, 0.1, P.gauge + 0.9), '#a39d92', nSl, false);
  const M = new THREE.Matrix4();
  for (let i = 0; i < nSl; i++) { M.makeTranslation(X0 - ext + 0.3 + i * 0.65, -0.17, 0); sl.mesh.setMatrixAt(i, M); }
  group.add(sl.mesh, sl.hull);

  // platform with stairwell hole
  const xs0 = X1 - 17, xs1 = X1 - 5, zh0 = ze + 3.9, zh1 = ze + 6.5;
  const PC = '#e8e3d6';
  group.add(boxSpan(X0, xs0, -0.75, Hp, ze, ze + Wp, PC));
  group.add(boxSpan(xs0, xs1, -0.75, Hp, ze, zh0, PC));
  group.add(boxSpan(xs0, xs1, -0.75, Hp, zh1, ze + Wp, PC));
  group.add(boxSpan(xs1, X1, -0.75, Hp, ze, ze + Wp, PC));
  const nSteps = 13, stepD = 0.62, stepH = 0.2;
  for (let k = 0; k < nSteps; k++) {
    group.add(boxSpan(xs0 + k * stepD, xs1, -0.75, Hp - (k + 1) * stepH, zh0, zh1, k % 2 ? '#d6d0c2' : '#dcd6c8'));
  }
  // parapets around the hole
  const GL = '#dfe9ee';
  group.add(boxSpan(xs0 + 0.6, xs1, Hp, Hp + 1.0, zh0 - 0.08, zh0, GL));
  group.add(boxSpan(xs0 + 0.6, xs1, Hp, Hp + 1.0, zh1, zh1 + 0.08, GL));
  group.add(boxSpan(xs1, xs1 + 0.08, Hp, Hp + 1.0, zh0 - 0.08, zh1 + 0.08, GL));
  // edge strip + tactile line
  group.add(boxSpan(X0, X1, Hp, Hp + 0.02, ze, ze + 0.3, '#f8f6ef', { edges: false }));
  group.add(boxSpan(X0 + 0.4, X1 - 0.4, Hp, Hp + 0.025, ze + 0.85, ze + 1.15, '#f2c230', { edges: false }));
  // end railing
  group.add(boxSpan(X0, X0 + 0.08, Hp, Hp + 1.0, ze + 0.4, ze + Wp, '#f3f1ea'));
  for (const z of [ze + 0.5, ze + Wp - 0.1]) group.add(boxSpan(X0, X0 + 1.2, Hp, Hp + 1.0, z - 0.04, z + 0.04, '#f3f1ea'));

  // fences / platform doors with gaps at the doors (train stops centred on the platform)
  const stopFront = -consist.length / 2;
  const doorsX = consist.doors.map(d => stopFront + d);
  if (P.fence || model.psd) {
    const gaps = doorsX.filter(x => x > X0 + 1 && x < X1 - 1).map(x => [x - 1.25, x + 1.25]);
    let x = X0 + 0.6;
    const fz = ze + 0.42;
    const segs = [];
    for (const [a, b] of gaps) { if (a - x > 0.6) segs.push([x, a]); x = b; }
    if (X1 - 0.6 - x > 0.6) segs.push([x, X1 - 0.6]);
    for (const [a, b] of segs) {
      group.add(boxSpan(a, b, Hp, Hp + 1.3, fz - 0.07, fz + 0.07, '#f6f5f0'));
      group.add(boxSpan(a, b, Hp + 1.12, Hp + 1.22, fz - 0.08, fz + 0.08, model.st.color, { edges: false }));
    }
  }

  // station sign
  const sx = X0 + Lp * 0.42, sz = ze + 3.0;
  for (const dx of [-2.1, 2.1]) group.add(boxSpan(sx + dx - 0.06, sx + dx + 0.06, Hp, Hp + 3.2, sz - 0.06, sz + 0.06, '#5a5d63'));
  const sign = texturedBoard(4.8, 1.4, 0.1, signTexture(model));
  sign.position.set(sx, Hp + 2.45, sz); group.add(sign);
  // LED departure board
  const lx = X0 + Lp * 0.2, lz = ze + 3.4;
  for (const dx of [-1.4, 1.4]) group.add(boxSpan(lx + dx - 0.05, lx + dx + 0.05, Hp, Hp + 3.4, lz - 0.05, lz + 0.05, '#5a5d63'));
  const led = texturedBoard(3.2, 0.8, 0.14, ledTexture(model));
  led.position.set(lx, Hp + 2.9, lz); group.add(led);
  // benches + vending machine
  for (const bx of [X0 + Lp * 0.3, X0 + Lp * 0.58]) {
    group.add(boxSpan(bx - 1.0, bx + 1.0, Hp + 0.42, Hp + 0.5, ze + 5.6, ze + 6.1, '#c98a4b'));
    for (const dx of [-0.8, 0.8]) group.add(boxSpan(bx + dx - 0.05, bx + dx + 0.05, Hp, Hp + 0.42, ze + 5.7, ze + 6.0, '#5a5d63', { hull: false }));
  }
  group.add(boxSpan(X0 + Lp * 0.08, X0 + Lp * 0.08 + 1.1, Hp, Hp + 1.85, ze + Wp - 0.9, ze + Wp - 0.15, model.op === 'tra' || model.op === 'thsr' ? '#d2473b' : '#2f6fb4'));
  group.add(boxSpan(X0 + Lp * 0.08 + 0.12, X0 + Lp * 0.08 + 0.98, Hp + 0.9, Hp + 1.65, ze + Wp - 0.96, ze + Wp - 0.9, '#e9eef2', { hull: false }));

  const zc = (zh0 + zh1) / 2;
  const info = {
    Hp, Wp, ze, Lp, X0, X1, xs0, xs1, zh0, zh1, zc, stopFront, doorsX,
    lane: ze + 3.25,
    stairTop: new THREE.Vector3(xs0 - 0.8, Hp, zc),
    stairBottom: new THREE.Vector3(xs0 + nSteps * stepD + 0.6, Hp - nSteps * stepH, zc),
    floorY(x, z) {
      if (z > zh0 && z < zh1 && x > xs0 && x < xs1) {
        const k = Math.min(nSteps, Math.max(0, (x - xs0) / stepD));
        return Hp - k * stepH;
      }
      return Hp;
    },
    bounds: new THREE.Box3(new THREE.Vector3(X0 - 1, -0.5, -2.5), new THREE.Vector3(X1 + 1, 4.2, ze + Wp)),
  };
  return { group, info };
}
