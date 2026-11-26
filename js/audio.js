import { G, pos } from './state.js';
import { KEY } from './config.js';
import { U } from './shaders.js';
import { fireLitNear } from './survival.js';

/* ---------- GERÄUSCHE (Web Audio, alles synthetisch) ---------- */
export let AC = null, master = null, windGain = null;
try { G.soundOn = localStorage.getItem(KEY + '-ton') !== '0'; } catch (e) { }
export let noiseBuf = null;
export function initAudio() {
  if (!G.soundOn) return;
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = .55; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      windGain = AC.createGain(); windGain.gain.value = .0; src.connect(lp).connect(windGain).connect(master); src.start();
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
export function out(pan) { if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; p.connect(master); return p; } return master; }
export function chirp() {
  const t0 = AC.currentTime, n = 2 + Math.floor(Math.random() * 4), o = AC.createOscillator(), g = AC.createGain(), f = 2300 + Math.random() * 1700;
  o.type = 'sine'; g.gain.value = 0; o.connect(g).connect(out(Math.random() * 1.6 - .8));
  for (let i = 0; i < n; i++) { const s = t0 + i * .12; o.frequency.setValueAtTime(f * (1 + i % 2 * .15), s); o.frequency.exponentialRampToValueAtTime(f * 1.45, s + .07); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.045, s + .012); g.gain.linearRampToValueAtTime(0, s + .08); }
  o.start(t0); o.stop(t0 + n * .12 + .1);
}
export function cricket() {
  const t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = 4300 + Math.random() * 400; g.gain.value = 0;
  o.connect(g).connect(out(Math.random() * 1.6 - .8));
  for (let i = 0; i < 3; i++) { const s = t0 + i * .06; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.012, s + .01); g.gain.linearRampToValueAtTime(0, s + .04); }
  o.start(t0); o.stop(t0 + .25);
}
export function burst(freq, type, dur, vol, delay = 0) {
  if (!AC || !G.soundOn) return;
  const t0 = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(f).connect(g).connect(master); s.start(t0, Math.random()); s.stop(t0 + dur);
}
/* tone: kurzer Ton, der von f0 nach f1 gleitet */
export function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  if (!AC || !G.soundOn) return;
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + .02);
}
export function sfx(kind, dist = 0) {
  if (!AC || !G.soundOn) return;
  const v = Math.max(0, 1 - dist / 40), j = .85 + Math.random() * .3;
  if (kind === 'splash' && v > 0) burst(900, 'lowpass', .35, .14 * v);
  if (kind === 'pick') burst(2500, 'bandpass', .08, .08);
  /* Schritte und Landen */
  if (kind === 'step') { burst(1300 * j, 'bandpass', .07, .022); burst(450 * j, 'lowpass', .05, .02); }
  if (kind === 'stepWood') { burst(360 * j, 'bandpass', .07, .055); burst(1000 * j, 'bandpass', .03, .015); }
  if (kind === 'stepWater') burst(1000 * j, 'lowpass', .14, .045);
  if (kind === 'land') burst(240, 'lowpass', .16, .11);
  /* Arbeiten */
  if (kind === 'rustle') burst(3000 * j, 'highpass', .13, .035);
  if (kind === 'chop') { burst(300 * j, 'bandpass', .1, .17); burst(1500 * j, 'bandpass', .04, .05); }
  if (kind === 'scoop') { burst(750, 'lowpass', .3, .09); burst(1600, 'bandpass', .12, .025, .12); }
  if (kind === 'gulp') { tone(240, 150, .12, .05); tone(220, 140, .12, .04, 'sine', .22); }
  if (kind === 'crunch') for (let i = 0; i < 3; i++) burst(1700 * j, 'bandpass', .06, .06, i * .13);
  if (kind === 'whoosh') { burst(500, 'lowpass', .45, .09); for (let i = 0; i < 4; i++) burst(1900, 'highpass', .04, .05, .1 + i * .09); }
  /* Rückmeldungen */
  if (kind === 'gain') tone(620 * j, 940 * j, .09, .035);
  if (kind === 'thock') { burst(220, 'lowpass', .13, .14); tone(170, 110, .1, .05, 'triangle'); }
  if (kind === 'erase') { burst(2600, 'bandpass', .16, .05); burst(1800, 'bandpass', .12, .04, .08); }
  if (kind === 'chime') { tone(880, 880, .5, .04, 'sine'); tone(1320, 1320, .6, .03, 'sine', .12); }
}
export function updateSound(dt, t) {
  if (!AC || !G.soundOn || G.paused) { if (windGain) windGain.gain.value = 0; return; }
  const day = U.uDay.value;
  windGain.gain.value = .025 + .02 * Math.sin(t * .3) + Math.max(0, pos.y - 10) * .002;
  if (day > .4 && Math.random() < dt * .6) chirp();
  if (day < .35 && Math.random() < dt * 1.6) cricket();
  if (fireLitNear(6) && Math.random() < dt * 5) burst(1800, 'highpass', .05, .05);
}


export function setSound(v) {
  G.soundOn = v;
  try { localStorage.setItem(KEY + '-ton', v ? '1' : '0'); } catch (e) { }
  if (v) initAudio(); else if (windGain) windGain.gain.value = 0;
}
