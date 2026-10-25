import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { comparatorDraftKey } from "@/lib/comparatorDraft";
import { useComparatorDraft } from "./useComparatorDraft";

const product = { id: "dais", product_name: "Dais Lounge Chair", brand_name: "Man of Parts", category: "Seating", tags: [], image_url: null };
describe("comparator draft persistence", () => {
  beforeEach(() => localStorage.clear());
  it("restores ordered selections and unfinished controls after remount without saving a shortlist", () => {
    const first = renderHook(() => useComparatorDraft("cyrille", null));
    act(() => first.result.current.setDraft(d => ({ ...d, compareList: [product, { ...product, id: "ondas", product_name: "Ondas" }], shortlistName: "Singapore", search: "Man", source: "favorites", letter: "M", openDesigners: ["Man of Parts"] })));
    first.unmount();
    const restored = renderHook(() => useComparatorDraft("cyrille", null));
    expect(restored.result.current.draft.compareList.map(p => p.id)).toEqual(["dais", "ondas"]);
    expect(restored.result.current.draft).toMatchObject({ shortlistName: "Singapore", search: "Man", source: "favorites", letter: "M", openDesigners: ["Man of Parts"] });
  });
  it("persists removals including clearing the last piece", () => {
    const first = renderHook(() => useComparatorDraft("cyrille", null));
    act(() => first.result.current.setDraft(d => ({ ...d, compareList: [product] })));
    act(() => first.result.current.setDraft(d => ({ ...d, compareList: [] })));
    first.unmount();
    expect(renderHook(() => useComparatorDraft("cyrille", null)).result.current.draft.compareList).toEqual([]);
  });
  it("does not overwrite a stored draft while waiting for the account or expose it to another account", () => {
    const key = comparatorDraftKey("cyrille", null);
    const raw = JSON.stringify({ compareList: [product] });
    localStorage.setItem(key, raw);
    const initialProps: { user: string | undefined } = { user: undefined };
    const hook = renderHook(({ user }: { user: string | undefined }) => useComparatorDraft(user, null), { initialProps });
    expect(localStorage.getItem(key)).toBe(raw);
    hook.rerender({ user: "cyrille" });
    expect(hook.result.current.draft.compareList[0]?.id).toBe("dais");
    hook.rerender({ user: "other" });
    expect(hook.result.current.draft.compareList).toEqual([]);
  });
  it("keeps saved-shortlist drafts separate and excludes prices from storage", () => {
    const hook = renderHook(() => useComparatorDraft("cyrille", "saved-a"));
    act(() => hook.result.current.setDraft(d => ({ ...d, compareList: [{ ...product, trade_price_cents: 999 }] })));
    const stored = JSON.parse(localStorage.getItem(comparatorDraftKey("cyrille", "saved-a")) || "{}");
    expect(stored.compareList[0].trade_price_cents).toBeUndefined();
    expect(renderHook(() => useComparatorDraft("cyrille", null)).result.current.draft.compareList).toEqual([]);
  });
  it("recovers from malformed storage", () => {
    localStorage.setItem(comparatorDraftKey("cyrille", null), "{");
    expect(renderHook(() => useComparatorDraft("cyrille", null)).result.current.draft.compareList).toEqual([]);
  });
});