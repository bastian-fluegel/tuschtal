import { G, pos } from './state.js';
import { MAT } from './shaders.js';
import { P, merge } from './geometry.js';
import { ROOF, WOOD2 } from './pieces.js';
import { addNature, buildFruit } from './world.js';
import { addPiece, snap } from './building.js';
import { height } from './terrain.js';
import { rng } from './noise.js';
import { scene } from './engine.js';

/* ---------- HÄUSCHEN ---------- */
export function siteScore(hx, hz) {
  let lo = 1e9, hi = -1e9;
  for (let x = hx - 1; x <= hx + 5; x += 1) for (let z = hz - 1; z <= hz + 6; z += 1) { const h = height(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return { lo, hi, s: lo < 1 ? 1e9 : hi - lo };
}
export function placeHouse(sx, sz) {
  let best = null;
  for (let dx = -24; dx <= 24; dx += 4) for (let dz = -24; dz <= 24; dz += 4) {
    const hx = snap(sx + dx), hz = snap(sz + dz), sc = siteScore(hx, hz);
    if (!best || sc.s < best.sc.s) best = { hx, hz, sc };
  }
  const { hx, hz } = best;
  let y = -1e9; for (let x = hx - 1; x <= hx + 5; x += .5) for (let z = hz - 1; z <= hz + 3; z += .5) y = Math.max(y, height(x, z));
  y = Math.round(Math.max(y, .4) * 100) / 100;
  G.house = { hx, hz, y };
  const recs = [], add = (t, i, j, r = 0, yy = y) => recs.push({ t, x: hx + 2 * i, y: yy, z: hz + 2 * j, r, world: 1 });
  const fy = y + .2;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { add('fundament', i, j); add('boden', i, j); }
  add('wand', 0, 0, 0, fy); add('fenster', 1, 0, 0, fy); add('wand', 2, 0, 0, fy);
  add('fenster', 0, 1, 2, fy); add('tuer', 1, 1, 2, fy); add('fenster', 2, 1, 2, fy);
  add('fenster', 0, 0, 1, fy); add('wand', 0, 1, 1, fy);
  add('wand', 2, 0, 3, fy); add('kamin', 2, 0, 3, fy); add('fenster', 2, 1, 3, fy);
  add('bett', 0, 0, 1, fy); add('tisch', 1, 0, 0, fy);
  const ground = (i, j) => { const x = hx + 2 * i, z = hz + 2 * j; let m = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) m = Math.min(m, height(x + a * .5, z + b * .5)); return Math.round(Math.max(m, 0) * 100) / 100; };
  add('weg', 1, 2, 0, ground(1, 2)); add('weg', 1, 3, 0, ground(1, 3));
  add('laterne', 2, 2, 0, ground(2, 2)); add('brunnen', -1, 3, 0, ground(-1, 3));
  recs.forEach(r => addPiece(r));
  G.house.bed = { x: hx, z: hz + 2, y: fy };
  G.house.door = { x: hx + 2, z: hz + 6 };
  // großes Satteldach + Firstbalken
  const top = fy + 2.4, roof = merge([P('prism', ROOF, hx + 2, top + .767, hz + 1, 2.71, 6.8, 1.533, Math.PI / 2, -Math.PI / 2), P('box', WOOD2, hx + 2, top + 2.3, hz + 1, 6.9, .16, .16)]);
  scene.add(new THREE.Mesh(roof, MAT.vc), new THREE.Mesh(roof, MAT.hull));
  // Garten: Beerenbüsche und Apfelbaum
  const wo = { group: new THREE.Group(), items: [], fruitMesh: null }, list = [], r = rng(99);
  for (const [x, z, k] of [[hx - 3.5, hz + 5, 'bush'], [hx + 7.5, hz + 4.5, 'bush'], [hx + 7, hz - 3, 'bush'], [hx - 4.5, hz - 2.5, 'tree'], [hx + 9, hz + 1, 'conifer'], [hx + 8.5, hz - 4, 'bare'], [hx - 5, hz + 8, 'bare']]) addNature(k, x, height(x, z) - .1, z, r, list, wo, 1);
  const g = merge(list); wo.group.add(new THREE.Mesh(g, MAT.vc), new THREE.Mesh(g, MAT.hull)); scene.add(wo.group);
  G.house.garden = wo; buildFruit(wo);
}
export const inHouse = () => G.house && pos.x > G.house.hx - 1 && pos.x < G.house.hx + 5 && pos.z > G.house.hz - 1 && pos.z < G.house.hz + 3 && pos.y > G.house.y - .5 && pos.y < G.house.y + 3;

