import { describe, expect, it } from "vitest";
import { applyComparedFinish, finishComparisonObjects } from "./visualiserFinishComparison";
import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { VisualiserMaterial } from "@/contexts/VisualiserMaterialContext";

const finish = { id: "oak", name: "Oak", category: "Wood" } as VisualiserMaterial;
const alternate = { ...finish, id: "walnut", name: "Walnut" };
const piece = { instanceId: "table", position: [1, 0, 2], rotation: [0, 0.5, 0], scale: 1, topMaterial: finish, finishesLocked: true } as PlacedObject;

describe("side-by-side furniture finishes", () => {
  it("previews two independent finishes without changing saved placement or finishes", () => {
    const other = { ...piece, instanceId: "other" };
    const saved = [piece, other];
    const a = finishComparisonObjects(saved, "table", "top", finish);
    const b = finishComparisonObjects(saved, "table", "top", alternate);
    expect(a[0].topMaterial?.id).toBe("oak");
    expect(b[0].topMaterial?.id).toBe("walnut");
    expect(saved[0].topMaterial?.id).toBe("oak");
    expect(b[0].position).toEqual([1, 0, 2]);
    expect(b[0].rotation).toEqual([0, 0.5, 0]);
    expect(b[1]).toBe(other);
  });
  it("does not apply a comparison to locked finishes", () => {
    expect(applyComparedFinish([piece], "table", "top", alternate)[0]).toBe(piece);
  });
  it("applies only the chosen finish to the selected unlocked piece", () => {
    const other = { ...piece, instanceId: "other" };
    const result = applyComparedFinish([{ ...piece, finishesLocked: false }, other], "table", "top", alternate);
    expect(result[0].topMaterial?.id).toBe("walnut");
    expect(result[1]).toBe(other);
    expect(finishComparisonObjects([piece], "table", "top", null)[0]).toBe(piece);
  });
});