import { describe, expect, it } from "vitest";
import { findPdfMatches } from "./pdfTextSearch";

const pages = [
  { height: 600, items: [{ str: "Frame: Black Pepper Oak", x: 100, y: 500, w: 230, h: 10 }] },
  { height: 600, items: [{ str: "STUDIO NOTE", x: 50, y: 400, w: 110, h: 8 }, { str: "oak oak", x: 50, y: 380, w: 70, h: 8 }] },
];

describe("PDF viewer text search", () => {
  it("finds every occurrence across pages, case-insensitive, in page order", () =>
    expect(findPdfMatches(pages, "OAK").map(m => m.page)).toEqual([1, 2, 2]));
  it("places the match inside its text run with a top-left origin", () =>
    expect(findPdfMatches(pages, "black")[0]).toEqual({ page: 1, left: 170, top: 90, width: 50, height: 10 }));
  it("ignores single-character and empty queries", () => { expect(findPdfMatches(pages, "o")).toEqual([]); expect(findPdfMatches(pages, "  ")).toEqual([]); });
  it("returns nothing for text that isn't in the PDF", () => expect(findPdfMatches(pages, "walnut")).toEqual([]));
});
