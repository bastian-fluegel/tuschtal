import { $, PAPER, QUALITY } from './config.js';
import { GEO } from './geometry.js';
import { MAT, U } from './shaders.js';
import { PIECES } from './pieces.js';

/* ---------- SZENE ---------- */
export const canvas = $('#c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.aa, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.dprStart));
renderer.setClearColor(PAPER);
U.uDpr.value = renderer.getPixelRatio();
U.uFogNear.value = QUALITY.fog[0]; U.uFogFar.value = QUALITY.fog[1];
export const scene = new THREE.Scene();
export const cam = new THREE.PerspectiveCamera(70, 1, .1, 700); cam.rotation.order = 'YXZ';
export const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), MAT.sky); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
export const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), MAT.water); water.rotation.x = -Math.PI / 2; water.renderOrder = 2; scene.add(water);
/* Im Hochformat (Handy) wird das Blickfeld weiter, sonst sieht man nur einen schmalen Streifen */
export function resize() {
  const a = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight, false); cam.aspect = a;
  cam.fov = a < 1 ? Math.min(90, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(35)) / a))) : 70;
  cam.updateProjectionMatrix();
}
/* Bildschärfe zur Laufzeit ändern (device.js passt sie der Bildrate an) */
export function setPixelRatio(r) { renderer.setPixelRatio(r); U.uDpr.value = r; resize(); }
addEventListener('resize', resize); resize();
export function draw() { renderer.render(scene, cam); }

export function blobTex(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
}
export const GLOW = blobTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), SMOKE = blobTex('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
export const glows = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; scene.add(s); return s; });
export const smokes = Array.from({ length: 16 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE, color: 0x8d8a86, depthWrite: false, transparent: true, opacity: 0 })); s.visible = false; s.userData.life = 0; scene.add(s); return s; });
export const FLAME = [new THREE.MeshBasicMaterial({ color: '#e86a2a' }), new THREE.MeshBasicMaterial({ color: '#ffcf5a' })];
export function makeFlame() {
  const g = new THREE.Group(), a = new THREE.Mesh(GEO.cone, FLAME[0]), b = new THREE.Mesh(GEO.cone, FLAME[1]);
  a.scale.set(.26, .7, .26); a.position.y = .35; b.scale.set(.15, .45, .15); b.position.y = .25; g.add(a, b); g.visible = false; return g;
}

/* Papierkorn */
(() => {
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s; const x = cv.getContext('2d'), im = x.createImageData(s, s);
  for (let i = 0; i < s * s; i++) { const v = 228 + Math.random() * 27; im.data.set([v, v - 2, v - 6, 255], i * 4); }
  x.putImageData(im, 0, 0); x.strokeStyle = 'rgba(150,120,80,.12)';
  for (let i = 0; i < 70; i++) { const a = Math.random() * s, b = Math.random() * s, t = Math.random() * 6.28, l = 6 + Math.random() * 18; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + Math.cos(t + .5) * l * .5, b + Math.sin(t + .5) * l * .5, a + Math.cos(t) * l, b + Math.sin(t) * l); x.stroke(); }
  $('#paper').style.backgroundImage = `url(${cv.toDataURL()})`;
})();

export function makeThumbs() {
  let r2;
  try {
    const cv = document.createElement('canvas');
    r2 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r2.setSize(120, 120, false); r2.setClearColor(0x000000, 0);
    for (const p of PIECES) {
      const sc = new THREE.Scene(), b = p.geo.boundingBox, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).length();
      sc.add(new THREE.Mesh(p.geo, MAT.vc), new THREE.Mesh(p.geo, MAT.hull));
      const ca = new THREE.PerspectiveCamera(32, 1, .1, 100);
      ca.position.copy(c).add(new THREE.Vector3(1.1, .85, 1.35).normalize().multiplyScalar(sz * 1.7)); ca.lookAt(c);
      r2.render(sc, ca); p.thumb = cv.toDataURL();
    }
  } catch (e) { console.warn('Vorschau fehlgeschlagen', e); }
  if (r2) { r2.dispose(); r2.forceContextLoss(); }
}

