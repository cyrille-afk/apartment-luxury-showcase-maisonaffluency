import { describe, expect, it, vi } from "vitest";

const { calls, query } = vi.hoisted(() => {
  const calls: Array<[string, ...unknown[]]> = [];
  const query: Record<string, unknown> = {};
  for (const name of ["select", "order", "range", "eq", "or", "not", "neq"]) {
    query[name] = (...args: unknown[]) => { calls.push([name, ...args]); return query; };
  }
  query.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  return { calls, query };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => query } }));
import { fetchLiveCatalogue } from "./mockAiLayoutService";

describe("3D-ready catalogue scope", () => {
  it("All projects queries all active visible model-bearing products without an eight-ID restriction", async () => {
    await fetchLiveCatalogue();
    expect(calls).toContainEqual(["not", "glb_url", "is", null]);
    expect(calls).toContainEqual(["eq", "is_active", true]);
    expect(calls.filter(([name]) => name === "or")).toEqual([["or", "is_hidden.is.null,is_hidden.eq.false"]]);
    expect(calls).toContainEqual(["range", 0, 249]);
  });
});