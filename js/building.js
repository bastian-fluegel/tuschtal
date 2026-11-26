import { $, KEY } from './config.js';
import { BYID, PIECES } from './pieces.js';
import { G, INV } from './state.js';
import { MAT } from './shaders.js';
import { cam, makeFlame, scene } from './engine.js';
import { drawInv, toast } from './ui.js';
import { height } from './terrain.js';
import { terrainMeshes } from './world.js';
import { P, merge } from './geometry.js';
import { emit } from './features.js';

/* ---------- BAUTEILE IN DER WELT ---------- */
export const pieces = [], undo = [], tweens = [];
export const snap = v => Math.floor(v / 2) * 2 + 1;
const _w = new THREE.Vector3(), YAX = new THREE.Vector3(0, 1, 0);
export function worldPt(p, arr, out) { return out.fromArray(arr).applyAxisAngle(YAX, p.g.rotation.y).add(p.g.position); }
export function addPiece(rec, pop) {
  const def = BYID[rec.t]; if (!def) return null;
  const g = new THREE.Group(), body = new THREE.Mesh(def.geo, MAT.vc);
  g.add(body, new THREE.Mesh(def.geo, MAT.hull));
  g.position.set(rec.x, rec.y, rec.z); g.rotation.y = rec.r * Math.PI / 2; scene.add(g);
  const p = { rec, def, g, body, x: rec.x, y: rec.y, z: rec.z, top: rec.y + def.top, fkey: rec.x + ',' + rec.y + ',' + rec.z };
  if (def.fire) { p.flame = makeFlame(); p.flame.position.fromArray(def.fire); g.add(p.flame); }
  if (rec.d) {   /* Steinsockel bis zum Boden, so breit wie das Bauteil */
    const b = def.geo.boundingBox, sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
    const sg = merge([P('box', '#b7afa3', (b.max.x + b.min.x) / 2, -rec.d / 2 + .02, (b.max.z + b.min.z) / 2, sx + .04, rec.d, sz + .04)]);
    g.add(new THREE.Mesh(sg, MAT.vc), new THREE.Mesh(sg, MAT.hull)); p.skirt = sg;
  }
  body.userData.piece = p; pieces.push(p);
  if (pop) { g.scale.setScalar(.35); tweens.push({ g, t: 0 }); }
  return p;
}
export function removePiece(p) { scene.remove(p.g); pieces.splice(pieces.indexOf(p), 1); delete G.fires[p.fkey]; }
export function saveBuild() { try { localStorage.setItem(KEY, JSON.stringify(pieces.filter(p => !p.rec.world).map(p => p.rec))); } catch (e) { } }
export function loadBuild() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) a.forEach(r => { if (!r.world) addPiece(r); }); } catch (e) { } }

/* ---------- RAYCAST + BAUEN ---------- */
export const ray = new THREE.Raycaster(); ray.far = 45;
const _nd = new THREE.Vector2();
export function pickAt(nx, ny) { _nd.set(nx, ny); ray.setFromCamera(_nd, cam); return ray.intersectObjects(pieces.map(p => p.body).concat(terrainMeshes), false)[0] || null; }
/* Möbel (def.fine) rasten auf einem halben Raster ein, damit man Räume einrichten kann */
export function slotFrom(hit) {
  if (!hit) return null;
  const def = PIECES[G.tool], fine = def && def.fine, sn = fine ? v => Math.floor(v) + .5 : snap;
  const p = hit.object.userData.piece;
  if (p) {
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.y > .5) return fine ? { x: sn(hit.point.x), z: sn(hit.point.z), y: hit.point.y } : { x: p.x, z: p.z, y: p.top };
    if (n.y < -.5) return null;
    const q = hit.point.clone().addScaledVector(n, fine ? .3 : .6); return { x: sn(q.x), z: sn(q.z), y: fine ? height(q.x, q.z) : p.y };
  }
  /* Gelände: kleine Teile sinken in den Hang, Bauteile bleiben waagerecht und bekommen einen Steinsockel */
  const x = sn(hit.point.x), z = sn(hit.point.z), k = fine ? .3 : .95;
  const hs = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([dx, dz]) => height(x + dx * k, z + dz * k));
  const hi = Math.max(Math.max(...hs), 0), lo = Math.max(Math.min(...hs), 0);
  if (fine || (def && def.sink)) return { x, z, y: lo };
  return { x, z, y: hi, depth: Math.min(8, hi - Math.min(...hs) + .1) };
}
export function buildAt(nx, ny, forceErase) {
  const hit = pickAt(nx, ny); if (!hit) return;
  if (forceErase || G.tool === 'erase') {
    const p = hit.object.userData.piece; if (!p) return;
    if (p.rec.world) { toast('Das Häuschen bleibt stehen.'); return; }
    if (p.def.costItems) { for (const [k, n] of Object.entries(p.def.costItems)) INV[k] = (INV[k] || 0) + n; drawInv(); }
    if (p.def.cost) { INV.wood = (INV.wood || 0) + p.def.cost; drawInv(); toast(`${p.def.cost} Holz zurückbekommen.`); }
    emit('erase', { x: p.x, y: p.y, z: p.z }); removePiece(p); undo.push({ del: p.rec }); saveBuild(); return;
  }
  const s = slotFrom(hit); if (!s) return;
  const def = PIECES[G.tool];
  if (def.cost) { if (INV.wood < def.cost) { toast(`${def.name} braucht ${def.cost} Holz.`); return; } INV.wood -= def.cost; drawInv(); }
  if (def.costItems) {
    const miss = Object.entries(def.costItems).find(([k, n]) => (INV[k] || 0) < n);
    if (miss) { toast(`Du hast keine(n) ${def.name} mehr. Stell an der Werkbank neue her.`); return; }
    for (const [k, n] of Object.entries(def.costItems)) INV[k] -= n; drawInv();
  }
  const rec = { t: def.id, x: s.x, y: Math.round(s.y * 100) / 100, z: s.z, r: G.rot };
  if (s.depth > .15) rec.d = Math.round(s.depth * 100) / 100;
  const p = addPiece(rec, true);
  if (p) { undo.push({ add: p }); saveBuild(); emit('build', { x: p.x, y: p.y, z: p.z }); }
}
export function doUndo() {
  const u = undo.pop(); if (!u) return;
  if (u.add && pieces.includes(u.add)) removePiece(u.add);
  if (u.del) addPiece(u.del, true);
  saveBuild();
}
export const ghost = new THREE.Mesh(PIECES[0].geo, MAT.ghost); ghost.renderOrder = 3; ghost.visible = false; scene.add(ghost);
export const eraseMark = new THREE.Mesh(PIECES[0].geo, MAT.erase); eraseMark.renderOrder = 3; eraseMark.visible = false; scene.add(eraseMark);

