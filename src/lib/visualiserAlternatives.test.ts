import { describe, expect, it } from "vitest";
import { compatibleProportions, curatedVisualiserAlternatives } from "./visualiserAlternatives";
import { buildVisualiserSwap, snapshotVisualiserPiece, restoreVisualiserSwap, SWAP_UNDO_DURATION_MS } from "./visualiserSwap";
import { createPlacedObject } from "./placedObjectFactory";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";

const model = "https://cdn.example.com/chair.glb";
const chair = (id: string, extra: Record<string, unknown> = {}) => ({
  id, product_name: `Chair ${id}`, brand_name: "Maker", image_url: null,
  category: "Seating", subcategory: "Dining Chairs", glb_url: model,
  dimensions: "W 50 × D 55 × H 80 cm", ...extra,
});

describe("curated visualiser alternatives", () => {
  it("requires the same functional category and a real 3D model", () => {
    const active = chair("active");
    const result = curatedVisualiserAlternatives(active, [
      active,
      chair("mirror", { id: "trade-copy", source_pick_id: "active" }),
      chair("no-model", { glb_url: null }),
      chair("lounge", { subcategory: "Lounge Chairs" }),
      chair("matching"),
    ]);
    expect(result.map(product => product.id)).toEqual(["matching"]);
  });

  it("deduplicates Trade and source-pick mirrors of an alternative", () => {
    const result = curatedVisualiserAlternatives(chair("active"), [
      chair("source", { source_pick_id: null }),
      chair("trade", { source_pick_id: "source" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("rejects a recorded three-times-wider piece but does not invent incompatibility for unknown dimensions", () => {
    expect(compatibleProportions(chair("a"), chair("b", { dimensions: "W 150 × D 55 × H 80 cm" }))).toBe(false);
    expect(compatibleProportions(chair("a", { dimensions: null }), chair("b"))).toBe(true);
  });
});

describe("in-place visualiser swap", () => {
  it("offers Undo Swap for eight seconds", () => {
    expect(SWAP_UNDO_DURATION_MS).toBe(8000);
  });

  it("restores the original product, exact floor pose, locked finishes and price without affecting other pieces", () => {
    const original: PlacedObject = {
      ...createPlacedObject(chair("original"), [1.25, 0, -2.5]),
      rotation: [0, 1.75, 0], finishesLocked: true, finishes: ["Tobacco Oak", "Opera Calla"],
      baseMaterial: { id: "tobacco-oak" } as PlacedObject["baseMaterial"],
      retailEurCents: 237200, specItemId: "spec-7",
    };
    const snapshot = snapshotVisualiserPiece(original);
    original.finishes?.push("later edit");
    const alternative = buildVisualiserSwap(original, { ...chair("new"), retailEurCents: 479100 }, {}, 42);
    const other = createPlacedObject(chair("other"), [-1, 0, 2]);
    const restored = restoreVisualiserSwap([alternative, other], snapshot, 43);
    expect(restored[0]).toMatchObject({ id: "original", position: [1.25, 0, -2.5], rotation: [0, 1.75, 0],
      finishesLocked: true, finishes: ["Tobacco Oak", "Opera Calla"], baseMaterial: { id: "tobacco-oak" },
      retailEurCents: 237200, specItemId: "spec-7", restoreKey: 43 });
    expect(restored[1]).toBe(other);
    expect(restored.reduce((total, piece) => total + (piece.retailEurCents ?? 0), 0)).toBe(237200);
  });
  it("keeps the exact pose and specification identity while replacing old materials and live RRP", () => {
    const current: PlacedObject = {
      ...createPlacedObject(chair("old"), [1.25, 0, -2.5]),
      instanceId: "placed-1", inventoryInstanceId: "inventory-old", specItemId: "board-row-7",
      rotation: [0, Math.PI / 2, 0], scale: 1.2, positionLocked: true,
      material: { id: "old-fabric" } as PlacedObject["material"], retailEurCents: 100000,
    };
    const replacement = buildVisualiserSwap(current, { ...chair("new"), retailEurCents: 250000 }, {
      finishes: ["Natural Oak"], baseMaterial: { id: "natural-oak" },
    }, 42);
    expect(replacement.position).toEqual([1.25, 0, -2.5]);
    expect(replacement.rotation).toEqual([0, Math.PI / 2, 0]);
    expect(replacement.instanceId).toBe("placed-1");
    expect(replacement.specItemId).toBe("board-row-7");
    expect(replacement.scale).toBe(1.2);
    expect(replacement.positionLocked).toBe(true);
    expect(replacement.retailEurCents).toBe(250000);
    expect(replacement.baseMaterial).toMatchObject({ id: "natural-oak" });
    expect(replacement.material).toBeNull();
    expect(replacement.inventoryInstanceId).toBeUndefined();
    expect(replacement.restoreKey).toBe(42);
  });
});
