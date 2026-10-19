import { expect, it } from "vitest";
import { computeVariantAxes } from "../parseSizeVariants";
import { resolveActiveVariantCents } from "../resolveActiveVariant";

it("keeps Cloud Side Table's three stones and two sizes with all six recorded prices", () => {
  const sizes = ["W. 67 x D. 58 x H. 67.5 / Tray Height 52", "W. 74 x D. 66 x H. 85.6 / Tray Height 70.4"];
  const finishes = ["Pink Travertine", "Silver Travertine", "White Travertine"];
  const prices = [[1080000, 1140000, 1340000], [1350000, 1410000, 1510000]];
  const rows = sizes.flatMap((label, size) => finishes.map((base, finish) => ({ label, base, top: "", price_cents: prices[size][finish] })));
  const axes = computeVariantAxes(rows);
  expect(axes.baseOptions).toEqual(finishes);
  expect([...new Set(rows.map((row) => row.label))]).toEqual(sizes);
  for (const [size, label] of sizes.entries()) {
    for (const [finish, base] of finishes.entries()) {
      expect(resolveActiveVariantCents({ selectedVariantIdx: null, selectedBase: base, selectedTop: null, selectedDualSize: label, selectedSingleSize: null, selectedSingleMaterial: null }, { sizeVariants: rows, isBaseOnly: true, isDualAxis: false, hasSingleAxisSplit: false, hasDualSize: false, baseOnlyRequiresSize: true })).toBe(prices[size][finish]);
    }
  }
});