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

describe("session cookie isolation", () => {
  it("forces no-store when a Supabase auth cookie is present, even without a bearer token", () => {
    const req = new Request("https://x/catalog-manifest", {
      headers: { Cookie: "sb-dcrauiygaezoduwdjmsm-auth-token=abc123; theme=dark" },
    });
    expect(isAuthenticatedRequest(req)).toBe(true);
    expect(publicCacheHeaders(req)["Cache-Control"]).toBe(PRIVATE_CACHE_CONTROL);
  });

  it("detects chunked ssr auth cookies", () => {
    const req = new Request("https://x/catalog-manifest", {
      headers: { Cookie: "sb-dcrauiygaezoduwdjmsm-auth-token.0=part; sb-dcrauiygaezoduwdjmsm-auth-token.1=part" },
    });
    expect(isAuthenticatedRequest(req)).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    const req = new Request("https://x/catalog-manifest", {
      headers: { Cookie: "theme=dark; ma_cart_v1=xyz" },
    });
    expect(isAuthenticatedRequest(req)).toBe(false);
    expect(publicCacheHeaders(req)["Cache-Control"]).toBe(PUBLIC_CATALOG_CACHE_CONTROL);
  });

  it("varies shared cache entries on Cookie as well as Authorization", () => {
    const headers = publicCacheHeaders(new Request("https://x/catalog-manifest"));
    expect(headers.Vary).toBe("Accept-Encoding, Authorization, Cookie");
  });
});
