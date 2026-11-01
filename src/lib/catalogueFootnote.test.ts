import { describe, expect, it } from "vitest";
import { shouldShowCatalogueFootnote } from "./catalogueFootnote";

describe("catalogue footnote visibility", () => {
  it("suppresses the note for a signed-in Trade account", () => {
    expect(shouldShowCatalogueFootnote(true, false)).toBe(false);
  });
  it("shows the note only for confirmed public guests", () => {
    expect(shouldShowCatalogueFootnote(false, false)).toBe(true);
    expect(shouldShowCatalogueFootnote(false, true)).toBe(false);
  });
});