// Big-station mode: several island platforms with independent trains, a footbridge over the tracks,
// and a cut-away station building (entrance -> ticket gates -> stairs -> bridge -> platform).
import * as THREE from 'three';
import { boxSpan, box, cyl, inked, inkMat, instancedInk, disposeTree } from './ink.js';
import { buildConsist, setDoors } from './train.js';
import { MODEL_BY_ID } from './trains.js';
import { texturedBoard } from './station.js';
import { Person } from './people.js';

const FONT = '"Noto Sans TC","Noto Sans JP","Microsoft JhengHei","Hiragino Sans",sans-serif';

// island: type (sk = shinkansen/HSR gauge & height), no = track numbers [A, B], A/B = models running on each track
export const HUBS = {
  tokyo: {
    name: '東京駅', ro: 'Tokyo', style: 'brick', color: '#b5523b',
    desc: '日本鐵道的起點，丸之內紅磚站舍建於 1914 年。在來線、東海道新幹線與東北・北陸新幹線在此交會。',
    hero: 0,
    islands: [
      { type: 'sk', no: ['20', '21'], line: '東北・北陸新幹線', A: ['e5', 'e6', 'e2'], B: ['e7', 'e8', 'e5'], first: 'e5' },
      { type: 'sk', no: ['14', '15'], line: '東海道新幹線', A: ['n700s', 'n700a'], B: ['n700s', 'dy', 'n700a'] },
      { type: 'jr', no: ['9', '10'], line: '東海道線・特急', A: ['e261', '185'], B: ['e259', 'e217'] },
      { type: 'jr', no: ['5', '6'], line: '山手線・京浜東北線', A: ['e235'], B: ['e233k'] },
      { type: 'jr', no: ['3', '4'], line: '京浜東北線・山手線', A: ['e233k'], B: ['e235'] },
      { type: 'jr', no: ['1', '2'], line: '中央線', A: ['e233c'], B: ['e233c'] },
    ],
  },
  shinjuku: {
    name: '新宿駅', ro: 'Shinjuku', style: 'modern', color: '#80c241',
    desc: '世界上每日進出人次最多的車站，山手線、中央線與特急「あずさ」在此停靠。',
    hero: 2,
    islands: [
      { type: 'jr', no: ['7', '8'], line: '中央線快速', A: ['e233c'], B: ['e233c'] },
      { type: 'jr', no: ['9', '10'], line: '特急', A: ['e353'], B: ['e259', 'e353'] },
      { type: 'jr', no: ['13', '14'], line: '山手線', A: ['e235'], B: ['e235'], first: 'e235' },
      { type: 'jr', no: ['15', '16'], line: '山手線・中央総武線', A: ['e235'], B: ['e231'] },
    ],
  },
  nagoya: {
    name: '名古屋駅', ro: 'Nagoya', style: 'tower', color: '#f08300',
    desc: 'JR東海的大本營，站上就是 JR セントラルタワーズ雙塔。',
    hero: 0,
    islands: [
      { type: 'sk', no: ['14', '15'], line: '東海道新幹線', A: ['n700s', 'n700a'], B: ['n700a', 'dy'], first: 'n700s' },
      { type: 'sk', no: ['16', '17'], line: '東海道新幹線', A: ['n700s', '700'], B: ['n700s'] },
      { type: 'jr', no: ['10', '11'], line: '中央本線', A: ['315'], B: ['383', '315'] },
      { type: 'jr', no: ['5', '6'], line: '東海道本線', A: ['313'], B: ['313', '373'] },
      { type: 'jr', no: ['12', '13'], line: '関西本線・特急', A: ['hc85'], B: ['313'] },
    ],
  },
  kyoto: {
    name: '京都駅', ro: 'Kyoto', style: 'grid', color: '#0072bc',
    desc: '巨大玻璃中庭的現代站舍，觀光客與新幹線、關西機場特急絡繹不絕。',
    hero: 0,
    islands: [
      { type: 'sk', no: ['11', '12'], line: '東海道新幹線', A: ['n700s', 'n700a'], B: ['n700a', 'n700s'], first: 'n700s' },
      { type: 'jr', no: ['30', '31'], line: 'はるか・特急', A: ['271'], B: ['683', '287'] },
      { type: 'jr', no: ['4', '5'], line: 'JR京都線', A: ['225'], B: ['223'] },
      { type: 'jr', no: ['6', '7'], line: 'JR京都線・琵琶湖線', A: ['223'], B: ['225', '87'] },
    ],
  },
  osaka: {
    name: '大阪駅', ro: 'Osaka', style: 'glass', color: '#f15a24',
    desc: '西日本最大的轉運站，環狀線、新快速與往北陸的「雷鳥號」都從這裡出發。',
    hero: 2,
    islands: [
      { type: 'jr', no: ['1', '2'], line: '大阪環状線', A: ['323'], B: ['323'] },
      { type: 'jr', no: ['3', '4'], line: 'JR京都線・神戸線', A: ['225'], B: ['223'] },
      { type: 'jr', no: ['11', '12'], line: '特急', A: ['683'], B: ['285', '87'], first: '683' },
      { type: 'jr', no: ['5', '6'], line: 'JR京都線・神戸線', A: ['223', '225'], B: ['225'] },
      { type: 'jr', no: ['21', '22'], line: 'うめきた（関空・紀州路）', A: ['271'], B: ['287'] },
    ],
  },
  hakata: {
    name: '博多駅', ro: 'Hakata', style: 'glass', color: '#d7141a',
    desc: '九州的門戶，山陽・九州新幹線與各式水戶岡銳治設計的特急列車齊聚。',
    hero: 0,
    islands: [
      { type: 'sk', no: ['11', '12'], line: '山陽・九州新幹線', A: ['800', 'n700s'], B: ['n700a', '800'], first: '800' },
      { type: 'jr', no: ['1', '2'], line: '特急', A: ['885', '787'], B: ['883'] },
      { type: 'jr', no: ['3', '4'], line: '鹿児島本線', A: ['811'], B: ['813', '821'] },
      { type: 'jr', no: ['5', '6'], line: '観光列車', A: ['yufuin'], B: ['aru', 'nanatsu'] },
    ],
  },
  taipei: {
    name: '臺北車站', ro: 'Taipei', style: 'tw', color: '#1b5fa8',
    desc: '高鐵、臺鐵、捷運三鐵共構的台灣交通樞紐，站體方正、屋頂是傳統綠瓦。',
    hero: 0,
    islands: [
      { type: 'sk', no: ['1', '2'], line: '台灣高鐵', A: ['700t', 'n700st'], B: ['700t'], first: '700t' },
      { type: 'tw', no: ['1A', '1B'], line: '西部幹線', A: ['emu3000', 'e1000'], B: ['emu900', 'emu800'] },
      { type: 'tw', no: ['2A', '2B'], line: '東部幹線', A: ['taroko', 'puyuma'], B: ['emu3000', 'emu800'] },
    ],
  },
};

const STYLE = {
  brick:  { wall: '#b5523b', trim: '#efe7da', floor: '#e5ddcf', roof: '#3d4b49' },
  modern: { wall: '#cdd2d6', trim: '#3a3f45', floor: '#e3e1db', roof: '#5a6068' },
  tower:  { wall: '#d9d2c3', trim: '#8a8f96', floor: '#e6e1d6', roof: '#c9cdd2' },
  grid:   { wall: '#c3c8cc', trim: '#2f353b', floor: '#e2e0da', roof: '#8a9096' },
  glass:  { wall: '#9fc4d6', trim: '#38434c', floor: '#e4e2dc', roof: '#6d7f8c' },
  tw:     { wall: '#e3d6b8', trim: '#a63a2c', floor: '#e6dfcf', roof: '#2f6b4f' },
};

const PLAT = { sk: { Hp: 1.25, gauge: 1.435, edge: 1.9 }, jr: { Hp: 1.1, gauge: 1.067, edge: 1.7 }, tw: { Hp: 1.15, gauge: 1.067, edge: 1.7 } };
const WI = 10;          // island width
const TRACK_GAP = 4.4;  // centre distance between neighbouring islands' tracks
const LP = 100;         // platform length
const HB = 7.6;         // footbridge walking height
const TREAD = 0.36, RISE = 0.25;
const SPEED_HUB = 2.5;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function canvasBoard(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  return new THREE.CanvasTexture(cv);
}

function slopedPanel(x0, y0, x1, y1, z, h, color) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const b = box(len, h, 0.08, color);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2 + h / 2, z);
  b.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  return b;
}

// solid stepped stair rising toward +x, from (xFoot, y0) to (xTop, y1), across z band
function stair(group, xTop, y0, y1, z0, z1, shade) {
  const n = Math.max(1, Math.round((y1 - y0) / RISE));
  const rise = (y1 - y0) / n;
  const xFoot = xTop - n * TREAD;
  for (let k = 0; k < n; k++) group.add(boxSpan(xFoot + k * TREAD, xTop, y0 - 0.02, y0 + (k + 1) * rise, z0, z1, k % 2 ? shade : '#dcd6c8', { hull: k === 0 }));
  group.add(slopedPanel(xFoot, y0, xTop, y1, z0 - 0.05, 1.0, '#dfe9ee'));
  group.add(slopedPanel(xFoot, y0, xTop, y1, z1 + 0.05, 1.0, '#dfe9ee'));
  return xFoot;
}

class Track {
  constructor(hub, island, side) {
    this.hub = hub; this.island = island; this.side = side;
    const P = PLAT[island.type];
    this.P = P;
    this.sgn = side === 'A' ? 1 : -1;               // direction from the track into the island
    this.z = side === 'A' ? island.z0 - P.edge : island.z1 + P.edge;
    this.zE = side === 'A' ? island.z0 : island.z1;   // platform edge
    this.lane = this.zE + this.sgn * 3.25;
    this.rev = side === 'B';                         // B trains run toward +x
    this.lines = (side === 'A' ? island.A : island.B).map(id => MODEL_BY_ID[id]).filter(Boolean);
    this.no = island.no[side === 'A' ? 0 : 1];
    this.holder = new THREE.Group();
    this.holder.position.z = this.z;
    if (this.rev) this.holder.rotation.y = Math.PI;
    hub.group.add(this.holder);
    this.slots = []; this.consist = null; this.phase = 'gap'; this.t = 0; this.gapT = 1; this.doorOpen = 0;
  }
  worldX(lx) { return this.rev ? -lx : lx; }
  newTrain(model) {
    if (this.consist) { this.holder.remove(this.consist.group); disposeTree(this.consist.group); }
    this.model = model || pick(this.lines);
    this.consist = buildConsist(this.model, Math.min(4, Math.max(3, this.model.show)), this.hub.color);
    this.holder.add(this.consist.group);
    this.stopFront = -this.consist.length / 2;
    this.frontX = 1e4; this.consist.group.position.x = this.frontX;
    this.doorOpen = 0; this.alighted = false; this.closing = false; this.boardStart = -1;
    this.doorsW = this.consist.doors.map(d => this.worldX(this.stopFront + d)).filter(x => x > -LP / 2 + 1.2 && x < LP / 2 - 1.2);
    this.slots = [];
    for (const d of this.doorsW) for (let k = 0; k < 3; k++) for (const s of [-1, 1])
      this.slots.push({ x: d + s * 0.42, z: this.zE + this.sgn * (1.55 + k * 0.62), door: d, k, who: null });
    this.target = Math.min(10, Math.max(4, Math.round(this.doorsW.length * 1.5)));
    // passengers already waiting move to the queues for the new train's doors
    for (const p of this.hub.people) if (p.track === this && p.role === 'wait') { p.slot = null; this.hub.assign(p, this); }
    if (this === this.hub.hero) this.hub.onHero && this.hub.onHero(this);
  }
  freeSlot() {
    let best = null;
    for (const s of this.slots) if (!s.who && (!best || s.k < best.k || (s.k === best.k && Math.random() < 0.3))) best = s;
    return best;
  }
  waiting() { return this.hub.people.filter(p => p.track === this && (p.role === 'wait' || p.role === 'board')).length; }
  update(dt) {
    this.t += dt;
    const D = this.consist.length + LP / 2 + 45;
    switch (this.phase) {
      case 'gap': if (this.t > this.gapT) { this.phase = 'approach'; this.t = 0; } break;
      case 'approach': {
        const u = Math.min(1, this.t / 6);
        this.frontX = this.stopFront + D * (1 - u) * (1 - u);
        if (u >= 1) { this.phase = 'dwell'; this.t = 0; }
        break;
      }
      case 'dwell': {
        if (!this.closing) {
          if (this.t > 0.5) this.doorOpen = Math.min(1, this.doorOpen + dt / 0.9);
          if (this.t > 0.5 && !this.alighted) { this.alighted = true; this.hub.spawnAlighting(this); }
          if (this.t > 2.2 && this.boardStart < 0) { this.boardStart = this.t; this.hub.startBoarding(this); }
          const busy = this.hub.people.some(p => p.track === this && ((p.role === 'board' && p.arrived) || (p.role === 'alight' && p.near)));
          if ((this.boardStart >= 0 && !busy && this.t > 5) || this.t > 22) {
            this.closing = true; this.tc = this.t;
            for (const p of this.hub.people) if (p.track === this && p.role === 'board' && !p.arrived) { p.role = 'wait'; p.path = []; p.onDone = null; }
          }
        } else {
          this.doorOpen = Math.max(0, this.doorOpen - dt / 0.9);
          if (this.t - this.tc > 1.8) { this.phase = 'depart'; this.t = 0; }
        }
        break;
      }
      case 'depart': {
        const a = 2 * (D + 20) / 49;
        this.frontX = this.stopFront - 0.5 * a * this.t * this.t;
        if (this.t > 7) { this.newTrain(this.forced); this.forced = null; this.phase = 'gap'; this.t = 0; this.gapT = rand(2, 9); }
        break;
      }
    }
    this.consist.group.position.x = this.frontX;
    setDoors(this.consist, this.doorOpen);
  }
}

export class Hub {
  constructor(key, { color = null, onHero = null } = {}) {
    const cfg = HUBS[key];
    this.key = key; this.cfg = cfg; this.color = color; this.onHero = onHero;
    this.group = new THREE.Group();
    this.people = []; this.boarded = 0; this.spawnT = 0;
    const st = STYLE[cfg.style];

    // ---- layout along z: islands, then the station building ----
    let z = 0;
    this.islands = cfg.islands.map((isl) => {
      const P = PLAT[isl.type];
      const zA = z;
      const o = { ...isl, Hp: P.Hp, z0: zA + P.edge, z1: zA + P.edge + WI };
      o.zc = (o.z0 + o.z1) / 2;
      z = o.z1 + P.edge + TRACK_GAP;
      return o;
    });
    const last = this.islands[this.islands.length - 1];
    const zFirst = this.islands[0].z0 - PLAT[this.islands[0].type].edge;
    const zb0 = last.z1 + PLAT[last.type].edge + 3.5, zb1 = zb0 + 30;
    const xB0 = LP / 2 - 12, xB1 = xB0 + 6, xm = (xB0 + xB1) / 2;
    Object.assign(this, { zb0, zb1, xB0, xB1, xm });

    // ---- ground, ballast, rails ----
    const EXT = 85;
    this.group.add(boxSpan(-EXT, EXT, -0.75, -0.25, zFirst - 4, zb1 + 16, '#ddd7ca'));
    this.tracks = [];
    for (const isl of this.islands) {
      for (const side of ['A', 'B']) {
        const tr = new Track(this, isl, side);
        this.tracks.push(tr);
        const g2 = tr.P.gauge / 2;
        this.group.add(boxSpan(-EXT, EXT, -0.25, -0.17, tr.z - 2.0, tr.z + 2.0, '#cbc4b5'));
        for (const zz of [-g2, g2]) this.group.add(boxSpan(-EXT, EXT, -0.17, 0, tr.z + zz - 0.04, tr.z + zz + 0.04, '#7d8188', { edges: false }));
        const nSl = Math.floor(EXT * 2 / 0.65);
        const sl = instancedInk(new THREE.BoxGeometry(0.24, 0.1, tr.P.gauge + 0.9), '#a39d92', nSl, false);
        const M = new THREE.Matrix4();
        for (let i = 0; i < nSl; i++) { M.makeTranslation(-EXT + 0.3 + i * 0.65, -0.17, tr.z); sl.mesh.setMatrixAt(i, M); }
        this.group.add(sl.mesh, sl.hull);
      }
    }

    // ---- island platforms with stairs up to the bridge ----
    for (const isl of this.islands) {
      const { Hp, z0, z1, zc } = isl;
      const X0 = -LP / 2, X1 = LP / 2, PC = '#e8e3d6';
      this.group.add(boxSpan(X0, X1, -0.75, Hp, z0, z1, PC));
      for (const [ze, s] of [[z0, 1], [z1, -1]]) {
        this.group.add(boxSpan(X0, X1, Hp, Hp + 0.02, Math.min(ze, ze + s * 0.3), Math.max(ze, ze + s * 0.3), '#f8f6ef', { edges: false }));
        this.group.add(boxSpan(X0 + 0.4, X1 - 0.4, Hp, Hp + 0.025, Math.min(ze + s * 0.85, ze + s * 1.15), Math.max(ze + s * 0.85, ze + s * 1.15), '#f2c230', { edges: false }));
      }
      isl.xFoot = stair(this.group, xB0, Hp, HB, zc - 1.0, zc + 1.0, '#d6d0c2');
      // bridge pillars standing on the island
      for (const dz of [-1.6, 1.6]) this.group.add(boxSpan(xB1 - 0.7, xB1 - 0.1, Hp, HB - 0.6, zc + dz - 0.3, zc + dz + 0.3, '#cfd3d6'));
      // island sign
      const tex = canvasBoard(1024, 220, (g) => {
        g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 1024, 220);
        g.fillStyle = cfg.color; g.fillRect(0, 0, 1024, 26);
        g.fillStyle = '#1c1a1e'; g.textBaseline = 'middle'; g.textAlign = 'center';
        g.font = `900 64px ${FONT}`; g.fillText(isl.line, 512, 125);
        g.font = `900 110px "JetBrains Mono",monospace`;
        g.textAlign = 'left'; g.fillText(isl.no[0], 30, 125);
        g.textAlign = 'right'; g.fillText(isl.no[1], 994, 125);
        g.strokeStyle = '#1c1a1e'; g.lineWidth = 10; g.strokeRect(5, 5, 1014, 210);
      });
      const sx = -LP * 0.1;
      for (const dx of [-2.3, 2.3]) this.group.add(boxSpan(sx + dx - 0.06, sx + dx + 0.06, Hp, Hp + 3.2, zc - 0.06, zc + 0.06, '#5a5d63'));
      const sign = texturedBoard(5.2, 1.1, 0.1, tex); sign.position.set(sx, Hp + 2.55, zc); this.group.add(sign);
      for (const bx of [-LP * 0.32, LP * 0.12]) this.group.add(boxSpan(bx - 1, bx + 1, Hp + 0.42, Hp + 0.5, zc - 0.25, zc + 0.25, '#c98a4b'));
      this.group.add(boxSpan(-LP * 0.42, -LP * 0.42 + 1.1, Hp, Hp + 1.85, zc - 0.4, zc + 0.4, isl.type === 'sk' ? '#2f6fb4' : '#d2473b'));
    }

    // ---- footbridge ----
    const bz0 = this.islands[0].zc - 2.0, bz1 = zb0 + 5;
    this.group.add(boxSpan(xB0, xB1, HB - 0.6, HB, bz0, bz1, '#e9e5dc'));
    const gaps = this.islands.map(i => [i.zc - 1.15, i.zc + 1.15]).concat([[zb0 + 0.8, zb0 + 4.2]]);
    let zz = bz0;
    for (const [a, b] of gaps) { if (a - zz > 0.3) this.group.add(boxSpan(xB0 - 0.05, xB0 + 0.05, HB, HB + 1.2, zz, a, '#dfe9ee')); zz = b; }
    if (bz1 - zz > 0.3) this.group.add(boxSpan(xB0 - 0.05, xB0 + 0.05, HB, HB + 1.2, zz, bz1, '#dfe9ee'));
    this.group.add(boxSpan(xB1 - 0.05, xB1 + 0.05, HB, HB + 1.2, bz0, bz1, '#dfe9ee'));
    this.group.add(boxSpan(xB0, xB1, HB, HB + 1.2, bz0 - 0.08, bz0, '#dfe9ee'));
    for (let i = 0; i < this.islands.length - 1; i++) {
      const zp = (this.islands[i].z1 + this.islands[i + 1].z0) / 2;
      this.group.add(boxSpan(xB0 + 0.4, xB0 + 1.0, -0.25, HB - 0.6, zp - 0.3, zp + 0.3, '#cfd3d6'));
      this.group.add(boxSpan(xB1 - 1.0, xB1 - 0.4, -0.25, HB - 0.6, zp - 0.3, zp + 0.3, '#cfd3d6'));
    }

    // ---- station building (cut-away) ----
    const BX0 = -LP / 2 - 4, BX1 = LP / 2 + 4;
    this.group.add(boxSpan(BX0, BX1, -0.25, 0.1, zb0, zb1, st.floor));
    this.group.add(boxSpan(BX0, BX1, 0.1, 2.2, zb0, zb0 + 0.3, st.wall));       // track-side wall
    for (const x of [BX0, BX1 - 0.3]) this.group.add(boxSpan(x, x + 0.3, 0.1, 3.0, zb0, zb1, st.wall));
    // inner stair from bridge level down to the concourse, landing under the bridge end
    const zs = zb0 + 2.5;
    this.xFootB = stair(this.group, xB0, 0.1, HB, zb0 + 1.0, zb0 + 4.0, '#d6d0c2');
    this.group.add(boxSpan(xB0, xB1, 0.1, HB - 0.6, zb0 + 4.4, zb0 + 5, '#cfd3d6', { hull: true }));
    this.zs = zs;
    // ticket gates
    const zg = zb0 + 12, xg0 = xB0 - 26, nG = 16;
    this.zg = zg; this.xg0 = xg0; this.nG = nG;
    for (let i = 0; i <= nG; i++) {
      const x = xg0 + i;
      this.group.add(boxSpan(x - 0.13, x + 0.13, 0.1, 1.05, zg - 0.8, zg + 0.8, '#d8dde2'));
      this.group.add(boxSpan(x - 0.13, x + 0.13, 1.05, 1.12, zg + 0.4, zg + 0.8, i % 3 ? '#2fa36b' : '#2f6fb4', { edges: false, hull: false }));
    }
    this.group.add(boxSpan(BX0 + 0.3, xg0 - 0.13, 0.1, 1.1, zg - 0.08, zg + 0.08, '#c7ccd1'));
    this.group.add(boxSpan(xg0 + nG + 0.13, BX1 - 0.3, 0.1, 1.1, zg - 0.08, zg + 0.08, '#c7ccd1'));
    // departure board above the gates
    const dep = canvasBoard(1024, 256, (g) => {
      g.fillStyle = '#16171a'; g.fillRect(0, 0, 1024, 256); g.textBaseline = 'middle';
      const rows = this.tracks.slice(0, 4);
      rows.forEach((tr, i) => {
        const y = 36 + i * 60;
        g.fillStyle = '#ffae2b'; g.font = `700 36px ${FONT}`; g.textAlign = 'left';
        g.fillText(`${String(7 + i).padStart(2, '0')}:${String((i * 17 + 5) % 60).padStart(2, '0')}  ${tr.lines[0].nick}`, 24, y);
        g.fillStyle = '#66e08a'; g.textAlign = 'right'; g.fillText(`${tr.no} 番線`, 1000, y);
      });
    });
    for (const dx of [-5.5, 5.5]) this.group.add(boxSpan(xg0 + nG / 2 + dx - 0.07, xg0 + nG / 2 + dx + 0.07, 0.1, 4.4, zg - 1.6, zg - 1.45, '#5a5d63'));
    const board = texturedBoard(10, 2.5, 0.16, dep); board.position.set(xg0 + nG / 2, 3.5, zg - 1.5); this.group.add(board);
    // ticket machines, kiosk, pillars
    for (let i = 0; i < 6; i++) this.group.add(boxSpan(xg0 - 14 + i * 1.3, xg0 - 13 + i * 1.3, 0.1, 1.7, zg + 1.0, zg + 1.7, '#e8ecef'));
    this.group.add(boxSpan(-30, -18, 0.1, 2.6, zg + 6, zg + 11, '#f4efe4'));
    this.group.add(boxSpan(-30, -18, 2.6, 3.0, zg + 6, zg + 11, cfg.color));
    for (const x of [-40, -10, 20]) for (const zp of [zb0 + 8, zb1 - 6]) this.group.add(cylAt(x, zp, 0.45, 5.0, st.trim));
    // facade with entrance gap
    const xE0 = xg0 - 1, xE1 = xg0 + nG + 1;
    this.xE0 = xE0; this.xE1 = xE1;
    this.group.add(facade(cfg, st, BX0, BX1, zb1, xE0, xE1));

    // ---- plaza ----
    this.group.add(boxSpan(BX0 - 10, BX1 + 10, -0.25, 0.04, zb1, zb1 + 15, '#d2ccbf', { edges: false }));
    for (let i = 0; i < 8; i++) {
      const x = BX0 + 6 + i * ((BX1 - BX0 - 12) / 7);
      if (x > xE0 - 3 && x < xE1 + 3) continue;
      this.group.add(cylAt(x, zb1 + 9, 0.18, 2.2, '#7a5a3a'));
      const crown = inked(new THREE.IcosahedronGeometry(1.7, 1), inkMat('#5f9e5a', false)); crown.position.set(x, 3.4, zb1 + 9); this.group.add(crown);
    }

    // ---- trains ----
    const hero = this.islands[cfg.hero];
    this.hero = this.tracks.find(t => t.island === hero && t.side === 'A');
    for (const tr of this.tracks) {
      tr.newTrain(tr === this.hero && hero.first ? MODEL_BY_ID[hero.first] : null);
      if (tr === this.hero) { tr.gapT = 0.4; continue; }
      if (Math.random() < 0.35) { tr.phase = 'dwell'; tr.t = 0.6; tr.frontX = tr.stopFront; }
      else tr.gapT = rand(0.5, 12);
    }
    for (const tr of this.tracks) for (let i = 0; i < Math.round(tr.target * 0.6); i++) this.spawnWaiting(tr, true);

    // bounds: the hero platform (like the single-platform view) and the whole station
    const zA = this.hero.z;
    this.heroBounds = new THREE.Box3(V(-LP / 2 - 1, -0.5, zA - 2.5), V(LP / 2 + 1, 4.2, hero.z0 + 7.5));
    this.allBounds = new THREE.Box3(V(BX0, -0.5, zFirst - 3), V(BX1, HB + 1.5, zb1 + 14));
  }

  // ---- passengers ----
  routeIn(tr) {
    const isl = tr.island, x = rand(this.xE0 + 1, this.xE1 - 1), ax = this.xg0 + Math.floor(rand(0, this.nG)) + 0.5;
    return [
      V(x, 0.1, this.zb1 - 1), V(ax, 0.1, this.zg + 1.3), V(ax, 0.1, this.zg - 1.3),
      V(this.xFootB - 0.8, 0.1, this.zs), V(this.xB0, HB, this.zs), V(this.xm, HB, this.zs), V(this.xm, HB, isl.zc),
      V(this.xB0 - 0.1, HB, isl.zc), V(isl.xFoot, isl.Hp, isl.zc), V(isl.xFoot - 0.8, isl.Hp, tr.lane),
    ];
  }
  routeOut(tr, fromX) {
    const isl = tr.island, ax = this.xg0 + Math.floor(rand(0, this.nG)) + 0.5;
    return [
      V(fromX, isl.Hp, tr.lane), V(isl.xFoot - 0.8, isl.Hp, tr.lane), V(isl.xFoot, isl.Hp, isl.zc), V(this.xB0 - 0.1, HB, isl.zc),
      V(this.xm, HB, isl.zc), V(this.xm, HB, this.zs), V(this.xB0, HB, this.zs), V(this.xFootB - 0.8, 0.1, this.zs),
      V(ax, 0.1, this.zg - 1.3), V(ax, 0.1, this.zg + 1.3), V(rand(this.xE0 + 1, this.xE1 - 1), 0.1, this.zb1 - 1),
      V(rand(this.xE0 - 20, this.xE1 + 20), 0.05, this.zb1 + 13),
    ];
  }
  arrive(tr) {
    return (pp) => { pp.face.set(0, 0, -tr.sgn); pp.arrived = true; if (tr.boardStart >= 0 && tr.phase === 'dwell' && !tr.closing) this.board(pp, tr, 0.2); };
  }
  // give a waiting passenger a queue slot on track tr (keeps the walk already under way)
  assign(p, tr) {
    const slot = tr.freeSlot();
    if (!slot) return false;
    p.slot = slot; slot.who = p; p.arrived = false;
    const H = tr.island.Hp;
    const tail = [V(slot.x, H, tr.lane), V(slot.x, H, slot.z)];
    if (p.path.length > 2 && p.inbound) p.path.splice(p.path.length - 2, 2, ...tail);
    else p.go([V(p.obj.position.x, H, tr.lane), ...tail], this.arrive(tr));
    return true;
  }
  spawnWaiting(tr, instant = false) {
    const slot = tr.freeSlot(); if (!slot) return;
    const p = new Person(); p.speed = SPEED_HUB + Math.random() * 0.5;
    p.role = 'wait'; p.track = tr; p.slot = slot; slot.who = p;
    this.group.add(p.obj); this.people.push(p);
    const H = tr.island.Hp;
    if (instant) { p.place(V(slot.x, H, slot.z)); p.face.set(0, 0, -tr.sgn); p.arrived = true; return; }
    p.place(V(rand(this.xE0 - 25, this.xE1 + 25), 0.05, this.zb1 + 13));
    p.inbound = true;
    p.go([...this.routeIn(tr), V(slot.x, H, tr.lane), V(slot.x, H, slot.z)], (pp) => { pp.inbound = false; this.arrive(tr)(pp); });
  }
  spawnAlighting(tr) {
    if (!tr.doorsW.length) return;
    const n = 2 + Math.floor(Math.random() * Math.min(7, tr.doorsW.length * 2));
    const H = tr.island.Hp;
    for (let i = 0; i < n; i++) {
      const d = pick(tr.doorsW), off = rand(-0.3, 0.3);
      const p = new Person(); p.speed = SPEED_HUB + Math.random() * 0.5;
      p.role = 'alight'; p.track = tr; p.near = true; p.obj.visible = false;
      p.place(V(d, H, tr.zE - tr.sgn * 0.8));
      this.group.add(p.obj); this.people.push(p);
      p.delay = i * 0.45 + Math.random() * 0.3;
      p.pending = [V(d + off, H, tr.zE + tr.sgn * 1.0), ...this.routeOut(tr, d + off)];
    }
  }
  board(p, tr, delay) {
    if (p.role !== 'wait') return;
    p.role = 'board'; p.boardAt = this.time + delay; p.boardGo = false;
  }
  startBoarding(tr) {
    // queued passengers board front-first; those already on the platform hurry to the nearest door,
    // anyone still on the stairs or bridge keeps walking and boards on arrival if the doors are open
    const isl = tr.island;
    for (const p of this.people) {
      if (p.track !== tr || p.role !== 'wait' || !p.slot) continue;
      const onIsland = Math.abs(p.obj.position.y - isl.Hp) < 0.08 && Math.abs(p.obj.position.z - isl.zc) < WI / 2;
      if (p.arrived) this.board(p, tr, 0.3 + p.slot.k * 0.75 + Math.random() * 0.35);
      else if (onIsland) this.board(p, tr, 0);
    }
  }
  remove(p) {
    this.group.remove(p.obj);
    this.people.splice(this.people.indexOf(p), 1);
    if (p.slot) p.slot.who = null;
  }
  update(dt) {
    this.time = (this.time || 0) + dt;
    for (const tr of this.tracks) tr.update(dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = rand(0.25, 0.6);
      const open = this.tracks.filter(t => t.phase !== 'dwell' && t.waiting() < t.target);
      if (open.length) this.spawnWaiting(pick(open));
    }
    for (const p of this.people.slice()) {
      const tr = p.track;
      if (p.role === 'alight' && p.delay > 0) {
        p.delay -= dt;
        if (p.delay <= 0) { p.obj.visible = true; p.go(p.pending, (pp) => this.remove(pp)); }
        continue;
      }
      if (p.role === 'alight' && p.near && (p.obj.position.z - tr.zE) * tr.sgn > 1.2) p.near = false;
      if (p.role === 'board' && !p.boardGo && this.time >= p.boardAt) {
        p.boardGo = true;
        let d = p.slot.door, sx = p.slot.x;
        if (!p.arrived) { const px = p.obj.position.x; d = tr.doorsW.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a), d); sx = d; p.speed *= 1.4; }
        p.slot.who = null; p.slot = null; p.inbound = false;
        const H = tr.island.Hp;
        p.go([V(d + (sx - d) * 0.4, H, tr.zE + tr.sgn * 0.7), V(d, H, tr.zE - tr.sgn * 0.9)], (pp) => { this.boarded++; this.remove(pp); });
      }
      p.update(dt, null);
      if (p.role === 'board' && p.boardGo) p.obj.visible = (p.obj.position.z - tr.zE) * tr.sgn > -0.5;
    }
  }
  get waitingCount() { return this.people.filter(p => p.role === 'wait' || p.role === 'board').length; }
  forceHero(model) { this.hero.forced = model; }
  dispose() { disposeTree(this.group); }
}

function cylAt(x, z, r, h, color) { const c = cyl(r, r, h, color, 12); c.position.set(x, 0.1 + h / 2, z); return c; }

function facade(cfg, st, X0, X1, z, xE0, xE1) {
  const g = new THREE.Group();
  const H = 3.2, T = 0.6;
  g.add(boxSpan(X0, xE0, 0.1, H, z - T, z, st.wall));
  g.add(boxSpan(xE1, X1, 0.1, H, z - T, z, st.wall));
  g.add(boxSpan(X0, X1, H, H + 0.25, z - T - 0.1, z + 0.1, st.trim));
  if (cfg.style === 'brick') {
    for (const y of [1.0, 2.1]) {
      g.add(boxSpan(X0, xE0, y, y + 0.18, z - 0.02, z + 0.04, st.trim, { edges: false, hull: false }));
      g.add(boxSpan(xE1, X1, y, y + 0.18, z - 0.02, z + 0.04, st.trim, { edges: false, hull: false }));
    }
    for (const x of [X0 + 7, X1 - 7]) {
      const t = cyl(6, 6, 7, st.wall, 8); t.position.set(x, 3.6, z - 6); g.add(t);
      g.add(boxSpan(x - 6.2, x + 6.2, 7.0, 7.4, z - 12.2, z + 0.2, st.trim));
      const dome = inked(new THREE.SphereGeometry(5.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), inkMat(st.roof, false));
      dome.position.set(x, 7.4, z - 6); g.add(dome);
    }
  } else if (cfg.style === 'tower') {
    for (const x of [X0 + 9, X1 - 9]) { const t = cyl(7, 7, 12, st.trim, 20); t.position.set(x, 6.1, z - 9); g.add(t); }
  } else if (cfg.style === 'tw') {
    // green-tiled eave along the facade
    for (const [a, b] of [[X0, xE0], [xE1, X1], [xE0, xE1]]) g.add(boxSpan(a - 0.4, b + 0.4, H + 0.25, H + 0.55, z - T - 1.2, z + 0.8, st.roof));
    for (let x = X0 + 2; x < X1; x += 6) if (x < xE0 || x > xE1) g.add(boxSpan(x - 0.3, x + 0.3, 0.1, H, z - 0.05, z + 0.25, st.trim));
  } else {
    // mullions / window grid
    for (let x = X0 + 2; x < X1; x += 3) if (x < xE0 || x > xE1) g.add(boxSpan(x - 0.08, x + 0.08, 0.1, H, z - 0.02, z + 0.06, st.trim, { edges: false, hull: false }));
  }
  // name board over the entrance
  const tex = canvasBoard(1024, 256, (c) => {
    c.fillStyle = cfg.style === 'tw' ? '#a63a2c' : '#fbfaf6'; c.fillRect(0, 0, 1024, 256);
    c.fillStyle = cfg.style === 'tw' ? '#fbfaf6' : '#1c1a1e'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 120px ${FONT}`; c.fillText(cfg.name, 512, 105);
    c.font = `700 46px "JetBrains Mono",monospace`; c.fillText(cfg.ro.toUpperCase() + ' STATION', 512, 205);
    c.strokeStyle = '#1c1a1e'; c.lineWidth = 12; c.strokeRect(6, 6, 1012, 244);
  });
  const xc = (xE0 + xE1) / 2;
  for (const dx of [-5, 5]) g.add(boxSpan(xc + dx - 0.12, xc + dx + 0.12, 0.1, 5.6, z - 0.3, z, '#5a5d63'));
  const b = texturedBoard(12, 3, 0.2, tex); b.position.set(xc, 5.2, z - 0.15); g.add(b);
  return g;
}
