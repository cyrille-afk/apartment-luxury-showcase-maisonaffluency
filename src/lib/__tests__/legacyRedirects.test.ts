import { describe, expect, it } from "vitest";
import { legacyRedirectTarget } from "../legacyRedirects";

describe("legacyRedirectTarget", () => {
  it("sends old shop URLs to Designers", () => {
    for (const p of ["/products", "/products/x", "/shop", "/shop/a/b", "/catalog", "/catalogue/", "/collection/y"])
      expect(legacyRedirectTarget(p)).toBe("/designers");
  });
  it("sends old home/test URLs to the homepage", () => {
    for (const p of ["/home", "/index.html", "/index.php", "/test", "/preview/x", "/staging"])
      expect(legacyRedirectTarget(p)).toBe("/");
  });
  it("leaves real pages alone", () => {
    for (const p of ["/", "/designers", "/contact", "/collections", "/trade/products/1", "/designers/emma-donnersberg"])
      expect(legacyRedirectTarget(p)).toBeNull();
  });
});
