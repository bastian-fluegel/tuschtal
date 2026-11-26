import { collect, hook } from './features.js';
import { $, BALANCE, FOODS, ITEMS, CS, GAME_HOUR, LKEY, STATS, WARN, clamp } from './config.js';
import { G, INV, S, T, fruitAvail, pos, woodAvail, MODS, give } from './state.js';
import { U } from './shaders.js';
import { buildFruit, chunks } from './world.js';
import { drawInv, toast } from './ui.js';
import { height } from './terrain.js';
import { inHouse } from './house.js';
import { pieces, worldPt } from './building.js';
import { sfx } from './audio.js';
const _w = new THREE.Vector3();

/* ---------- LEBEN: Werte, Zeit, Aktionen ---------- */
export const warned = {};
export function fireLitNear(maxD) {
  let best = 1e9;
  for (const p of pieces) if (p.def.fire && (G.fires[p.fkey] || 0) > 0) { worldPt(p, p.def.fire, _w); best = Math.min(best, _w.distanceTo(pos)); }
  return best < maxD ? best : 0;
}
export function warmTarget() {
  let t = 18 + 60 * U.uDay.value;
  if (pos.y > 16) t -= (pos.y - 16) * 2.5;
  if (inHouse()) t = Math.max(t, 62);
  const f = fireLitNear(5.5); if (f) t = Math.max(t, 100 - f * 6);
  return clamp(t, 0, 100);
}
export function advance(h) {
  T.hour += h;
  for (const k in G.fires) { G.fires[k] -= h; if (G.fires[k] <= 0) delete G.fires[k]; }
  let newDay = false;
  while (T.hour >= 24) { T.hour -= 24; T.day++; newDay = true; }
  if (newDay) { rebuildAllFruit(); spoil(); hook('newDay'); }
}
export function rebuildAllFruit() { for (const c of chunks.values()) buildFruit(c); if (G.house) buildFruit(G.house.garden); G.owners.forEach(buildFruit); }
/* Verderben: pro Tag geht ein Anteil verderblicher Sachen verloren */
function spoil() {
  const lost = [];
  for (const k in INV) { const sp = ITEMS[k] && ITEMS[k].spoil; if (sp && INV[k] > 0) { const n = Math.max(1, Math.round(INV[k] * sp)); INV[k] -= Math.min(n, INV[k]); lost.push(ITEMS[k].name); } }
  if (lost.length) setTimeout(() => toast('Über Nacht verdorben: ' + lost.join(', ')), 2600);
  drawInv();
}
export function tickLife(dt) {
  const h = dt / GAME_HOUR;
  const B = BALANCE;
  S.food -= B.foodPerHour * h; S.water -= B.waterPerHour * h; S.energy -= B.energyPerHour * h * (G.running ? B.sprintFactor : 1);
  if (S.food <= 0 || S.water <= 0) S.energy -= B.hungryEnergyPerHour * h;
  const wt = warmTarget(), rate = wt > S.warm ? (wt > 90 ? B.warmUpFire : B.warmUp) : B.coolDown;
  S.warm += Math.sign(wt - S.warm) * Math.min(Math.abs(wt - S.warm), rate * h);
  if (S.warm < 15) S.energy -= B.coldEnergyPerHour * h;
  for (const k in S) S[k] = clamp(S[k], 0, 100);
  for (const [k] of STATS) { if (S[k] < 25 && !warned[k]) { warned[k] = 1; toast(WARN[k]); } if (S[k] > 35) warned[k] = 0; }
  advance(h);
  if (S.energy <= 0) faint();
}
export function eat(k) {
  const f = FOODS[k]; if (!f) return;
  if (!INV[k]) { toast(`Keine ${ITEMS[k] ? ITEMS[k].name : k} mehr.`); return; }
  INV[k]--;
  for (const st of ['food', 'water', 'warm', 'energy']) if (f[st]) S[st] = Math.min(100, S[st] + f[st]);
  toast(f.msg); drawInv(); saveLife();
}
export function drink() { S.water = Math.min(100, S.water + 30); toast('Kühles, klares Wasser.'); saveLife(); }
export function harvest(it) {
  const I = ITEMS[it.fk] || { name: it.fk, yield: [1, 1] }, [lo, hi] = I.yield || [1, 1];
  const want = lo + Math.floor(Math.random() * (hi - lo + 1)) + MODS.harvestBonus, n = give(ITEMS, it.fk, want);
  if (!n) { toast('Dein Rucksack ist voll. Iss etwas oder bring Sachen in eine Truhe.'); return; }
  G.picked[it.key] = T.day; buildFruit(it.owner);
  toast(`${n} × ${n === 1 ? I.one : I.name} eingesammelt.` + (n < want ? ' Der Rucksack ist jetzt voll.' : '')); sfx('pick'); drawInv(); saveLife();
}
export function takeWood(it) {
  const w = G.woodUsed[it.key] && G.woodUsed[it.key].d === T.day ? G.woodUsed[it.key] : { d: T.day, n: 0 };
  const n = give(ITEMS, 'wood', MODS.woodGain);
  if (!n) { toast('Dein Rucksack ist voll.'); return; }
  w.n++; G.woodUsed[it.key] = w; toast(n > 1 ? `${n} Bündel Holz gesammelt.` : 'Ein Bündel Holz gesammelt.'); drawInv(); saveLife();
}
export function stoke(p) {
  if (INV.wood < 1) { toast('Du brauchst Holz. Sammle es an Bäumen.'); return; }
  const was = (G.fires[p.fkey] || 0) > 0;
  INV.wood--; G.fires[p.fkey] = Math.min(14, (G.fires[p.fkey] || 0) + 4);
  toast(was ? 'Holz nachgelegt, das Feuer knistert.' : 'Das Feuer brennt.'); drawInv(); saveLife();
}
export const fade = $('#fade');
export function blackout(text, fn) {
  G.paused = true; fade.textContent = text; fade.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => { fade.classList.remove('on'); G.paused = false; }, 700); }, 1300);
}
export function sleep() {
  const h = T.hour, night = h >= 19 || h < 5, hours = night ? ((24 - h + 7) % 24 || 8) : 3;
  blackout('Zzz …', () => {
    S.food = clamp(S.food - 2 * hours, 0, 100); S.water = clamp(S.water - 3 * hours, 0, 100);
    S.energy = clamp(S.energy + 14 * hours, 0, 100); if (inHouse()) S.warm = Math.max(S.warm, 62);
    advance(hours); saveLife();
    toast(night ? `Guten Morgen. Tag ${T.day} beginnt.` : 'Ein erholsames Nickerchen.');
  });
}
export function faint() {
  blackout('Dir wird schwarz vor Augen …', () => {
    const h = T.hour, hours = Math.max(6, (24 - h + 7) % 24); advance(hours);
    S.energy = 45; S.food = Math.max(S.food, 25); S.water = Math.max(S.water, 25); S.warm = 62; G.vy = 0;
    if (G.house) { pos.set(G.house.bed.x + .9, G.house.bed.y, G.house.bed.z); G.yaw = Math.PI / 2; }
    saveLife(); toast('Du bist erschöpft zusammengebrochen und im Häuschen aufgewacht.');
  });
}
export function waterNear() {
  if (pos.y > 1.6) return false;
  for (let a = 0; a < 6.28; a += .79) if (height(pos.x + Math.cos(a) * 1.6, pos.z + Math.sin(a) * 1.6) < -.1) return true;
  return height(pos.x, pos.z) < 0;
}
const TREES = new Set(['tree', 'conifer', 'bare']), SMALL = new Set(['bush', 'mushroom', 'herb']);
export function findAction() {
  const ov = collect('override'); if (ov.length) return ov[0];
  let best = null, bd = 1e9;
  const offer = (d, a) => { if (a && d < bd) { bd = d; best = a; } };
  for (const p of pieces) {
    if (!p.def.use) continue;
    const d = Math.hypot(p.x - pos.x, p.z - pos.z); if (d > 2.4 || Math.abs(p.y - pos.y) > 2) continue;
    if (p.def.use === 'sleep') offer(d, { label: 'Schlafen', run: sleep });
    else if (p.def.use === 'drink') offer(d, { label: 'Trinken', run: drink, more: collect('waterActions', { lake: false }) });
    else if (p.def.use !== 'fire') { const pa = collect('pieceActions', p); if (pa.length) offer(d, { ...pa[0], more: pa.slice(1) }); }
    else {
      const lit = (G.fires[p.fkey] || 0) > 0;
      const feed = { label: lit ? 'Holz nachlegen' : 'Feuer anzünden', run: () => stoke(p) };
      const fa = lit ? collect('fireActions', p) : [];
      offer(d, fa.length ? { ...fa[0], more: [...fa.slice(1), feed] } : feed);
    }
  }
  const owners = [...G.owners];
  const pcx = Math.floor(pos.x / CS), pcz = Math.floor(pos.z / CS);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = chunks.get((pcx + dx) + ',' + (pcz + dz)); if (c) owners.push(c); }
  if (G.house) owners.push(G.house.garden);
  for (const o of owners) for (const it of o.items) {
    const d = Math.hypot(it.x - pos.x, it.z - pos.z), reach = SMALL.has(it.kind) ? 1.9 : 2.3;
    if (d > reach || Math.abs(it.y - pos.y) > 2.5) continue;
    if (fruitAvail(it)) offer(d, { label: (ITEMS[it.fk] && ITEMS[it.fk].pick) || 'Einsammeln', run: () => harvest(it) });
    else if (TREES.has(it.kind) && woodAvail(it)) offer(d + .3, { label: 'Holz sammeln', run: () => takeWood(it) });
  }
  if (!best && waterNear()) best = { label: 'Trinken', run: drink, more: collect('waterActions', { lake: true }) };
  return best;
}
export function saveLife() {
  try { localStorage.setItem(LKEY, JSON.stringify({ T, S, INV, picked: G.picked, woodUsed: G.woodUsed, fires: G.fires, pos: [pos.x, pos.y, pos.z], yaw: G.yaw })); } catch (e) { }
}
export function loadLife() {
  try {
    const d = JSON.parse(localStorage.getItem(LKEY) || 'null'); if (!d) return false;
    Object.assign(T, d.T); Object.assign(S, d.S); Object.assign(INV, d.INV);
    G.picked = d.picked || {}; G.woodUsed = d.woodUsed || {}; G.fires = d.fires || {};
    if (d.pos) { pos.fromArray(d.pos); G.yaw = d.yaw || 0; return true; }
  } catch (e) { }
  return false;
}

