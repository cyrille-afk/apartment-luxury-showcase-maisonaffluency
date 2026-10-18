import { expect, it } from "vitest";
import { designerBrowsePath, productBrowsePath, isTradeDesignerBrowse } from "./tradeBrowsing";
it("keeps portraits and picks in Trade", () => {
  expect(designerBrowsePath("kerstens", true, "biography")).toBe("/trade/gallery/kerstens/biography");
  expect(designerBrowsePath("kerstens", true)).toBe("/trade/gallery/kerstens/profile");
  expect(productBrowsePath("kerstens", "mono", true)).toBe("/trade/products/kerstens/mono");
});
it("retains mode controls on all designer routes", () => {
  for (const suffix of ["", "/profile", "/biography"]) expect(isTradeDesignerBrowse("/trade/gallery/kerstens" + suffix)).toBe(true);
  expect(isTradeDesignerBrowse("/trade/designers/admin")).toBe(false);
});
it("leaves public routes public", () => {
  expect(designerBrowsePath("kerstens", false)).toBe("/designers/kerstens");
  expect(designerBrowsePath("kerstens", false, "biography")).toBe("/designers/kerstens/biography");
  expect(productBrowsePath("kerstens", "mono", false)).toBe("/designers/kerstens/mono");
});
