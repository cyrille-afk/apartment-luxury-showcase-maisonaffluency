import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { formatCuratorialEditionLine } from "./editionLabel";

const MUSHROOM_ID = "4da78c41-cc8a-4e1c-a1be-9ec530ad4e26";

describe("Mushroom rug attribution", () => {
  it("stays out of the public catalogue while Emma Donnersberg is trade-only", async () => {
    const { data, error } = await supabase
      .from("designer_curator_picks_public")
      .select("id")
      .eq("id", MUSHROOM_ID);
    if (error) throw error;
    expect(data).toEqual([]);
  });

  it("carries the CC-Tapis Edition card label", () => {
    expect(
      formatCuratorialEditionLine({
        id: MUSHROOM_ID,
        designer_id: "eb7741a8-2b2c-4619-9746-37d2cfda0ec8",
        slug: "mushroom",
        edition: "CC-Tapis Edition",
      }),
    ).toBe("CC-Tapis Edition");
  });
});
