/* ============================================================
   MODUL: HANDWERK & EINRICHTUNG
   Materialien (Steine, Fasern, Lehm), Werkbank, Werkzeuge mit echten
   Effekten, Möbel und Deko zum Aufstellen, Truhe als Lager,
   begrenzter Rucksack.
   Abschalten: config.js → FEATURES.crafting = false
   Neues Möbelstück: Eintrag in FURNITURE. Neues Werkzeug: Eintrag in TOOLS.
   ============================================================ */
import { $, CS, ITEMS, KEY } from '../config.js';
import { G, INV, ikey, MODS, give, NO_BAG } from '../state.js';
import { P, merge } from '../geometry.js';
import { PIECES, BYID, WOOD, WOOD2, STONE, LAMP, DARK, E } from '../pieces.js';
import { scene } from '../engine.js';
import { height, normalAt } from '../terrain.js';
import { rng, hash } from '../noise.js';
import { buildFruit } from '../world.js';
import { addPiece } from '../building.js';
import { toast, drawInv } from '../ui.js';
import { advance, saveLife } from '../survival.js';
import { sfx, burst } from '../audio.js';
import { emit } from '../features.js';

/* ---------- Materialien ---------- */
const MATERIALS = {
  stone: { name: 'Steine', one: 'Stein', cat: 'material', pick: 'Steine aufheben', yield: [1, 3], spoil: 0 },
  fiber: { name: 'Fasern', one: 'Faser', cat: 'material', pick: 'Gras rupfen', yield: [2, 4], spoil: 0 },
  clay: { name: 'Lehm', one: 'Lehm', cat: 'material', pick: 'Lehm graben', yield: [1, 2], spoil: 0 },
  plank: { name: 'Bretter', one: 'Brett', cat: 'material', desc: 'an der Werkbank aus Holz gesägt', spoil: 0 },
  rope: { name: 'Seil', one: 'Seil', cat: 'material', desc: 'an der Werkbank aus Fasern gedreht', spoil: 0 }
};
const BASE_BAG = 24;

/* ---------- Werkzeuge: einmal herstellen, wirken dauerhaft ---------- */
const TOOLS = [
  { id: 'axe', name: 'Steinaxt', needs: { wood: 2, stone: 2, rope: 1 }, effect: 'Doppelt so viel Holz, öfter pro Baum', apply: m => { m.woodGain = 2; m.woodPerTree = 3; } },
  { id: 'basket', name: 'Korb', needs: { fiber: 6, rope: 1 }, effect: 'Rucksack +12 Plätze', apply: m => { m.bagMax += 12; } },
  { id: 'gloves', name: 'Sammelhandschuhe', needs: { fiber: 4, rope: 1 }, effect: '+1 bei jeder Ernte', apply: m => { m.harvestBonus = 1; } },
  { id: 'lantern', name: 'Handlaterne', needs: { plank: 1, clay: 1, fiber: 2 }, effect: 'Leuchtet nachts um dich herum', apply: m => { m.lantern = true; } },
  { id: 'flask', name: 'Feldflasche', needs: { clay: 2, rope: 1 }, effect: 'Bis zu 8 Wasser tragen', needsItem: 'water', apply: m => { m.waterMax = 8; } },
  { id: 'rod', name: 'Gute Angel', needs: { wood: 2, rope: 2 }, effect: 'Doppelt so viel Zeit zum Ziehen', needsItem: 'fish', apply: m => { m.biteWindow = 2.3; } }
];
const BASE_MODS = { ...MODS };
function applyTools() {
  Object.assign(MODS, BASE_MODS, { bagMax: BASE_BAG });
  for (const t of TOOLS) if ((INV[t.id] || 0) > 0) t.apply(MODS);
}

/* ---------- Möbel und Deko ----------
   parts(): Teile wie in pieces.js. fine: halbes Raster. use: 'sleep' | 'drink' | 'store' */
const RUG = '#b5573f', RUG2 = '#e2b65c', CLAY = '#c4774a';
const FURNITURE = [
  { id: 'stuhl', name: 'Stuhl', needs: { plank: 2 }, fine: true, parts: () => [P('box', WOOD, 0, .45, 0, .46, .06, .46), ...[[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]].map(([x, z]) => P('box', WOOD2, x, .22, z, .05, .44, .05)), P('box', WOOD, 0, .75, -.21, .46, .5, .05)] },
  { id: 'hocker', name: 'Hocker', needs: { plank: 1 }, fine: true, parts: () => [P('cyl', WOOD, 0, .42, 0, .21, .06, .21), ...[0, 2.1, 4.2].map(a => P('box', WOOD2, Math.cos(a) * .13, .2, Math.sin(a) * .13, .05, .4, .05))] },
  { id: 'bank', name: 'Bank', needs: { plank: 3 }, fine: true, parts: () => [P('box', WOOD, 0, .42, 0, 1.3, .07, .36), P('box', WOOD2, -.55, .2, 0, .08, .4, .3), P('box', WOOD2, .55, .2, 0, .08, .4, .3)] },
  { id: 'regal', name: 'Regal', needs: { plank: 3, rope: 1 }, fine: true, parts: () => {
    const a = [P('box', WOOD2, -.47, .8, 0, .05, 1.6, .34), P('box', WOOD2, .47, .8, 0, .05, 1.6, .34)];
    [.03, .52, 1.02, 1.52].forEach(y => a.push(P('box', WOOD, 0, y, 0, .94, .04, .34)));
    const cols = ['#5f7fa8', '#b5573f', '#6f9a45', '#d9a03c', '#7a5a8a'], r = rng(9);
    for (const y of [.54, 1.04]) { let x = -.4; while (x < .3) { const w = .06 + r() * .05; a.push(P('box', cols[Math.floor(r() * 5)], x + w / 2, y + .16, 0, w, .26 + r() * .08, .24)); x += w + .01; } }
    a.push(P('cyl', CLAY, .25, 1.13, 0, .07, .18, .07), P('cyl', '#e8dcc0', .3, 1.62, 0, .08, .16, .08));
    return a; } },
  { id: 'truhe', name: 'Truhe', needs: { plank: 4, rope: 1 }, fine: true, use: 'store', parts: () => [P('box', WOOD, 0, .25, 0, .9, .5, .55), P('box', WOOD2, 0, .56, 0, .93, .12, .58), P('box', DARK, -.3, .3, 0, .05, .52, .59), P('box', DARK, .3, .3, 0, .05, .52, .59), P('box', LAMP, 0, .45, .29, .1, .1, .03)] },
  { id: 'kommode', name: 'Kommode', needs: { plank: 5 }, fine: true, parts: () => [P('box', WOOD, 0, .42, 0, 1, .8, .45), ...[.2, .44, .68].map(y => P('box', WOOD2, 0, y, .23, .88, .19, .02)), ...[.2, .44, .68].map(y => P('ico', LAMP, 0, y, .25, .03, .03, .03)), P('cyl', CLAY, .3, .95, 0, .08, .2, .08)] },
  { id: 'teppich', name: 'Teppich', needs: { fiber: 6 }, fine: true, parts: () => [P('box', RUG, 0, .01, 0, 1.6, .02, 1.1), P('box', RUG2, 0, .02, 0, 1.3, .02, .8), P('box', '#5f7fa8', 0, .03, 0, .9, .02, .4)] },
  { id: 'blumentopf', name: 'Blumentopf', needs: { clay: 2, fiber: 1 }, fine: true, parts: () => [P('cyl', '#b8643c', 0, .13, 0, .16, .26, .16), P('ico', '#5f9a3a', 0, .36, 0, .2, .16, .2), P('ico', '#6f9a45', .1, .45, .05, .12, .1, .12), P('ico', '#e0708a', -.05, .5, .04, .06, .06, .06), P('ico', '#f0d060', .07, .52, -.06, .05, .05, .05)] },
  { id: 'kerze', name: 'Kerze', needs: { clay: 1, fiber: 1 }, fine: true, light: [0, .3, 0], parts: () => [P('cyl', DARK, 0, .015, 0, .09, .03, .09), P('cyl', '#f2ead6', 0, .13, 0, .04, .22, .04), P('ico', LAMP, 0, .27, 0, .025, .05, .025)] },
  { id: 'vase', name: 'Vase', needs: { clay: 2 }, fine: true, parts: () => [P('cyl', CLAY, 0, .18, 0, .12, .36, .12), P('cyl', CLAY, 0, .38, 0, .07, .06, .07), ...[-.3, 0, .3].map(a => P('box', '#b39a6a', Math.sin(a) * .06, .55, 0, .015, .35, .015, 0, a)), P('ico', '#e6c35c', -.08, .72, 0, .04, .04, .04), P('ico', '#d9735e', .08, .72, 0, .04, .04, .04)] },
  { id: 'buecher', name: 'Bücherstapel', needs: { plank: 1, fiber: 2 }, fine: true, parts: () => [P('box', '#5f7fa8', 0, .03, 0, .32, .06, .24), P('box', '#b5573f', .02, .09, 0, .3, .06, .22, .2), P('box', '#6f9a45', -.01, .15, 0, .28, .06, .22, -.15), P('box', '#d9a03c', 0, .21, 0, .26, .06, .2, .4)] },
  { id: 'schaukelstuhl', name: 'Schaukelstuhl', needs: { plank: 4, rope: 1 }, fine: true, parts: () => [P('box', WOOD, 0, .5, 0, .5, .06, .5), P('box', WOOD, 0, .85, -.25, .5, .65, .05, 0, -.2), P('box', WOOD2, -.22, .06, 0, .05, .06, .8), P('box', WOOD2, .22, .06, 0, .05, .06, .8), ...[[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].map(([x, z]) => P('box', WOOD2, x, .28, z, .04, .44, .04)), P('box', '#5f7fa8', 0, .55, .02, .44, .05, .44)] },
  { id: 'wandbild', name: 'Wandbild', needs: { plank: 1, berries: 2 }, parts: () => [P('box', WOOD2, 0, 1.45, E + .15, .76, .56, .04), P('box', '#f4ecd8', 0, 1.45, E + .17, .66, .46, .02), P('box', '#86aedb', 0, 1.55, E + .18, .66, .2, .01), P('box', '#6f9a45', 0, 1.33, E + .18, .66, .16, .01), P('box', '#c8653a', .12, 1.4, E + .19, .12, .14, .01)] },
  { id: 'fass', name: 'Regenfass', needs: { plank: 4, rope: 2 }, fine: true, use: 'drink', parts: () => [P('cyl', '#9a6a3e', 0, .4, 0, .3, .8, .3), P('cyl', DARK, 0, .2, 0, .315, .04, .315), P('cyl', DARK, 0, .6, 0, .315, .04, .315), P('cyl', '#3f6585', 0, .79, 0, .26, .02, .26)] },
  { id: 'haengematte', name: 'Hängematte', needs: { rope: 2, fiber: 4 }, use: 'sleep', parts: () => [P('box', WOOD2, -.9, .7, 0, .1, 1.4, .1), P('box', WOOD2, .9, .7, 0, .1, 1.4, .1), P('box', '#d9c9a3', 0, .62, 0, 1.4, .05, .55), P('box', '#c9b48a', 0, .64, 0, 1.2, .05, .4), P('box', '#a8946a', -.82, .9, 0, .2, .03, .03, 0, 0), P('box', '#a8946a', .82, .9, 0, .2, .03, .03)] }
];
const WORKBENCH = { id: 'werkbank', name: 'Werkbank', cost: 4, use: 'craft', sink: true, parts: () => [
  P('box', WOOD, 0, .85, -.3, 1.6, .1, .7), ...[[-.72, -.6], [.72, -.6], [-.72, 0], [.72, 0]].map(([x, z]) => P('box', WOOD2, x, .42, z, .08, .84, .08)),
  P('box', WOOD2, 0, .25, -.3, 1.5, .05, .6), P('box', '#8f8a84', -.4, .92, -.3, .5, .02, .12, .3), P('box', WOOD2, -.62, .92, -.45, .14, .04, .04),
  P('box', '#6d655c', .45, .95, -.45, .1, .1, .22), P('box', WOOD2, .45, .93, -.2, .04, .04, .35), P('box', '#8f8a84', .25, .91, -.15, .15, .03, .05)] };

/* ---------- Materialien in der Welt ---------- */
function stoneParts(x, y, z, r) { const a = []; for (let i = 0; i < 3 + Math.floor(r() * 2); i++) a.push(P('rock', i % 2 ? '#a39d93' : '#8f8a84', x + (r() - .5) * .5, y + .06, z + (r() - .5) * .5, .12 + r() * .1, .08 + r() * .05, .12 + r() * .08, r() * 6)); return a; }
function fiberParts(x, y, z, r) { const a = []; for (let i = 0; i < 7; i++) { const t = r() * 6.28, h = .45 + r() * .3; a.push(P('box', r() < .5 ? '#c9b46a' : '#a8b85a', x + Math.cos(t) * .1, y + h / 2, z + Math.sin(t) * .1, .025, h, .04, t, (r() - .5) * .5)); } return a; }
function clayParts(x, y, z, r) { const a = []; for (let i = 0; i < 3; i++) a.push(P('ico', i % 2 ? '#a7714b' : '#b8835a', x + (r() - .5) * .5, y + .03, z + (r() - .5) * .5, .2 + r() * .1, .06, .16 + r() * .08)); return a; }
const PARTS = { stone: stoneParts, fiber: fiberParts, clay: clayParts };
function addItem(owner, fk, x, z, r) {
  const y = height(x, z) - .02;
  owner.items.push({ kind: fk === 'fiber' ? 'herb' : 'mushroom', fk, x, y, z, key: ikey(x, z), owner, fruit: PARTS[fk](x, y, z, r) });
}
function chunk(ch, cx, cz) {
  const r = rng(Math.floor(hash(cx - 313, cz + 59) * 1e9));
  for (let k = 0; k < 3; k++) { const x = cx * CS + r() * CS, z = cz * CS + r() * CS, h = height(x, z); if (h > .6 && h < 22) addItem(ch, 'stone', x, z, r); }
  for (let k = 0; k < 4; k++) { const x = cx * CS + r() * CS, z = cz * CS + r() * CS, h = height(x, z); if (h > 1.2 && h < 12 && normalAt(x, z).y > .85 && r() < .7) addItem(ch, 'fiber', x, z, r); }
  for (let k = 0; k < 10; k++) { const x = cx * CS + r() * CS, z = cz * CS + r() * CS, h = height(x, z); if (h > .05 && h < 1.1) { addItem(ch, 'clay', x, z, r); if (r() < .6) break; } }
}

/* ---------- Truhe (alle Truhen teilen sich ihren Inhalt) ---------- */
const CHEST_KEY = KEY + '-truhe';
let chest = {};
function loadChest() { try { chest = JSON.parse(localStorage.getItem(CHEST_KEY) || '{}') || {}; } catch (e) { chest = {}; } }
function saveChest() { try { localStorage.setItem(CHEST_KEY, JSON.stringify(chest)); } catch (e) { } }
const storable = k => ITEMS[k] && !NO_BAG.has(ITEMS[k].cat);

/* ---------- Fenster: Werkbank und Truhe ---------- */
let el = null, mode = 'craft', tab = 'material';
const has = needs => Object.entries(needs).every(([k, n]) => (INV[k] || 0) >= n);
const known = it => !it.needsItem || ITEMS[it.needsItem];
const needText = needs => Object.entries(needs).map(([k, n]) => { const h = INV[k] || 0; return `<span class="${h >= n ? 'ok' : 'miss'}">${n} ${n === 1 ? ITEMS[k].one : ITEMS[k].name} (${h})</span>`; }).join(' · ');
function recipesFor(t) {
  if (t === 'material') return [{ id: 'plank', name: '3 Bretter', needs: { wood: 2 }, effect: 'Zum Bauen von Möbeln', give: ['plank', 3] }, { id: 'rope', name: 'Seil', needs: { fiber: 3 }, effect: 'Für Werkzeuge und Möbel', give: ['rope', 1] }];
  if (t === 'tool') return TOOLS.filter(known).map(x => ({ ...x, give: [x.id, 1], once: true }));
  return FURNITURE.map(x => ({ id: x.id, name: x.name, needs: x.needs, effect: x.use === 'store' ? 'Lager für deine Vorräte' : x.use === 'sleep' ? 'Zum Ausruhen' : x.use === 'drink' ? 'Wasserstelle im Haus' : x.light ? 'Spendet warmes Licht' : 'Zum Einrichten', give: [x.id, 1] })).filter(x => Object.keys(x.needs).every(k => ITEMS[k]));
}
function drawCraft() {
  const list = recipesFor(tab);
  el.querySelector('.card').innerHTML = `
    <h2>Werkbank</h2>
    <p class="cr-note">Hier stellst du Material, Werkzeuge und Möbel her. Möbel stellst du danach im Baumodus auf (Knopf „Bauen“).</p>
    <div class="cr-tabs">${[['material', 'Material'], ['tool', 'Werkzeuge'], ['moebel', 'Möbel und Deko']].map(([k, n]) => `<button class="b${tab === k ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="cr-list">${list.map(x => {
      const own = x.once && (INV[x.id] || 0) > 0, ok = has(x.needs), cnt = !x.once && tab === 'moebel' ? ` <i>vorrätig: ${INV[x.id] || 0}</i>` : '';
      return `<div class="cr-card${own ? ' own' : ''}"><div><b>${x.name}</b>${cnt}<small>${x.effect}</small><small class="needs">${own ? 'Besitzt du schon' : needText(x.needs)}</small></div>${own ? '' : `<button class="b${ok ? ' main' : ''}" data-make="${x.id}" ${ok ? '' : 'disabled'}>Herstellen</button>`}</div>`;
    }).join('')}</div>
    <div class="ck-bar"><b></b></div>
    <div class="row"><button class="b main" data-act="close">Fertig</button></div>`;
}
let busy = false;
function make(id) {
  if (busy) return;
  const x = recipesFor(tab).find(r => r.id === id); if (!x || !has(x.needs)) return;
  busy = true; const bar = el.querySelector('.ck-bar b'), t0 = performance.now(), dur = 1300;
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / dur); bar.style.width = (k * 100).toFixed(0) + '%';
    if (Math.random() < .12) burst(2200, 'highpass', .05, .07);
    if (k < 1) { requestAnimationFrame(tick); return; }
    for (const [k2, n] of Object.entries(x.needs)) INV[k2] -= n;
    const [g, n] = x.give, got = give(ITEMS, g, n);
    if (got < n) { INV[g] -= got; for (const [k2, m] of Object.entries(x.needs)) INV[k2] += m; toast('Kein Platz im Rucksack. Bring etwas in eine Truhe.'); }
    else { advance(.25); sfx('pick'); emit('done'); applyTools(); toast(x.once ? `${x.name} hergestellt: ${x.effect}.` : `${x.name} hergestellt.` + (tab === 'moebel' ? ' Stell es im Baumodus auf.' : '')); }
    busy = false; drawCraft(); drawInv(); saveLife();
  };
  requestAnimationFrame(tick);
}
function drawChest() {
  const bagKeys = Object.keys(INV).filter(k => storable(k) && INV[k] > 0), chKeys = Object.keys(chest).filter(k => ITEMS[k] && chest[k] > 0);
  const row = (k, n, dir) => `<div class="bagrow"><div><b>${ITEMS[k].name}</b> <strong>${n}</strong></div><div class="row" style="margin:0"><button class="b" data-mv="${dir}" data-k="${k}" data-n="1">1 ${dir === 'in' ? '→' : '←'}</button><button class="b" data-mv="${dir}" data-k="${k}" data-n="all">Alle ${dir === 'in' ? '→' : '←'}</button></div></div>`;
  el.querySelector('.card').innerHTML = `
    <h2>Truhe</h2>
    <p class="cr-note">Alle Truhen teilen sich ihren Inhalt. In der Truhe verdirbt nichts.</p>
    <h3>Im Rucksack</h3><div class="baglist">${bagKeys.map(k => row(k, INV[k], 'in')).join('') || '<p>Nichts zum Einlagern.</p>'}</div>
    <h3>In der Truhe</h3><div class="baglist">${chKeys.map(k => row(k, chest[k], 'out')).join('') || '<p>Die Truhe ist leer.</p>'}</div>
    <div class="row"><button class="b main" data-act="close">Fertig</button></div>`;
}
function move(dir, k, nStr) {
  if (dir === 'in') { const n = nStr === 'all' ? INV[k] : 1; INV[k] -= n; chest[k] = (chest[k] || 0) + n; }
  else { const want = nStr === 'all' ? chest[k] : 1, got = give(ITEMS, k, want); chest[k] -= got; if (got < want) toast('Der Rucksack ist voll.'); }
  saveChest(); drawChest(); drawInv(); saveLife();
}
function open(m) { mode = m; G.paused = true; (m === 'craft' ? drawCraft : drawChest)(); el.classList.remove('hide'); }
function close() { if (busy) return; el.classList.add('hide'); if (G.started) G.paused = false; }
function onClick(e) {
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  if (t.dataset.act === 'close') close();
  else if (t.dataset.tab) { tab = t.dataset.tab; drawCraft(); }
  else if (t.dataset.make) make(t.dataset.make);
  else if (t.dataset.mv) move(t.dataset.mv, t.dataset.k, t.dataset.n);
}

/* ---------- Einbau ---------- */
const CSS = `
.cr-note{color:var(--ink2);font-size:15px}
.cr-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}
.cr-list{display:grid;gap:8px}
.cr-card{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1.5px solid var(--ink);border-radius:var(--hand);background:rgba(255,255,255,.4)}
.cr-card.own{opacity:.6;border-style:dashed}
.cr-card i{font-style:normal;font-size:14px;color:var(--wash)}
.cr-card small{display:block;font-size:14px;color:var(--ink2)}
.cr-card .needs .ok{color:#3b6d11}.cr-card .needs .miss{color:#9c3b2a}
.cr-card .b[disabled]{opacity:.45}
.ck-bar{height:10px;border:1.5px solid var(--ink);border-radius:6px;overflow:hidden;margin:10px 0 2px;background:rgba(255,255,255,.4)}
.ck-bar b{display:block;height:100%;width:0;background:#e0a35a}`;
const HELP = `<h3>Handwerk und Einrichtung</h3><dl class="ctl">
  <dt>Material</dt><dd>Steine liegen überall herum, Fasern wachsen als hohes Gras auf Wiesen, Lehm findest du am Seeufer.</dd>
  <dt>Werkbank</dt><dd>steht im Häuschen. Dort sägst du Bretter, drehst Seile und stellst Werkzeuge und Möbel her.</dd>
  <dt>Werkzeuge</dt><dd>wirken dauerhaft: Axt, Korb, Handschuhe, Laterne, Feldflasche, gute Angel.</dd>
  <dt>Möbel</dt><dd>im Baumodus aufstellen, sie rasten fein ein. Mit dem Radierer bekommst du sie zurück.</dd>
  <dt>Rucksack</dt><dd>hat 24 Plätze, mit Korb 36. Überzähliges kommt in eine Truhe, dort verdirbt nichts.</dd></dl>`;

function registerPiece(def) { def.geo = merge(def.parts()); def.top = def.geo.boundingBox.max.y; PIECES.push(def); BYID[def.id] = def; }
function init() {
  Object.assign(ITEMS, MATERIALS);
  for (const t of TOOLS) ITEMS[t.id] = { name: t.name, one: t.name, cat: 'tool', desc: t.effect, spoil: 0 };
  for (const f of FURNITURE) { ITEMS[f.id] = { name: f.name, one: f.name, cat: 'moebel', desc: 'im Baumodus aufstellen', spoil: 0 }; registerPiece({ ...f, costItems: { [f.id]: 1 } }); }
  registerPiece(WORKBENCH);
  applyTools(); loadChest();
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  el = document.createElement('div'); el.className = 'sheet feature hide'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="card"></div>'; el.addEventListener('click', onClick); document.body.appendChild(el);
  $('#help .card .row:last-child').insertAdjacentHTML('beforebegin', HELP);
  /* Werkbank im Häuschen, vor dem Ostfenster */
  const h = G.house;
  addPiece({ t: 'werkbank', x: h.hx + 4, y: h.bed.y, z: h.hz + 2, r: 3, world: 1 });
  /* Startmaterial beim Haus */
  const home = { group: new THREE.Group(), items: [], fruitMesh: null }, r = rng(777);
  scene.add(home.group);
  [[h.hx + 8, h.hz + 6], [h.hx - 3, h.hz + 9]].forEach(([x, z]) => addItem(home, 'stone', x, z, r));
  [[h.hx + 3.5, h.hz + 9], [h.hx + 9.5, h.hz + 3]].forEach(([x, z]) => addItem(home, 'fiber', x, z, r));
  G.owners.push(home); buildFruit(home);
}

export default {
  name: 'crafting', init, chunk,
  pieceActions: p => p.def.use === 'craft' ? [{ label: 'Werkbank benutzen', run: () => open('craft') }] : p.def.use === 'store' ? [{ label: 'Truhe öffnen', run: () => open('store') }] : [],
  reset: () => { chest = {}; saveChest(); applyTools(); }
};
