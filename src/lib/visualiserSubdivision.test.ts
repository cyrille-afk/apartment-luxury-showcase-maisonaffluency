import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import OpenSubdiv, { type OpenSubdivModule } from "@nasedkinpv/opensubdiv-wasm";
import { isCurvedFurniturePart, subdivideCurvedGeometry } from "./visualiserSubdivision";

let engine: OpenSubdivModule;
beforeAll(async () => {
  engine = await OpenSubdiv({ wasmBinary: readFileSync("node_modules/@nasedkinpv/opensubdiv-wasm/dist/opensubdiv.wasm") });
});
describe("selective Catmull-Clark subdivision", () => {
  it("targets tub-chair upholstery and organic lamp curves, not structural parts", () => {
    expect(isCurvedFurniturePart("GUM armchair", "backrest", "Backrest")).toBe(true);
    expect(isCurvedFurniturePart("Frenchmen Street Lounge Chair", "upholstery", "FabricAndLeather")).toBe(true);
    expect(isCurvedFurniturePart("Cinnamon Gardens Floor Lamp", null, "Curved Stem")).toBe(true);
    expect(isCurvedFurniturePart("GUM armchair", "frame", "Frame Legs")).toBe(false);
    expect(isCurvedFurniturePart("Cinnamon Gardens Floor Lamp", "base", "Base Plate")).toBe(false);
    expect(isCurvedFurniturePart("Praia da Granja Coffee Table", "top", "Table Top")).toBe(false);
  });
  it("applies exactly one Catmull-Clark level, preserves UVs and leaves source unchanged", () => {
    const source = new THREE.OctahedronGeometry(1);
    const before = Array.from(source.getAttribute("position").array);
    const output = subdivideCurvedGeometry(source, engine);
    expect(output).not.toBe(source);
    expect(output.userData.visualiserSubdivisionLevel).toBe(1);
    // Every input triangle becomes three quads, triangulated into six triangles.
    expect(output.getAttribute("position").count).toBe(source.getAttribute("position").count * 6);
    expect(output.getAttribute("uv").count).toBe(output.getAttribute("position").count);
    expect(Array.from(output.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    expect(Array.from(output.getAttribute("position").array)).not.toEqual(before);
    expect(Array.from(source.getAttribute("position").array)).toEqual(before);
    expect(subdivideCurvedGeometry(output, engine)).toBe(output);
  });
  it("retains material-group assignment and skips mixed-material or animated topology", () => {
    const source = new THREE.OctahedronGeometry(1);
    source.addGroup(0, source.getAttribute("position").count, 2);
    expect(subdivideCurvedGeometry(source, engine).groups[0]?.materialIndex).toBe(2);
    const mixed = new THREE.BoxGeometry();
    expect(subdivideCurvedGeometry(mixed, engine)).toBe(mixed);
    const animated = new THREE.OctahedronGeometry(1);
    animated.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(animated.getAttribute("position").count * 4), 4));
    expect(subdivideCurvedGeometry(animated, engine)).toBe(animated);
  });
});