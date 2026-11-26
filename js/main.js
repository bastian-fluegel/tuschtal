/* ============================================================
   TUSCHTAL – Einstieg und Spielschleife
   Module (jedes ist einzeln erweiterbar):
     config    Name, Balancing, Konstanten         state     gemeinsamer Zustand (G, Werte, Vorrat)
     noise     Zufall/Rauschen                     terrain   Höhe und Farbe der Landschaft
     shaders   Tusche-Aquarell-Look, Tag/Nacht     geometry  Bausteine (Box, Kegel …) + merge
     nature    Bäume, Büsche, Felsen, Früchte      pieces    Bauteil-Katalog (hier neue Teile)
     engine    Renderer, Kamera, Himmel, Wasser    world     Chunks laden/entladen, Pflanzen
     house     das Starthäuschen                   building  Bauen, Abreißen, Speichern
     player    Bewegung, Kollision                 survival  Werte, Zeit, Aktionen, Schlaf
     daynight  Sonne, Licht, Feuer, Rauch          fauna     Rehe, Hasen, Vögel, Insekten, Fische
     audio     synthetische Geräusche              input     Touch, Maus, Tastatur
     ui        HUD, Titel, Menü, Tutorial, Rucksack
     features  Andockpunkte für abschaltbare Module
   Module (abschaltbar in config.js → FEATURES):
     features/cooking   Pilze, Kräuter, Angeln, Kochstelle, Rezeptbuch
     features/crafting  Steine, Fasern, Lehm, Werkbank, Werkzeuge, Möbel, Truhe
     features/feel      Spielgefühl: Fortschritt beim Sammeln, Partikel, Schritte, Schlaf-Uhr
   ============================================================ */
import { $, loadMsg, FEATURES } from './config.js';
import { register, hook } from './features.js';
import { G, pos } from './state.js';
import { U } from './shaders.js';
import { buildPalette, drawAction, drawInv, drawStats, initUI, setTool, updateTutorial } from './ui.js';
import { cam, draw, makeThumbs, sky, water } from './engine.js';
import { eraseMark, ghost, loadBuild, pickAt, slotFrom, tweens } from './building.js';
import { findAction, loadLife, saveLife, tickLife } from './survival.js';
import { height, normalAt } from './terrain.js';
import { makeAnimals, makeBirds, makeBugs, updateAnimals, updateBirds, updateBugs, updateFish } from './fauna.js';
import { move } from './player.js';
import { placeHouse } from './house.js';
import { updateChunks } from './world.js';
import { updateLights, updateSky } from './daynight.js';
import { updateSound } from './audio.js';
import './input.js';

let last = performance.now(), uiT = 0, saveT = 0, orbit = 0;

/* Titelbildschirm: Kamera kreist langsam ums Häuschen */
function titleCamera(dt) {
  const h = G.house; orbit += dt * .07;
  const cx = h.hx + 2, cz = h.hz + 1;
  cam.position.set(cx + Math.cos(orbit) * 17, h.y + 6.5, cz + Math.sin(orbit) * 17);
  cam.lookAt(cx, h.y + 2.2, cz);
}

function updateBuildPreview() {
  ghost.visible = false; eraseMark.visible = false;
  if (!G.build) return;
  const [hx, hy] = (!G.coarse && G.hover) ? G.hover : [0, 0];
  const hit = pickAt(hx, hy);
  if (G.tool === 'erase') {
    const p = hit && hit.object.userData.piece;
    if (p && !p.rec.world) { eraseMark.geometry = p.body.geometry; eraseMark.position.copy(p.g.position); eraseMark.rotation.copy(p.g.rotation); eraseMark.scale.setScalar(1.02); eraseMark.visible = true; }
  } else { const s = slotFrom(hit); if (s) { ghost.position.set(s.x, s.y + .01, s.z); ghost.rotation.y = G.rot * Math.PI / 2; ghost.visible = true; } }
}

function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt / .28; const k = Math.min(w.t, 1), c1 = 1.70158;
    w.g.scale.setScalar(.35 + .65 * (1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)));
    if (k >= 1) { w.g.scale.setScalar(1); tweens.splice(i, 1); }
  }
}

function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000), ts = t / 1000; last = t;
  if (!G.started) titleCamera(dt);
  else if (!G.paused) { move(dt); tickLife(dt); }
  updateChunks(false); updateSky(); updateLights(dt, ts);
  updateAnimals(dt); updateBirds(dt, ts); updateBugs(dt, ts); updateFish(dt); updateSound(dt, ts);
  sky.position.copy(cam.position); water.position.set(Math.round(cam.position.x), 0, Math.round(cam.position.z));
  U.uTime.value = ts;
  hook('update', dt, ts);
  updateBuildPreview(); updateTweens(dt); updateTutorial(dt);
  if ((uiT += dt) > .2) {
    uiT = 0; drawStats();
    G.curAction = G.paused || G.build ? null : findAction(); drawAction();
  }
  if ((saveT += dt) > 5) { saveT = 0; if (G.started && !G.paused) saveLife(); }
  draw();
  requestAnimationFrame(frame);
}

/* ---------- START ---------- */
function findSpawn() {
  for (let r = 0; r < 600; r += 6) for (let a = 0; a < 6.28; a += .5) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z);
    if (h > 2 && h < 7 && normalAt(x, z).y > .9) return [x, z];
  }
  return [0, 0];
}
setTimeout(async () => {
  try {
    initUI();
    loadMsg('Das Häuschen wird gezimmert'); placeHouse(...findSpawn());
    if (!loadLife()) { pos.set(G.house.door.x, height(G.house.door.x, G.house.door.z), G.house.door.z); G.yaw = 0; }
    /* Module laden – in config.js unter FEATURES abschaltbar */
    if (FEATURES.cooking) { loadMsg('Rezepte werden gesammelt'); register((await import('./features/cooking.js')).default); }
    if (FEATURES.crafting) { loadMsg('Die Werkbank wird aufgestellt'); register((await import('./features/crafting.js')).default); }
    if (FEATURES.feel) { loadMsg('Farbe wird angerührt'); register((await import('./features/feel.js')).default); }
    loadMsg('Bauteile werden skizziert'); makeThumbs(); buildPalette(); setTool(0);
    loadMsg('Landschaft wird lasiert'); updateChunks(true); loadBuild();
    loadMsg('Tiere werden geweckt'); makeAnimals(); makeBirds(); makeBugs();
    drawInv(); updateSky(); drawStats();
    $('#load').classList.add('hide');
    requestAnimationFrame(frame);
  } catch (err) {
    $('#load').innerHTML = 'Das Malen ist schiefgegangen<small></small>';
    $('#load small').textContent = String(err && err.message || err);
  }
}, 60);
