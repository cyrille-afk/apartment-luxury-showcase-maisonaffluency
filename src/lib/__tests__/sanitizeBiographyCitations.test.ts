import { describe, it, expect } from "vitest";
import { sanitizeBiographyCitations } from "../sanitizeBiographyCitations";

describe("sanitizeBiographyCitations", () => {
  it("strips markdown citation links keeping the label", () => {
    const input = "Her work with [CC-Tapis](https://www.maisonaffluency.com/designers/cc-tapis) is lyrical.";
    expect(sanitizeBiographyCitations(input)).toBe("Her work with CC-Tapis is lyrical.");
  });

  it("strips [Source: ...] and [Sources: ...] citation brackets", () => {
    const input =
      "She founded her studio in 2015 [Source: example.com/bio]. Profiled by Paris Match [Sources: parismatch.com; ideat.fr].";
    expect(sanitizeBiographyCitations(input)).toBe(
      "She founded her studio in 2015. Profiled by Paris Match.",
    );
  });

  it("removes bare non-media URL lines", () => {
    const input = "Intro paragraph.\nhttps://www.maisonaffluency.com/designers\nNext paragraph.";
    expect(sanitizeBiographyCitations(input)).toBe("Intro paragraph.\nNext paragraph.");
  });

  it("preserves standalone YouTube embeds", () => {
    const input = "Intro.\nhttps://www.youtube.com/watch?v=abc123\nOutro.";
    expect(sanitizeBiographyCitations(input)).toBe(input);
  });

  it("preserves Vimeo and Cloudinary embeds with caption suffix", () => {
    const input =
      "A.\nhttps://vimeo.com/12345 | Studio film | right\nB.\nhttps://res.cloudinary.com/x/image/upload/v1/photo.jpg | Workshop\nC.";
    expect(sanitizeBiographyCitations(input)).toBe(input);
  });

  it("collapses extra blank lines created by removals", () => {
    const input = "Para 1.\n\nhttps://example.com\n\nPara 2.";
    expect(sanitizeBiographyCitations(input)).toBe("Para 1.\n\nPara 2.");
  });

  it("handles null/undefined", () => {
    expect(sanitizeBiographyCitations(null)).toBe("");
    expect(sanitizeBiographyCitations(undefined)).toBe("");
  });
});
