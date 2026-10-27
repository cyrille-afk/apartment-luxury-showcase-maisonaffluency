import { describe, expect, it } from "vitest";

import { ECART_REEDITION_LABEL, formatCuratorialEditionLine, formatEditionLabel, getHouseEditionLabel, isEcartReedition, productEditionBadge, profileEditionLine } from "./editionLabel";

describe("Ecart re-edition labels", () => {
  it('does not treat generic stored house attribution as an edition on child profiles', () => {
    expect(profileEditionLine({ edition: 'Man of Parts Edition', founder: 'Man of Parts', pageDesignerName: 'Sebastian Herkner' })).toBeNull();
    expect(profileEditionLine({ edition: 'Man of Parts Edition', founder: 'Man of Parts', pageDesignerName: 'Yabu Pushelberg' })).toBeNull();
  });
  it('retains actual limited or signed editions on child profiles', () => {
    expect(profileEditionLine({ edition: 'Edition of 8', founder: 'Man of Parts', pageDesignerName: 'Sebastian Herkner' })).not.toBeNull();
    expect(profileEditionLine({ edition: 'Man of Parts Edition', edition_number: '1/8', founder: 'Man of Parts', pageDesignerName: 'Sebastian Herkner' })).not.toBeNull();
  });
  it('suppresses redundant Man of Parts attribution on its own page without a generated fallback', () => {
    expect(profileEditionLine({ edition: 'Man of Parts Edition', founder: 'Man of Parts', pageDesignerName: 'Man of Parts' })).toBeNull();
    expect(getHouseEditionLabel({ designerName: 'Sebastian Herkner', founder: 'Man of Parts', pageDesignerName: 'Man of Parts' })).toBeNull();
    expect(getHouseEditionLabel({ designerName: 'Yabu Pushelberg', parentBrand: 'Man of Parts', pageDesignerName: 'Man of Parts' })).toBeNull();
  });
  it('preserves genuine editions on the Man of Parts page', () => {
    expect(profileEditionLine({ edition: 'Edition of 8', founder: 'Man of Parts', pageDesignerName: 'Man of Parts' })).toBe('Edition of 8');
    expect(profileEditionLine({ edition_number: '1/8', founder: 'Man of Parts', pageDesignerName: 'Man of Parts' })).toBe('Edition 1/8');
  });
  it('retains other house pages and unscoped catalogue attribution', () => {
    expect(profileEditionLine({ edition: 'Veronese Edition', founder: 'Veronese', pageDesignerName: 'Veronese' })).toBe('Veronese Edition');
    expect(profileEditionLine({ edition: 'Man of Parts Edition', founder: 'Man of Parts' })).not.toBeNull();
  });
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
    expect(isEcartReedition({ designerName: "Joseph Dirand", founder: "Maison Pouenat" })).toBe(false);
  });

  it("normalises older edition spellings and avoids a doubled Ecart badge", () => {
    expect(formatEditionLabel({ edition: "Re-edition" })).toBe("REEDITION");
    expect(formatCuratorialEditionLine({ edition: "RE-EDITION" })).toBe("REEDITION");
    expect(productEditionBadge({ edition: "Re-edition" }, true)).toBe("REEDITION");
    expect(productEditionBadge({ edition: "Limited Re-edition of 8" }, true)).toBe("REEDITION · Limited REEDITION of 8");
    expect(productEditionBadge({ edition: "Edition of 8" }, false)).toBe("Edition of 8");
  });
});