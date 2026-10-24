import { describe, expect, it } from "vitest";
import { quoteReviewNetCents } from "./quoteReview";

describe("quote review pricing", () => {
  it("uses the exact saved line discount rather than applying the tier again", () => {
    expect(quoteReviewNetCents({ lineTotalCents: 300_003 }, 15_000)).toBe(285_003);
  });
  it("does not represent an unpriced piece as free", () => {
    expect(quoteReviewNetCents({ lineTotalCents: null }, 0)).toBeNull();
  });
  it("preserves an explicitly zero-priced line", () => {
    expect(quoteReviewNetCents({ lineTotalCents: 0 }, 0)).toBe(0);
  });
});