import { P } from './geometry.js';

/* ---------- NATUR ---------- */
export const LEAF = ['#6f9a45', '#86ad52', '#5d8a3c', '#7ea64d'];
export function tree(x, y, z, r) {
  const s = .8 + r() * .6, l = () => LEAF[Math.floor(r() * LEAF.length)];
  const a = [P('cyl', '#7a5a3e', x, y + 1.1 * s, z, .17 * s, 2.2 * s, .17 * s),
    P('ico', l(), x, y + 2.7 * s, z, 1.3 * s, 1.1 * s, 1.3 * s),
    P('ico', l(), x + .55 * s, y + 3.3 * s, z + .2 * s, .9 * s, .8 * s, .9 * s),
    P('ico', l(), x - .45 * s, y + 3.1 * s, z - .35 * s, .8 * s, .75 * s, .8 * s)];
  a.s = s; return a;
}
export function conifer(x, y, z, r) {
  const s = .8 + r() * .7;
  const a = [P('cyl', '#6e5038', x, y + .6 * s, z, .14 * s, 1.2 * s, .14 * s),
    P('cone', '#4f7a4a', x, y + 1.9 * s, z, 1.2 * s, 2 * s, 1.2 * s),
    P('cone', '#5b8653', x, y + 2.9 * s, z, .9 * s, 1.7 * s, .9 * s),
    P('cone', '#4a7044', x, y + 3.8 * s, z, .6 * s, 1.3 * s, .6 * s)];
  a.s = s; return a;
}
export function bush(x, y, z, r) {
  const s = .6 + r() * .5;
  const a = [P('ico', '#7aa04c', x, y + .45 * s, z, .9 * s, .65 * s, .9 * s), P('ico', '#8db55a', x + .5 * s, y + .35 * s, z + .2 * s, .55 * s, .45 * s, .55 * s)];
  a.s = s; return a;
}
export const BARK = '#3a2f28', PUFF = ['#e3a35a', '#d9735e', '#86aedb', '#e6c35c', '#9fbf6a'];
export function bareTree(x, y, z, r) {
  const s = .9 + r() * .5, a = [], c = () => PUFF[Math.floor(r() * PUFF.length)];
  const br = (bx, by, bz, len, rx, ry, dep) => {
    const dx = Math.sin(rx) * Math.sin(ry), dy = Math.cos(rx), dz = Math.sin(rx) * Math.cos(ry), w = .035 * len + .02;
    a.push(P('cyl', BARK, bx + dx * len / 2, by + dy * len / 2, bz + dz * len / 2, w, len, w, ry, rx));
    const ex = bx + dx * len, ey = by + dy * len, ez = bz + dz * len;
    if (dep > 0) { const k = 2 + (r() < .5 ? 1 : 0); for (let i = 0; i < k; i++) br(ex, ey, ez, len * (.6 + r() * .15), rx * .6 + .35 + r() * .4, ry + (i - (k - 1) / 2) * 1.6 + r() * .6, dep - 1); }
    else if (r() < .85) a.push(P('ico', c(), ex, ey, ez, .55 * s + r() * .3, .4 * s, .55 * s + r() * .3));
  };
  br(x, y, z, 1.8 * s, .05, r() * 6, 2);
  a.s = s; return a;
}
export function rock(x, y, z, r) { const s = .5 + r() * 1.1; return [P('rock', '#9b958c', x, y + .25 * s, z, s, .7 * s, s * .9, r() * 6)]; }
export function apples(x, y, z, s, r) {
  const a = []; for (let i = 0; i < 6; i++) { const t = r() * 6.28, h = 2.3 + r() * 1.2; a.push(P('ico', r() < .7 ? '#c8432f' : '#d9a23a', x + Math.cos(t) * 1.15 * s, y + h * s, z + Math.sin(t) * 1.15 * s, .14, .14, .14)); } return a;
}
export function berries(x, y, z, s, r) {
  const a = []; for (let i = 0; i < 9; i++) { const t = r() * 6.28; a.push(P('ico', r() < .5 ? '#b02e3a' : '#5b3a78', x + Math.cos(t) * .75 * s, y + (.35 + r() * .45) * s, z + Math.sin(t) * .75 * s, .08, .08, .08)); } return a;
}

