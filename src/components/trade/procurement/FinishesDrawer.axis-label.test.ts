import { it, expect } from "vitest";
import { resolveFinishFrom } from "@/components/trade/procurement/FinishesDrawer";
it("yoma", () => {
  const r = resolveFinishFrom({ variant_label: "Wood Finish: Bleached Oak · Metal Finish: Patinated Bronze — Open Pore · Stone Finish: Brown Travertine Sandblasted — Open Pore · 255 × 70 × H 100 cm - Bleach Oak", wood_label: "Bleached Oak" }, {}, []);
  expect(r.label).toBe("Bleached Oak / Patinated Bronze — Open Pore / Brown Travertine Sandblasted — Open Pore");
});
