import { hook } from './features.js';
import { CS, RAD, SEG, QUALITY } from './config.js';
import { G, fruitAvail, ikey, pos } from './state.js';
import { MAT } from './shaders.js';
import { apples, bareTree, berries, bush, conifer, rock, tree } from './nature.js';
import { fbm, hash, rng } from './noise.js';
import { height, normalAt, tcol } from './terrain.js';
import { merge } from './geometry.js';
import { scene } from './engine.js';

/* ---------- LEBEN: Zustand ---------- */

/* ---------- WELT: Chunks ---------- */
export const chunks = new Map(), terrainMeshes = [];
export const OFFS = []; for (let dz = -RAD; dz <= RAD; dz++) for (let dx = -RAD; dx <= RAD; dx++) if (QUALITY.square || dx * dx + dz * dz <= RAD * RAD + 1) OFFS.push([dx, dz]);
OFFS.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));
export function addNature(kind, x, y, z, r, list, owner, fruitChance) {
  const parts = kind === 'tree' ? tree(x, y, z, r) : kind === 'bare' ? bareTree(x, y, z, r) : kind === 'conifer' ? conifer(x, y, z, r) : kind === 'bush' ? bush(x, y, z, r) : rock(x, y, z, r);
  list.push(...parts);
  if (kind === 'rock') return;
  const it = { kind, x, y, z, key: ikey(x, z), owner };
  if (kind === 'tree' && r() < fruitChance) { it.fruit = apples(x, y, z, parts.s, r); it.fk = 'apples'; }
  if (kind === 'bush' && r() < fruitChance) { it.fruit = berries(x, y, z, parts.s, r); it.fk = 'berries'; }
  owner.items.push(it);
}
export function buildFruit(o) {
  if (o.fruitMesh) { o.group.remove(o.fruitMesh); o.fruitMesh.geometry.dispose(); o.fruitMesh = null; }
  const parts = []; for (const it of o.items) if (fruitAvail(it)) parts.push(...it.fruit);
  if (parts.length) { o.fruitMesh = new THREE.Mesh(merge(parts), MAT.vc); o.group.add(o.fruitMesh); }
}
export function nearHouse(x, z, m) { return G.house && x > G.house.hx - 1 - m && x < G.house.hx + 5 + m && z > G.house.hz - 1 - m && z < G.house.hz + 3 + m; }
export function makeChunk(cx, cz) {
  const n = SEG + 1, pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), idx = [], c = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = cx * CS + i * CS / SEG, z = cz * CS + j * CS / SEG, h = height(x, z), nm = normalAt(x, z), k = (j * n + i) * 3;
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z; nor[k] = nm.x; nor[k + 1] = nm.y; nor[k + 2] = nm.z;
    tcol(h, nm.y, x, z, c); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * n + i, b = a + 1, d = a + n, e = d + 1; idx.push(a, d, b, b, d, e); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeBoundingSphere();
  const group = new THREE.Group(), mesh = new THREE.Mesh(geo, MAT.terrain); group.add(mesh);
  const ch = { group, mesh, items: [], fruitMesh: null, geos: [geo] };
  const r = rng(Math.floor(hash(cx, cz) * 1e9)), list = [];
  for (let k = 0; k < 16; k++) {
    const x = cx * CS + r() * CS, z = cz * CS + r() * CS, h = height(x, z);
    if (h < 1.3 || nearHouse(x, z, 4)) continue;
    const ny = normalAt(x, z).y, forest = fbm(x * .015 + 3, z * .015 + 7, 2);
    if (ny > .86 && h < 15 && r() < forest * 1.25) addNature(r() < .3 || h > 9 ? 'conifer' : r() < .45 ? 'bare' : 'tree', x, h - .3, z, r, list, ch, .4);
    else if (r() < .3) addNature('bush', x, h - .05, z, r, list, ch, .55);
    else if (r() < .14) addNature('rock', x, h - .1, z, r, list, ch, 0);
  }
  if (list.length) { const pg = merge(list); ch.geos.push(pg); group.add(new THREE.Mesh(pg, MAT.vc), new THREE.Mesh(pg, MAT.hull)); }
  hook('chunk', ch, cx, cz);
  buildFruit(ch);
  scene.add(group); terrainMeshes.push(mesh); chunks.set(cx + ',' + cz, ch);
}
export function dropChunk(k) {
  const c = chunks.get(k); scene.remove(c.group); c.geos.forEach(g => g.dispose()); if (c.fruitMesh) c.fruitMesh.geometry.dispose();
  terrainMeshes.splice(terrainMeshes.indexOf(c.mesh), 1); chunks.delete(k);
}
export function updateChunks(all) {
  const pcx = Math.floor(pos.x / CS), pcz = Math.floor(pos.z / CS); let built = 0;
  for (const [dx, dz] of OFFS) { const k = (pcx + dx) + ',' + (pcz + dz); if (!chunks.has(k)) { if (!all && built >= 1) break; makeChunk(pcx + dx, pcz + dz); built++; } }
  for (const k of [...chunks.keys()]) { const [x, z] = k.split(',').map(Number); if (Math.abs(x - pcx) > RAD + 1 || Math.abs(z - pcz) > RAD + 1) dropChunk(k); }
}

