import { describe, it, expect } from "vitest";
import { copyTearsheetHref } from "./CopyTearsheetLink";

describe("copyTearsheetHref", () => {
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
