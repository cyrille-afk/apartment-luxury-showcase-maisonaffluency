import { describe, expect, it } from "vitest";
import { buildRadarBreakdown } from "../../supabase/functions/_shared/radarRubric";

const base = { email: "studio@yahoo.com", regNumber: "", hasDocument: false, projectPoints: 55, projectBasis: "Villas", footprintPoints: 18, footprintBasis: "Press" };

describe("radar rubric", () => {
  it("total equals the sum of category points", () => {
    const r = buildRadarBreakdown(base);
    expect(r.score).toBe(73);
    expect(r.breakdown.reduce((s, c) => s + c.points, 0)).toBe(r.score);
  });
  it("caps AI categories at 60 and 20", () => {
    expect(buildRadarBreakdown({ ...base, projectPoints: 99, footprintPoints: 99 }).score).toBe(80);
  });
  it("registration +5, credential document +5, corporate email +10", () => {
    expect(buildRadarBreakdown({ ...base, email: "a@studio.com", regNumber: "UEN1", hasDocument: true }).score).toBe(93);
  });
  it("free webmail and missing registration earn 0, never negative", () => {
    const r = buildRadarBreakdown({ ...base, projectPoints: 0, footprintPoints: 0 });
    expect(r.score).toBe(0);
  });
});
