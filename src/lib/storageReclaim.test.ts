import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_RENDER_DRAFT_KEY } from "./aiRenderDraft";
import { ensureStorageHeadroom } from "./storageReclaim";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("AI Render Studio quota cleanup", () => {
  it("evicts disposable caches, never the saved source draft or auth", () => {
    const sourceImage = "https://example.com/residence-01.png";
    localStorage.setItem(AI_RENDER_DRAFT_KEY, JSON.stringify({ sourceImage }));
    localStorage.setItem("sb-test-auth-token", "session-placeholder");
    localStorage.setItem("disposable-cache", "x".repeat(500));
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "__ma_quota_probe__" && this.getItem("disposable-cache")) {
        throw new DOMException("Full", "QuotaExceededError");
      }
      original.call(this, key, value);
    });
    expect(ensureStorageHeadroom()).toBe(true);
    expect(localStorage.getItem("disposable-cache")).toBeNull();
    expect(JSON.parse(localStorage.getItem(AI_RENDER_DRAFT_KEY) || "null")).toMatchObject({ sourceImage });
    expect(localStorage.getItem("sb-test-auth-token")).toBe("session-placeholder");
  });
});