import { describe, it, expect } from "vitest";
import {
  bearerToken,
  decodeJwtRole,
  isAuthenticatedRequest,
  publicCacheHeaders,
  PUBLIC_CATALOG_CACHE_CONTROL,
  PRIVATE_CACHE_CONTROL,
} from "../../../supabase/functions/_shared/publicCache";

function jwtWithRole(role: string) {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64({ role, sub: "u1" })}.sig`;
}

describe("public catalogue cache policy", () => {
  it("parses bearer tokens", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("abc")).toBeNull();
  });

  it("reads the role claim", () => {
    expect(decodeJwtRole(jwtWithRole("authenticated"))).toBe("authenticated");
    expect(decodeJwtRole(jwtWithRole("anon"))).toBe("anon");
    expect(decodeJwtRole("not-a-jwt")).toBeNull();
  });

  it("caches anonymous requests at the edge for 1h with a 24h SWR window", () => {
    const req = new Request("https://x/catalog-manifest", {
      headers: { Authorization: `Bearer ${jwtWithRole("anon")}` },
    });
    expect(isAuthenticatedRequest(req)).toBe(false);
    const headers = publicCacheHeaders(req);
    expect(headers["Cache-Control"]).toBe(PUBLIC_CATALOG_CACHE_CONTROL);
    expect(headers["Cache-Control"]).toContain("s-maxage=3600");
    expect(headers["Cache-Control"]).toContain("stale-while-revalidate=86400");
    expect(headers.Vary).toContain("Authorization");
  });

  it("bypasses the cache for signed-in trade users", () => {
    const req = new Request("https://x/catalog-manifest", {
      headers: { Authorization: `Bearer ${jwtWithRole("authenticated")}` },
    });
    expect(isAuthenticatedRequest(req)).toBe(true);
    expect(publicCacheHeaders(req)["Cache-Control"]).toBe(PRIVATE_CACHE_CONTROL);
    expect(PRIVATE_CACHE_CONTROL).toBe("no-store, private");
  });

  it("treats a request with no token as cacheable", () => {
    const headers = publicCacheHeaders(new Request("https://x/catalog-manifest"));
    expect(headers["Cache-Control"]).toBe(PUBLIC_CATALOG_CACHE_CONTROL);
  });
});
