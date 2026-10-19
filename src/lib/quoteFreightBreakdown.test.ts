import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { resolveQuoteFreightDestination } from "./quoteFreightBreakdown";

describe("Quote freight destination provenance", () => {
  it("uses the separate ship-to destination when supplied", () => {
    expect(resolveQuoteFreightDestination(false, "BE", "Singapore")).toEqual({
      country: "be", iso: "BE", source: "Ship-to address",
    });
  });
  it("uses billing Singapore when a separate ship-to is empty", () => {
    expect(resolveQuoteFreightDestination(false, null, "Singapore")).toEqual({
      country: "singapore", iso: "SG", source: "Billing address",
    });
  });
  it("ignores an old ship-to when the quote uses billing", () => {
    expect(resolveQuoteFreightDestination(true, "BE", "Singapore").iso).toBe("SG");
    expect(resolveQuoteFreightDestination(true, "BE", "Singapore").source).toBe("Billing address");
  });
});