import { $, clamp, MOUSE_LOOK } from './config.js';
import { G } from './state.js';
import { PIECES } from './pieces.js';
import { buildAt, doUndo } from './building.js';
import { canvas } from './engine.js';
import { saveLife } from './survival.js';
import { hold, joy, keys } from './player.js';
import { initAudio } from './audio.js';
import { eatItem, edibleOrder, escape, menuOpen, openMenu, runAction, runMore, toggleBag, setTool, startGame, toggleBuild, toggleFly } from './ui.js';

/* ---------- EINGABE ---------- */
export const ptrs = new Map(), joyEl = $('#joy'), knob = $('#knob');
export const ndc = (x, y) => [x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1];
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- MAUS FANGEN (Computer) ----------
   Ein Klick ins Bild fängt die Maus: Bewegen = umsehen, Linksklick = Aktion bzw. Setzen,
   Rechtsklick = Abreißen. Esc gibt sie frei und öffnet das Menü. Öffnet sich ein Fenster
   (Rucksack, Kochen, Werkbank), wird die Maus freigegeben und danach wieder gefangen. */
export const locked = () => document.pointerLockElement === canvas;
let wantLock = false, unlockAt = 0, skipMove = 0;
function requestLock() {
  if (!canvas.requestPointerLock) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (_) { }
}
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', locked());
  if (locked()) { wantLock = true; G.hover = null; skipMove = 2; return; }
  unlockAt = performance.now();
  if (G.started && !menuOpen() && !G.paused) openMenu();   /* mit Esc freigegeben: Pause */
});
document.addEventListener('pointerlockerror', () => { });
/* jedes Bild: bei offenem Fenster freigeben, danach wieder fangen (Klick oder Taste zählt als Erlaubnis) */
export function updateLock() {
  if (locked() && (menuOpen() || !G.started || G.coarse)) document.exitPointerLock();
}
function relockSoon() {
  setTimeout(() => { if (wantLock && !locked() && G.started && !G.paused && !menuOpen() && !G.coarse) requestLock(); }, 0);
}
document.addEventListener('click', relockSoon);
addEventListener('keyup', relockSoon);

canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (e.pointerType === 'mouse' && G.started) {
    G.coarse = false;
    if (locked()) {                                        /* gefangene Maus: Klick wirkt in der Bildmitte */
      if (G.paused) return;
      if (G.build) buildAt(0, 0, e.button === 2); else if (e.button === 0) runAction();
      return;
    }
  }
  /* erster Klick fängt die Maus; klappt das nicht, bleibt Ziehen zum Umsehen als Rückfall */
  const lockTry = e.pointerType === 'mouse' && G.started && !G.paused && e.button === 0 && !!canvas.requestPointerLock;
  if (lockTry) requestLock();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  G.coarse = e.pointerType !== 'mouse';
  const kind = G.coarse && e.clientX < innerWidth * .45 ? 'move' : 'look';
  ptrs.set(e.pointerId, { kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), dist: 0, btn: e.button, lockTry });
  if (kind === 'move') { joyEl.classList.add('active'); joyEl.style.left = (e.clientX - 62) + 'px'; joyEl.style.top = (e.clientY - 62) + 'px'; joyEl.style.bottom = 'auto'; }
});
canvas.addEventListener('pointermove', e => {
  if (locked()) {
    /* Browser melden direkt nach dem Fangen manchmal einen Riesensprung: ersten Schritt und Ausreißer verwerfen */
    if (skipMove > 0) { skipMove--; return; }
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
    G.yaw -= e.movementX * MOUSE_LOOK; G.pitch = clamp(G.pitch - e.movementY * MOUSE_LOOK, -1.45, 1.45); return;
  }
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') { G.coarse = false; G.hover = ndc(e.clientX, e.clientY); } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.dist += Math.abs(dx) + Math.abs(dy);
  if (p.kind === 'look') { const k = G.coarse ? .0055 : .0042; G.yaw -= dx * k; G.pitch = clamp(G.pitch - dy * k, -1.45, 1.45); if (!G.coarse) G.hover = ndc(e.clientX, e.clientY); }
  else {
    /* Daumen weit über den Rand hinausziehen = rennen */
    let jx = (e.clientX - p.x0) / 50, jy = (e.clientY - p.y0) / 50; const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; }
    joy.x = jx; joy.y = jy; joy.run = l > 1.45; knob.style.transform = `translate(${jx * 34}px,${jy * 34}px)`; joyEl.classList.toggle('run', joy.run);
  }
});
export function endPtr(e) {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
  if (p.kind === 'move') { joy.x = joy.y = 0; joy.run = false; joyEl.classList.remove('active', 'run'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; knob.style.transform = ''; return; }
  if (e.type === 'pointerup' && !p.lockTry && p.dist < 10 && performance.now() - p.t0 < 400) {
    const [x, y] = ndc(e.clientX, e.clientY);
    if (G.build) buildAt(x, y, p.btn === 2); else if (G.curAction) runAction();
  }
}
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
/* Mausrad im Baumodus: Bauteil wechseln */
let wheelT = 0;
canvas.addEventListener('wheel', e => {
  if (!G.build || G.paused) return;
  e.preventDefault();
  const now = performance.now(); if (now - wheelT < 120 || Math.abs(e.deltaY) < 4) return; wheelT = now;   /* Trackpads feuern viele kleine Schritte */
  const list = [...PIECES.keys(), 'erase'], i = list.indexOf(G.tool), d = e.deltaY > 0 ? 1 : -1;
  setTool(list[(i + d + list.length) % list.length]);
}, { passive: false });
addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (G.started && performance.now() - unlockAt > 400) escape(); return; }   /* Esc hat schon die Maus freigegeben */
  if (!G.started) { if (e.code === 'Enter' || e.code === 'Space') startGame(); return; }
  if ((e.code === 'KeyI' || e.code === 'Tab') && G.started) { e.preventDefault(); if (!menuOpen() || !document.getElementById('bag').classList.contains('hide')) toggleBag(); return; }
  if (menuOpen()) return;
  G.coarse = false;
  keys[e.code] = true;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyB') toggleBuild();
  else if (e.code === 'KeyE') runAction();
  else if (G.build) {
    if (e.code === 'KeyR') G.rot = (G.rot + 1) % 4;
    else if (e.code === 'KeyF') toggleFly();
    else if (e.code === 'KeyX') setTool('erase');
    else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) doUndo();
    else if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (PIECES[i]) setTool(i); }
  } else if (e.code === 'KeyQ') runMore(0);
  else if (e.code === 'KeyR') runMore(1);
  else if (/^Digit[1-9]$/.test(e.code)) { const k = edibleOrder()[+e.code.slice(5) - 1]; if (k) eatItem(k); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; hold.up = hold.down = false; saveLife(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveLife(); });

