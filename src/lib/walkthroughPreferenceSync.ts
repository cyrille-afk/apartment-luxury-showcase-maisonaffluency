import { supabase } from "@/integrations/supabase/client";
import { parseRemotePreferences, type WalkthroughPreferences } from "@/lib/cinematicPlayback";

export type SyncedPreferences = WalkthroughPreferences & { customPathId: string | null };

export async function fetchRemoteWalkthroughPreferences(): Promise<SyncedPreferences | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from("user_walkthrough_preferences")
    .select("preset, custom_path_id, speed, loop").eq("user_id", session.user.id).maybeSingle();
  if (error) throw error;
  return parseRemotePreferences(data);
}

export async function pushRemoteWalkthroughPreferences(p: SyncedPreferences) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { error } = await supabase.from("user_walkthrough_preferences").upsert({
    user_id: session.user.id, preset: p.preset, speed: p.speed, loop: p.loop,
    custom_path_id: p.customPathId, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
