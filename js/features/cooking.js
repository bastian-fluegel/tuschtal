/* ============================================================
   MODUL: KOCHEN
   Sammeln (Pilze, Kräuter), Angeln, Wasser schöpfen, Kochstelle mit
   Werkzeugen und Zutaten-Slots, Rezeptbuch zum Entdecken, Haltbarkeit.
   Abschalten: config.js → FEATURES.cooking = false
   Neues Rezept: Eintrag in RECIPES unten. Neue Zutat: INGREDIENTS + Spawn.
   ============================================================ */
import { $, CS, ITEMS, FOODS, KEY } from '../config.js';
import { G, INV, pos, ikey, MODS, give } from '../state.js';
import { P, merge } from '../geometry.js';
import { MAT } from '../shaders.js';
import { scene } from '../engine.js';
import { height, normalAt } from '../terrain.js';
import { rng, hash } from '../noise.js';
import { buildFruit } from '../world.js';
import { toast, drawInv } from '../ui.js';
import { advance, saveLife } from '../survival.js';
import { sfx, burst } from '../audio.js';
import { splash } from '../fauna.js';

/* ---------- Daten ---------- */
const NEW_ITEMS = {
  mushrooms: { name: 'Pilze', one: 'Pilz', cat: 'zutat', pick: 'Pilze sammeln', yield: [1, 3], spoil: .5 },
  herbs: { name: 'Kräuter', one: 'Kraut', cat: 'zutat', pick: 'Kräuter pflücken', yield: [2, 3], spoil: .35 },
  fish: { name: 'Fische', one: 'Fisch', cat: 'zutat', spoil: 1 },
  water: { name: 'Wasser', one: 'Wasser', cat: 'zutat', spoil: 0 }
};
const RAW_FOODS = {
  mushrooms: { food: 5, msg: 'Roh schmecken Pilze nach Erde. Gekocht wären sie besser.' },
  herbs: { food: 2, water: 1, msg: 'Bitter, aber frisch.' },
  water: { water: 25, msg: 'Ein Schluck aus der Flasche.' }
};
const INGREDIENTS = ['apples', 'berries', 'mushrooms', 'herbs', 'fish', 'water'];
const TOOLS = { spiess: 'Spieß', topf: 'Topf', pfanne: 'Pfanne' };
const STATION_TOOLS = { kamin: ['spiess', 'topf', 'pfanne'], lagerfeuer: ['spiess', 'topf'] };
export const RECIPES = [
  { id: 'bratapfel', name: 'Bratapfel', tool: 'spiess', needs: { apples: 1 }, food: 30, warm: 8, known: true, hint: 'Ein Apfel über der Flamme', msg: 'Warm und weich, duftet nach Herbst.' },
  { id: 'grillpilze', name: 'Grillpilze', tool: 'spiess', needs: { mushrooms: 1 }, food: 18, warm: 4, hint: 'Etwas aus dem Wald auf den Spieß', msg: 'Rauchig und herzhaft.' },
  { id: 'steckerlfisch', name: 'Steckerlfisch', tool: 'spiess', needs: { fish: 1 }, food: 40, energy: 8, hint: 'Ein Fang aus dem See am Stock', msg: 'Knusprige Haut, zartes Fleisch.' },
  { id: 'kraeutertee', name: 'Kräutertee', tool: 'topf', needs: { herbs: 1, water: 1 }, water: 30, warm: 25, hint: 'Wiese trifft Wasser', msg: 'Wärmt von innen.' },
  { id: 'beerenbrei', name: 'Beerenbrei', tool: 'topf', needs: { berries: 2, water: 1 }, food: 26, water: 14, warm: 8, hint: 'Zwei Handvoll Süßes und Wasser', msg: 'Süß und warm.' },
  { id: 'pilzsuppe', name: 'Pilzsuppe', tool: 'topf', needs: { mushrooms: 1, herbs: 1, water: 1 }, food: 34, water: 18, warm: 15, hint: 'Wald, Wiese und Wasser in einem Topf', msg: 'Kräftig und wohltuend.' },
  { id: 'fischsuppe', name: 'Fischsuppe', tool: 'topf', needs: { fish: 1, herbs: 1, water: 1 }, food: 45, water: 20, warm: 15, energy: 10, hint: 'Aus dem See, mit Grün und Wasser', msg: 'Die beste Suppe im Tal.' },
  { id: 'apfelkompott', name: 'Apfelkompott', tool: 'topf', needs: { apples: 2, water: 1 }, food: 34, water: 12, hint: 'Zwei Äpfel weich kochen', msg: 'Wie bei Oma.' },
  { id: 'waldtee', name: 'Waldbeerentee', tool: 'topf', needs: { berries: 1, herbs: 1, water: 1 }, water: 28, warm: 20, energy: 6, hint: 'Beere, Kraut und Wasser', msg: 'Fruchtig und belebend.' },
  { id: 'pilzpfanne', name: 'Pilzpfanne', tool: 'pfanne', needs: { mushrooms: 2, herbs: 1 }, food: 42, warm: 6, hint: 'Viel Wald und ein wenig Wiese', msg: 'Brutzelnd heiß.' },
  { id: 'kraeuterfisch', name: 'Kräuterfisch', tool: 'pfanne', needs: { fish: 1, herbs: 1 }, food: 48, energy: 12, hint: 'Fang und Kraut, scharf angebraten', msg: 'Duftet bis zum Waldrand.' },
  { id: 'obstpfanne', name: 'Apfel-Beeren-Pfanne', tool: 'pfanne', needs: { apples: 1, berries: 2 }, food: 36, water: 6, hint: 'Obst in der Pfanne', msg: 'Karamellisiert und süß.' }
];
const BOOK_KEY = KEY + '-rezepte';
let book = new Set();
function loadBook() { book = new Set(RECIPES.filter(r => r.known).map(r => r.id)); try { JSON.parse(localStorage.getItem(BOOK_KEY) || '[]').forEach(id => book.add(id)); } catch (e) { } }
function saveBook() { try { localStorage.setItem(BOOK_KEY, JSON.stringify([...book])); } catch (e) { } }
const fxText = f => [['food', 'Essen'], ['water', 'Trinken'], ['warm', 'Wärme'], ['energy', 'Energie']].filter(([k]) => f[k]).map(([k, n]) => `+${f[k]} ${n}`).join(' · ');

/* ---------- Pilze und Kräuter in der Welt ---------- */
function mushParts(x, y, z, r) {
  const a = [], n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const ox = (r() - .5) * .5, oz = (r() - .5) * .5, s = .7 + r() * .6, cap = r() < .5 ? '#a8794a' : '#d9a03c';
    a.push(P('cyl', '#efe6d6', x + ox, y + .1 * s, z + oz, .045 * s, .2 * s, .045 * s), P('ico', cap, x + ox, y + .22 * s, z + oz, .15 * s, .07 * s, .15 * s));
  }
  return a;
}
function herbParts(x, y, z, r) {
  const a = [];
  for (let i = 0; i < 5; i++) { const t = r() * 6.28; a.push(P('box', '#5f9a3a', x + Math.cos(t) * .12, y + .18, z + Math.sin(t) * .12, .03, .36, .06, t, (r() - .5) * .6)); }
  for (let i = 0; i < 3; i++) a.push(P('ico', r() < .5 ? '#cdb8ec' : '#f4efe2', x + (r() - .5) * .3, y + .38 + r() * .08, z + (r() - .5) * .3, .045, .045, .045));
  return a;
}
function addItem(owner, kind, fk, x, z, r) {
  const y = height(x, z) - .03;
  owner.items.push({ kind, fk, x, y, z, key: ikey(x, z), owner, fruit: kind === 'mushroom' ? mushParts(x, y, z, r) : herbParts(x, y, z, r) });
}
const TREES = new Set(['tree', 'conifer', 'bare']);
function chunk(ch, cx, cz) {
  const r = rng(Math.floor(hash(cx + 101, cz - 77) * 1e9));
  const trees = ch.items.filter(it => TREES.has(it.kind));
  for (let k = 0; k < 3 && trees.length; k++) {
    const t = trees[Math.floor(r() * trees.length)], a = r() * 6.28, d = .9 + r() * .8, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
    if (height(x, z) > 1) addItem(ch, 'mushroom', 'mushrooms', x, z, r);
  }
  for (let k = 0; k < 4; k++) {
    const x = cx * CS + r() * CS, z = cz * CS + r() * CS, h = height(x, z);
    if (h > 1.3 && h < 12 && normalAt(x, z).y > .85 && r() < .6) addItem(ch, 'herb', 'herbs', x, z, r);
  }
}

/* ---------- Wasser schöpfen ---------- */
function fill() {
  if (!give(ITEMS, 'water', 1)) { toast('Dein Rucksack ist voll.'); return; }
  burst(700, 'lowpass', .25, .08); toast(`Wasser abgefüllt (${INV.water}/${MODS.waterMax}). Gut zum Kochen und für unterwegs.`);
  drawInv(); saveLife();
}

/* ---------- Angeln ---------- */
const fishing = { state: 'idle', t: 0, px: 0, pz: 0 };
let bob = null;
function startFish() {
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  let spot = null;
  for (const off of [0, .4, -.4, .8, -.8, 1.3, -1.3, 2, -2, 3.14]) for (const d of [3.5, 5, 6.5]) {
    if (spot) break;
    const c = Math.cos(off), s = Math.sin(off), dx = fx * c - fz * s, dz = fx * s + fz * c, x = pos.x + dx * d, z = pos.z + dz * d;
    if (height(x, z) < -.5) spot = [x, z];
  }
  if (!spot) { toast('Hier ist das Wasser zu flach. Such eine tiefere Stelle.'); return; }
  Object.assign(fishing, { state: 'wait', t: 2.5 + Math.random() * 4.5, px: pos.x, pz: pos.z });
  bob.position.set(spot[0], .05, spot[1]); bob.visible = true; splash(spot[0], spot[1]);
  toast('Angel ausgeworfen. Warte, bis der Schwimmer abtaucht …');
}
function stopFish(msg) { fishing.state = 'idle'; bob.visible = false; if (msg) toast(msg); }
function catchFish() {
  if (!give(ITEMS, 'fish', 1)) { stopFish('Der Fisch passt nicht mehr in den Rucksack.'); return; }
  splash(bob.position.x, bob.position.z);
  stopFish('Ein Fisch! Brat oder koch ihn bald, er hält nur bis morgen.'); drawInv(); saveLife();
}
function update(dt, ts) {
  if (fishing.state === 'idle' || G.paused) return;
  if (Math.hypot(pos.x - fishing.px, pos.z - fishing.pz) > 1.2) { stopFish('Du hast die Angel eingeholt.'); return; }
  fishing.t -= dt;
  if (fishing.state === 'wait') {
    bob.position.y = .04 + Math.sin(ts * 3) * .02;
    if (fishing.t <= 0) { fishing.state = 'bite'; fishing.t = MODS.biteWindow; splash(bob.position.x, bob.position.z); }
  } else {
    bob.position.y = -.06 + Math.sin(ts * 30) * .03;
    if (fishing.t <= 0) stopFish('Er hat sich losgerissen. Versuch es nochmal.');
  }
}
function override() {
  if (fishing.state === 'wait') return { label: 'Angel einholen', run: () => stopFish('Angel eingeholt.') };
  if (fishing.state === 'bite') return { label: 'Jetzt ziehen!', run: catchFish };
  return null;
}

/* ---------- Kochstelle ---------- */
const st = { piece: null, tools: [], tool: 'spiess', slots: [], busy: false, msg: '' };
let el = null;
const avail = k => (INV[k] || 0) - st.slots.filter(s => s === k).length;
function match() {
  if (!st.slots.length) return null;
  const c = {}; st.slots.forEach(k => c[k] = (c[k] || 0) + 1);
  return RECIPES.find(r => r.tool === st.tool && Object.keys(r.needs).length === Object.keys(c).length && Object.entries(r.needs).every(([k, n]) => c[k] === n)) || null;
}
function openCook(p) {
  st.piece = p; st.tools = p ? (STATION_TOOLS[p.def.id] || ['spiess']) : [];
  if (p && !st.tools.includes(st.tool)) st.tool = st.tools[0];
  st.slots = []; st.msg = ''; G.paused = true; draw(); el.classList.remove('hide');
}
function closeCook() { if (st.busy) return; el.classList.add('hide'); if (G.started) G.paused = false; }
function draw() {
  const p = st.piece, m = match();
  const where = p ? (p.def.id === 'kamin' ? 'am Kamin' : 'am Lagerfeuer') : '';
  let res = '';
  if (m) res = book.has(m.id) ? `→ <b>${m.name}</b> <small>${fxText(m)}</small>` : '→ <b>Etwas Neues!</b> <small>Probier es aus.</small>';
  else if (st.slots.length) res = '<small>Unbekannte Mischung. So wird daraus nichts.</small>';
  const ingr = INGREDIENTS.filter(k => (INV[k] || 0) > 0);
  el.querySelector('.card').innerHTML = `
    <h2>${p ? 'Kochen ' + where : 'Rezeptbuch'}</h2>
    ${p ? `<p class="ck-note">Werkzeug wählen, bis zu drei Zutaten hineinlegen, kochen. Neue Mischungen landen im Rezeptbuch.</p>
    <div class="ck-tools">${Object.entries(TOOLS).map(([k, n]) => `<button class="b${st.tool === k ? ' on' : ''}" data-tool="${k}" ${st.tools.includes(k) ? '' : 'disabled title="Nur am Kamin"'}>${n}</button>`).join('')}</div>
    <div class="ck-slots">${[0, 1, 2].map(i => st.slots[i] ? `<button class="ck-slot full" data-slot="${i}">${ITEMS[st.slots[i]].one}<small>antippen zum Entfernen</small></button>` : '<div class="ck-slot">+</div>').join('')}</div>
    <div class="ck-res">${res || '<small>Leg Zutaten aus deinem Vorrat hinein.</small>'}</div>
    <div class="ck-bar"><b></b></div>
    <div class="row"><button class="b main" data-act="cook">Kochen</button><button class="b" data-act="close">Fertig</button></div>
    <h3>Deine Zutaten</h3>
    <div class="ck-ingr">${ingr.length ? ingr.map(k => `<button class="b" data-ing="${k}" ${avail(k) > 0 ? '' : 'disabled'}>${ITEMS[k].name} <strong>${avail(k)}</strong></button>`).join('') : '<p>Keine Zutaten. Sammle Äpfel, Beeren, Pilze, Kräuter, angle Fische und schöpf Wasser.</p>'}</div>` : ''}
    <h3>Rezeptbuch <small>${book.size} von ${RECIPES.length} entdeckt</small></h3>
    <div class="ck-book">${RECIPES.map(r => book.has(r.id)
      ? `<button class="ck-rec" data-rec="${r.id}"><b>${r.name}</b> <i>${TOOLS[r.tool]}</i><small>${Object.entries(r.needs).map(([k, n]) => `${n} × ${n === 1 ? ITEMS[k].one : ITEMS[k].name}`).join(', ')} · ${fxText(r)}</small></button>`
      : `<div class="ck-rec unknown"><b>???</b> <i>${TOOLS[r.tool]}</i><small>${r.hint}</small></div>`).join('')}</div>
    ${p ? '' : '<div class="row"><button class="b main" data-act="close">Schließen</button></div>'}`;
}
function cook() {
  if (st.busy) return;
  if (!st.slots.length) { toast('Leg zuerst Zutaten hinein.'); return; }
  const r = match();
  if (!r) { toast('Daraus wird nichts. Probier eine andere Mischung oder ein anderes Werkzeug.'); return; }
  st.busy = true; const bar = el.querySelector('.ck-bar b'), t0 = performance.now(), dur = 2600;
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / dur); bar.style.width = (k * 100).toFixed(0) + '%';
    if (Math.random() < .25) burst(st.tool === 'topf' ? 500 : 1700, st.tool === 'topf' ? 'lowpass' : 'highpass', .06, .05);
    if (k < 1) { requestAnimationFrame(tick); return; }
    for (const k2 of st.slots) INV[k2]--;
    INV[r.id] = (INV[r.id] || 0) + 1; advance(.5); sfx('pick');
    const fresh = !book.has(r.id); book.add(r.id); saveBook();
    toast(fresh ? `Neues Rezept entdeckt: ${r.name}!` : `${r.name} ist fertig. Du findest es im Rucksack.`);
    const again = [...st.slots]; st.slots = []; again.forEach(k2 => { if (avail(k2) > 0) st.slots.push(k2); });
    if (st.slots.length !== again.length) st.slots = [];
    st.busy = false; draw(); drawInv(); saveLife();
  };
  requestAnimationFrame(tick);
}
function onClick(e) {
  const t = e.target.closest('button'); if (!t || t.disabled || st.busy) return;
  if (t.dataset.tool) { st.tool = t.dataset.tool; }
  else if (t.dataset.ing) { if (st.slots.length < 3 && avail(t.dataset.ing) > 0) st.slots.push(t.dataset.ing); }
  else if (t.dataset.slot) { st.slots.splice(+t.dataset.slot, 1); }
  else if (t.dataset.rec && st.piece) {
    const r = RECIPES.find(x => x.id === t.dataset.rec);
    if (!st.tools.includes(r.tool)) { toast(`${r.name} braucht ${TOOLS[r.tool] === 'Pfanne' ? 'eine Pfanne' : 'einen ' + TOOLS[r.tool]}. Den gibt es am Kamin.`); return; }
    const need = Object.entries(r.needs), missing = need.filter(([k, n]) => (INV[k] || 0) < n);
    if (missing.length) { toast('Dir fehlt: ' + missing.map(([k, n]) => `${n - (INV[k] || 0)} × ${ITEMS[k].one}`).join(', ')); return; }
    st.tool = r.tool; st.slots = []; need.forEach(([k, n]) => { for (let i = 0; i < n; i++) st.slots.push(k); });
  }
  else if (t.dataset.act === 'cook') { cook(); return; }
  else if (t.dataset.act === 'close') { closeCook(); return; }
  draw();
}

/* ---------- Einbau in die Oberfläche ---------- */
const CSS = `
.ck-note{color:var(--ink2);font-size:15px}
.ck-tools,.ck-ingr{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.ck-tools .b[disabled],.ck-ingr .b[disabled]{opacity:.4}
.ck-ingr .b strong{font:600 22px 'Caveat',cursive;color:var(--wash)}
.ck-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
.ck-slot{height:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.8px dashed var(--ink2);border-radius:var(--hand);font:600 26px 'Caveat',cursive;color:var(--ink2);background:rgba(255,255,255,.3)}
.ck-slot.full{border-style:solid;border-color:var(--ink);color:var(--ink);background:#f3e2bf;cursor:pointer;font-size:24px}
.ck-slot small{font:12px 'Patrick Hand',sans-serif;color:var(--ink2)}
.ck-res{min-height:28px;font-size:19px}
.ck-res small,.ck-rec small,.card h3 small{font-size:14px;color:var(--ink2);font-family:'Patrick Hand',sans-serif}
.ck-bar{height:10px;border:1.5px solid var(--ink);border-radius:6px;overflow:hidden;margin:6px 0 2px;background:rgba(255,255,255,.4)}
.ck-bar b{display:block;height:100%;width:0;background:#e0a35a}
.ck-book{display:grid;gap:6px}
.ck-rec{display:block;width:100%;text-align:left;padding:8px 10px;border:1.5px solid var(--ink);border-radius:var(--hand);background:rgba(255,255,255,.4);font:17px 'Patrick Hand',sans-serif;color:var(--ink);cursor:pointer}
.ck-rec i{font-style:normal;font-size:14px;color:var(--wash);margin-left:6px}
.ck-rec small{display:block}
.ck-rec.unknown{opacity:.7;border-style:dashed;cursor:default}`;
const HELP = `<h3>Kochen</h3><dl class="ctl">
  <dt>Sammeln</dt><dd>Pilze wachsen unter Bäumen, Kräuter auf Wiesen. Beim Haus findest du ein paar.</dd>
  <dt>Wasser</dt><dd>am Brunnen oder See schöpfen (bis zu 4). Es dient zum Kochen und für unterwegs.</dd>
  <dt>Angeln</dt><dd>am tiefen Wasser: auswerfen, warten, und wenn der Schwimmer abtaucht, schnell ziehen.</dd>
  <dt>Kochen</dt><dd>am brennenden Feuer. Der Kamin hat Spieß, Topf und Pfanne, das Lagerfeuer Spieß und Topf. 12 Rezepte warten auf dich.</dd>
  <dt>Frische</dt><dd>Fisch hält bis morgen, Pilze und Kräuter ein paar Tage. Gekochtes hält länger.</dd></dl>`;

function init() {
  Object.assign(ITEMS, NEW_ITEMS); Object.assign(FOODS, RAW_FOODS);
  ITEMS.berries.spoil = .3; ITEMS.apples.spoil = .15;
  for (const r of RECIPES) {
    ITEMS[r.id] = { name: r.name, one: r.name, cat: 'gericht', spoil: .2 };
    FOODS[r.id] = { food: r.food, water: r.water, warm: r.warm, energy: r.energy, msg: r.msg };
  }
  loadBook();
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  el = document.createElement('div'); el.className = 'sheet feature hide'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="card"></div>'; el.addEventListener('click', onClick); document.body.appendChild(el);
  const help = $('#help .card'), last = help.querySelector('.row'); last.insertAdjacentHTML('beforebegin', HELP);
  const bagRow = $('#bag .row'); bagRow.insertAdjacentHTML('afterbegin', '<button class="b" id="bBook">Rezeptbuch</button>');
  $('#bBook').onclick = () => { $('#bag').classList.add('hide'); openCook(null); };
  bob = new THREE.Mesh(merge([P('ico', '#f4efe4', 0, 0, 0, .09, .09, .09), P('ico', '#c0503a', 0, .07, 0, .07, .05, .07)]), MAT.vc);
  bob.visible = false; scene.add(bob);
  /* ein paar Pilze und Kräuter beim Häuschen, damit der Einstieg leicht ist */
  const h = G.house, home = { group: new THREE.Group(), items: [], fruitMesh: null }, r = rng(4242);
  scene.add(home.group);
  [[h.hx + 5.5, h.hz + 6], [h.hx - 2.5, h.hz + 7.5], [h.hx + 7, h.hz - 1]].forEach(([x, z]) => addItem(home, 'herb', 'herbs', x, z, r));
  [[h.hx - 3.4, h.hz - 1.4], [h.hx - 5.8, h.hz - 3.6]].forEach(([x, z]) => addItem(home, 'mushroom', 'mushrooms', x, z, r));
  G.owners.push(home); buildFruit(home);
}

export default {
  name: 'cooking', init, update, chunk, override,
  fireActions: p => p.def.fire ? [{ label: 'Kochen', run: () => openCook(p) }] : [],
  waterActions: ctx => {
    const out = [];
    if ((INV.water || 0) < MODS.waterMax) out.push({ label: 'Wasser schöpfen', run: fill });
    if (ctx.lake) out.push({ label: 'Angeln', run: startFish });
    return out;
  },
  reset: () => { loadBook(); book = new Set(RECIPES.filter(r => r.known).map(r => r.id)); saveBook(); stopFish(); }
};
