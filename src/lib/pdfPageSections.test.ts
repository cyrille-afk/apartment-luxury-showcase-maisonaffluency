import { describe, expect, it } from "vitest";
import { pageSections } from "./pdfPageSections";

describe("PDF thumbnail section labels", () => {
  it("cover page gets no labels even with a logo", () => expect(pageSections("Sample Residence Prepared exclusively for client review", [{ width: 198, height: 120 }])).toEqual([]));
  it("layout page with floor/wall finishes is Finishes", () => expect(pageSections("Floor: Black Pepper Oak / Wall: Default", [])).toEqual(["Finishes"]));
  it("note with a reference photo is Notes + Photos", () => expect(pageSections("STUDIO NOTE Keep the walnut", [{ width: 150, height: 108 }])).toEqual(["Notes", "Photos"]));
  it("piece note beside finish swatches is Notes + Finishes, not Photos", () => expect(pageSections("1 / Changed / Finishes NOTE 1 warmer", [{ width: 40, height: 40 }])).toEqual(["Notes", "Finishes"]));
  it("plain page gets no labels", () => expect(pageSections("Furniture footprints", [])).toEqual([]));
});
