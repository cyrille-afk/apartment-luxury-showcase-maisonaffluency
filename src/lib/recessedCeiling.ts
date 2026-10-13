import * as THREE from "three";
import { clampCeilingOpening, clampCeilingThickness } from "./visualiserCeilingSettings";

export const CEILING = { thickness: 0.15, recess: 0.25, ledge: 1.4, roughness: 0.9, glow: "#ffe0b2" };

export type SafeCeilingDimensions = { radius: number; inner: number; thickness: number };

/** Reject corrupt persisted/layout values before they reach THREE.Shape coordinates. */
export function safeCeilingDimensions(radius: unknown, thickness?: unknown, opening?: unknown): SafeCeilingDimensions | null {
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius <= CEILING.ledge) return null;
  const safeThickness = clampCeilingThickness(thickness);
  const inner = opening === undefined ? radius - CEILING.ledge : radius * clampCeilingOpening(opening) / 100;
  if (![safeThickness, inner].every(Number.isFinite) || safeThickness <= 0 || inner <= 0 || inner >= radius) return null;
  return { radius, inner, thickness: safeThickness };
}

/** Shape XY becomes world XZ; positive extrusion points down into the room. */
export function recessedCeilingShape(radius: number, opening?: number): THREE.Shape {
  const dimensions = safeCeilingDimensions(radius, undefined, opening);
  if (!dimensions) throw new Error("Invalid recessed ceiling dimensions");
  const outer = new THREE.Shape();
  outer.moveTo(-dimensions.radius, -dimensions.radius);
  outer.lineTo(dimensions.radius, -dimensions.radius); outer.lineTo(dimensions.radius, dimensions.radius);
  outer.lineTo(-dimensions.radius, dimensions.radius); outer.closePath();
  const { inner } = dimensions;
  const hole = new THREE.Path();
  hole.moveTo(-inner, -inner); hole.lineTo(-inner, inner);
  hole.lineTo(inner, inner); hole.lineTo(inner, -inner); hole.closePath();
  outer.holes.push(hole);
  return outer;
}

export function recessedCeilingGeometry(radius: number, thickness?: number, opening?: number): THREE.ExtrudeGeometry {
  const dimensions = safeCeilingDimensions(radius, thickness, opening);
  if (!dimensions) throw new Error("Invalid recessed ceiling dimensions");
  return new THREE.ExtrudeGeometry(recessedCeilingShape(radius, opening), {
    depth: dimensions.thickness, bevelEnabled: false, steps: 1,
  });
}