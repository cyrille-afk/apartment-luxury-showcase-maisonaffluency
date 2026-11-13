import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from "three";
import { curatedDimensions, dimensionToMetres } from "./curatedLayoutDimensions";
import { fitExactModelDimensions, fitUprightModel } from "./modelOrientation";
import { generateRoomLayoutMatrix, footprint, boxAt, overlaps } from "./roomLayoutMatrix";
import { toAsset, type LiveCatalogueItem } from "./mockAiLayoutService";

describe("curated room real-world proportions", () => {
  it("converts unlabelled values over 10 from centimetres", () => {
    expect(dimensionToMetres(45)).toBe(0.45);
    expect(dimensionToMetres(300)).toBe(3);
    expect(dimensionToMetres(10)).toBe(10);
  });
  it("converts unlabelled values over 300 from millimetres", () => {
    expect(dimensionToMetres(450)).toBe(0.45);
    expect(dimensionToMetres(2400)).toBe(2.4);
  });
  it("retains metre measurements", () => {
    expect(curatedDimensions({ dimensionsCubic: { w: 0.45, d: 0.45, h: 0.5 } })).toEqual({ w: 0.45, d: 0.45, h: 0.5 });
  });
  it("honours explicit mm even below the magnitude cutoff", () => {
    expect(curatedDimensions({ width_mm: 300, depth_mm: 250, height_mm: 450 })).toEqual({ w: 0.3, d: 0.25, h: 0.45 });
  });
  it("parses recorded W/D/H in metres, centimetres and millimetres", () => {
    for (const dimensions of ["W 0.45 × D 0.4 × H 0.5 m", "W 45 × D 40 × H 50 cm", "450 × 400 × 500 mm", "W 45 D 40 H 50"])
      expect(curatedDimensions({ dimensions })).toEqual({ w: 0.45, d: 0.4, h: 0.5 });
  });
  it("uses a small stool volume when measurements are missing rather than a 1m cube", () => {
    expect(curatedDimensions({ name: "Bond Street Stool" })).toEqual({ w: 0.45, d: 0.45, h: 0.45 });
  });
  it("fits the loaded model to the same exact W/H/D as the placeholder and grounds Y=0", () => {
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(100, 200, 300)));
    source.position.set(10, 50, -20);
    const dims = curatedDimensions({ dimensionsCubic: { w: 45, d: 40, h: 50 } });
    const fitted = fitExactModelDimensions(fitUprightModel(source), dims);
    const box = new Box3().setFromObject(fitted);
    const size = box.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.45);
    expect(size.y).toBeCloseTo(0.5);
    expect(size.z).toBeCloseTo(0.4);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(box.getCenter(new Vector3()).z).toBeCloseTo(0);
  });
  it("places normalized cm/mm pieces without overlap and shares exact fallback dimensions", () => {
    const piece = (id: string, role: LiveCatalogueItem["role"], dimensionsCubic: LiveCatalogueItem["dimensionsCubic"]): LiveCatalogueItem => ({ componentId: id, name: id, sku: id, role, dimensionsCubic, glbUrl: "", price: 1000, available: true, stockStatus: null, leadWeeks: null, styleTokens: [] });
    const items = [piece("sofa", "anchor", { w: 2400, d: 1000, h: 800 }), piece("coffee", "table", { w: 120, d: 60, h: 40 }), piece("side", "accent", { w: 45, d: 40, h: 50 })];
    const scene = generateRoomLayoutMatrix({ roomType: "living", style: "quiet-luxury", totalBudget: 150000, roomDimensions: { width: 7.2, length: 6, height: 3.2 } }, items).scene;
    expect(scene.curatedAssets).toHaveLength(3);
    const boxes = scene.curatedAssets.map(a => {
      expect(a.position[1]).toBe(0);
      const item = items.find(i => i.componentId === a.componentId);
      if (!item) throw new Error("missing product");
      expect(a.dimensionsCubic).toEqual(curatedDimensions(item));
      const { w, d } = footprint(item);
      return boxAt(a.position[0], a.position[2], w, d);
    });
    boxes.forEach((box, i) => boxes.slice(i + 1).forEach(other => expect(overlaps(box, other)).toBe(false)));
    expect(toAsset(items[2], [1, 2, 3], [0, 0, 0]).position).toEqual([1, 0, 3]);
  });
});