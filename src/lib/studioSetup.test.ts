import { describe, expect, it } from "vitest";
import { studioSetupComplete, isStudioSettingsPath } from "./studioSetup";
const studio = { name: "Hamptons Studio", display_name: "Hamptons Studio", logo_url: "https://assets.example/logo.png", pdf_cover_theme: { background: "#123456", accent: "#ABCDEF", text: "#FFFFFF" } };
describe("studio browsing gate", () => {
  it("rejects default studio names", () => { expect(studioSetupComplete({ ...studio, name: "My Studio" }, 1)).toBe(false); });
  it("allows an optional logo", () => { expect(studioSetupComplete({ ...studio, logo_url: null }, 1)).toBe(true); });
  it("rejects a supplied non-HTTPS logo", () => { expect(studioSetupComplete({ ...studio, logo_url: "http://assets.example/logo.png" }, 1)).toBe(false); });
  it("requires at least one project folder", () => { expect(studioSetupComplete(studio, 0)).toBe(false); expect(studioSetupComplete(studio, 1)).toBe(true); });
  it("requires saved background colour", () => { expect(studioSetupComplete({ ...studio, pdf_cover_theme: { accent: "#ABCDEF", text: "#FFFFFF" } }, 1)).toBe(false); });
  it("requires saved accent colour", () => { expect(studioSetupComplete({ ...studio, pdf_cover_theme: { background: "#123456", text: "#FFFFFF" } }, 1)).toBe(false); });
  it("requires saved title text colour", () => { expect(studioSetupComplete({ ...studio, pdf_cover_theme: { background: "#123456", accent: "#ABCDEF" } }, 1)).toBe(false); });
  it("requires client-facing title", () => { expect(studioSetupComplete({ ...studio, display_name: " " }, 1)).toBe(false); });
  it("keeps the requested settings destination and existing alias accessible", () => { expect(isStudioSettingsPath("/settings/studio")).toBe(true); expect(isStudioSettingsPath("/trade/settings/studio")).toBe(true); expect(isStudioSettingsPath("/trade/quotes")).toBe(false); });
});
