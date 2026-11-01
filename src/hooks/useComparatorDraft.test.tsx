import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { comparatorDraftKey } from "@/lib/comparatorDraft";
import { useComparatorDraft } from "./useComparatorDraft";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
      upsert: async () => ({ data: null, error: null }),
    };
    return query;
  } },
}));

const product = { id: "dais", product_name: "Dais Lounge Chair", brand_name: "Man of Parts", category: "Seating", tags: [], image_url: null };
describe("comparator draft persistence", () => {
  beforeEach(() => localStorage.clear());
  it("restores ordered selections and unfinished controls after remount without saving a shortlist", async () => {
    const first = renderHook(() => useComparatorDraft("cyrille", null));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.setDraft(d => ({ ...d, compareList: [product, { ...product, id: "ondas", product_name: "Ondas" }], shortlistName: "Singapore", search: "Man", source: "favorites", letter: "M", openDesigners: ["Man of Parts"] })));
    first.unmount();
    const restored = renderHook(() => useComparatorDraft("cyrille", null));
    await waitFor(() => expect(restored.result.current.ready).toBe(true));
    expect(restored.result.current.draft.compareList.map(p => p.id)).toEqual(["dais", "ondas"]);
    expect(restored.result.current.draft).toMatchObject({ shortlistName: "Singapore", search: "Man", source: "favorites", letter: "M", openDesigners: ["Man of Parts"] });
  });
  it("persists removals including clearing the last piece", async () => {
    const first = renderHook(() => useComparatorDraft("cyrille", null));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.setDraft(d => ({ ...d, compareList: [product] })));
    act(() => first.result.current.setDraft(d => ({ ...d, compareList: [] })));
    first.unmount();
    const restored = renderHook(() => useComparatorDraft("cyrille", null));
    await waitFor(() => expect(restored.result.current.ready).toBe(true));
    expect(restored.result.current.draft.compareList).toEqual([]);
  });
  it("does not overwrite a stored draft while waiting for the account or expose it to another account", async () => {
    const key = comparatorDraftKey("cyrille", null);
    const raw = JSON.stringify({ compareList: [product] });
    localStorage.setItem(key, raw);
    const initialProps: { user: string | undefined } = { user: undefined };
    const hook = renderHook(({ user }: { user: string | undefined }) => useComparatorDraft(user, null), { initialProps });
    expect(localStorage.getItem(key)).toBe(raw);
    hook.rerender({ user: "cyrille" });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.draft.compareList[0]?.id).toBe("dais");
    hook.rerender({ user: "other" });
    expect(hook.result.current.draft.compareList).toEqual([]);
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.draft.compareList).toEqual([]);
  });
  it("keeps saved-shortlist drafts separate and excludes prices from storage", async () => {
    const hook = renderHook(() => useComparatorDraft("cyrille", "saved-a"));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => hook.result.current.setDraft(d => ({ ...d, compareList: [{ ...product, trade_price_cents: 999 }] })));
    const stored = JSON.parse(localStorage.getItem(comparatorDraftKey("cyrille", "saved-a")) || "{}");
    expect(stored.compareList[0].trade_price_cents).toBeUndefined();
    const working = renderHook(() => useComparatorDraft("cyrille", null));
    await waitFor(() => expect(working.result.current.ready).toBe(true));
    expect(working.result.current.draft.compareList).toEqual([]);
  });
  it("recovers from malformed storage", async () => {
    localStorage.setItem(comparatorDraftKey("cyrille", null), "{");
    const hook = renderHook(() => useComparatorDraft("cyrille", null));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.draft.compareList).toEqual([]);
  });
});