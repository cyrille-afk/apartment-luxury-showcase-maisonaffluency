import { describe, it, expect } from "vitest";
import { resolveQuoteBranding, quoteBrandingStorageKey } from "./quoteBranding";

const studio = { name: "Studio One", display_name: "Studio One Design", logo_url: "https://studio.example/default.svg" };
describe("quote sheet branding", () => {
  it("prefers the linked folder logo over the platform and studio logo", () => {
    expect(resolveQuoteBranding({ id: "folder", studio_name: "Atelier", studio_logo_url: "https://studio.example/custom.png" }, studio, false)).toEqual({ logoUrl: "https://studio.example/custom.png", studioName: "Atelier", showPlatform: false, canHidePlatform: false });
  });
  it("uses studio profile identity without a folder logo", () => {
    expect(resolveQuoteBranding(null, studio, false).logoUrl).toBe("https://studio.example/default.svg");
  });
  it("retains default Affluency branding when no custom logo exists", () => {
    expect(resolveQuoteBranding(null, null, false).showPlatform).toBe(true);
  });
  it("hides the default identity when Hide platform branding is checked", () => {
    expect(resolveQuoteBranding(null, null, true).showPlatform).toBe(false);
  });
  it("never hides an existing custom logo through the platform toggle", () => {
    expect(resolveQuoteBranding(null, studio, true).logoUrl).toBe(studio.logo_url);
  });
  it("rejects unsupported logo formats", () => {
    expect(resolveQuoteBranding({ id: "folder", studio_name: null, studio_logo_url: "https://studio.example/logo.pdf" }, null, false).showPlatform).toBe(true);
  });
  it("isolates manual identity drafts by user and quote", () => {
    expect(quoteBrandingStorageKey("one", "quote")).not.toBe(quoteBrandingStorageKey("two", "quote"));
    expect(quoteBrandingStorageKey("one", "quote")).not.toBe(quoteBrandingStorageKey("one", "other"));
  });
});