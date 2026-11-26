import { P, merge } from './geometry.js';
import { bareTree, bush, conifer, rock, tree } from './nature.js';
import { rng } from './noise.js';

/* ---------- BAUTEILE ----------
   Jedes Teil steht in einer 2×2-Zelle, Mittelpunkt (0,0), Boden bei y=0.
   Teile am Zellrand (Wände, Zäune, Kamin) liegen bei z = -0.88. */
export const WOOD = '#a9784f', WOOD2 = '#7d5436', PLASTER = '#eadbc0', STONE = '#b7afa3', ROOF = '#c8653a', LAMP = '#ffd46b', DARK = '#4e3d30', GLASS = '#9fbcd0';
export const E = -.88;
export const PIECES = [
  { id: 'boden', name: 'Boden', parts: () => [P('box', WOOD, 0, .1, 0, 2, .2, 2), P('box', WOOD2, -.5, .205, 0, .04, .01, 2), P('box', WOOD2, .5, .205, 0, .04, .01, 2)] },
  { id: 'wand', name: 'Wand', parts: () => [P('box', PLASTER, 0, 1.2, E, 2, 2.4, .24), P('box', WOOD2, 0, 2.34, E, 2.04, .12, .3), P('box', STONE, 0, .15, E, 2.04, .3, .3), P('box', WOOD2, -.94, 1.2, E, .1, 2.3, .28), P('box', WOOD2, .94, 1.2, E, .1, 2.3, .28)] },
  { id: 'fenster', name: 'Fenster', parts: () => [
    P('box', PLASTER, 0, .45, E, 2, .9, .24), P('box', PLASTER, 0, 2.05, E, 2, .7, .24), P('box', PLASTER, -.75, 1.3, E, .5, .8, .24), P('box', PLASTER, .75, 1.3, E, .5, .8, .24),
    P('box', GLASS, 0, 1.3, E, 1, .8, .04), P('box', WOOD2, 0, 1.3, E, .07, .8, .1), P('box', WOOD2, 0, 1.3, E, 1, .07, .1), P('box', WOOD2, 0, .9, E + .08, 1.15, .08, .36),
    P('box', WOOD2, 0, 2.34, E, 2.04, .12, .3), P('box', STONE, 0, .15, E, 2.04, .3, .3)] },
  { id: 'tuer', name: 'Tür', parts: () => [
    P('box', PLASTER, -.75, 1.2, E, .5, 2.4, .24), P('box', PLASTER, .75, 1.2, E, .5, 2.4, .24), P('box', PLASTER, 0, 2.15, E, 1, .5, .24),
    P('box', WOOD2, -.44, .95, E + .5, .08, 1.9, .9), P('box', LAMP, -.38, .95, E + .85, .06, .06, .06), P('box', WOOD2, 0, 2.34, E, 2.04, .12, .3)] },
  { id: 'saeule', name: 'Säule', parts: () => [P('box', STONE, 0, .1, 0, .62, .2, .62), P('cyl', STONE, 0, 1.2, 0, .2, 2, .2), P('box', STONE, 0, 2.3, 0, .56, .2, .56)] },
  { id: 'dach', name: 'Dach', parts: () => [P('prism', ROOF, 0, .4, 0, 1.24, 2.16, .8, 0, -Math.PI / 2), P('box', WOOD2, 0, 1.2, 0, .14, .14, 2.24)] },
  { id: 'treppe', name: 'Treppe', parts: () => [0, 1, 2, 3].map(i => P('box', i % 2 ? WOOD : WOOD2, 0, .3 * (i + 1), .75 - i * .5, 2, .6 * (i + 1), .5)) },
  { id: 'zaun', sink: true, name: 'Zaun', parts: () => [P('box', WOOD2, -.9, .5, E, .12, 1, .12), P('box', WOOD2, 0, .5, E, .12, 1, .12), P('box', WOOD2, .9, .5, E, .12, 1, .12), P('box', WOOD, 0, .4, E, 2, .08, .06), P('box', WOOD, 0, .8, E, 2, .08, .06)] },
  { id: 'weg', sink: true, name: 'Weg', parts: () => { const r = rng(7); const a = [P('box', '#cdbf9f', 0, .03, 0, 2, .06, 2)]; for (let i = 0; i < 5; i++)a.push(P('rock', STONE, (r() - .5) * 1.5, .06, (r() - .5) * 1.5, .32, .12, .32, r() * 6)); return a; } },
  { id: 'fundament', name: 'Fundament', parts: () => [P('box', STONE, 0, -1.3, 0, 2.04, 2.6, 2.04)] },
  { id: 'lagerfeuer', sink: true, name: 'Lagerfeuer', use: 'fire', fire: [0, .12, 0], cost: 3, parts: () => {
    const a = []; for (let i = 0; i < 7; i++) { const t = i / 7 * 6.28; a.push(P('rock', STONE, Math.cos(t) * .55, .08, Math.sin(t) * .55, .2, .14, .2, t)); }
    for (let i = 0; i < 3; i++) a.push(P('box', WOOD2, 0, .1, 0, .9, .12, .12, i * 1.05)); return a; } },
  { id: 'laterne', sink: true, name: 'Laterne', light: [0, 2.25, 0], parts: () => [P('box', STONE, 0, .08, 0, .4, .16, .4), P('cyl', DARK, 0, 1.1, 0, .06, 2, .06), P('box', LAMP, 0, 2.25, 0, .32, .38, .32), P('cone', DARK, 0, 2.58, 0, .28, .28, .28)] },
  { id: 'bett', sink: true, name: 'Bett', use: 'sleep', parts: () => [P('box', WOOD2, 0, .22, 0, 1.05, .3, 1.5), P('box', '#efe6d6', 0, .42, 0, .96, .14, 1.42), P('box', '#5f7fa8', 0, .52, .2, 1, .08, .98), P('box', '#f4ede0', 0, .54, -.48, .74, .12, .34), P('box', WOOD2, 0, .55, -.74, 1.05, .85, .08)] },
  { id: 'kamin', name: 'Kamin', use: 'fire', fire: [0, .1, -.42], smoke: [0, 5.45, -.55], parts: () => [
    P('box', STONE, 0, .6, -.68, 1.4, 1.2, .16), P('box', STONE, -.6, .6, -.45, .2, 1.2, .6), P('box', STONE, .6, .6, -.45, .2, 1.2, .6), P('box', STONE, 0, 1.1, -.45, 1.4, .2, .6),
    P('box', '#6d655c', 0, .05, -.45, 1, .1, .5), P('box', WOOD2, 0, 1.26, -.42, 1.6, .1, .74), P('box', STONE, 0, 3.35, -.55, .6, 4.1, .5)] },
  { id: 'tisch', sink: true, name: 'Tisch', parts: () => [P('box', WOOD, 0, .76, 0, 1.2, .08, .8), ...[[-.5, -.32], [.5, -.32], [-.5, .32], [.5, .32]].map(([x, z]) => P('box', WOOD2, x, .37, z, .08, .74, .08)), P('ico', '#c9a46a', .2, .84, 0, .2, .07, .2), P('ico', '#c8432f', -.25, .86, .1, .1, .1, .1), P('ico', '#d9a23a', -.12, .86, -.12, .1, .1, .1)] },
  { id: 'brunnen', sink: true, name: 'Brunnen', use: 'drink', parts: () => [P('cyl', STONE, 0, .45, 0, .75, .9, .75), P('cyl', '#3f6585', 0, .91, 0, .6, .03, .6), P('box', WOOD2, -.72, 1.35, 0, .1, 1.8, .1), P('box', WOOD2, .72, 1.35, 0, .1, 1.8, .1), P('box', WOOD2, 0, 1.95, 0, 1.6, .08, .08), P('prism', ROOF, 0, 2.35, 0, 1.0, 1.9, .5, Math.PI / 2, -Math.PI / 2)] },
  { id: 'baum', sink: true, name: 'Baum', parts: () => tree(0, 0, 0, rng(3)) },
  { id: 'kahl', sink: true, name: 'Kahlbaum', parts: () => bareTree(0, 0, 0, rng(4)) },
  { id: 'tanne', sink: true, name: 'Tanne', parts: () => conifer(0, 0, 0, rng(5)) },
  { id: 'busch', sink: true, name: 'Busch', parts: () => bush(0, 0, 0, rng(11)) },
  { id: 'fels', sink: true, name: 'Fels', parts: () => rock(0, 0, 0, rng(2)) }
];
export const BYID = {};
for (const p of PIECES) { p.geo = merge(p.parts()); p.top = p.geo.boundingBox.max.y; BYID[p.id] = p; }

