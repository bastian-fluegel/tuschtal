import { G, pos } from './state.js';
import { KEY } from './config.js';
import { U } from './shaders.js';
import { fireLitNear } from './survival.js';

/* ---------- GERÄUSCHE (Web Audio, alles synthetisch) ---------- */
export let AC = null, master = null, windGain = null;
try { G.soundOn = localStorage.getItem(KEY + '-ton') !== '0'; } catch (e) { }
export let noiseBuf = null;
/* iPhone: Web Audio ist bei Stummschalter sonst stumm.
   1. Audio-Session auf "playback" stellen (Safari ab iOS 16.4)
   2. Fallback: ein stummes <audio>-Element abspielen, das schaltet iOS auf Medienwiedergabe */
let unlockEl = null;
function silentWav() {
  const n = 2205, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer), w = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  let s = ''; b.forEach(x => s += String.fromCharCode(x)); return 'data:audio/wav;base64,' + btoa(s);
}
function unlockIOS() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
  try {
    if (!unlockEl) { unlockEl = document.createElement('audio'); unlockEl.src = silentWav(); unlockEl.loop = true; unlockEl.setAttribute('playsinline', ''); unlockEl.volume = .01; }
    const p = unlockEl.play(); if (p && p.catch) p.catch(() => { });
  } catch (e) { }
}
function chime() {
  const t0 = AC.currentTime;
  [660, 880].forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t0 + i * .12); g.gain.linearRampToValueAtTime(.12, t0 + i * .12 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + i * .12 + .5); o.connect(g).connect(master); o.start(t0 + i * .12); o.stop(t0 + i * .12 + .55); });
}
export function initAudio() {
  if (!G.soundOn) return;
  unlockIOS();
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 1; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      windGain = AC.createGain(); windGain.gain.value = .0; src.connect(lp).connect(windGain).connect(master); src.start();
      chime();
    }
    if (AC.state !== 'running') AC.resume();
  } catch (e) { AC = null; }
}
export function out(pan) { if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; p.connect(master); return p; } return master; }
export function chirp() {
  const t0 = AC.currentTime, n = 2 + Math.floor(Math.random() * 4), o = AC.createOscillator(), g = AC.createGain(), f = 2300 + Math.random() * 1700;
  o.type = 'sine'; g.gain.value = 0; o.connect(g).connect(out(Math.random() * 1.6 - .8));
  for (let i = 0; i < n; i++) { const s = t0 + i * .12; o.frequency.setValueAtTime(f * (1 + i % 2 * .15), s); o.frequency.exponentialRampToValueAtTime(f * 1.45, s + .07); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.09, s + .012); g.gain.linearRampToValueAtTime(0, s + .08); }
  o.start(t0); o.stop(t0 + n * .12 + .1);
}
export function cricket() {
  const t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = 4300 + Math.random() * 400; g.gain.value = 0;
  o.connect(g).connect(out(Math.random() * 1.6 - .8));
  for (let i = 0; i < 3; i++) { const s = t0 + i * .06; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.028, s + .01); g.gain.linearRampToValueAtTime(0, s + .04); }
  o.start(t0); o.stop(t0 + .25);
}
export function burst(freq, type, dur, vol) {
  if (!AC || !G.soundOn) return;
  const t0 = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(f).connect(g).connect(master); s.start(t0, Math.random()); s.stop(t0 + dur);
}
export function sfx(kind, dist = 0) {
  if (!AC || !G.soundOn) return;
  const v = Math.max(0, 1 - dist / 40);
  if (kind === 'splash' && v > 0) burst(900, 'lowpass', .35, .14 * v);
  if (kind === 'pick') burst(2500, 'bandpass', .08, .08);
}
export function updateSound(dt, t) {
  if (!AC || !G.soundOn || G.paused) { if (windGain) windGain.gain.value = 0; return; }
  const day = U.uDay.value;
  windGain.gain.value = .05 + .03 * Math.sin(t * .3) + Math.max(0, pos.y - 10) * .003;
  if (day > .4 && Math.random() < dt * .6) chirp();
  if (day < .35 && Math.random() < dt * 1.6) cricket();
  if (fireLitNear(6) && Math.random() < dt * 5) burst(1800, 'highpass', .05, .05);
}


export function setSound(v) {
  G.soundOn = v;
  try { localStorage.setItem(KEY + '-ton', v ? '1' : '0'); } catch (e) { }
  if (v) initAudio(); else { if (windGain) windGain.gain.value = 0; if (unlockEl) unlockEl.pause(); }
}
