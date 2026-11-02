import { describe, expect, it } from "vitest";
import { filterDesignerDirectory, directorySearchDetails, directoryRefinement } from "./designerDirectoryFilter";

const designers = [
  { name: "Amélie Vermersch", slug: "amelie-vermersch" },
  { name: "Andrea Claire Studio", slug: "andrea-claire-studio" },
  { name: "CC-Tapis", slug: "cc-tapis" },
  { name: "Michel Amar Studio", slug: "michel-amar-studio" },
];

describe("visual directory filtering", () => {
  it('identifies exact and partial catalogue searches without retaining typed text', () => {
    expect(directorySearchDetails(designers, 'Amelie Vermersch').canonical_designer).toBe('amelie-vermersch');
    expect(directorySearchDetails(designers, 'amelie')).toEqual({ query_kind: 'partial_designer', canonical_designer: 'none', matched_designers: ['amelie-vermersch'], result_count: 1 });
    expect(directorySearchDetails(designers, 'private@example.com')).toEqual({ query_kind: 'unmatched', canonical_designer: 'none', matched_designers: [], result_count: 0 });
  });
  it('distinguishes initial searches, extensions, shortening, replacement and clearing', () => {
    expect(directoryRefinement('', 'Am')).toBe('initial');
    expect(directoryRefinement('Am', 'Amelie')).toBe('extend');
    expect(directoryRefinement('Amelie', 'Am')).toBe('shorten');
    expect(directoryRefinement('Amelie', 'Michel')).toBe('replace');
    expect(directoryRefinement('Amelie', '')).toBe('clear');
    expect(directoryRefinement('Amélie', 'amelie')).toBeNull();
  });
  it('caps catalogue match details at ten without truncating the result count', () => {
    const details = directorySearchDetails(Array.from({ length: 12 }, (_, i) => ({ name: `Maker ${i}`, slug: `maker-${i}` })), 'Maker');
    expect(details.matched_designers).toHaveLength(10);
    expect(details.result_count).toBe(12);
  });
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