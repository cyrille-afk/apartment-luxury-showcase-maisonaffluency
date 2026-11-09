import { describe, expect, it } from "vitest";
import { isCollectionLanding, isProductDetailPath, routeScrollBehavior, shouldResetRouteScroll } from "./collectionScrollPolicy";

describe("Collection scroll ownership", () => {
  it("lets both Trade product URLs and public product URLs own their content-ready reset", () => {
    expect(isProductDetailPath("/trade/products/4c5447ce-abd1-4c16-80a7-c3c41738f7a8")).toBe(true);
    expect(isProductDetailPath("/trade/products/michel-amar-studio/puzzle-dining-table")).toBe(true);
    expect(isProductDetailPath("/designers/michel-amar-studio/jules-lamp")).toBe(true);
    expect(isProductDetailPath("/trade/gallery/michel-amar-studio")).toBe(false);
  });
  it("resets repeated Collection navigation to the heading", () => {
    expect(shouldResetRouteScroll("/trade/the-collection", "/trade/the-collection")).toBe(true);
  });
  it("does not reset unrelated same-page filters", () => {
    expect(shouldResetRouteScroll("/designers", "/designers")).toBe(false);
  });
  it.each([
    "/trade/admin", "/trade/admin/glb-models", "/trade/admin/studios/example",
    "/trade/admin-dashboard", "/trade/designers/admin", "/trade/collectibles/admin",
    "/trade/quotes-admin", "/trade/documents-admin", "/admin/trade-review",
  ])("never animates admin navigation to %s", (path) => {
    expect(routeScrollBehavior(path, true)).toBe("instant");
  });
  it.each(["/trade/admin/inquiries", "/trade/admin/glb-models", "/trade/designers/admin"])(
    "keeps same-page admin options at their current position on %s", (path) => {
      expect(shouldResetRouteScroll(path, path)).toBe(false);
    },
  );
  it("preserves public navigation and reduced-motion behavior", () => {
    expect(routeScrollBehavior("/journal", true)).toBe("smooth");
    expect(routeScrollBehavior("/journal", false)).toBe("instant");
    expect(routeScrollBehavior("/trade-program", true, "/journal")).toBe("smooth");
  });
  it.each([
    "/trade", "/trade/", "/trade/comparator", "/trade/tools", "/trade/quotes",
    "/trade/settings", "/trade/projects", "/trade/favorites", "/trade/client-management",
    "/trade/gallery/michel-amar-studio", "/trade/products/michel-amar-studio/jules-lamp",
    "/trade/the-collection", "/trade/boards/example", "/trade/concierge",
  ])("lands every Trade destination instantly: %s", (path) => {
    expect(routeScrollBehavior(path, true, "/journal")).toBe("instant");
  });
  it("does not animate departures from ordinary Trade pages either", () => {
    expect(routeScrollBehavior("/designers/michel-amar-studio", true, "/trade/gallery/michel-amar-studio")).toBe("instant");
  });
  it.each(["/trade/comparator", "/trade/tools", "/trade/quotes", "/trade/settings"])(
    "keeps same-page Trade functions stationary: %s", (path) => {
      expect(shouldResetRouteScroll(path, path)).toBe(false);
    },
  );
  it("lands dashboard options instantly even when their destination has no admin suffix", () => {
    expect(routeScrollBehavior("/trade/journal", true, "/trade/admin-dashboard")).toBe("instant");
    expect(routeScrollBehavior("/trade/clients", true, "/trade/admin/tools")).toBe("instant");
  });
  it("excludes Collection from resize anchor restoration", () => {
    expect(isCollectionLanding("/trade/the-collection")).toBe(true);
    expect(isCollectionLanding("/trade/the-collection/")).toBe(true);
    expect(isCollectionLanding("/trade/gallery/thierry-lemaire")).toBe(false);
  });
});