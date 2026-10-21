import { describe, expect, it } from "vitest";
import { upsertInventory, type ProjectInventoryItem } from "./ProjectInventoryContext";
import { createPlacedObject, inventoryItemToPlaceable } from "@/lib/placedObjectFactory";
import { layoutItems, patchLayoutItem } from "@/lib/activeProjectLayout";

const armchair: Omit<ProjectInventoryItem, "addedAt"> = {
  id: "armchair-id", productName: "Frenchmen Street Armchair", productType: "Frenchmen Street Armchair",
  brandName: "Sebastian Herkner", imageUrl: null, glbUrl: "https://assets.example/armchair.glb",
  dimensions: "W 62 × D 59 × H 80 cm", variantLabel: "Fabric Cat. Opera · Zero 005",
  selectedUpholstery: "Zero 005", selectedFrameFinish: "Black Pepper Oak", finishes: ["Zero 005", "Black Pepper Oak"],
  upholsteryMaterial: { id: "zero-005", name: "Zero 005", image_url: "https://assets.example/zero-005.jpg", brand_name: "Sahco", category: "Upholstery", material_type: "fabric", color_family: null },
};

describe("exact workspace entity binding", () => {
  it("keeps Frenchmen Street Armchair identity, model and dimensions through storage, placement and movement", () => {
    const restored = JSON.parse(JSON.stringify(upsertInventory([], { ...armchair, productName: "Frenchmen Street Armchair " }))) as ProjectInventoryItem[];
    const placed = createPlacedObject(inventoryItemToPlaceable(restored[0]), [1, 0, 2]);
    const moved = patchLayoutItem([placed], placed.instanceId, { x: 3, rotation: Math.PI / 4 })[0];
    expect(moved.productType).toBe("Frenchmen Street Armchair");
    expect(moved.product_name).toBe("Frenchmen Street Armchair");
    expect(layoutItems([moved])[0].name).toBe("Frenchmen Street Armchair");
    expect(moved.glb_url).toBe("https://assets.example/armchair.glb");
    expect(moved.dimensions).toBe("W 62 × D 59 × H 80 cm");
  });
  it("keeps Zero 005 as the selected upholstery, not Fabric Cat. Opera, through reload and placement", () => {
    const restored = JSON.parse(JSON.stringify(upsertInventory([], armchair))) as ProjectInventoryItem[];
    const placed = createPlacedObject(inventoryItemToPlaceable(restored[0]), [0, 0, 0]);
    expect(restored[0].selectedUpholstery).toBe("Zero 005");
    expect(placed.selectedUpholstery).toBe("Zero 005");
    expect(placed.upholsteryMaterial?.name).toBe("Zero 005");
    expect(placed.upholsteryMaterial?.image_url).toBe("https://assets.example/zero-005.jpg");
  });
  it("refreshes a re-added selection instead of retaining a stale product snapshot", () => {
    const previous = { ...armchair, productName: "Frenchmen Street Side Chair", selectedUpholstery: null, addedAt: 1 };
    const result = upsertInventory([previous], armchair);
    expect(result).toHaveLength(1);
    expect(result[0].productName).toBe("Frenchmen Street Armchair");
    expect(result[0].selectedUpholstery).toBe("Zero 005");
  });
});