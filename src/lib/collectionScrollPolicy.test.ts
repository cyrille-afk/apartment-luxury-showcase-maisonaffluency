import { describe, expect, it } from "vitest";
import { isCollectionLanding, shouldResetRouteScroll } from "./collectionScrollPolicy";

describe("Collection scroll ownership", () => {
  it("resets repeated Collection navigation to the heading", () => {
    expect(shouldResetRouteScroll("/trade/the-collection", "/trade/the-collection")).toBe(true);
  });
  it("does not reset unrelated same-page filters", () => {
    expect(shouldResetRouteScroll("/designers", "/designers")).toBe(false);
  });
  it("excludes Collection from resize anchor restoration", () => {
    expect(isCollectionLanding("/trade/the-collection")).toBe(true);
    expect(isCollectionLanding("/trade/the-collection/")).toBe(true);
    expect(isCollectionLanding("/trade/gallery/thierry-lemaire")).toBe(false);
  });
});