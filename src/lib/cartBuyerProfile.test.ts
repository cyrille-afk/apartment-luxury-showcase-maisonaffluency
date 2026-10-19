import { describe, expect, it } from "vitest";
import { cartBuyerProfileFields } from "../../supabase/functions/_shared/cartBuyerProfile";

describe("cart recognition classification", () => {
  it("saves private-client baskets as private", () => {
    expect(cartBuyerProfileFields("private")).toEqual({ buyer_profile: "private" });
  });
  it("keeps professional baskets distinct", () => {
    expect(cartBuyerProfileFields("designer")).toEqual({ buyer_profile: "designer" });
  });
  it("does not overwrite a captured profile on later unclassified pings", () => {
    for (const value of [undefined, null, "unknown"]) {
      expect({ buyer_profile: "private", ...cartBuyerProfileFields(value) }.buyer_profile).toBe("private");
    }
  });
});