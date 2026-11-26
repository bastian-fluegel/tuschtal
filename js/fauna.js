import { BARK, PUFF } from './nature.js';
import { G, pos } from './state.js';
import { GLOW, scene } from './engine.js';
import { MAT, U } from './shaders.js';
import { P, merge } from './geometry.js';
import { height } from './terrain.js';
import { nearHouse } from './world.js';
import { sfx } from './audio.js';

/* ---------- LEBEN IN DER WELT: Tiere, Insekten, Fische ---------- */
export const DEER = '#c98140', DEER2 = '#bb7438', RAB = '#b89c7c', WHITEISH = '#f2ece0';
export const GEO_A = {
  deer: merge([P('ico', DEER, 0, 1.05, 0, .32, .34, .62), P('cyl', DEER2, 0, 1.38, .55, .085, .5, .085, 0, .5), P('ico', DEER2, 0, 1.64, .78, .13, .14, .22),
    P('ico', BARK, 0, 1.6, .99, .05, .05, .05), P('cone', DEER2, .09, 1.8, .7, .045, .13, .045), P('cone', DEER2, -.09, 1.8, .7, .045, .13, .045), P('ico', WHITEISH, 0, 1.16, -.6, .07, .09, .05), P('ico', WHITEISH, 0, .9, 0, .2, .12, .45)]),
  leg: merge([P('box', '#7a5233', .13, -.45, 0, .06, .9, .06), P('box', '#7a5233', -.13, -.45, 0, .06, .9, .06)]),
  rabbit: merge([P('ico', RAB, 0, .2, 0, .17, .16, .25), P('ico', RAB, 0, .33, .2, .11, .1, .12), P('box', RAB, .04, .5, .15, .03, .2, .06, 0, -.25), P('box', RAB, -.04, .5, .15, .03, .2, .06, 0, -.25), P('ico', WHITEISH, 0, .23, -.25, .07, .07, .07), P('ico', WHITEISH, 0, .12, .02, .11, .07, .17), P('ico', BARK, 0, .32, .31, .025, .025, .025)]),
  fish: merge([P('ico', '#7d93a3', 0, 0, 0, .1, .12, .32), P('cone', '#6a7f8f', 0, 0, -.38, .1, .18, .1, 0, -Math.PI / 2)])
};
export function inked(geo) { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, MAT.animal), new THREE.Mesh(geo, MAT.hull)); return g; }
export const animals = [];
export function spawnAnimal(a) {
  for (let i = 0; i < 14; i++) {
    const ang = Math.random() * 6.28, r = 25 + Math.random() * 50, x = pos.x + Math.cos(ang) * r, z = pos.z + Math.sin(ang) * r, h = height(x, z);
    if (h > 1.5 && h < 14 && !nearHouse(x, z, 2)) { a.x = x; a.z = z; a.dir = Math.random() * 6.28; a.tdir = a.dir; a.state = 'idle'; a.timer = Math.random() * 4; return; }
  }
  a.x = pos.x + 999; a.z = pos.z;
}
export function makeAnimals() {
  for (let i = 0; i < 7; i++) {
    const g = inked(GEO_A.deer), fl = inked(GEO_A.leg), bl = inked(GEO_A.leg);
    fl.position.set(0, .9, .38); bl.position.set(0, .9, -.38); g.add(fl, bl); scene.add(g);
    animals.push({ type: 'deer', g, legs: [fl, bl], phase: 0 });
  }
  for (let i = 0; i < 10; i++) { const g = inked(GEO_A.rabbit); scene.add(g); animals.push({ type: 'rabbit', g, phase: 0 }); }
  animals.forEach(spawnAnimal);
}
export function updateAnimals(dt) {
  for (const a of animals) {
    const dx = a.x - pos.x, dz = a.z - pos.z, d = Math.hypot(dx, dz);
    if (d > 95) { spawnAnimal(a); continue; }
    const fear = (a.type === 'deer' ? 11 : 6.5) * (G.moving ? 1 : .35);
    if (d < fear && !G.paused) { if (a.state !== 'flee') a.timer = 2 + Math.random() * 2; a.state = 'flee'; a.tdir = Math.atan2(dx, dz) + (Math.random() - .5) * .4; }
    a.timer -= dt;
    if (a.timer <= 0) {
      if (a.state === 'idle') { a.state = 'walk'; a.tdir = a.dir + (Math.random() - .5) * 2.6; a.timer = 2 + Math.random() * 4; }
      else { a.state = 'idle'; a.timer = 2 + Math.random() * 6; }
    }
    const sp = a.state === 'flee' ? (a.type === 'deer' ? 8 : 6) : a.state === 'walk' ? (a.type === 'deer' ? 1.3 : 1.1) : 0;
    const da = ((a.tdir - a.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.dir += da * Math.min(1, dt * 4);
    const nx = a.x + Math.sin(a.dir) * sp * dt, nz = a.z + Math.cos(a.dir) * sp * dt, h = height(nx, nz);
    if (h < .4 || h > 18 || nearHouse(nx, nz, .5)) a.tdir = a.dir + Math.PI * (.7 + Math.random() * .6);
    else { a.x = nx; a.z = nz; }
    a.phase += dt * Math.max(sp, .001) * (a.type === 'deer' ? 2.2 : 3.6);
    let y = height(a.x, a.z) - .05;
    if (a.type === 'rabbit' && sp > 0) y += Math.abs(Math.sin(a.phase)) * (a.state === 'flee' ? .45 : .25);
    a.g.position.set(a.x, y, a.z); a.g.rotation.y = a.dir;
    if (a.legs) { const s = Math.sin(a.phase) * Math.min(1, sp / 2) * .55; a.legs[0].rotation.x = s; a.legs[1].rotation.x = -s; }
    if (sp === 0) a.g.rotation.x = Math.sin(performance.now() / 900 + a.x) * .03;
  }
}
/* Vögel: kleine Tusche-Vs am Himmel */
export const INKMAT = new THREE.MeshBasicMaterial({ color: '#3a332d' });
export const WINGL = new THREE.BoxGeometry(.7, .03, .16).translate(.35, 0, 0), WINGR = new THREE.BoxGeometry(.7, .03, .16).translate(-.35, 0, 0);
export const flocks = [];
export function makeBirds() {
  for (let f = 0; f < 2; f++) {
    const fl = { cx: pos.x, cz: pos.z, ang: Math.random() * 6.28, r: 30 + f * 20, sp: (.12 + Math.random() * .08) * (f ? -1 : 1), h: 16 + f * 6, birds: [] };
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group(), l = new THREE.Mesh(WINGL, INKMAT), r = new THREE.Mesh(WINGR, INKMAT); g.add(l, r); scene.add(g);
      const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2);
      fl.birds.push({ g, l, r, ox: side * k * 1.4, oz: -k * 1.2, oy: Math.random() * .6, ph: Math.random() * 6 });
    }
    flocks.push(fl);
  }
}
export function updateBirds(dt, t) {
  const show = U.uDay.value > .3;
  for (const fl of flocks) {
    if (Math.hypot(fl.cx - pos.x, fl.cz - pos.z) > 110) { fl.cx = pos.x; fl.cz = pos.z; }
    fl.ang += fl.sp * dt;
    const x = fl.cx + Math.cos(fl.ang) * fl.r, z = fl.cz + Math.sin(fl.ang) * fl.r, dir = Math.atan2(-Math.sin(fl.ang) * fl.sp, Math.cos(fl.ang) * fl.sp);
    const base = Math.max(height(x, z), 0) + fl.h;
    for (const b of fl.birds) {
      b.g.visible = show; if (!show) continue;
      const c = Math.cos(dir), s = Math.sin(dir);
      b.g.position.set(x + b.ox * c + b.oz * s, base + b.oy + Math.sin(t * .7 + b.ph) * .4, z - b.ox * s + b.oz * c);
      b.g.rotation.y = dir; const w = Math.sin(t * 7 + b.ph) * .55; b.l.rotation.z = w; b.r.rotation.z = -w;
    }
  }
}
/* Schmetterlinge am Tag, Glühwürmchen in der Nacht */
export const flies = [], bugs = [];
export function makeBugs() {
  const WB = new THREE.PlaneGeometry(.14, .11).translate(.07, 0, 0), WB2 = new THREE.PlaneGeometry(.14, .11).translate(-.07, 0, 0);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.MeshBasicMaterial({ color: PUFF[i % PUFF.length], side: THREE.DoubleSide });
    const g = new THREE.Group(), l = new THREE.Mesh(WB, m), r = new THREE.Mesh(WB2, m); l.rotation.x = r.rotation.x = -Math.PI / 2;
    const lw = new THREE.Group(), rw = new THREE.Group(); lw.add(l); rw.add(r); g.add(lw, rw); scene.add(g);
    flies.push({ g, lw, rw, x: pos.x, z: pos.z, vx: 0, vz: 0, ph: Math.random() * 6 });
  }
  for (let i = 0; i < 36; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xd8ff7a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(.35); scene.add(s); bugs.push({ s, x: pos.x, z: pos.z, y: 1, ph: Math.random() * 6, sp: .5 + Math.random() });
  }
}
export function updateBugs(dt, t) {
  const day = U.uDay.value;
  for (const f of flies) {
    const vis = day > .45; f.g.visible = vis; if (!vis) continue;
    if (Math.hypot(f.x - pos.x, f.z - pos.z) > 20) { const a = Math.random() * 6.28, r = 4 + Math.random() * 12; f.x = pos.x + Math.cos(a) * r; f.z = pos.z + Math.sin(a) * r; }
    f.vx += (Math.random() - .5) * dt * 6; f.vz += (Math.random() - .5) * dt * 6; f.vx *= .97; f.vz *= .97;
    f.x += f.vx * dt; f.z += f.vz * dt;
    const h = height(f.x, f.z); if (h < 0) { f.vx = -f.vx; f.vz = -f.vz; }
    f.g.position.set(f.x, Math.max(h, 0) + .7 + Math.sin(t * 2 + f.ph) * .35, f.z); f.g.rotation.y = Math.atan2(f.vx, f.vz);
    const w = Math.sin(t * 18 + f.ph) * .9; f.lw.rotation.z = w; f.rw.rotation.z = -w;
  }
  for (const b of bugs) {
    const vis = day < .4; b.s.visible = vis; if (!vis) continue;
    if (Math.hypot(b.x - pos.x, b.z - pos.z) > 22) { const a = Math.random() * 6.28, r = 3 + Math.random() * 18; b.x = pos.x + Math.cos(a) * r; b.z = pos.z + Math.sin(a) * r; }
    b.x += Math.sin(t * b.sp + b.ph) * dt * .6; b.z += Math.cos(t * b.sp * .8 + b.ph) * dt * .6;
    b.s.position.set(b.x, Math.max(height(b.x, b.z), 0) + .5 + Math.sin(t * .9 + b.ph) * .5 + b.sp * .6, b.z);
    b.s.material.opacity = Math.pow(Math.max(0, Math.sin(t * 1.7 * b.sp + b.ph)), 3) * (1 - day * 2.2);
  }
}
/* Springende Fische */
export const RINGT = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, 6.28); x.stroke(); return new THREE.CanvasTexture(cv); })();
export const fish = inked(GEO_A.fish); fish.visible = false; scene.add(fish);
export const rings = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: RINGT, transparent: true, depthWrite: false, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.position.y = .03; m.userData.life = 0; scene.add(m); return m; });
export let fishT = 3, jump = null;
export function splash(x, z) { const r = rings.find(r => r.userData.life <= 0) || rings[0]; r.position.set(x, .03, z); r.userData.life = 1; sfx('splash', Math.hypot(x - pos.x, z - pos.z)); }
export function updateFish(dt) {
  if (!jump && (fishT -= dt) < 0) {
    fishT = 4 + Math.random() * 6;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28, r = 8 + Math.random() * 28, x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
      if (height(x, z) < -1.5) { jump = { x, z, dir: Math.random() * 6.28, t: 0 }; splash(x, z); break; }
    }
  }
  if (jump) {
    jump.t += dt / 1.1; const k = jump.t;
    fish.visible = true;
    fish.position.set(jump.x + Math.sin(jump.dir) * k * 2.6, Math.sin(Math.PI * k) * 1.5 - .1, jump.z + Math.cos(jump.dir) * k * 2.6);
    fish.rotation.set(-Math.cos(Math.PI * k) * 1.1, jump.dir, 0);
    if (k >= 1) { splash(fish.position.x, fish.position.z); fish.visible = false; jump = null; }
  }
  for (const r of rings) { if (r.userData.life <= 0) continue; r.userData.life -= dt / 1.4; const k = 1 - r.userData.life; r.scale.setScalar(.4 + k * 2.6); r.material.opacity = r.userData.life * .8; }
}

