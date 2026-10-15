import * as THREE from "three";

export const RUG_TOP_Y = 0.004;

/** A genuinely planar surface with rounded corners, metre-space UVs and no bulky trim. */
export function roundedRugGeometry(width: number, depth: number): THREE.ShapeGeometry {
  const w = width / 2, d = depth / 2;
  const r = Math.min(0.18, width / 8, depth / 8);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -d);
  s.lineTo(w - r, -d);
  s.absarc(w - r, -d + r, r, -Math.PI / 2, 0, false);
  s.lineTo(w, d - r);
  s.absarc(w - r, d - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w + r, d);
  s.absarc(-w + r, d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w, -d + r);
  s.absarc(-w + r, -d + r, r, Math.PI, Math.PI * 1.5, false);
  s.closePath();
  return new THREE.ShapeGeometry(s, 24);
}