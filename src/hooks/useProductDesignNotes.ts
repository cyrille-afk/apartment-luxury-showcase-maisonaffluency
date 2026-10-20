import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DesignNoteSection {
  label: "Form" | "Function" | "Texture" | "Colour";
  text: string;
}

/** Hand-written per-product design notes. Returns [] when none are recorded. */
export function useProductDesignNotes(pickId: string | null | undefined): DesignNoteSection[] {
  const [sections, setSections] = useState<DesignNoteSection[]>([]);
  useEffect(() => {
    let cancelled = false;
    setSections([]);
    if (!pickId) return;
    (supabase as any)
      .from("product_design_notes")
      .select("form, function, texture, colour")
      .eq("pick_id", pickId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (cancelled || !data) return;
        const list: DesignNoteSection[] = [
          { label: "Form", text: data.form },
          { label: "Function", text: data.function },
          { label: "Texture", text: data.texture },
          { label: "Colour", text: data.colour },
        ].filter((s) => typeof s.text === "string" && s.text.trim()) as DesignNoteSection[];
        setSections(list);
      });
    return () => { cancelled = true; };
  }, [pickId]);
  return sections;
}
