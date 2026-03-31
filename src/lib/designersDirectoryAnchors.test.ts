import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getDesignersDirectoryAnchor,
  getDesignersDirectoryAnchorId,
  getDesignersDirectoryLayout,
} from "./designersDirectoryAnchors";

describe("designers directory anchors", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterAll(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it("prefers the mobile letter anchor when both mobile and desktop trees exist", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    document.body.innerHTML = `
      <div data-directory-layout="desktop" style="display:none">
        <div id="desktop-alpha-A" data-alpha-letter="A"></div>
      </div>
      <div data-directory-layout="mobile">
        <div id="mobile-alpha-A" data-alpha-letter="A"></div>
      </div>
    `;

    expect(getDesignersDirectoryLayout()).toBe("mobile");
    expect(getDesignersDirectoryAnchorId("a")).toBe("mobile-alpha-A");
    expect(getDesignersDirectoryAnchor("A")?.id).toBe("mobile-alpha-A");
  });
});