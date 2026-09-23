import { describe, expect, it } from "vitest";

import { ECART_REEDITION_LABEL, isEcartReedition } from "./editionLabel";

describe("Ecart re-edition labels", () => {
  it("labels Ecart and its affiliated designers", () => {
    expect(isEcartReedition({ designerName: "Ecart" })).toBe(true);
    expect(isEcartReedition({ designerName: "Jean-Michel Frank", founder: "Ecart" })).toBe(true);
    expect(isEcartReedition({ designerName: "Eileen Gray", reeditionBy: "Ecart Paris" })).toBe(true);
    expect(ECART_REEDITION_LABEL).toBe("Reedition");
  });

  it("does not label unrelated designers", () => {
    expect(isEcartReedition({ designerName: "Victoria Magniant" })).toBe(false);
    expect(isEcartReedition({ designerName: "Joseph Dirand", founder: "Pouenat" })).toBe(false);
  });
});