import { $, clamp } from './config.js';
import { G } from './state.js';
import { PIECES } from './pieces.js';
import { buildAt, doUndo } from './building.js';
import { canvas } from './engine.js';
import { saveLife } from './survival.js';
import { hold, joy, keys } from './player.js';
import { initAudio } from './audio.js';
import { eatItem, edibleOrder, escape, menuOpen, runAction, runMore, toggleBag, setTool, startGame, toggleBuild, toggleFly } from './ui.js';

/* ---------- EINGABE ---------- */
export const ptrs = new Map(), joyEl = $('#joy'), knob = $('#knob');
export const ndc = (x, y) => [x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1];
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  initAudio();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  G.coarse = e.pointerType !== 'mouse';
  const kind = G.coarse && e.clientX < innerWidth * .45 ? 'move' : 'look';
  ptrs.set(e.pointerId, { kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), dist: 0, btn: e.button });
  if (kind === 'move') { joyEl.classList.add('active'); joyEl.style.left = (e.clientX - 62) + 'px'; joyEl.style.top = (e.clientY - 62) + 'px'; joyEl.style.bottom = 'auto'; }
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') { G.coarse = false; G.hover = ndc(e.clientX, e.clientY); } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.dist += Math.abs(dx) + Math.abs(dy);
  if (p.kind === 'look') { const k = G.coarse ? .0055 : .0042; G.yaw -= dx * k; G.pitch = clamp(G.pitch - dy * k, -1.45, 1.45); if (!G.coarse) G.hover = ndc(e.clientX, e.clientY); }
  else {
    let jx = (e.clientX - p.x0) / 50, jy = (e.clientY - p.y0) / 50; const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; }
    joy.x = jx; joy.y = jy; knob.style.transform = `translate(${jx * 34}px,${jy * 34}px)`;
  }
});
export function endPtr(e) {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
  if (p.kind === 'move') { joy.x = joy.y = 0; joyEl.classList.remove('active'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; knob.style.transform = ''; return; }
  if (e.type === 'pointerup' && p.dist < 10 && performance.now() - p.t0 < 400) {
    const [x, y] = ndc(e.clientX, e.clientY);
    if (G.build) buildAt(x, y, p.btn === 2); else if (G.curAction) runAction();
  }
}
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (G.started) escape(); return; }
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

