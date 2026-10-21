import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { formatCuratorialEditionLine } from "./editionLabel";

const MUSHROOM_ID = "4da78c41-cc8a-4e1c-a1be-9ec530ad4e26";

describe("Mushroom rug attribution", () => {
  // Emma Donnersberg is public again (Oct 2026); only her Michel Amar
  // collaborations stay Trade-only, so the CC-Tapis Mushroom rug is public.
  it("is listed in the public catalogue now that Emma Donnersberg is public", async () => {
    const { data, error } = await supabase
      .from("designer_curator_picks_public")
      .select("id")
      .eq("id", MUSHROOM_ID);
    if (error) throw error;
    expect(data).toEqual([{ id: MUSHROOM_ID }]);
  });

  it("carries the CC-Tapis Edition card label", () => {
    expect(
      formatCuratorialEditionLine({ edition: "CC-Tapis Edition" }),
    ).toBe("CC-Tapis Edition");
  });
});
