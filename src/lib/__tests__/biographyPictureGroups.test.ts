import { describe, expect, it } from "vitest";
import { biographyPictureGroups } from "../biographyPictureGroups";

describe("biography picture pairing", () => {
  it("pairs pictures one and two with paragraphs two and three, and the third with the remaining text", () => {
    expect(biographyPictureGroups([2, 3, 4, 5], 3)).toEqual([[2], [3], [4, 5]]);
  });
  it("preserves all narrative when there are no pictures", () => {
    expect(biographyPictureGroups([2, 3, 4, 5], 0)).toEqual([[2, 3, 4, 5]]);
  });
  it("preserves extra pictures without duplicating narrative", () => {
    expect(biographyPictureGroups([2, 3], 3)).toEqual([[2], [3], []]);
  });
});