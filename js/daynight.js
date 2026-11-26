import { DUSK, NIGHT, PAPER, WHITE } from './config.js';
import { G, T, pos, MODS } from './state.js';
import { U } from './shaders.js';
import { glows, renderer, smokes } from './engine.js';
import { pieces, worldPt } from './building.js';
const _w = new THREE.Vector3();

/* ---------- TAG UND NACHT ---------- */
export const sunDir = new THREE.Vector3(), _m = new THREE.Vector3(), tint = new THREE.Color();
export function updateSky() {
  const a = (T.hour - 6) / 12 * Math.PI, sy = Math.sin(a);
  sunDir.set(Math.cos(a) * .85, sy, .4).normalize();
  const day = THREE.MathUtils.smoothstep(sy, -.15, .3), dusk = Math.exp(-((sy / .2) ** 2));
  U.uSun.value.copy(sunDir); U.uDay.value = day; U.uDusk.value = dusk;
  U.uL.value.copy(sy > 0 ? sunDir : _m.set(-sunDir.x, -sunDir.y, sunDir.z).normalize());
  tint.copy(NIGHT).lerp(WHITE, day).lerp(DUSK, dusk * .45);
  U.uTint.value.copy(tint); U.uPaper.value.copy(PAPER).multiply(tint); renderer.setClearColor(U.uPaper.value);
}
export let smokeT = 0;
export function updateLights(dt, t) {
  const L = [], day = U.uDay.value;
  for (const p of pieces) {
    if (p.def.fire) {
      const lit = (G.fires[p.fkey] || 0) > 0; p.flame.visible = lit;
      if (lit) {
        const fl = .85 + .3 * Math.sin(t * 13 + p.x) * Math.sin(t * 7.3 + p.z);
        p.flame.scale.set(1, fl, 1); p.flame.rotation.y = t * 2;
        worldPt(p, p.def.fire, _w); L.push({ x: _w.x, y: _w.y + .5, z: _w.z, w: 1.4 * fl, s: 3.6 });
        if (p.def.smoke && (smokeT += dt) > .35) { smokeT = 0; const sm = smokes.find(s => s.userData.life <= 0); if (sm) { worldPt(p, p.def.smoke, sm.position); sm.userData.life = 1; sm.visible = true; } }
      }
    }
    if (p.def.light && day < .7) { worldPt(p, p.def.light, _w); L.push({ x: _w.x, y: _w.y, z: _w.z, w: .9 * (1 - day), s: 2.6 }); }
  }
  if (MODS.lantern && day < .7) L.push({ x: pos.x, y: pos.y + 1.3, z: pos.z, w: .85 * (1 - day), s: 2.2 });
  L.sort((a, b) => ((a.x - pos.x) ** 2 + (a.z - pos.z) ** 2) - ((b.x - pos.x) ** 2 + (b.z - pos.z) ** 2));
  for (let i = 0; i < 8; i++) {
    const l = L[i], v = U.uLights.value[i], gs = glows[i];
    if (l) { v.set(l.x, l.y, l.z, l.w); gs.visible = true; gs.position.set(l.x, l.y, l.z); gs.scale.setScalar(l.s); gs.material.opacity = Math.min(1, l.w) * .55 * (1 - day * .8); }
    else { v.set(0, -999, 0, 0); gs.visible = false; }
  }
  for (const s of smokes) {
    if (s.userData.life <= 0) continue;
    s.userData.life -= dt / 4.5; const k = 1 - s.userData.life;
    s.position.y += dt * .9; s.position.x += dt * .25;
    s.scale.setScalar(.6 + k * 2.4); s.material.opacity = Math.sin(Math.min(k * 3, 1) * 1.57) * .5 * s.userData.life;
    if (s.userData.life <= 0) s.visible = false;
  }
}

