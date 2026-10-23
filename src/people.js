// Tiny passengers that walk along waypoint paths.
import * as THREE from 'three';
import { inked, inkMat } from './ink.js';

const BODY_COLS = ['#e0574a', '#3f7fd0', '#f2b33d', '#4fa36b', '#8e6bbf', '#2c3e50', '#e98fb0', '#e7e2d6', '#c96f3b', '#5bb3c9'];
const SKIN = ['#f1c9a5', '#e2b48e', '#c99a72'];
const HAIR = ['#2a2420', '#4a3426', '#6b6b6b', '#1c1a1e'];
const bodyGeo = new THREE.CapsuleGeometry(0.21, 0.72, 4, 10);
const headGeo = new THREE.SphereGeometry(0.15, 12, 10);
const hairGeo = new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
const legGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.5, 8);
const bagGeo = new THREE.BoxGeometry(0.32, 0.26, 0.14);
for (const g of [bodyGeo, headGeo, hairGeo, legGeo, bagGeo]) g.userData.keep = true;

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Person {
  constructor() {
    const g = new THREE.Group();
    const s = 0.92 + Math.random() * 0.14;
    const torso = inked(bodyGeo, inkMat(pick(BODY_COLS), false)); torso.position.y = 0.98; g.add(torso);
    const head = inked(headGeo, inkMat(pick(SKIN), false)); head.position.y = 1.58; g.add(head);
    const hair = inked(hairGeo, inkMat(pick(HAIR), false), { hull: false }); hair.position.y = 1.6; g.add(hair);
    const legC = inkMat(pick(['#2b2e36', '#3d4a63', '#5a4a3a', '#2b2e36']), false);
    this.legs = [-0.09, 0.09].map(z => { const l = inked(legGeo, legC); l.position.set(0, 0.32, z); g.add(l); return l; });
    if (Math.random() < 0.45) { const b = inked(bagGeo, inkMat(pick(['#7a4b33', '#1c1a1e', '#c94f3d', '#e2d7bf']), false)); b.position.set(0.0, 0.9, 0.27); g.add(b); }
    g.scale.setScalar(s);
    this.obj = g;
    this.path = []; this.speed = 1.9 + Math.random() * 0.6; this.phase = Math.random() * 6;
    this.state = 'idle'; this.onDone = null; this.face = new THREE.Vector3(0, 0, -1);
    this.gy = 0; // ground height when waypoints carry their own y (no floorY function)
  }
  place(v) { this.obj.position.copy(v); this.gy = v.y; }
  go(points, onDone, state = 'walk') {
    this.path = points.map(p => p.clone()); this.onDone = onDone; this.state = state;
    this.from = new THREE.Vector3(this.obj.position.x, this.gy, this.obj.position.z);
  }
  update(dt, floorY) {
    const p = this.obj.position;
    if (this.path.length) {
      const tgt = this.path[0];
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) { p.x = tgt.x; p.z = tgt.z; this.from = tgt.clone(); this.gy = tgt.y; this.path.shift(); }
      else { p.x += dx / d * step; p.z += dz / d * step; this.face.set(dx / d, 0, dz / d); }
      this.phase += dt * this.speed * 6.5;
      const sw = Math.sin(this.phase) * 0.35;
      this.legs[0].rotation.z = sw; this.legs[1].rotation.z = -sw;
      if (!floorY && this.path.length) {
        const t2 = this.path[0], f = this.from;
        const seg = Math.hypot(t2.x - f.x, t2.z - f.z), rem = Math.hypot(t2.x - p.x, t2.z - p.z);
        this.gy = seg > 1e-4 ? f.y + (t2.y - f.y) * (1 - rem / seg) : t2.y;
      }
      p.y = (floorY ? floorY(p.x, p.z) : this.gy) + Math.abs(Math.sin(this.phase)) * 0.04;
      if (!this.path.length) { this.legs[0].rotation.z = this.legs[1].rotation.z = 0; const cb = this.onDone; this.onDone = null; this.state = 'idle'; cb && cb(this); }
    } else p.y = floorY ? floorY(p.x, p.z) : this.gy;
    const yaw = Math.atan2(-this.face.z, this.face.x);
    this.obj.rotation.y = yaw;
  }
}
