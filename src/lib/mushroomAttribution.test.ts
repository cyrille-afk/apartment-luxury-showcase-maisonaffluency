import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { formatCuratorialEditionLine } from "./editionLabel";

async function mushroom() {
  const { data, error } = await supabase
    .from("designer_curator_picks_public")
    .select("id, designer_id, slug, edition")
    .eq("id", "4da78c41-cc8a-4e1c-a1be-9ec530ad4e26")
    .single();
  if (error) throw error;
  return data;
}

describe("Mushroom rug attribution", () => {
  it("belongs to Emma Donnersberg and retains the rug address", async () => {
    const pick = await mushroom();
    expect(pick.designer_id).toBe("eb7741a8-2b2c-4619-9746-37d2cfda0ec8");
    expect(pick.slug).toBe("mushroom");
  });

  it("carries the CC-Tapis Edition card label", async () => {
    expect(formatCuratorialEditionLine(await mushroom())).toBe("CC-Tapis Edition");
  });
});