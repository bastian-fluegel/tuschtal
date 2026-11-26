
/* ---------- GEOMETRIE-BAUSTEINE ---------- */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 9),
  ico: new THREE.IcosahedronGeometry(1, 1), rock: new THREE.DodecahedronGeometry(1, 0), prism: new THREE.CylinderGeometry(1, 1, 1, 3)
};
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
// P(geometrie, farbe, x,y,z, breite,höhe,tiefe, drehY, drehX)
export function P(g, c, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0) {
  return { g, c: new THREE.Color(c), m: new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, 0, 'YXZ')), _s.set(sx, sy, sz)) };
}
export function merge(parts) {
  const pos = [], nor = [], col = [];
  for (const p of parts) {
    const src = GEO[p.g], g = (src.index ? src.toNonIndexed() : src.clone()).applyMatrix4(p.m);
    const a = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(p.c.r, p.c.g, p.c.b); }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

