import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { isChildBrandDesigner } from "./designerHierarchy";

describe("Independent designer collection ownership", () => {
  it("keeps Gilles & Boissier independent of Pouenat in the live catalogue", async () => {
    const { data, error } = await supabase.from("designers")
      .select("name, founder, is_independent")
      .eq("slug", "gilles-boissier").single();
    expect(error).toBeNull();
    expect(data?.name).toBe("Gilles & Boissier");
    expect(data?.is_independent).toBe(true);
    expect(isChildBrandDesigner(data)).toBe(false);
  });

  it("excludes independent portfolios but retains genuine house children", () => {
    const designer = { name: "Gilles & Boissier", founder: "Pouenat" };
    expect(isChildBrandDesigner({ ...designer, is_independent: true })).toBe(false);
    expect(isChildBrandDesigner({ ...designer, is_independent: false })).toBe(true);
  });
});