import { describe, expect, it } from "vitest";
import { collectionCtaTarget, placeCtaAfterParagraph } from "../biographyCtaPlacement";

describe("collection CTA placement", () => {
  it("sits after paragraph three of a five paragraph biography", () => {
    // intro, video, then picture rows carrying paragraphs 2, 3 and 4-5
    expect(placeCtaAfterParagraph([1, 0, 1, 1, 2])).toEqual({ rowIndex: 3, splitAt: 0 });
  });

  it("stays beneath the video when the biography has only two paragraphs", () => {
    expect(placeCtaAfterParagraph([1, 0, 1])).toEqual({ rowIndex: 1, splitAt: 0 });
  });

  it("sits after paragraph two of a four paragraph biography", () => {
    expect(placeCtaAfterParagraph([1, 0, 1, 1])).toEqual({ rowIndex: 2, splitAt: 0 });
  });

  it("splits a picture row when the CTA falls between its paragraphs", () => {
    // intro, video, one picture row carrying paragraphs 2-5 of a five paragraph bio
    expect(placeCtaAfterParagraph([1, 0, 4])).toEqual({ rowIndex: 2, splitAt: 2 });
  });

  it("follows the opening when there is a single paragraph", () => {
    expect(placeCtaAfterParagraph([1, 0])).toEqual({ rowIndex: 0, splitAt: 0 });
  });

  it("has no placement without narrative", () => {
    expect(placeCtaAfterParagraph([])).toEqual({ rowIndex: 0, splitAt: 0 });
  });

  it("targets the midpoint paragraph", () => {
    expect(collectionCtaTarget(5)).toBe(3);
    expect(collectionCtaTarget(4)).toBe(2);
    expect(collectionCtaTarget(1)).toBe(1);
  });
});
