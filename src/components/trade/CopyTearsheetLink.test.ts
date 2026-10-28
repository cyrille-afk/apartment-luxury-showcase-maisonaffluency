import { afterEach, describe, it, expect } from "vitest";
import { copyTearsheetHref } from "./CopyTearsheetLink";
import { setClientSafeMode } from "@/lib/clientSafeMode";

afterEach(() => setClientSafeMode(false));

describe("copyTearsheetHref", () => {
  it("carries presentation protection into an exact finish-aware preview URL", () => {
    setClientSafeMode(true);
    const url = new URL(copyTearsheetHref("/trade/tearsheets?product=sofa&fabric=Mohair"));
    expect(url.searchParams.get("presentation")).toBe("1");
    expect(url.searchParams.get("product")).toBe("sofa");
    expect(url.searchParams.get("fabric")).toBe("Mohair");
  });
  it("resolves an app path to an absolute URL on the current origin", () => {
    const href = copyTearsheetHref("/trade/tearsheets?project=abc");
    expect(href).toMatch(/^https?:\/\/[^/]+\/trade\/tearsheets\?project=abc$/);
  });

  it("adds a leading slash when the path lacks one", () => {
    const href = copyTearsheetHref("trade/boards/xyz");
    expect(href).toMatch(/\/trade\/boards\/xyz$/);
  });

  it("passes through absolute URLs untouched", () => {
    const url = "https://www.maisonaffluency.com/trade/boards/xyz";
    expect(copyTearsheetHref(url)).toBe(url);
  });
});
