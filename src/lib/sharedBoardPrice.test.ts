import { expect, it } from "vitest";
import { sharedBoardPrice } from "./sharedBoardPrice";

it("keeps Rift's recorded retail size fallback when its finish is unpriced", () => {
  expect(sharedBoardPrice({ msrp_cents: 2920200, msrp_from: true }, { price_cents: null })).toEqual({ cents: 2920200, from: true });
});
it("keeps Yoma's recorded retail fallback instead of price upon request", () => {
  expect(sharedBoardPrice({ msrp_cents: 11173700, msrp_from: true })).toEqual({ cents: 11173700, from: true });
});
it("a confirmed finish price replaces the indicative minimum", () => {
  expect(sharedBoardPrice({ msrp_cents: 2920200, msrp_from: true }, { price_cents: 3329300 })).toEqual({ cents: 3329300, from: false });
});