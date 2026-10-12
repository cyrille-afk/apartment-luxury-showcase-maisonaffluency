import { describe, it, expect, beforeEach } from "vitest";
import { saveView, readSavedViews, deleteView } from "@/lib/tradeSavedViews";

const base = { search: "fuga", brand: "all", category: "Rugs", subcategory: "all", edition: "CC-Tapis Edition", sortBy: "title" as const };

describe("trade saved views", () => {
  beforeEach(() => localStorage.clear());

  it("stores the full search/filter/sort combination", () => {
    saveView({ ...base, name: "Rugs" });
    const [v] = readSavedViews();
    expect(v).toMatchObject({ ...base, name: "Rugs" });
  });

  it("replaces a view with the same name", () => {
    saveView({ ...base, name: "Rugs" });
    saveView({ ...base, name: "rugs", search: "mushroom" });
    const views = readSavedViews();
    expect(views).toHaveLength(1);
    expect(views[0].search).toBe("mushroom");
  });

  it("deletes a view", () => {
    const [v] = saveView({ ...base, name: "Rugs" });
    expect(deleteView(v.id)).toHaveLength(0);
  });
});
