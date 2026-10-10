import { describe, it, expect } from "vitest";
import { coverSheetFigures } from "./tradeCoverSheetPdf";

describe("trade cover sheet figures", () => {
  it("Silver 10%: €4,200 RRP → €420 discount, €3,780 net", () => {
    expect(coverSheetFigures({ retailCents: 420000, netCents: 378000 })).toEqual({ retail: 420000, discount: 42000, net: 378000 });
  });
});
