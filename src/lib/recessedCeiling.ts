import * as THREE from "three";
import { clampCeilingOpening, clampCeilingThickness } from "./visualiserCeilingSettings";

export const CEILING = { thickness: 0.15, recess: 0.25, ledge: 1.4, roughness: 0.9, glow: "#ffe0b2" };

/** Shape XY becomes world XZ; positive extrusion points down into the room. */
export function recessedCeilingShape(radius: number, opening?: number): THREE.Shape {
  const outer = new THREE.Shape();
  outer.moveTo(-radius, -radius);
  outer.lineTo(radius, -radius); outer.lineTo(radius, radius);
  outer.lineTo(-radius, radius); outer.closePath();
  const inner = opening === undefined ? radius - CEILING.ledge : radius * clampCeilingOpening(opening) / 100;
  const hole = new THREE.Path();
  hole.moveTo(-inner, -inner); hole.lineTo(-inner, inner);
  hole.lineTo(inner, inner); hole.lineTo(inner, -inner); hole.closePath();
  outer.holes.push(hole);
  return outer;
}

export function recessedCeilingGeometry(radius: number, thickness?: number, opening?: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(recessedCeilingShape(radius, opening), {
    depth: clampCeilingThickness(thickness), bevelEnabled: false, steps: 1,
  });
}