import { describe, expect, it } from "vitest";
import { comparatorEditionLabel } from "./comparatorEditionLabel";

describe("comparator curator-pick edition labels", () => {
  it("credits Ecart on Armchair, 1926 without requiring a manual edition", () => {
    expect(comparatorEditionLabel({ brand_name: "Jean-Michel Frank", reedition_by: "Ecart", tags: [] })).toBe("Ecart REEDITION");
  });
  it("keeps genuine recorded edition details ahead of house fallback", () => {
    expect(comparatorEditionLabel({ brand_name: "Jean-Michel Frank", reedition_by: "Ecart", edition: "Edition of 8", tags: [] })).toBe("Edition of 8");
  });
  it("does not invent a badge for independent makers", () => {
    expect(comparatorEditionLabel({ brand_name: "Alexander Lamont", tags: [] })).toBeNull();
  });
});