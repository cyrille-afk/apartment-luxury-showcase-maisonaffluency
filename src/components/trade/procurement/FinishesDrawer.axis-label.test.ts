import { it, expect } from "vitest";
import { resolveFinishFrom } from "@/components/trade/procurement/FinishesDrawer";
it("yoma", () => {
  const r = resolveFinishFrom({ variant_label: "Wood Finish: Bleached Oak · Metal Finish: Patinated Bronze — Open Pore · Stone Finish: Brown Travertine Sandblasted — Open Pore · 255 × 70 × H 100 cm - Bleach Oak", wood_label: "Bleached Oak" }, {}, []);
  expect(r.label).toBe("Bleached Oak / Patinated Bronze — Open Pore / Brown Travertine Sandblasted — Open Pore");
});
it("prices a client stone/metal request from its recorded exact tier", () => {
  const result = resolveFinishFrom({ variant_label: "Onice Velluto Marble / Aged Brass" }, { size_variants: [{ top: "Onice Velluto Marble", base: "Aged Brass", price_cents: 260000 }] }, [{ name: "Onice Velluto Marble", image_url: "stone.jpg" }, { name: "Aged Brass", image_url: "brass.jpg" }], true);
  expect(result).toMatchObject({ price_cents: 260000, top_image: "stone.jpg", base_image: "brass.jpg" });
});
it("does not borrow a baseline price for an unpriced requested stone", () => {
  const result = resolveFinishFrom({ variant_label: "Unknown Stone / Aged Brass" }, { size_variants: [{ top: "Pakistani Onyx", base: "Aged Brass", price_cents: 260000 }] }, [], true);
  expect(result.price_cents).toBeNull();
});
it("rejects ambiguous size prices for a requested finish pair", () => {
  const result = resolveFinishFrom({ variant_label: "Marble / Brass" }, { size_variants: [{ top: "Marble", base: "Brass", price_cents: 260000 }, { top: "Marble", base: "Brass", price_cents: 300000 }] }, [], true);
  expect(result.price_cents).toBeNull();
});
