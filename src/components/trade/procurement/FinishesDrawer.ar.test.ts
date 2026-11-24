import { describe, expect, it } from "vitest";
import { resolveArBoardPreview } from "./FinishesDrawer";

describe("catalogue-approved AR finish restoration", () => {
  it("restores Opera Delft upholstery on the selected 250cm sofa using its catalogue texture and price", () => {
    const variants = [{ top: "Fabric Cat. Opera", base: "Brass", label: "190 cm", price_cents: 779000 }, { top: "Fabric Cat. Opera", base: "Brass", label: "250 cm", price_cents: 950000 }];
    const swatches = [{ name: "Opera Delft", image_url: "/opera-delft.jpg", category: "Fabric", price_tier_label: "Fabric Cat. Opera" }, { name: "Brass", image_url: "/brass.jpg", category: "Metal" }];
    const restored = resolveArBoardPreview({ kind: "board", id: "row", product: "sofa", top: "Opera Delft", base: "Brass", size: "250 cm" }, "sofa", variants, swatches, null);
    expect(restored?.selection.top).toBe("Opera Delft");
    expect(restored?.selection.top_image).toBe("/opera-delft.jpg");
    expect(restored?.selection.price_cents).toBe(950000);
    expect(restored?.variant.label).toBe("250 cm");
    expect(resolveArBoardPreview({ kind: "board", id: "row", product: "sofa", top: "Unapproved fabric", base: "Brass" }, "sofa", variants, swatches, null)).toBeNull();
  });

  it("keeps GUM seat, leather backrest and oak independent and rejects an unknown backrest", () => {
    const variants = [{ price_cents: 825600, axes: [
      { role: "seat" as const, label: "Seat", value: "Edson", colours: [{ name: "EDSON 008 Charbon", image_url: "/charbon.jpg" }] },
      { role: "backrest" as const, label: "Backrest", value: "Tundra leather", colours: [{ name: "Tundra 603", image_url: "/tundra603.jpg" }] },
      { role: "frame" as const, label: "Frame", value: "Oak", colours: [{ name: "Smooth Oak", image_url: "/oak.jpg" }] },
    ] }];
    const finish = "Seat Upholstery: EDSON 008 Charbon · Backrest Upholstery: Tundra 603 · Frame Finish: Smooth Oak";
    const restored = resolveArBoardPreview({ kind: "board", id: "row", product: "gum", finish }, "gum", variants, [], null);
    expect(restored?.selection.top_image).toBe("/charbon.jpg");
    expect(restored?.selection.extra?.[0]?.img).toBe("/tundra603.jpg");
    expect(restored?.selection.base_image).toBe("/oak.jpg");
    expect(resolveArBoardPreview({ kind: "board", id: "row", product: "gum", finish: finish.replace("Tundra 603", "Unknown fabric") }, "gum", variants, [], null)).toBeNull();
  });
});