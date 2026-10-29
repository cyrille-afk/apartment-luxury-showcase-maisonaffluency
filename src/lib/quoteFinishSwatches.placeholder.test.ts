import { it, expect } from "vitest";
import { findQuoteFinishSwatches } from "./quoteFinishSwatches";
const sw = ["Arsène - F3371009 - Pigeon", "Arsène - F3371011 - Tabac", "Pierre Frey Capri"].map((name, i) => ({ id: String(i), name, image_url: `u${i}` }));
it("placeholder 'Selected Pierre Frey fabric' shows no swatches", () => {
  expect(findQuoteFinishSwatches("Selected Pierre Frey fabric", sw as never)).toEqual([]);
});
it("a named colourway still matches", () => {
  expect(findQuoteFinishSwatches("Arsène - F3371011 - Tabac", sw as never).map((s) => s.name)).toContain("Arsène - F3371011 - Tabac");
});
