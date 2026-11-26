import { fbm, vn } from './noise.js';

/* ---------- GELÄNDE ---------- */
export function height(x, z) {
  const c = fbm(x * .006 + 50, z * .006 - 30, 4);
  const hl = fbm(x * .03, z * .03, 3);
  const r = Math.abs(fbm(x * .012 + 9, z * .012 + 4, 3) - .5);
  let h = (c - .43) * 46 + (hl - .5) * 8;
  if (h > 6) h += (.5 - r) * 22 * Math.min((h - 6) / 10, 1);
  return h + (vn(x * .25, z * .25) - .5) * .5;
}
const _n = new THREE.Vector3();
export function normalAt(x, z) { const e = .5; return _n.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize(); }
export const C = h => new THREE.Color(h);
export const TC = { sand: C('#dcc592'), grass: C('#93b85e'), grass2: C('#5f8d43'), dirt: C('#9b8562'), rock: C('#8f8a84'), snow: C('#f7f3ea'), deep: C('#b9a67a') };
export function tcol(h, ny, x, z, out) {
  const v = vn(x * .05, z * .05);
  if (h < 0) out.copy(TC.deep);
  else if (h < 1.1) out.copy(TC.sand);
  else {
    out.copy(TC.grass).lerp(TC.grass2, v);
    if (h > 13) out.lerp(TC.rock, Math.min((h - 13) / 5, 1));
    if (h > 24) out.lerp(TC.snow, Math.min((h - 24) / 3, 1));
  }
  if (ny < .8 && h > 1.1) out.lerp(h > 18 ? TC.rock : TC.dirt, Math.min((.8 - ny) * 4, 1));
  return out;
}

