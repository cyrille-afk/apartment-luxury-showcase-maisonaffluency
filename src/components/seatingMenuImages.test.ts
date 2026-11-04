import { describe, expect, it } from "vitest";
import { SEATING_CARDS, seatingImagesForVisit } from "./seatingMenuImages";

describe("curated Seating image rotation", () => {
  it("changes every subcategory image on each consecutive opening", () => {
    for (let visit = 0; visit < 6; visit++) {
      const current = seatingImagesForVisit(visit);
      const next = seatingImagesForVisit(visit + 1);
      SEATING_CARDS.forEach((card, index) => {
        expect(card.images).toContain(current[index]);
        expect(next[index]).not.toBe(current[index]);
      });
    }
  });
  it("cycles back to curated alternatives without exhausting the pools", () => {
    expect(seatingImagesForVisit(6)).toEqual(seatingImagesForVisit(0));
  });
});