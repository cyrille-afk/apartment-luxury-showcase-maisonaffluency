import { describe, expect, it } from "vitest";
import { quoteAccessToken, quoteShareIdentity, quoteShareUrl, quoteShareSlug, namedQuoteShareUrl } from "./quoteSharePresentation";

const token = "a".repeat(48);
const snapshot = { lines: [{ name: "Angelo M/H High Table", maker: "Alinea", image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1780460960/stool-with-table-3_822x822_fjngmc.jpg", finish: null, dimensions: null, quantity: 1, unitCents: null, lineTotalCents: null, currency: null }] };
describe("quote link identity", () => {
  it("creates names-only quote addresses with no access token", () => {
    expect(quoteShareSlug(snapshot)).toBe("alinea-angelo-m-h-high-table");
    expect(namedQuoteShareUrl(quoteShareSlug(snapshot))).toBe("https://www.maisonaffluency.com/quote/alinea-angelo-m-h-high-table");
    expect(namedQuoteShareUrl(quoteShareSlug(snapshot))).not.toContain(token);
  });
  it("includes Alinea and Angelo M/H High Table in a production address while retaining the original token", () => {
    expect(quoteShareUrl(token, snapshot)).toBe(`https://www.maisonaffluency.com/quote/alinea-angelo-m-h-high-table--${token}`);
    expect(quoteAccessToken(`alinea-angelo-m-h-high-table--${token}`)).toBe(token);
  });
  it("accepts existing token-only links and rejects names without valid access tokens", () => {
    expect(quoteAccessToken(token)).toBe(token);
    expect(quoteAccessToken("alinea-angelo-m-h-high-table")).toBeNull();
    expect(quoteAccessToken(`forged${token}`)).toBeNull();
  });
  it("uses recorded product/maker identity, never the decorative slug, with no recipient or price fields", () => {
    const preview = quoteShareIdentity(snapshot);
    expect(preview.title).toBe("Angelo M/H High Table by Alinea — Maison Affluency");
    expect(Object.keys(preview)).toEqual(["title", "description", "image", "imageAlt"]);
    expect(preview.image).toContain("w_1200,h_630,c_pad,b_rgb:FAF9F5,q_70,f_jpg");
    expect(preview.imageAlt).toBe("Angelo M/H High Table by Alinea");
  });
  it("handles multiple pieces without misrepresenting the first piece as the entire quote", () => {
    expect(quoteShareIdentity({ lines: [snapshot.lines[0], snapshot.lines[0]] }).title).toContain("+ 1 more");
  });
  it("keeps unavailable previews generic and contains no claimed product identity", () => {
    expect(quoteShareIdentity(null)).toEqual({ title: "Quote unavailable — Maison Affluency", description: "Please ask your designer for a current quote link.", image: null, imageAlt: null });
  });
});