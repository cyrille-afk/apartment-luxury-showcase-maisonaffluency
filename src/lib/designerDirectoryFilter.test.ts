import { describe, expect, it } from "vitest";
import { filterDesignerDirectory } from "./designerDirectoryFilter";

const designers = [
  { name: "Amélie Vermersch", slug: "amelie-vermersch" },
  { name: "Andrea Claire Studio", slug: "andrea-claire-studio" },
  { name: "CC-Tapis", slug: "cc-tapis" },
  { name: "Michel Amar Studio", slug: "michel-amar-studio" },
];

describe("visual directory filtering", () => {
  it("filters immediately from the first typed character, overriding the letter", () => {
    expect(filterDesignerDirectory(designers, "M", "A").map(d => d.slug))
      .toEqual(["amelie-vermersch", "michel-amar-studio"]);
    expect(filterDesignerDirectory(designers, "amelie", null).map(d => d.slug))
      .toEqual(["amelie-vermersch"]);
  });
  it("A displays only names beginning with A", () => {
    expect(filterDesignerDirectory(designers, "", "A").map(d => d.slug))
      .toEqual(["amelie-vermersch", "andrea-claire-studio"]);
  });
  it("clearing filters restores the whole matrix and unmatched text returns no cards", () => {
    expect(filterDesignerDirectory(designers, "", null)).toEqual(designers);
    expect(filterDesignerDirectory(designers, "nonexistent", null)).toEqual([]);
  });
});