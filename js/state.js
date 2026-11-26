/* Gemeinsamer Spielzustand: alles, was mehrere Module lesen UND ändern */
export const G = {
  paused: true, build: false, tool: 0, rot: 0, fly: false,
  yaw: 0, pitch: -.12, vy: 0, onGround: false, running: false, moving: false,
  coarse: matchMedia('(pointer:coarse)').matches, hover: null, curAction: null,
  soundOn: true, house: null, owners: [], picked: {}, woodUsed: {}, fires: {}, started: false
};
export const pos = new THREE.Vector3();                       // Füße des Spielers
export const T = { day: 1, hour: 8 };                         // Spielzeit
export const S = { food: 80, water: 72, energy: 88, warm: 75 }; // Überlebenswerte 0..100
export const INV = { berries: 1, apples: 2, wood: 2 };        // Vorrat
export const ikey = (x, z) => Math.round(x * 10) + ',' + Math.round(z * 10);
export const fruitAvail = it => it.fruit && !(G.picked[it.key] >= T.day);
export const woodAvail = it => { const w = G.woodUsed[it.key]; return !(w && w.d === T.day && w.n >= MODS.woodPerTree); };
/* Modifikatoren: Module (z. B. Werkzeuge) verändern diese Werte */
export const MODS = { woodPerTree: 2, woodGain: 1, harvestBonus: 0, waterMax: 4, biteWindow: 1.15, lantern: false, bagMax: Infinity };
/* Platz im Rucksack: Werkzeuge und Möbel zählen nicht mit */
export const NO_BAG = new Set(['tool', 'moebel']);
export function bagUsed(ITEMS) { let n = 0; for (const k in INV) if (ITEMS[k] && !NO_BAG.has(ITEMS[k].cat)) n += INV[k] || 0; return n; }
/* give: legt bis zu n Stück in den Rucksack, gibt zurück, wie viele gepasst haben */
export function give(ITEMS, k, n) {
  const free = (ITEMS[k] && NO_BAG.has(ITEMS[k].cat)) ? n : Math.max(0, Math.min(n, MODS.bagMax - bagUsed(ITEMS)));
  INV[k] = (INV[k] || 0) + free; return free;
}
