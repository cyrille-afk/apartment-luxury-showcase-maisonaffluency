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
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { comparatorEditionLabel as label2 } from "./comparatorEditionLabel";
d2("parent house without recorded edition", () => {
  i2("shows no Maison Pouenat Edition chip on Gilles & Boissier pieces", () => {
    e2(label2({ brand_name: "Gilles & Boissier", reedition_by: "Maison Pouenat", edition: undefined, tags: [] } as never)).toBeNull();
  });
});
