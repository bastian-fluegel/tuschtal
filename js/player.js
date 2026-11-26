import { EYE } from './config.js';
import { G, S, pos } from './state.js';
import { cam } from './engine.js';
import { height } from './terrain.js';
import { pieces } from './building.js';

/* ---------- SPIELER ---------- */
export const keys = {}, hold = { up: false, down: false }, joy = { x: 0, y: 0, run: false };
export const down = new THREE.Raycaster(), side = new THREE.Raycaster();
export const DOWN = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3(), _d = new THREE.Vector3();
export function nearBodies() { return pieces.filter(p => Math.abs(p.x - pos.x) < 5 && Math.abs(p.z - pos.z) < 5).map(p => p.body); }
export function groundAt(near) {
  let g = Math.max(height(pos.x, pos.z), -1.2);
  if (near.length) { down.set(_o.set(pos.x, pos.y + 1, pos.z), DOWN); down.far = 8; const h = down.intersectObjects(near, false)[0]; if (h) g = Math.max(g, h.point.y); }
  return g;
}
export function blocked(dx, dz, near) {
  const len = Math.hypot(dx, dz); if (!len || !near.length) return false;
  _d.set(dx / len, 0, dz / len);
  for (const yo of [.7, 1.5]) { side.set(_o.set(pos.x, pos.y + yo, pos.z), _d); side.far = len + .35; if (side.intersectObjects(near, false).length) return true; }
  return false;
}
export function move(dt) {
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const shift = keys.ShiftLeft || keys.ShiftRight;
  G.running = !G.fly && (shift || joy.run) && l > .1; G.moving = l > .1;
  const tired = S.energy < 15 ? .6 : 1;
  const sp = G.fly ? 14 : (G.running ? 9.5 : 6) * tired, s = Math.sin(G.yaw), c = Math.cos(G.yaw);
  const dx = (mx * c + mz * s) * sp * dt, dz = (-mx * s + mz * c) * sp * dt, near = nearBodies();
  if (!blocked(dx, dz, near)) { pos.x += dx; pos.z += dz; }
  else if (!blocked(dx, 0, near)) pos.x += dx;
  else if (!blocked(0, dz, near)) pos.z += dz;
  const g = groundAt(near), up = keys.Space || hold.up;
  if (G.fly) { pos.y += ((up ? 1 : 0) - ((shift || hold.down) ? 1 : 0)) * 10 * dt; if (pos.y < g) pos.y = g; pos.y = Math.min(pos.y, 80); G.onGround = false; }
  else {
    G.vy -= 26 * dt; pos.y += G.vy * dt;
    if (pos.y <= g) { pos.y = g; G.vy = 0; G.onGround = true; } else G.onGround = false;
    if (up && G.onGround) G.vy = 9;
  }
  cam.position.set(pos.x, pos.y + EYE, pos.z); cam.rotation.set(G.pitch, G.yaw, 0);
}

