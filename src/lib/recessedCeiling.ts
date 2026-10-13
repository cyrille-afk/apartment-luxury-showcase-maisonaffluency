import * as THREE from "three";

export const CEILING = { thickness: 0.15, recess: 0.25, ledge: 1.4, roughness: 0.9, glow: "#ffe0b2" };

/** Shape XY becomes world XZ; positive extrusion points down into the room. */
export function recessedCeilingShape(radius: number): THREE.Shape {
  const outer = new THREE.Shape();
  outer.moveTo(-radius, -radius);
  outer.lineTo(radius, -radius); outer.lineTo(radius, radius);
  outer.lineTo(-radius, radius); outer.closePath();
  const inner = radius - CEILING.ledge;
  const hole = new THREE.Path();
  hole.moveTo(-inner, -inner); hole.lineTo(-inner, inner);
  hole.lineTo(inner, inner); hole.lineTo(inner, -inner); hole.closePath();
  outer.holes.push(hole);
  return outer;
}

export function recessedCeilingGeometry(radius: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(recessedCeilingShape(radius), {
    depth: CEILING.thickness, bevelEnabled: false, steps: 1,
  });
}