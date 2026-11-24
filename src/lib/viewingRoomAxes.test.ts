import { describe, expect, it } from "vitest";
import { viewingRoomSelection, type ViewingRoomSlot } from "./viewingRoom";

const c = (id: string) => ({ id, name: id, category: "x", brand_name: "b", image_url: null, material_type: null, color_family: null });
const slot = { id: "gum", product_name: "GUM", retail_price: 8000, materials: {}, is_swappable: false, allow_finish_customization: true, alternatives: [], finish_options: [{ key: "2", label: "Edson / Edson / Oak", retail_price: 9000, materials: {}, colourways: [], axes: [
  { role: "seat", label: "Seat Upholstery", value: "Edson range", colours: [c("edson-gris"), c("edson-lin")] },
  { role: "backrest", label: "Backrest Upholstery", value: "Edson range", colours: [c("edson-charbon")] },
  { role: "frame", label: "Frame Finish", value: "Oak", colours: [c("smooth-oak")] },
] }] } as unknown as ViewingRoomSlot;

describe("three-axis upholstery", () => {
  it("keeps seat, backrest and frame colours separate", () => {
    const s = viewingRoomSelection(slot, "gum", "2", undefined, undefined, { seat: "edson-lin", backrest: "edson-charbon", frame: "smooth-oak" });
    expect(s.materials["upholstery"]?.id).toBe("edson-lin");
    expect(s.materials["backrest"]?.id).toBe("edson-charbon");
    expect(s.materials["base"]?.id).toBe("smooth-oak");
    expect(s.retail_price).toBe(9000);
  });
  it("rejects a colour from another axis", () => {
    expect(() => viewingRoomSelection(slot, "gum", "2", undefined, undefined, { backrest: "edson-lin" })).toThrow("Unapproved colourway");
  });
});
