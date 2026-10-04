import { supabase } from "@/integrations/supabase/client";
import { onboardingProjectForMarket } from "@/lib/onboardingProject";
import type { TradeOfficeMarket } from "@/hooks/useTradeOfficeMarket";

/** Curated catalogue pieces used to pre-populate a new user's sample board. */
const SAMPLE_PRODUCT_IDS = [
  "2816322a-94f6-49e7-a70f-4a8c15292d5a", // Frenchmen Street Lounge Chair
  "ffd33487-bb3d-4d18-80ee-1e35b858738e", // Sandy Cove Sofa
  "f198902d-aa9e-41d8-8630-bad4226aaa45", // Praia da Granja Coffee Table
  "8a072491-e699-44ee-ac6b-51838d7514ed", // Madison Avenue Side Table
  "163af529-08b9-4391-9a48-03663261c085", // Cinnamon Gardens Floor Lamp
];

/**
 * Returns the user's most recent board; if they have none, creates a sample
 * project + board pre-filled with catalogue pieces so every tour lands on a
 * real canvas. Returns null only if creation fails.
 */
export async function ensureSampleBoard(market: TradeOfficeMarket = null, studioId: string | null = null): Promise<{ id: string; project_id: string | null } | null> {
  const { data: existing } = await supabase
    .from("client_boards")
    .select("id, project_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing as any;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const sample = onboardingProjectForMarket(market);
  let projectQuery = supabase.from("projects").select("id")
    .eq("user_id", uid).eq("name", sample.name).limit(1);
  projectQuery = studioId ? projectQuery.eq("studio_id", studioId) : projectQuery.is("studio_id", null);
  const { data: existingProject } = await projectQuery.maybeSingle();
  let projectId = existingProject?.id ?? null;
  if (!projectId) {
    const { data: project } = await supabase.from("projects")
      .insert({ user_id: uid, studio_id: studioId, name: sample.name, location: sample.location, client_name: "Sample Client" })
      .select("id").single();
    projectId = project?.id ?? null;
  }

  const { data: board, error } = await supabase
    .from("client_boards")
    .insert({
      user_id: uid,
      project_id: projectId,
      title: "Living Room — Sample Board",
      client_name: "Sample Client",
      hide_maison_branding: false,
    } as any)
    .select("id, project_id")
    .single();
  if (error || !board) return null;

  await supabase.from("client_board_items").insert(
    SAMPLE_PRODUCT_IDS.map((product_id, i) => ({
      board_id: (board as any).id,
      product_id,
      sort_order: i,
      added_by: uid,
    })) as any,
  );
  return board as any;
}
