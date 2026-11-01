import { describe, expect, it } from "vitest";
import { leadTimeBuckets } from "./leadTimeBuckets";

describe("leadTimeBuckets", () => {
  it("ranges use their upper end", () => expect(leadTimeBuckets("12-14 weeks")).toEqual(["≤ 14 Weeks", "≤ 18 Weeks"]));
  it("6 weeks is within ≤ 6", () => expect(leadTimeBuckets("5-6 weeks")[0]).toBe("≤ 6 Weeks"));
  it("ready to ship is Available Now", () => expect(leadTimeBuckets("Ready to ship in Portugal")).toContain("Available Now"));
  it("20+ weeks", () => expect(leadTimeBuckets("18-20 weeks")).toEqual(["20+ Weeks"]));
  it("unparseable gives none", () => expect(leadTimeBuckets("Made to Order")).toEqual([]));
});
