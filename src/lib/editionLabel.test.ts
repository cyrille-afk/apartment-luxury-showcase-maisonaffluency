import { describe, expect, it } from "vitest";

import { ECART_REEDITION_LABEL, formatCuratorialEditionLine, formatEditionLabel, getHouseEditionLabel, isEcartReedition, productEditionBadge } from "./editionLabel";

describe("Ecart re-edition labels", () => {
  it("labels Ecart and its affiliated designers", () => {
    expect(isEcartReedition({ designerName: "Ecart" })).toBe(true);
    expect(isEcartReedition({ designerName: "Jean-Michel Frank", founder: "Ecart" })).toBe(true);
    expect(isEcartReedition({ designerName: "Eileen Gray", reeditionBy: "Ecart Paris" })).toBe(true);
    expect(ECART_REEDITION_LABEL).toBe("REEDITION");
    expect(getHouseEditionLabel({ designerName: "Ecart" })).toBe("Ecart REEDITION");
    expect(getHouseEditionLabel({ designerName: "Ecart", pageDesignerName: "Ecart" })).toBe("Ecart REEDITION");
    expect(getHouseEditionLabel({ designerName: "Jean-Michel Frank", founder: "Ecart", pageDesignerName: "Jean-Michel Frank" })).toBe("REEDITION");
    expect(getHouseEditionLabel({ designerName: "Eileen Gray", founder: "Ecart", pageDesignerName: "Eileen Gray" })).toBe("REEDITION");
  });

  it("does not label unrelated designers", () => {
    expect(isEcartReedition({ designerName: "Victoria Magniant" })).toBe(false);
    expect(isEcartReedition({ designerName: "Joseph Dirand", founder: "Pouenat" })).toBe(false);
  });

  it("normalises older edition spellings and avoids a doubled Ecart badge", () => {
    expect(formatEditionLabel({ edition: "Re-edition" })).toBe("REEDITION");
    expect(formatCuratorialEditionLine({ edition: "RE-EDITION" })).toBe("REEDITION");
    expect(productEditionBadge({ edition: "Re-edition" }, true)).toBe("REEDITION");
    expect(productEditionBadge({ edition: "Limited Re-edition of 8" }, true)).toBe("REEDITION · Limited REEDITION of 8");
    expect(productEditionBadge({ edition: "Edition of 8" }, false)).toBe("Edition of 8");
  });
});