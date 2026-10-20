import { describe, it, expect } from "vitest";
import { isHomePageUrl } from "./TradeAdminDesignNoteCoverage";
describe("isHomePageUrl", () => {
  it("flags a bare maker domain", () => expect(isHomePageUrl("https://tollgard.com")).toBe(true));
  it("flags a trailing-slash domain", () => expect(isHomePageUrl("https://tollgard.com/")).toBe(true));
  it("accepts an exact product page", () => expect(isHomePageUrl("https://www.alexanderlamont.com/en/product/tables/desk/fg008426-arbor-desk/")).toBe(false));
});
