import { describe, expect, it } from "vitest";
import { contrastRatio, coverFonts, DEFAULT_COVER_THEME, normalizeCoverTheme } from "./pdfCoverTheme";

describe("cover theme", () => {
  it("keeps valid studio colours and replaces invalid ones with defaults", () => {
    expect(normalizeCoverTheme({ background: "#112233", accent: "red", text: "#fff" })).toEqual({ background: "#112233", accent: DEFAULT_COVER_THEME.accent, text: DEFAULT_COVER_THEME.text });
  });
  it("falls back entirely for missing data", () => expect(normalizeCoverTheme(null)).toEqual(DEFAULT_COVER_THEME));
  it("maps typefaces to embedded fonts", () => {
    expect(coverFonts("modern").heading).toBe("Inter");
    expect(coverFonts("classic").heading).toBe("times");
    expect(coverFonts(undefined).heading).toBe("Cormorant");
  });
  it("computes contrast", () => expect(Math.round(contrastRatio("#000000", "#FFFFFF"))).toBe(21));
});
