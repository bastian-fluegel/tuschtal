/* ============================================================
   MODUL: SPIELGEFÜHL
   Sammeln braucht einen Moment: Der Aktionsknopf füllt sich, die Kamera
   bückt sich, beim Holz gibt es Axthiebe. Dazu Farbspritzer als Partikel,
   schwebende Zahlen („+3 Beeren“), aufleuchtende Werte, ein hüpfender
   Rucksack, Schritte und leichtes Wippen beim Gehen, ein weiches Landen
   und beim Schlafen eine Uhr, die sichtbar vorläuft.
   Abschalten: config.js → FEATURES.feel = false (Aktionen laufen dann sofort).
   Andockpunkte: intercept (Fortschritt), fx (Ereignisse), rest (Schlaf).
   ============================================================ */
import { $, ITEMS, FOODS, STATS, clamp } from '../config.js';
import { G, S, T, pos } from '../state.js';
import { cam, scene } from '../engine.js';
import { U } from '../shaders.js';
import { height } from '../terrain.js';
import { sfx } from '../audio.js';

const CALM = matchMedia('(prefers-reduced-motion: reduce)');
const _v = new THREE.Vector3(), _t = new THREE.Vector3();

/* ---------- Farben: Pigmente je Gegenstand ---------- */
const COL = {
  berries: ['#7d2f4a', '#a8435e', '#5f7d3a'], apples: ['#c0442f', '#d8743a', '#7a9a45'],
  wood: ['#8a6038', '#b48a58', '#6b4a2c'], mushrooms: ['#c9a27a', '#a8553e', '#efe1c6'],
  herbs: ['#6f8f46', '#9ab35a', '#4e6e34'], fish: ['#7f97a8', '#4f86b3', '#dfe7ef'],
  water: ['#4f86b3', '#7fb0d6', '#dfe9f2'], stone: ['#9a948b', '#7d776f', '#c4bdb2'],
  fiber: ['#b5a55a', '#8fa04e', '#d6c98a'], clay: ['#b07a52', '#8f5e3e', '#c99a72']
};
const DEFAULT = ['#c98b3e', '#efd29b', '#8a6038'];
const SPARK = ['#ffcf5a', '#e86a2a', '#ffe7a8'], DUST = ['#d8ccb4', '#b7afa3', '#efe6d2'], CRUMB = ['#f2b8ae', '#b7afa3', '#d8ccb4'];
const pick = a => a[Math.floor(Math.random() * a.length)];
/* kurzes Brummen auf dem Handy (Android; iPhones unterstützen das nicht) */
const buzz = ms => { if (G.coarse && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } };

/* ---------- Partikel: kleine Pigmentflecken ---------- */
function blotTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05, r = 6 + (i % 3) * 3, cx = 32 + Math.cos(a) * 7, cy = 32 + Math.sin(a) * 6;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r + 12);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.72, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r + 12, 0, 6.28); x.fill();
  }
  return new THREE.CanvasTexture(cv);
}
const parts = [];
function makeParticles() {
  const tex = blotTex();
  for (let i = 0; i < 120; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; s.renderOrder = 3; scene.add(s);
    parts.push({ s, v: new THREE.Vector3(), c: new THREE.Color(), age: 0, life: 0, grav: 9, size: .2, home: false, glow: false });
  }
}
/* burst: n Flecken an einer Stelle. o: speed, up, grav, size, life, home (fliegen zum Spieler), glow (nachts hell) */
function burst(x, y, z, cols, n, o = {}) {
  const sp = o.speed ?? 2.2, up = o.up ?? 2.5;
  for (let i = 0; i < n; i++) {
    const p = parts.find(q => q.life <= 0); if (!p) return;
    const a = Math.random() * 6.283, r = sp * (.4 + Math.random() * .6);
    p.s.position.set(x + (Math.random() - .5) * .2, y + (Math.random() - .5) * .2, z + (Math.random() - .5) * .2);
    p.v.set(Math.cos(a) * r, up * (.5 + Math.random() * .7), Math.sin(a) * r);
    p.c.set(pick(cols)); p.age = 0; p.life = (o.life ?? .9) * (.75 + Math.random() * .5);
    p.grav = o.grav ?? 9; p.size = (o.size ?? .18) * (.7 + Math.random() * .6);
    p.home = !!o.home && i % 2 === 0; p.glow = !!o.glow;
    p.s.material.rotation = Math.random() * 6.283; p.s.visible = true;
  }
}
function updateParticles(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.age += dt; p.life -= dt;
    if (p.home && p.age > .25) {       /* ein Teil der Ernte fliegt sichtbar zum Spieler */
      _t.copy(cam.position); _t.y -= 1; _v.subVectors(_t, p.s.position);
      const dist = _v.length(); if (dist < 1.1) p.life = 0;
      p.size = Math.min(p.size, .05 + dist * .06);       /* kleiner werden, nicht vor der Linse verschmieren */
      p.v.lerp(_v.normalize().multiplyScalar(9), Math.min(1, dt * 6));
    } else p.v.y -= p.grav * dt;
    p.s.position.addScaledVector(p.v, dt);
    const sc = p.size * (1 + p.age * .6); p.s.scale.set(sc, sc, 1);
    p.s.material.color.copy(p.c); if (!p.glow) p.s.material.color.multiply(U.uTint.value);
    p.s.material.opacity = Math.min(1, p.age / .08) * Math.min(1, p.life / .25) * .9;
    if (p.life <= 0) p.s.visible = false;
  }
}

/* ---------- Schwebende Texte und HUD-Rückmeldung ---------- */
let layer = null, btn = null, fade = null;
function floatText(at, text) {
  let x = innerWidth / 2, y = innerHeight * .44;
  if (at) { _v.set(at.x, at.y, at.z).project(cam); if (_v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1) { x = (_v.x + 1) / 2 * innerWidth; y = (1 - _v.y) / 2 * innerHeight; } }
  const el = document.createElement('div'); el.className = 'fx-float'; el.textContent = text;
  el.style.left = clamp(x, 70, innerWidth - 70) + 'px'; el.style.top = clamp(y, 90, innerHeight - 140) + 'px';
  el.addEventListener('animationend', () => el.remove()); layer.appendChild(el);
}
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
let bumpT = 0;
function bump() { const inv = $('#inv'); replay(inv, 'fx-bump'); clearTimeout(bumpT); bumpT = setTimeout(() => inv.classList.remove('fx-bump'), 500); }
/* Werte beobachten: springt einer nach oben, leuchtet der Balken und zeigt +N */
let prevS = null;
function watchStats() {
  if (!prevS) { prevS = { ...S }; return; }
  const dark = fade.classList.contains('on');
  for (const [k] of STATS) {
    const d = S[k] - prevS[k]; prevS[k] = S[k];
    if (d < 1.5 || dark) continue;
    const row = $('#st-' + k); if (!row) continue;
    replay(row, 'fx-up');
    const chip = document.createElement('span'); chip.className = 'fx-chip'; chip.textContent = '+' + Math.round(d);
    chip.addEventListener('animationend', () => chip.remove()); row.appendChild(chip);
  }
}

/* ---------- Ereignisse aus Kern und Modulen ---------- */
const front = (d, h) => ({ x: pos.x - Math.sin(G.yaw) * d, y: pos.y + h, z: pos.z - Math.cos(G.yaw) * d });
function fx(kind, d) {
  if (kind === 'gain') {
    const I = ITEMS[d.k], at = d.x !== undefined ? d : front(1.1, 1.1);
    burst(at.x, at.y, at.z, COL[d.k] || DEFAULT, 8 + Math.min(8, d.n * 2), { home: true });
    floatText(at, `+${d.n} ${I ? (d.n === 1 ? I.one : I.name) : d.k}`);
    sfx('gain'); bump(); buzz(18);
  } else if (kind === 'eat') {
    const f = FOODS[d.k]; sfx(f && !f.food ? 'gulp' : 'crunch');
  } else if (kind === 'drink') {
    const at = front(.9, .9); burst(at.x, at.y, at.z, COL.water, 8, { speed: 1.2, up: 1.5, size: .12, life: .6 });
    sfx('gulp');
  } else if (kind === 'fire') {
    burst(d.x, d.y + .2, d.z, SPARK, 14, { speed: 1, up: 3, grav: -1.5, size: .1, life: 1.2, glow: true });
    sfx('whoosh');
  } else if (kind === 'done') { sfx('chime'); bump(); }
  else if (kind === 'build') { buzz(10); burst(d.x, d.y + .1, d.z, DUST, 14, { speed: 2.6, up: 1, grav: 3, size: .3, life: .8 }); sfx('thock'); }
  else if (kind === 'erase') { burst(d.x, d.y + .6, d.z, CRUMB, 16, { speed: 2, up: 2.5, size: .16, life: .8 }); sfx('erase'); }
}

/* ---------- Arbeiten mit Fortschritt ---------- */
const ch = { a: null, t: 0, dur: 1, x0: 0, z0: 0, n: 0, tick: 0 };
const CHOP_HITS = [.3, .62, .94];
function intercept(a) {
  if (ch.a) return true;                     /* läuft schon: nicht doppelt starten */
  if (!a.work || G.build) return false;
  Object.assign(ch, { a, t: 0, dur: a.work, x0: pos.x, z0: pos.z, n: 0, tick: 0 });
  if (a.anim === 'scoop') sfx('scoop');
  if (a.anim === 'stoke' || a.anim === 'pick') sfx('rustle');
  btn.style.setProperty('--p', '0%'); btn.classList.add('fx-work');
  return true;
}
function stopWork() { ch.a = null; btn.classList.remove('fx-work'); btn.style.removeProperty('--p'); }
function workTick(dt, k) {
  const a = ch.a, at = a.at;
  if (a.anim === 'chop') {
    if (ch.n < CHOP_HITS.length && k >= CHOP_HITS[ch.n]) {
      ch.n++; sfx('chop'); shake = 1; buzz(12);
      if (at) burst(at.x, at.y + 1, at.z, COL.wood, 5, { speed: 2.4, up: 2, size: .12, life: .6 });
    }
  } else if (a.anim === 'pick') {
    if ((ch.tick += dt) > .22) { ch.tick = 0; sfx('rustle'); if (at) burst(at.x, at.y + .4, at.z, COL[at.fk] || DEFAULT, 2, { speed: 1, up: 1.4, size: .1, life: .5 }); }
  } else if (a.anim === 'scoop') {
    if (ch.n === 0 && k > .55) { ch.n = 1; const w = front(.9, .4); burst(w.x, w.y, w.z, COL.water, 7, { speed: 1, up: 2.2, size: .1, life: .6 }); }
  }
}
function updateWork(dt) {
  if (!ch.a) return;
  if (G.build || Math.hypot(pos.x - ch.x0, pos.z - ch.z0) > .6) { stopWork(); return; }
  ch.t += dt; const k = Math.min(1, ch.t / ch.dur);
  btn.style.setProperty('--p', (k * 100).toFixed(1) + '%');
  workTick(dt, k);
  if (k >= 1) { const a = ch.a; stopWork(); a.run(); }
}

/* ---------- Kamera: bücken, Hiebe, Wippen, Landen ---------- */
const DIP = { pick: [.32, .22], scoop: [.45, .42], stoke: [.3, .3], chop: [.05, .06] };
let dipY = 0, dipP = 0, shake = 0, bobAmp = 0, stepAcc = 0, land = 0, lastVy = 0, wasGround = true, lx = 0, lz = 0;
function steps(dt) {
  const d = Math.hypot(pos.x - lx, pos.z - lz); lx = pos.x; lz = pos.z;
  if (!G.onGround && !G.fly) lastVy = Math.min(lastVy, G.vy);
  if (G.onGround && !wasGround && lastVy < -7) {
    const f = Math.min(1, -lastVy / 16); land = .16 * f; sfx('land');
    burst(pos.x, pos.y + .05, pos.z, DUST, 6, { speed: 1.6, up: .6, grav: 2, size: .25, life: .6 });
  }
  if (G.onGround) lastVy = 0;
  wasGround = G.onGround;
  const walking = G.onGround && !G.fly && d > .001 && d < 1;
  bobAmp += ((walking ? 1 : 0) - bobAmp) * Math.min(1, dt * 8);
  if (!walking) return;
  const stride = G.running ? 1.3 : .95; stepAcc += d;
  if (stepAcc >= stride) {
    stepAcc -= stride;
    const g = Math.max(height(pos.x, pos.z), -1.2);
    sfx(pos.y - g > .08 ? 'stepWood' : g < -.05 ? 'stepWater' : 'step');
  }
}
function camera(dt, ts) {
  const [ty, tp] = ch.a && DIP[ch.a.anim] ? DIP[ch.a.anim] : [0, 0], e = ch.a ? Math.sin(Math.min(1, ch.t / ch.dur) * Math.PI) * .5 + .5 : 0;
  dipY += (ty * e - dipY) * Math.min(1, dt * 9); dipP += (tp * e - dipP) * Math.min(1, dt * 9);
  shake *= Math.exp(-dt * 11); land *= Math.exp(-dt * 9);
  if (CALM.matches) return;
  const bob = (Math.abs(Math.sin(stepAcc / (G.running ? 1.3 : .95) * Math.PI)) - .5) * .045 * bobAmp;
  cam.position.y += bob - dipY - land;
  cam.rotation.x = clamp(G.pitch - dipP - shake * .035, -1.5, 1.5);
  cam.rotation.z = Math.sin(ts * 47) * shake * .012;
}

/* ---------- Schlafen: die Uhr läuft sichtbar vor ---------- */
const hhmm = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 6) * 10; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
function rest(before) {
  const b = before.T, total = Math.max(0, (T.day - b.day) * 24 + T.hour - b.hour);
  if (total < .25) return 0;
  const e0 = before.S.energy, e1 = S.energy, dur = Math.min(2600, 900 + total * 170);
  const box = document.createElement('div'); box.className = 'fx-rest';
  box.innerHTML = '<span class="clk"></span><span class="day"></span><span class="bar"><b></b></span><span class="lbl">Energie</span>';
  fade.appendChild(box);
  const clk = box.querySelector('.clk'), day = box.querySelector('.day'), bar = box.querySelector('.bar b'), t0 = performance.now();
  const step = () => {
    if (!box.isConnected) return;
    const k = Math.min(1, (performance.now() - t0) / dur), s = k * k * (3 - 2 * k), h = b.hour + total * s;
    clk.textContent = hhmm(h); day.textContent = 'Tag ' + (b.day + Math.floor(h / 24));
    bar.style.width = (e0 + (e1 - e0) * s).toFixed(1) + '%';
    if (k < 1) requestAnimationFrame(step);
  };
  step();
  return dur + 250;
}

/* ---------- Einbau ---------- */
const CSS = `
.fx-layer{position:fixed;inset:0;pointer-events:none;z-index:3;overflow:hidden}
.fx-float{position:absolute;transform:translate(-50%,-50%);font:600 30px 'Caveat',cursive;color:var(--ink);text-shadow:0 0 4px var(--paper),0 0 9px var(--paper);white-space:nowrap;animation:fxRise 1.5s ease-out forwards}
@keyframes fxRise{0%{opacity:0;transform:translate(-50%,-30%) scale(.7)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.08)}100%{opacity:0;transform:translate(-50%,-240%) scale(1)}}
.stat{position:relative;justify-self:start}
.fx-chip{position:absolute;left:100%;margin-left:6px;top:50%;font:600 21px 'Caveat',cursive;color:var(--wash);text-shadow:0 0 3px var(--paper);white-space:nowrap;animation:fxChip 1.6s ease-out forwards}
@keyframes fxChip{0%{opacity:0;transform:translate(-4px,-50%)}15%{opacity:1;transform:translate(0,-50%)}100%{opacity:0;transform:translate(12px,-50%)}}
.stat.fx-up i{animation:fxGlow .7s ease-out}
@keyframes fxGlow{0%{box-shadow:0 0 0 0 rgba(239,210,155,.95);transform:scaleY(1.25)}100%{box-shadow:0 0 0 7px rgba(239,210,155,0);transform:scaleY(1)}}
#inv.fx-bump #bBag{animation:fxBump .45s ease-out}
@keyframes fxBump{35%{transform:scale(1.14) rotate(-3deg)}70%{transform:scale(.97) rotate(1deg)}100%{transform:none}}
#bAct.fx-work{background:linear-gradient(90deg,#e0a35a var(--p,0%),var(--ochre) var(--p,0%))}
#fade{flex-direction:column;gap:14px}
.fx-rest{font:20px 'Patrick Hand',sans-serif;color:#efe6d2;display:grid;gap:8px;justify-items:center;opacity:0;animation:fxIn .5s .1s forwards}
.fx-rest .clk{font:600 56px 'Caveat',cursive;line-height:1}
.fx-rest .day,.fx-rest .lbl{font-size:16px;color:#c9c2b4}
.fx-rest .bar{display:block;width:180px;height:12px;border:1.5px solid #efe6d2;border-radius:8px 5px 9px 4px/5px 9px 4px 8px;overflow:hidden}
.fx-rest .bar b{display:block;height:100%;background:#d9b23f;width:0}
@keyframes fxIn{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.fx-float{animation-duration:1.1s}.stat.fx-up i,#inv.fx-bump #bBag{animation:none}}`;
const HELP = `<h3>Sammeln</h3><dl class="ctl">
  <dt>Einen Moment</dt><dd>Pflücken, Holz hacken und Wasser schöpfen dauern kurz. Der Knopf füllt sich dabei. Wer weggeht, bricht ab.</dd></dl>`;

function init() {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  layer = document.createElement('div'); layer.className = 'fx-layer ingame'; document.body.appendChild(layer);
  btn = $('#bAct'); fade = $('#fade');
  const help = $('#help .card'), last = help && help.querySelector('.row'); if (last) last.insertAdjacentHTML('beforebegin', HELP);
  makeParticles(); lx = pos.x; lz = pos.z;
}

function update(dt, ts) {
  updateParticles(dt); watchStats();
  if (!G.started) { if (ch.a) stopWork(); return; }
  if (G.paused) return;                     /* Kamera nur anfassen, wenn move() sie gerade gesetzt hat */
  updateWork(dt); steps(dt); camera(dt, ts);
}

export default {
  name: 'feel', init, update, intercept, fx, rest,
  reset: () => { stopWork(); prevS = null; }
};
