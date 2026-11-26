/* ============================================================
   UI – HUD, Titel, Menü, Tutorial, Bau-Leiste
   Alles, was der Spieler sieht und antippt. Keine Spiellogik hier,
   nur Aufrufe in die anderen Module.
   ============================================================ */
import { $, KEY, LKEY, STATS, GAME, FOODS, ITEMS, CATS, clamp } from './config.js';
import { G, INV, S, T, pos, MODS, bagUsed, NO_BAG } from './state.js';
import { PIECES } from './pieces.js';
import { buildAt, doUndo, ghost, pieces, removePiece, saveBuild, undo } from './building.js';
import { buildFruit, chunks } from './world.js';
import { eat, saveLife, rebuildAllFruit } from './survival.js';
import { hook, collect } from './features.js';
import { height } from './terrain.js';
import { hold } from './player.js';
import { initAudio, setSound } from './audio.js';

/* ---------- HUD ---------- */
let statEls = [];
export function drawStats() {
  for (const [k, row, bar] of statEls) { bar.style.width = S[k].toFixed(0) + '%'; row.classList.toggle('warn', S[k] < 25); }
  const hh = Math.floor(T.hour), mm = Math.floor((T.hour - hh) * 60 / 10) * 10;
  const part = T.hour < 5 || T.hour >= 21 ? 'Nacht' : T.hour < 10 ? 'Morgen' : T.hour < 17 ? 'Tag' : 'Abend';
  $('#clock').textContent = `Tag ${T.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${part}`;
  $('#tired').style.opacity = clamp((25 - S.energy) / 25, 0, 1).toFixed(2);
  document.body.classList.toggle('kbd', !G.coarse);
  document.body.classList.toggle('touch', G.coarse);
}
/* Rucksack: Schnellanzeige im HUD + Liste zum Essen */
export const edibleOrder = () => Object.keys(FOODS).filter(k => (INV[k] || 0) > 0);
const fx = f => [['food', 'Essen'], ['water', 'Trinken'], ['warm', 'Wärme'], ['energy', 'Energie']].filter(([k]) => f[k]).map(([k, n]) => `+${f[k]} ${n}`).join(' · ');
export function drawInv() {
  const used = bagUsed(ITEMS), cap = MODS.bagMax === Infinity ? '' : `/${MODS.bagMax}`;
  $('#inv').innerHTML = `<button class="b${used >= MODS.bagMax ? ' full' : ''}" id="bBag">Rucksack <strong>${used}${cap}</strong> <kbd>I</kbd></button><span class="b" style="pointer-events:none">Holz <strong>${INV.wood || 0}</strong></span>`;
  if (!$('#bag').classList.contains('hide')) drawBag();
  paletteCounts();
}
function drawBag() {
  const order = edibleOrder(), used = bagUsed(ITEMS);
  const keys = Object.keys(ITEMS).filter(k => (INV[k] || 0) > 0);
  $('#bagCap').textContent = MODS.bagMax === Infinity ? '' : `${used} von ${MODS.bagMax} Plätzen belegt · Werkzeuge und Möbel brauchen keinen Platz`;
  const groups = Object.entries(CATS).map(([c, title]) => [title, keys.filter(k => (ITEMS[k].cat || 'nahrung') === c)]).filter(([, ks]) => ks.length);
  $('#bagList').innerHTML = groups.length ? groups.map(([title, ks]) => `<h3>${title}</h3>` + ks.map(k => {
    const I = ITEMS[k], f = FOODS[k], i = order.indexOf(k);
    const note = [f ? fx(f) : (I.desc || ''), I.spoil ? (I.spoil >= .9 ? 'verdirbt über Nacht' : 'verdirbt mit der Zeit') : ''].filter(Boolean).join(' · ');
    return `<div class="bagrow"><div><b>${I.name}</b> <strong>${INV[k]}</strong><small>${note}</small></div>${f ? `<button class="b" data-k="${k}">Essen <kbd>${i + 1}</kbd></button>` : ''}</div>`;
  }).join('')).join('') : '<p>Dein Rucksack ist leer. Sammle Beeren, Äpfel und mehr in der Natur.</p>';
}
export function openBag() { if (!G.started) return; G.paused = true; drawBag(); $('#bag').classList.remove('hide'); }
export function closeBag() { $('#bag').classList.add('hide'); if (G.started && !menuOpen()) G.paused = false; }
export function toggleBag() { if ($('#bag').classList.contains('hide')) openBag(); else closeBag(); }
let toastT = 0;
export function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800); }
export function eatItem(k) { eat(k); tutNote('eat'); }

/* ---------- BAUEN ---------- */
const ERASER = '<svg viewBox="0 0 60 60" fill="none" stroke="#2b2622" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 38 31 17 48 31 30 49H18Z" fill="#f2b8ae"/><path d="M22 28 39 43"/><path d="M12 54h38"/></svg>';
export function buildPalette() {
  $('#pal').innerHTML = PIECES.map((p, i) => `<button class="it" data-i="${i}">${p.thumb ? `<img src="${p.thumb}" alt="">` : ''}<span>${p.name}</span>${p.costItems ? '<em class="cnt"></em>' : ''}</button>`).join('')
    + `<button class="it" data-i="erase">${ERASER}<span>Radierer</span></button>`;
  $('#pal').addEventListener('click', e => { const b = e.target.closest('.it'); if (b) setTool(b.dataset.i === 'erase' ? 'erase' : +b.dataset.i); });
}
export function paletteCounts() {
  document.querySelectorAll('.it').forEach(b => {
    const p = PIECES[+b.dataset.i]; if (!p || !p.costItems) return;
    const n = Math.min(...Object.entries(p.costItems).map(([k, c]) => Math.floor((INV[k] || 0) / c)));
    const em = b.querySelector('.cnt'); if (em) em.textContent = n; b.classList.toggle('empty', n < 1);
  });
}
export function setTool(t) {
  G.tool = t;
  document.querySelectorAll('.it').forEach(b => b.classList.toggle('on', b.dataset.i === String(t)));
  const on = document.querySelector('.it.on'); if (on && G.build) on.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  if (t !== 'erase') ghost.geometry = PIECES[t].geo;
  updateMode();
}
export function updateMode() {
  const m = $('#mode'); m.classList.toggle('hide', !G.build);
  m.textContent = (G.fly ? 'Fliegen' : 'Bauen') + ' · ' + (G.tool === 'erase' ? 'Radierer' : PIECES[G.tool].name + (PIECES[G.tool].cost ? ` (${PIECES[G.tool].cost} Holz)` : ''));
}
export function toggleBuild() {
  G.build = !G.build; document.body.classList.toggle('build', G.build);
  $('#bBuild').classList.toggle('on', G.build); $('#bBuild').innerHTML = (G.build ? 'Fertig' : 'Bauen') + ' <kbd>B</kbd>';
  if (!G.build && G.fly) toggleFly();
  if (G.build) setTool(G.tool);
  updateMode();
}
export function toggleFly() {
  G.fly = !G.fly; G.vy = 0; $('#bFly').classList.toggle('on', G.fly);
  $('#bUp').innerHTML = (G.fly ? 'Hoch' : 'Springen') + ' <kbd>Leertaste</kbd>'; $('#bDown').classList.toggle('hide', !G.fly); updateMode();
}
export function runAction() {
  if (G.paused) return;
  if (G.build) { buildAt(0, 0); return; }
  if (G.curAction) { perform(G.curAction); tutNote('act'); }
}
/* Ein Modul darf die Aktion übernehmen (z. B. mit Fortschritt), sonst läuft sie sofort */
function perform(a) { if (!collect('intercept', a).length) a.run(); }
/* Aktionsknopf: Beschriftung folgt dem, was gerade möglich ist */
export function drawAction() {
  const b = $('#bAct');
  if (G.build) { b.innerHTML = (G.tool === 'erase' ? 'Abreißen' : 'Setzen') + ' <kbd>E</kbd>'; b.classList.remove('hide'); }
  else { b.classList.toggle('hide', !G.curAction); if (G.curAction) b.innerHTML = G.curAction.label + ' <kbd>E</kbd>'; }
  const more = (!G.build && G.curAction && G.curAction.more) || [];
  ['#bAct2', '#bAct3'].forEach((id, i) => { const el = $(id), m = more[i]; el.classList.toggle('hide', !m); if (m) el.innerHTML = m.label + ` <kbd>${'QR'[i]}</kbd>`; });
}
export function runMore(i) { const m = !G.paused && !G.build && G.curAction && G.curAction.more && G.curAction.more[i]; if (m) { perform(m); tutNote('act'); } }

/* ---------- TITEL, MENÜ, HILFE ---------- */
const sheet = id => $(id);
export function startGame() {
  initAudio(); G.started = true; G.paused = false;
  document.body.classList.remove('title');
  showCoach();
}
export function toTitle() {
  saveLife(); closeMenu(); G.started = false; G.paused = true;
  if (G.build) toggleBuild();
  document.body.classList.add('title');
}
export function openMenu() { if (!G.started) return; G.paused = true; sheet('#menu').classList.remove('hide'); }
export function closeMenu() { sheet('#menu').classList.add('hide'); if (G.started) G.paused = false; }
export function menuOpen() { return ['#menu', '#help', '#bag'].some(id => !sheet(id).classList.contains('hide')) || !!document.querySelector('.sheet.feature:not(.hide)'); }
function openHelp() { G.paused = true; sheet('#help').classList.remove('hide'); }
function closeHelp() { sheet('#help').classList.add('hide'); if (G.started && sheet('#menu').classList.contains('hide')) G.paused = false; }
export function escape() {
  const fs = document.querySelector('.sheet.feature:not(.hide)');
  if (fs) { fs.classList.add('hide'); G.paused = false; }
  else if (!sheet('#bag').classList.contains('hide')) closeBag();
  else if (!sheet('#help').classList.contains('hide')) closeHelp();
  else if (!sheet('#menu').classList.contains('hide')) closeMenu();
  else openMenu();
}
function soundLabels() { document.querySelectorAll('.bSound').forEach(b => b.textContent = 'Ton: ' + (G.soundOn ? 'an' : 'aus')); }
function twoStep(sel, label, fn) {
  let arm = 0; const b = $(sel);
  b.onclick = () => {
    if (performance.now() - arm < 3000) { fn(); arm = 0; b.textContent = 'Erledigt'; setTimeout(() => b.textContent = label, 1500); }
    else { arm = performance.now(); b.textContent = 'Wirklich? Nochmal tippen'; setTimeout(() => { if (arm) b.textContent = label; }, 3000); }
  };
}
function newGame() {
  Object.assign(T, { day: 1, hour: 8 }); Object.assign(S, { food: 80, water: 72, energy: 88, warm: 75 });
  for (const k in INV) INV[k] = 0; Object.assign(INV, { berries: 1, apples: 2, wood: 2 });
  G.picked = {}; G.woodUsed = {}; G.fires = {}; rebuildAllFruit(); hook('reset');
  pos.set(G.house.door.x, height(G.house.door.x, G.house.door.z), G.house.door.z); G.yaw = 0; G.pitch = -.12; G.vy = 0;
  drawInv(); saveLife(); resetTutorial(); closeMenu();
}

/* ---------- TUTORIAL ----------
   Jeder Schritt hat einen Text für Touch und Tastatur und eine Bedingung. */
const TUT = [
  { touch: 'Setz den Daumen links auf und zieh, um zu laufen.', key: 'Lauf mit W A S D oder den Pfeiltasten.', done: t => t.walked > 5 },
  { touch: 'Wisch rechts über den Bildschirm, um dich umzusehen.', key: 'Halte die Maustaste gedrückt und zieh, um dich umzusehen.', done: t => t.turned > 1.4 },
  { touch: 'Geh zu einem Busch mit Beeren neben dem Haus. Unten rechts erscheint ein Knopf, tipp ihn an.', key: 'Geh zu einem Busch mit Beeren neben dem Haus und drück E, wenn unten rechts ein Knopf erscheint.', done: t => t.acted },
  { touch: 'Öffne oben links den Rucksack und iss etwas.', key: 'Drück I für den Rucksack und iss etwas (oder direkt 1).', done: t => t.ate },
  { touch: 'Gut gemacht! Behalte deine vier Werte im Blick. Nachts wird es kalt, dein Häuschen schützt dich.', key: 'Gut gemacht! Behalte deine vier Werte im Blick. Nachts wird es kalt, dein Häuschen schützt dich.', done: t => t.time > 7 }
];
const tut = { step: 0, walked: 0, turned: 0, acted: false, ate: false, time: 0, lx: 0, lz: 0, lyaw: 0 };
try { tut.step = +(localStorage.getItem(KEY + '-tut') || 0); } catch (e) { }
export function tutNote(ev) { if (ev === 'act') tut.acted = true; if (ev === 'eat') tut.ate = true; }
function saveTut() { try { localStorage.setItem(KEY + '-tut', String(tut.step)); } catch (e) { } }
function showCoach() {
  const c = $('#coach');
  if (tut.step >= TUT.length || !G.started) { c.classList.add('hide'); return; }
  const s = TUT[tut.step];
  $('#coachStep').textContent = `Schritt ${tut.step + 1} von ${TUT.length}`;
  $('#coachText').textContent = G.coarse ? s.touch : s.key;
  c.classList.remove('hide');
  Object.assign(tut, { walked: 0, turned: 0, acted: false, ate: false, time: 0, lx: pos.x, lz: pos.z, lyaw: G.yaw });
}
function resetTutorial() { tut.step = 0; saveTut(); showCoach(); }
export function updateTutorial(dt) {
  if (tut.step >= TUT.length || G.paused || !G.started) return;
  tut.walked += Math.hypot(pos.x - tut.lx, pos.z - tut.lz); tut.lx = pos.x; tut.lz = pos.z;
  tut.turned += Math.abs(G.yaw - tut.lyaw); tut.lyaw = G.yaw; tut.time += dt;
  if (TUT[tut.step].done(tut)) { tut.step++; saveTut(); showCoach(); }
  else $('#coachText').textContent = G.coarse ? TUT[tut.step].touch : TUT[tut.step].key;
}

/* ---------- VERDRAHTUNG ---------- */
export function initUI() {
  document.title = GAME.name;
  $('#gname').textContent = GAME.name; $('#gtag').textContent = GAME.tagline; $('#gver').textContent = 'Version ' + GAME.version;
  $('#stats').innerHTML = STATS.map(([k, n, c]) => `<div class="stat" id="st-${k}"><span>${n}</span><i><b style="background:${c};width:50%"></b></i></div>`).join('');
  statEls = STATS.map(([k]) => [k, $('#st-' + k), $('#st-' + k + ' b')]);
  $('#inv').addEventListener('click', e => { if (e.target.closest('#bBag')) openBag(); });
  $('#bagList').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { eatItem(b.dataset.k); drawBag(); } });
  $('#bBagClose').onclick = closeBag;
  const holdBtn = (el, k) => {
    const on = e => { e.preventDefault(); hold[k] = true; }, off = () => { hold[k] = false; };
    el.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, off));
  };
  holdBtn($('#bUp'), 'up'); holdBtn($('#bDown'), 'down');
  $('#bRot').onclick = () => { G.rot = (G.rot + 1) % 4; };
  $('#bUndo').onclick = doUndo; $('#bFly').onclick = toggleFly; $('#bBuild').onclick = toggleBuild;
  $('#bAct').onclick = runAction; $('#bAct2').onclick = () => runMore(0); $('#bAct3').onclick = () => runMore(1);
  $('#bPlay').onclick = startGame;
  $('#bHow').onclick = openHelp; $('#bHow2').onclick = openHelp; $('#bHelpOk').onclick = closeHelp;
  $('#bMenu').onclick = openMenu; $('#bResume').onclick = closeMenu; $('#bTitle').onclick = toTitle;
  $('#bTut').onclick = () => { resetTutorial(); closeMenu(); };
  $('#coachSkip').onclick = () => { tut.step = TUT.length; saveTut(); showCoach(); };
  document.querySelectorAll('.bSound').forEach(b => b.onclick = () => { setSound(!G.soundOn); soundLabels(); });
  soundLabels();
  twoStep('#bClear', 'Eigene Bauten löschen', () => { pieces.filter(p => !p.rec.world).forEach(removePiece); undo.length = 0; saveBuild(); });
  twoStep('#bReset', 'Neues Spiel beginnen', newGame);
  let hasSave = false; try { hasSave = !!localStorage.getItem(LKEY); } catch (e) { }
  $('#bPlay').textContent = hasSave ? 'Weiterspielen' : 'Spielen';
}
