/* ============================================================
   GERÄT – das Spiel stellt sich auf Handy, Tablet oder Computer ein
   Erkennung und Qualitätsstufen stehen in config.js (DEVICE, QUALITY).
   Hier: Bildschärfe passt sich der Bildrate an, Bildschirm bleibt an,
   Vollbild-Knopf, Pause beim Verlassen der App, iOS-Zoomgesten aus.
   ============================================================ */
import { $, DEVICE, QUALITY } from './config.js';
import { G } from './state.js';
import { renderer, setPixelRatio } from './engine.js';
import { menuOpen, openMenu } from './ui.js';

/* ---------- Bildschärfe nach Bildrate ----------
   Alle 2 Sekunden wird gemessen. Unter 42 Bildern pro Sekunde wird das Bild
   etwas gröber. Hilft das nicht (Bildrate ist vom Gerät begrenzt, z. B. im
   Stromsparmodus), kommt die Schärfe zurück. Über 56 wird es wieder feiner,
   aber nie feiner als eine Stufe, die schon einmal zu schwer war. */
let acc = 0, frames = 0, calmUntil = 0, probe = null, ratio = 1, floor = 1, ceil = 1;
function setRatio(r) { ratio = Math.round(r * 1000) / 1000; setPixelRatio(ratio); }
let wasStarted = false;
export function updateDevice(raw) {
  if (G.started !== wasStarted) { wasStarted = G.started; keepAwake(G.started); }
  if (document.hidden || raw > .5) { acc = frames = 0; return; }   /* Tab-Wechsel und Ladepausen nicht mitzählen */
  const now = performance.now(); if (now < calmUntil) return;
  acc += raw; frames++;
  if (acc < 2) return;
  const fps = frames / acc; acc = frames = 0;
  if (probe) {
    if (fps < probe.fps * 1.1) { floor = probe.ratio; setRatio(probe.ratio); }   /* keine Besserung: Schärfe zurück */
    else ceil = ratio;                                                           /* geholfen: höher lohnt sich nicht */
    probe = null; calmUntil = now + 4000; return;
  }
  if (fps < 42 && ratio > floor + .01) { probe = { fps, ratio }; setRatio(Math.max(floor, ratio - .25)); calmUntil = now + 1000; }
  else if (fps > 56 && ratio < ceil - .01) { setRatio(Math.min(ceil, ratio + .125)); calmUntil = now + 6000; }
}

/* ---------- Bildschirm anlassen (Handy) ---------- */
let wakeLock = null, wakeBusy = false;
async function keepAwake(on) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (on && !wakeLock && !wakeBusy && !document.hidden) {
      wakeBusy = true; wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { } finally { wakeBusy = false; }
}

/* ---------- Vollbild ---------- */
function fsLabel(b) { b.textContent = 'Vollbild: ' + (document.fullscreenElement ? 'an' : 'aus'); }
function addFullscreen() {
  if (!document.fullscreenEnabled) return;          /* iPhone kann das nicht: dort hilft „Zum Home-Bildschirm“ */
  const b = document.createElement('button'); b.className = 'b'; b.id = 'bFull'; fsLabel(b);
  b.onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }); };
  document.addEventListener('fullscreenchange', () => fsLabel(b));
  $('#bHow2').insertAdjacentElement('afterend', b);
}

export function initDevice() {
  ratio = renderer.getPixelRatio(); floor = Math.min(ratio, QUALITY.dprMin); ceil = Math.min(devicePixelRatio || 1, QUALITY.dprMax);
  calmUntil = performance.now() + 3000;              /* die ersten Sekunden ruckeln immer etwas */
  document.body.dataset.device = DEVICE.kind;
  addFullscreen();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.started && !menuOpen()) openMenu(); }   /* App verlassen: Pause */
    else if (G.started) keepAwake(true);
  });
  /* iOS ignoriert maximum-scale: Zwei-Finger-Zoom selbst abfangen (Doppeltipp verhindert touch-action im CSS) */
  document.addEventListener('gesturestart', e => e.preventDefault());
}
