import { describe, expect, it } from "vitest";
import { resolveStudioSource } from "../../supabase/functions/_shared/studioSource";
describe("studio source resolution", () => {
  it("routes the reported bare handle to Instagram", () => {
    expect(resolveStudioSource("integrhaartistry")).toEqual({ url: "https://www.instagram.com/integrhaartistry/", instagramHandle: "integrhaartistry" });
  });
  it("recognizes explicit handles and full links", () => {
    expect(resolveStudioSource("@integrhaartistry").instagramHandle).toBe("integrhaartistry");
    expect(resolveStudioSource("https://www.instagram.com/integrhaartistry/").instagramHandle).toBe("integrhaartistry");
    expect(resolveStudioSource(" @studio.name ").url).toBe("https://www.instagram.com/studio.name/");
  });
  it("preserves websites and rejects Instagram lookalike hosts", () => {
    expect(resolveStudioSource("studio.com")).toEqual({ url: "https://studio.com", instagramHandle: null });
    expect(resolveStudioSource("https://notinstagram.com/studio/").instagramHandle).toBeNull();
  });
  it("does not invent absent sources", () => {
    expect(resolveStudioSource(null)).toEqual({ url: null, instagramHandle: null });
  });
});
